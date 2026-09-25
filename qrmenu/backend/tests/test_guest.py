from datetime import UTC, datetime, time, timedelta

from sqlalchemy import update

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import TableSession
from app.services.schedule import in_window
from tests.test_menu import make_category, make_item

API = "/api/admin"
COOKIE = get_settings().guest_cookie_name


async def make_table(admin_client, number="5", **kwargs):
    resp = await admin_client.post(f"{API}/tables", json={"number": number, **kwargs})
    assert resp.status_code == 201
    return resp.json()


async def scan(guest_client, token):
    return await guest_client.get(f"/t/{token}")


async def session_info(guest_client):
    resp = await guest_client.get("/api/guest/session")
    assert resp.status_code == 200
    return resp.json()


# --- QR scan & sessions ---


async def test_scan_starts_session(admin_client, guest_client):
    table = await make_table(admin_client)
    resp = await scan(guest_client, table["token"])
    assert resp.status_code == 303
    assert resp.headers["location"] == "/"
    cookie = resp.headers["set-cookie"].lower()
    assert f"{COOKIE}=" in cookie
    assert "httponly" in cookie and "secure" in cookie and "samesite=lax" in cookie

    info = await session_info(guest_client)
    assert info["status"] == "active"
    assert info["table"] == {"number": "5"}
    expires = datetime.fromisoformat(info["expires_at"])
    remaining = expires - datetime.now(UTC)
    assert timedelta(minutes=179) < remaining <= timedelta(minutes=180)


async def test_no_cookie_means_no_session(guest_client):
    assert (await session_info(guest_client))["status"] is None


async def test_tampered_cookie_is_ignored(guest_client):
    guest_client.cookies.set(COOKIE, "not-a-jwt")
    assert (await session_info(guest_client))["status"] is None


async def test_unknown_qr(guest_client):
    resp = await scan(guest_client, "nope-nope-nope-nope")
    assert resp.status_code == 303
    assert resp.headers["location"] == "/?error=invalid_qr"
    assert "set-cookie" not in resp.headers


async def test_regenerated_qr_stops_working(admin_client, guest_client):
    table = await make_table(admin_client)
    await admin_client.post(f"{API}/tables/{table['id']}/regenerate-token")
    resp = await scan(guest_client, table["token"])
    assert resp.headers["location"] == "/?error=invalid_qr"


async def test_inactive_table(admin_client, guest_client):
    table = await make_table(admin_client, is_active=False)
    resp = await scan(guest_client, table["token"])
    assert resp.headers["location"] == "/?error=table_inactive"


async def test_table_disabled_during_session(admin_client, guest_client):
    table = await make_table(admin_client)
    await scan(guest_client, table["token"])
    await admin_client.patch(f"{API}/tables/{table['id']}", json={"is_active": False})
    assert (await session_info(guest_client))["status"] == "table_inactive"


