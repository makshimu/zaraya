import asyncio

import pytest

from app.services import telegram
from tests.test_guest import make_table
from tests.test_hall import call
from tests.test_orders import line, order, seed

API = "/api/admin"
TOKEN = "123456789:" + "A" * 35


@pytest.fixture
def sent(monkeypatch):
    """Capture Telegram messages instead of calling the real API."""
    messages = []

    async def fake_send(token, chat_id, text):
        messages.append({"token": token, "chat_id": chat_id, "text": text})

    monkeypatch.setattr(telegram, "send", fake_send)
    return messages


async def enable_telegram(admin_client, **extra):
    settings = (await admin_client.get(f"{API}/settings")).json()
    # Russian as the main language: the messages below are checked in Russian
    body = {**settings, "default_language": "ru", "telegram_enabled": True, "telegram_chat_id": "-100123", "telegram_bot_token": TOKEN, **extra}
    return await admin_client.put(f"{API}/settings", json=body)


async def flush():
    await asyncio.sleep(0.05)  # let the fire-and-forget task run


async def test_token_is_write_only(admin_client):
    resp = await enable_telegram(admin_client)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["telegram_token_set"] is True
    assert "telegram_bot_token" not in data
    assert TOKEN not in (await admin_client.get(f"{API}/settings")).text

    # saving without the token keeps it
    settings = data | {"session_ttl_minutes": 90}
    assert (await admin_client.put(f"{API}/settings", json=settings)).json()["telegram_token_set"] is True
    # "" removes it; enabled without a token is refused
    cleared = await admin_client.put(f"{API}/settings", json=settings | {"telegram_bot_token": ""})
    assert cleared.status_code == 422
    assert cleared.json()["detail"] == "telegram_not_configured"
    off = settings | {"telegram_enabled": False, "telegram_bot_token": ""}
    assert (await admin_client.put(f"{API}/settings", json=off)).json()["telegram_token_set"] is False


async def test_bad_token_or_chat_rejected(admin_client):
    assert (await enable_telegram(admin_client, telegram_bot_token="not-a-token")).status_code == 422
    assert (await enable_telegram(admin_client, telegram_chat_id="chat")).status_code == 422


async def test_new_order_and_calls_go_to_telegram(admin_client, guest_client, sent):
    table, item, group = await seed(admin_client, guest_client, confirm_first=True)
    await enable_telegram(admin_client)
    await order(guest_client, line(item, group, size=1, mods=(1,), qty=2, comment="без лука"), comment="<быстро>")
    await flush()
    assert len(sent) == 1
    text = sent[0]["text"]
    assert sent[0]["chat_id"] == "-100123" and sent[0]["token"] == TOKEN
    assert "Стол 5" in text and "заказ №1" in text
    assert "ждёт подтверждения" in text
    assert "2× Шакшука + Бекон" in text and "«без лука»" in text
    assert "&lt;быстро&gt;" in text  # guest text is escaped for Telegram HTML
    assert "230 000 VND" in text

    await call(guest_client, "bill", "card")
    await flush()
    assert sent[-1]["text"] == "🧾 <b>Стол 5</b> просит счёт (карта)"


async def test_nothing_sent_when_disabled(admin_client, guest_client, sent):
    _, item, _ = await seed(admin_client, guest_client)
    await order(guest_client, line(item))
    await call(guest_client)
    await flush()
    assert sent == []


async def test_telegram_test_button(admin_client, sent, monkeypatch):
    assert (await admin_client.post(f"{API}/settings/telegram-test")).status_code == 422
    await enable_telegram(admin_client)
    assert (await admin_client.post(f"{API}/settings/telegram-test")).status_code == 204
    assert "подключены" in sent[-1]["text"]

    async def failing(*_):
        raise telegram.TelegramError("Bad Request: chat not found")

    monkeypatch.setattr(telegram, "send", failing)
    resp = await admin_client.post(f"{API}/settings/telegram-test")
    assert resp.status_code == 502
    assert resp.json()["detail"] == {"code": "telegram_error", "message": "Bad Request: chat not found"}


async def test_qr_pdf(admin_client, waiter_client):
    hall = (await admin_client.post(f"{API}/halls", json={"name": "Терраса"})).json()
    for n in range(1, 9):
        await make_table(admin_client, number=str(n), hall_id=hall["id"] if n > 6 else None)
    await make_table(admin_client, number="off", is_active=False)

    resp = await admin_client.get(f"{API}/tables/qr.pdf")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content.startswith(b"%PDF")
    assert resp.content.count(b"/Type /Page\n") + resp.content.count(b"/Type /Page ") >= 2  # 8 cards, 6 per page

    only_hall = await admin_client.get(f"{API}/tables/qr.pdf", params={"hall_id": hall["id"]})
    assert only_hall.status_code == 200
    assert len(only_hall.content) < len(resp.content)

    assert (await waiter_client.get(f"{API}/tables/qr.pdf")).status_code == 403
