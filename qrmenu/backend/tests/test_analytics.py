from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import update

from app.core.db import SessionLocal
from app.models import Order
from app.services.analytics import daypart
from tests.test_orders import key, line, seed

API = "/api/admin"


async def place(guest_client, item, language, qty=1):
    resp = await guest_client.post(
        "/api/guest/orders",
        json={"items": [line(item, qty=qty)], "language": language},
        headers=key(),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def move(order_id: int, local: datetime) -> None:
    async with SessionLocal() as db:
        await db.execute(update(Order).where(Order.id == order_id).values(created_at=local.astimezone(UTC)))
        await db.commit()


async def test_order_remembers_language(admin_client, guest_client):
    _, item, _ = await seed(admin_client, guest_client)
    assert (await place(guest_client, item, "en"))["language"] == "en"
    # a language the restaurant doesn't offer counts as the main one (Vietnamese by default)
    assert (await place(guest_client, item, "xx"))["language"] == "vi"


async def test_analytics(admin_client, guest_client):
    _, item, _ = await seed(admin_client, guest_client)
    settings = (await admin_client.get(f"{API}/settings")).json()
    tz = ZoneInfo(settings["timezone"])
    today = datetime.now(tz).replace(minute=0, second=0, microsecond=0)
    morning = today.replace(hour=9)
    evening = today.replace(hour=19)

    a = await place(guest_client, item, "ru", qty=2)  # 150 000
    b = await place(guest_client, item, "en")  # 75 000
    c = await place(guest_client, item, "en")
    rejected = await place(guest_client, item, "en", qty=5)
    await move(a["id"], morning)
    await move(b["id"], evening)
    await move(c["id"], evening)
    await move(rejected["id"], evening)
    await admin_client.post(f"{API}/orders/{rejected['id']}/status", json={"status": "rejected"})

    data = (await admin_client.get(f"{API}/analytics")).json()
    assert data["summary"] == {"orders": 3, "revenue": 300000, "avg_check": 100000, "items": 4, "visits": 1}
    hours = {h["hour"]: h["orders"] for h in data["by_hour"]}
    assert len(hours) == 24 and hours[9] == 1 and hours[19] == 2
    weekday = morning.isoweekday()
    assert {"weekday": weekday, "hour": 19, "orders": 2} in data["heatmap"]
    assert len(data["by_day"]) == 30 and data["by_day"][-1]["orders"] == 3

    assert data["top_items"][0]["quantity"] == 4
    parts = {p["key"]: p for p in data["dayparts"]}
    assert parts["morning"]["orders"] == 1 and parts["morning"]["top_items"][0]["quantity"] == 2
    assert parts["evening"]["orders"] == 2 and parts["lunch"]["top_items"] == []

    langs = {l["language"]: l for l in data["languages"]}
    assert langs["en"]["orders"] == 2 and round(langs["en"]["share"], 2) == 0.67
    assert langs["ru"]["revenue"] == 150000
    assert data["languages"][0]["language"] == "en"  # most orders first


async def test_period_and_permissions(admin_client, waiter_client):
    today = datetime.now(UTC).date()
    resp = await admin_client.get(f"{API}/analytics", params={"from": str(today - timedelta(days=6)), "to": str(today)})
    assert resp.status_code == 200
    assert len(resp.json()["by_day"]) == 7
    bad = await admin_client.get(f"{API}/analytics", params={"from": str(today), "to": str(today - timedelta(days=1))})
    assert bad.status_code == 422
    long = await admin_client.get(f"{API}/analytics", params={"from": "2020-01-01", "to": str(today)})
    assert long.json()["detail"] == "period_too_long"
    assert (await waiter_client.get(f"{API}/analytics")).status_code == 403


def test_dayparts():
    assert [daypart(h) for h in (6, 10, 11, 14, 15, 17, 18, 21, 22, 2)] == [
        "morning", "morning", "lunch", "lunch", "afternoon", "afternoon", "evening", "evening", "night", "night"
    ]


async def test_demo_seed_fills_everything(admin_client, monkeypatch):
    from app.demo.__main__ import seed as demo_seed
    from app.demo import __main__ as demo

    monkeypatch.setattr(demo, "DAYS", 2)  # keep the test fast
    await demo_seed(reset=True, if_empty=False)

    settings = (await admin_client.get(f"{API}/settings")).json()
    assert settings["default_language"] == "vi"
    assert settings["languages"] == ["vi", "en", "ru", "ja", "ko", "zh"]
    menu = (await admin_client.get(f"{API}/menu")).json()
    assert len(menu["items"]) >= 20
    assert all(set(i["name"]) == {"vi", "en", "ru", "ja", "ko", "zh"} for i in menu["items"])
    hall = (await admin_client.get(f"{API}/hall")).json()
    assert {t["state"] for t in hall} >= {"new_order", "waiter", "bill", "occupied"}
    analytics = (await admin_client.get(f"{API}/analytics")).json()
    assert analytics["summary"]["orders"] > 20
    assert len(analytics["languages"]) == 6