async def test_session_expires(admin_client, guest_client):
    table = await make_table(admin_client)
    await scan(guest_client, table["token"])
    async with SessionLocal() as db:
        await db.execute(
            update(TableSession).values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
        await db.commit()
    info = await session_info(guest_client)
    assert info["status"] == "expired"
    assert info["table"] == {"number": "5"}  # still known, so the guest can be told to rescan

    # menu stays viewable
    assert (await guest_client.get("/api/guest/menu")).status_code == 200

    # rescanning starts a fresh session
    await scan(guest_client, table["token"])
    assert (await session_info(guest_client))["status"] == "active"


async def test_closed_session(admin_client, guest_client):
    table = await make_table(admin_client)
    await scan(guest_client, table["token"])
    async with SessionLocal() as db:
        await db.execute(update(TableSession).values(closed_at=datetime.now(UTC)))
        await db.commit()
    assert (await session_info(guest_client))["status"] == "closed"


async def test_ttl_comes_from_settings(admin_client, guest_client):
    settings = (await admin_client.get(f"{API}/settings")).json()
    settings["session_ttl_minutes"] = 1
    resp = await admin_client.put(f"{API}/settings", json=settings)
    assert resp.status_code == 200, resp.text

    table = await make_table(admin_client)
    await scan(guest_client, table["token"])
    info = await session_info(guest_client)
    remaining = datetime.fromisoformat(info["expires_at"]) - datetime.now(UTC)
    assert timedelta(seconds=50) < remaining <= timedelta(minutes=1)


async def test_each_phone_gets_its_own_session(admin_client, guest_client):
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    table = await make_table(admin_client)
    await scan(guest_client, table["token"])
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as phone2:
        await scan(phone2, table["token"])
        assert (await session_info(phone2))["status"] == "active"
    async with SessionLocal() as db:
        from sqlalchemy import func, select

        assert await db.scalar(select(func.count()).select_from(TableSession)) == 2


# --- guest menu ---


async def test_guest_menu_filters(admin_client, guest_client):
    eggs = await make_category(admin_client, "Яйца")
    hidden = await make_category(admin_client, "Скрытая")
    await admin_client.patch(f"{API}/categories/{hidden['id']}", json={"is_enabled": False})
    await make_item(admin_client, hidden["id"], "Невидимка")
    empty = await make_category(admin_client, "Пустая")  # noqa: F841 - no items, not shown

    on = await make_item(admin_client, eggs["id"], "Шакшука")
    off = await make_item(admin_client, eggs["id"], "Выключено")
    await admin_client.patch(f"{API}/items/{off['id']}", json={"is_enabled": False})
    sold_out = await make_item(admin_client, eggs["id"], "Закончилось")
    await admin_client.patch(f"{API}/items/{sold_out['id']}", json={"is_available": False})

    menu = (await guest_client.get("/api/guest/menu")).json()
    assert [c["name"]["ru"] for c in menu["categories"]] == ["Яйца"]
    items = menu["categories"][0]["items"]
    assert [(i["id"], i["is_available"]) for i in items] == [(on["id"], True), (sold_out["id"], False)]
    assert items[0]["prices"][0]["amount"] == 75000
    assert menu["restaurant"]["currency"] == "VND"
    assert menu["restaurant"]["languages"] == ["vi", "en", "ru", "ja", "ko", "zh"]


async def test_guest_menu_includes_only_used_modifier_groups(admin_client, guest_client):
    from tests.test_menu import make_group

    cat = await make_category(admin_client)
    used = await make_group(admin_client)
    await make_group(admin_client, name={"ru": "Лишняя"})
    await make_item(admin_client, cat["id"], modifier_group_ids=[used["id"]])

    menu = (await guest_client.get("/api/guest/menu")).json()
    assert [g["id"] for g in menu["modifier_groups"]] == [used["id"]]
    assert len(menu["modifier_groups"][0]["modifiers"]) == 2


async def test_guest_menu_schedule(admin_client, guest_client):
    from zoneinfo import ZoneInfo

    settings = (await admin_client.get(f"{API}/settings")).json()
    now = datetime.now(ZoneInfo(settings["timezone"]))
    in_an_hour = (now + timedelta(hours=1)).strftime("%H:%M")
    in_two_hours = (now + timedelta(hours=2)).strftime("%H:%M")
    an_hour_ago = (now - timedelta(hours=1)).strftime("%H:%M")

    later = await make_category(
        admin_client, "Позже", available_from=in_an_hour, available_to=in_two_hours
    )
    current = await make_category(
        admin_client, "Сейчас", available_from=an_hour_ago, available_to=in_an_hour
    )
    await make_item(admin_client, later["id"])
    await make_item(admin_client, current["id"])

    menu = (await guest_client.get("/api/guest/menu")).json()
    assert [c["name"]["ru"] for c in menu["categories"]] == ["Сейчас"]


def test_schedule_window():
    assert in_window(time(18, 30), time(18, 0), time(23, 59))
    assert in_window(time(23, 59, 40), time(18, 0), time(23, 59))  # end minute is inclusive
    assert not in_window(time(17, 59), time(18, 0), time(23, 59))
    # crossing midnight
    assert in_window(time(23, 0), time(22, 0), time(2, 0))
    assert in_window(time(1, 0), time(22, 0), time(2, 0))
    assert not in_window(time(12, 0), time(22, 0), time(2, 0))


# --- settings ---


async def test_settings_update_and_validation(admin_client, waiter_client):
    base = (await admin_client.get(f"{API}/settings")).json()
    body = {**base, "languages": ["en", "vi", "ru"], "default_language": "ru", "currency": "RUB"}
    resp = await admin_client.put(f"{API}/settings", json=body)
    assert resp.status_code == 200, resp.text
    assert resp.json()["languages"] == ["ru", "en", "vi"]  # default moved first

    bad = [
        {**base, "default_language": "de"},
        {**base, "timezone": "Mars/Olympus"},
        {**base, "currency": "rub"},
        {**base, "session_ttl_minutes": 0},
        {**base, "languages": []},
    ]
    for body in bad:
        assert (await admin_client.put(f"{API}/settings", json=body)).status_code == 422, body

    assert (await waiter_client.put(f"{API}/settings", json=base)).status_code == 403
