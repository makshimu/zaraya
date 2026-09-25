from datetime import UTC, datetime, timedelta

from sqlalchemy import update

from app.core.db import SessionLocal
from app.models import ServiceCall
from tests.test_guest import make_table, scan, session_info
from tests.test_orders import line, order, seed

API = "/api/admin"


async def call(guest_client, type_="waiter", method=None):
    body = {"type": type_}
    if method:
        body["payment_method"] = method
    return await guest_client.post("/api/guest/calls", json=body)


async def hall_state(admin_client, number="5"):
    tables = (await admin_client.get(f"{API}/hall")).json()
    return next(t for t in tables if t["number"] == number)


async def set_settings(admin_client, **changes):
    settings = (await admin_client.get(f"{API}/settings")).json()
    await admin_client.put(f"{API}/settings", json={**settings, **changes})


# --- guest calls ---


async def test_call_waiter_lights_up_the_table(admin_client, guest_client):
    table = await make_table(admin_client)
    assert (await hall_state(admin_client))["state"] == "free"
    await scan(guest_client, table["token"])
    state = await hall_state(admin_client)
    assert state["state"] == "occupied"
    assert state["guests"] == 1

    resp = await call(guest_client)
    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "open"
    state = await hall_state(admin_client)
    assert state["state"] == "waiter"
    assert state["open_calls"][0]["type"] == "waiter"
    assert state["open_calls"][0]["table_number"] == "5"


async def test_bill_needs_payment_method_and_wins_over_waiter(admin_client, guest_client):
    table = await make_table(admin_client)
    await scan(guest_client, table["token"])
    assert (await call(guest_client, "bill")).status_code == 422
    assert (await call(guest_client, "waiter", "cash")).status_code == 422
    assert (await call(guest_client, "bill", "crypto")).status_code == 422

    await call(guest_client, "waiter")
    resp = await call(guest_client, "bill", "qr")
    assert resp.status_code == 201
    assert resp.json()["payment_method"] == "qr"
    assert (await hall_state(admin_client))["state"] == "bill"


async def test_call_rate_limit(admin_client, guest_client):
    table = await make_table(admin_client)
    await scan(guest_client, table["token"])
    assert (await call(guest_client)).status_code == 201
    again = await call(guest_client)
    assert again.status_code == 429
    assert again.json()["detail"]["code"] == "too_many_calls"
    assert 0 < again.json()["detail"]["retry_after"] <= 60
    # the bill is limited separately
    assert (await call(guest_client, "bill", "card")).status_code == 201

    async with SessionLocal() as db:
        await db.execute(
            update(ServiceCall).values(created_at=datetime.now(UTC) - timedelta(seconds=61))
        )
        await db.commit()
    assert (await call(guest_client)).status_code == 201


async def test_calls_need_active_session(admin_client, guest_client):
    assert (await call(guest_client)).status_code == 401


async def test_take_call_records_waiter(admin_client, waiter_client, guest_client):
    table = await make_table(admin_client)
    await scan(guest_client, table["token"])
    created = (await call(guest_client)).json()

    open_calls = (await waiter_client.get(f"{API}/calls")).json()
    assert [c["id"] for c in open_calls] == [created["id"]]

    resp = await waiter_client.post(f"{API}/calls/{created['id']}/take")
    assert resp.status_code == 200
    assert resp.json()["status"] == "taken"
    assert resp.json()["taken_by"] == "Waiter"
    # taking it again keeps the first waiter
    again = await admin_client.post(f"{API}/calls/{created['id']}/take")
    assert again.json()["taken_by"] == "Waiter"

    assert (await waiter_client.get(f"{API}/calls")).json() == []
    assert (await hall_state(admin_client))["state"] == "occupied"
    guest_view = (await guest_client.get("/api/guest/calls")).json()
    assert guest_view[0]["status"] == "taken"
    assert "taken_by" not in guest_view[0]


# --- hall & visit ---


async def test_new_order_state_and_visit_details(admin_client, guest_client):
    _, item, _ = await seed(admin_client, guest_client, confirm_first=True)
    placed = (await order(guest_client, line(item, qty=2))).json()
    state = await hall_state(admin_client)
    assert state["state"] == "new_order"
    assert state["pending_orders"] == 1
    assert state["visit_total"] == 150000

    await admin_client.post(f"{API}/orders/{placed['id']}/status", json={"status": "rejected"})
    await admin_client.post(f"{API}/orders/{placed['id']}/status", json={"status": "rejected"})
    second = (await order(guest_client, line(item))).json()
    await admin_client.post(f"{API}/orders/{second['id']}/status", json={"status": "accepted"})
    await call(guest_client, "bill", "cash")

    visit = (await admin_client.get(f"{API}/tables/{state['id']}/visit")).json()
    assert visit["table"]["visit_total"] == 75000  # rejected order doesn't count
    assert [o["id"] for o in visit["orders"]] == [second["id"], placed["id"]]
    assert visit["calls"][0]["payment_method"] == "cash"


async def test_close_table_ends_the_visit(admin_client, waiter_client, guest_client):
    table, item, _ = await seed(admin_client, guest_client)
    placed = (await order(guest_client, line(item))).json()
    await call(guest_client, "bill", "card")

    resp = await waiter_client.post(f"{API}/tables/{table['id']}/close")
    assert resp.status_code == 200
    assert resp.json()["state"] == "free"
    assert resp.json()["guests"] == 0

    # the guest token stops working at once
    assert (await session_info(guest_client))["status"] == "closed"
    blocked = await order(guest_client, line(item))
    assert blocked.status_code == 403
    assert blocked.json()["detail"] == "session_closed"
    assert (await call(guest_client)).status_code == 403

    one = (await admin_client.get(f"{API}/orders/{placed['id']}")).json()
    assert one["status"] == "closed"
    assert one["updated_by"] == "Waiter"
    assert (await admin_client.get(f"{API}/calls")).json() == []
    visit = (await admin_client.get(f"{API}/tables/{table['id']}/visit")).json()
    assert visit["orders"] == [] and visit["calls"] == []

    # a new scan starts a new visit
    await scan(guest_client, table["token"])
    assert (await session_info(guest_client))["status"] == "active"


async def test_table_must_be_open(admin_client, waiter_client, guest_client):
    table, item, _ = await seed(admin_client, guest_client)
    await set_settings(admin_client, require_table_open=True)

    assert (await session_info(guest_client))["status"] == "table_not_open"
    blocked = await order(guest_client, line(item))
    assert blocked.status_code == 403
    assert blocked.json()["detail"] == "session_table_not_open"
    assert (await call(guest_client)).status_code == 403
    # the menu is still there
    assert (await guest_client.get("/api/guest/menu")).status_code == 200

    opened = await waiter_client.post(f"{API}/tables/{table['id']}/open")
    assert opened.status_code == 200
    assert opened.json()["opened_at"] is not None
    assert opened.json()["state"] == "occupied"
    assert (await session_info(guest_client))["status"] == "active"
    assert (await order(guest_client, line(item))).status_code == 201

    # closing the table closes it for the next guests too
    await waiter_client.post(f"{API}/tables/{table['id']}/close")
    await scan(guest_client, table["token"])
    assert (await session_info(guest_client))["status"] == "table_not_open"


async def test_hall_needs_staff(guest_client):
    assert (await guest_client.get(f"{API}/hall")).status_code == 401
