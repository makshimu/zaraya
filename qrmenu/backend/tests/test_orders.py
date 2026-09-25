import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import update

from app.core.db import SessionLocal
from app.models import TableSession
from tests.test_guest import make_table, scan
from tests.test_menu import make_category, make_group, make_item

API = "/api/admin"


def key() -> dict:
    return {"Idempotency-Key": uuid.uuid4().hex}


async def seed(admin_client, guest_client, *, confirm_first=False):
    """Table 5 with a scanned session, a dish with two sizes and a topping group."""
    settings = (await admin_client.get(f"{API}/settings")).json()
    settings["require_first_order_confirmation"] = confirm_first
    await admin_client.put(f"{API}/settings", json=settings)

    table = await make_table(admin_client)
    cat = await make_category(admin_client)
    group = await make_group(admin_client)  # 0..2 of cheese 15000 / bacon 20000
    item = await make_item(
        admin_client,
        cat["id"],
        prices=[{"amount": 75000}, {"amount": 95000}],
        modifier_group_ids=[group["id"]],
    )
    await scan(guest_client, table["token"])
    return table, item, group


def line(item, group=None, *, size=0, mods=(), qty=1, **kw):
    return {
        "item_id": item["id"],
        "price_id": item["prices"][size]["id"],
        "modifier_ids": [group["modifiers"][m]["id"] for m in mods] if group else [],
        "quantity": qty,
        **kw,
    }


async def order(guest_client, *lines, comment="", headers=None):
    return await guest_client.post(
        "/api/guest/orders",
        json={"items": list(lines), "comment": comment},
        headers=headers or key(),
    )


# --- placing orders ---


async def test_backend_prices_the_order(admin_client, guest_client):
    table, item, group = await seed(admin_client, guest_client)
    resp = await order(
        guest_client,
        line(item, group, size=1, mods=(0, 1), qty=2, comment="без лука"),
        line(item, qty=1),
        comment="побыстрее",
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["table_number"] == "5"
    assert data["status"] == "accepted"
    assert data["comment"] == "побыстрее"
    first, second = data["items"]
    assert first["unit_price"] == 95000 + 15000 + 20000
    assert first["total"] == 2 * 130000
    assert first["comment"] == "без лука"
    assert [m["name"]["ru"] for m in first["modifiers"]] == ["Сыр", "Бекон"]
    assert first["modifiers"][0]["group_name"]["ru"] == "Топпинги"
    assert second["unit_price"] == 75000
    assert data["total"] == 260000 + 75000


async def test_order_keeps_snapshot_after_menu_changes(admin_client, guest_client):
    _, item, _ = await seed(admin_client, guest_client)
    placed = (await order(guest_client, line(item))).json()
    await admin_client.put(
        f"{API}/items/{item['id']}",
        json={"category_id": item["category_id"], "name": {"ru": "Новое имя"}, "prices": [{"amount": 1}]},
    )
    orders = (await guest_client.get("/api/guest/orders")).json()
    assert orders[0]["items"][0]["name"]["ru"] == "Шакшука"
    assert orders[0]["items"][0]["unit_price"] == 75000
    assert orders[0]["total"] == placed["total"]


async def test_idempotency_key(admin_client, guest_client):
    _, item, _ = await seed(admin_client, guest_client)
    headers = key()
    first = await order(guest_client, line(item), headers=headers)
    again = await order(guest_client, line(item, qty=5), headers=headers)
    assert first.status_code == 201
    assert again.status_code == 200
    assert again.json()["id"] == first.json()["id"]
    assert len((await guest_client.get("/api/guest/orders")).json()) == 1

    missing = await guest_client.post("/api/guest/orders", json={"items": [line(item)]})
    assert missing.status_code == 422


async def test_first_order_needs_confirmation(admin_client, guest_client):
    _, item, _ = await seed(admin_client, guest_client, confirm_first=True)
    first = (await order(guest_client, line(item))).json()
    second = (await order(guest_client, line(item))).json()
    assert first["status"] == "pending"
    assert second["status"] == "accepted"


async def test_rejected_first_order_keeps_next_one_pending(admin_client, guest_client):
    _, item, _ = await seed(admin_client, guest_client, confirm_first=True)
    first = (await order(guest_client, line(item))).json()
    await admin_client.post(f"{API}/orders/{first['id']}/status", json={"status": "rejected"})
    assert (await order(guest_client, line(item))).json()["status"] == "pending"


async def test_order_validation(admin_client, guest_client):
    _, item, group = await seed(admin_client, guest_client)
    other = await make_item(admin_client, item["category_id"], "Другое")

    async def code(*lines):
        resp = await order(guest_client, *lines)
        assert resp.status_code == 422, resp.text
        return resp.json()["detail"]

    assert (await code(line(item) | {"price_id": other["prices"][0]["id"]}))["code"] == "price_invalid"
    assert (await code(line(item) | {"modifier_ids": [999]}))["code"] == "modifier_invalid"
    dup = group["modifiers"][0]["id"]
    assert (await code(line(item) | {"modifier_ids": [dup, dup]}))["code"] == "modifier_invalid"
    # modifier of a group not attached to this dish
    assert (await code(line(other) | {"modifier_ids": [dup]}))["code"] == "modifier_invalid"
    assert (await code(line(item) | {"item_id": 999}))["code"] == "item_unavailable"

    bad_qty = await order(guest_client, line(item, qty=0))
    assert bad_qty.status_code == 422
    empty = await guest_client.post("/api/guest/orders", json={"items": []}, headers=key())
    assert empty.status_code == 422


async def test_unavailable_things_cannot_be_ordered(admin_client, guest_client):
    _, item, group = await seed(admin_client, guest_client)

    await admin_client.patch(f"{API}/items/{item['id']}", json={"is_available": False})
    resp = await order(guest_client, line(item))
    assert resp.json()["detail"] == {"code": "item_unavailable", "item_id": item["id"]}
    await admin_client.patch(f"{API}/items/{item['id']}", json={"is_available": True})

    await admin_client.patch(f"{API}/categories/{item['category_id']}", json={"is_enabled": False})
    assert (await order(guest_client, line(item))).json()["detail"]["code"] == "item_unavailable"
    await admin_client.patch(f"{API}/categories/{item['category_id']}", json={"is_enabled": True})

    mods = [{"id": m["id"], "name": m["name"], "price": m["price"]} for m in group["modifiers"]]
    mods[0]["is_available"] = False
    await admin_client.put(
        f"{API}/modifier-groups/{group['id']}",
        json={"name": group["name"], "max_select": 2, "modifiers": mods},
    )
    resp = await order(guest_client, line(item, group, mods=(0,)))
    assert resp.json()["detail"]["code"] == "modifier_unavailable"


async def test_required_group_min_max(admin_client, guest_client):
    _, item, _ = await seed(admin_client, guest_client)
    bread = (
        await admin_client.post(
            f"{API}/modifier-groups",
            json={
                "name": {"ru": "Хлеб"},
                "is_required": True,
                "max_select": 1,
                "modifiers": [{"name": {"ru": "Белый"}}, {"name": {"ru": "Ржаной"}}],
            },
        )
    ).json()
    cat_id = item["category_id"]
    dish = await make_item(admin_client, cat_id, "Тост", modifier_group_ids=[bread["id"]])

    none = await order(guest_client, line(dish))
    assert none.json()["detail"]["code"] == "modifier_selection_invalid"
    both = await order(guest_client, line(dish, bread, mods=(0, 1)))
    assert both.json()["detail"]["code"] == "modifier_selection_invalid"
    one = await order(guest_client, line(dish, bread, mods=(1,)))
    assert one.status_code == 201


async def test_session_required(admin_client, guest_client):
    _, item, _ = await seed(admin_client, guest_client)
    guest_client.cookies.clear()
    resp = await order(guest_client, line(item))
    assert resp.status_code == 401
    assert resp.json()["detail"] == "session_required"


async def test_expired_session_blocks_ordering_but_keeps_history(admin_client, guest_client):
    _, item, _ = await seed(admin_client, guest_client)
    await order(guest_client, line(item))
    async with SessionLocal() as db:
        await db.execute(
            update(TableSession).values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
        await db.commit()
    resp = await order(guest_client, line(item))
    assert resp.status_code == 403
    assert resp.json()["detail"] == "session_expired"
    assert len((await guest_client.get("/api/guest/orders")).json()) == 1


async def test_rate_limit(admin_client, guest_client):
    _, item, _ = await seed(admin_client, guest_client)
    for _ in range(10):
        assert (await order(guest_client, line(item))).status_code == 201
    resp = await order(guest_client, line(item))
    assert resp.status_code == 429
    assert resp.json()["detail"]["code"] == "too_many_orders"


async def test_guest_sees_only_own_orders(admin_client, guest_client):
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    table, item, _ = await seed(admin_client, guest_client)
    await order(guest_client, line(item))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as phone2:
        await scan(phone2, table["token"])
        assert (await phone2.get("/api/guest/orders")).json() == []
    assert (await guest_client.get("/api/guest/orders")).json()[0]["table_number"] == "5"


# --- staff side ---


async def test_status_flow(admin_client, waiter_client, guest_client):
    _, item, _ = await seed(admin_client, guest_client, confirm_first=True)
    placed = (await order(guest_client, line(item))).json()
    url = f"{API}/orders/{placed['id']}/status"

    for new in ("accepted", "cooking", "served", "closed"):
        resp = await waiter_client.post(url, json={"status": new})
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == new
        assert resp.json()["updated_by"] == "Waiter"

    back = await waiter_client.post(url, json={"status": "cooking"})
    assert back.status_code == 409
    assert back.json()["detail"] == "invalid_transition"

    guest_view = (await guest_client.get("/api/guest/orders")).json()[0]
    assert guest_view["status"] == "closed"
    assert "updated_by" not in guest_view


async def test_skip_kitchen_and_reject(admin_client, guest_client):
    _, item, _ = await seed(admin_client, guest_client)
    a = (await order(guest_client, line(item))).json()
    b = (await order(guest_client, line(item))).json()
    served = await admin_client.post(f"{API}/orders/{a['id']}/status", json={"status": "served"})
    assert served.json()["status"] == "served"
    rejected = await admin_client.post(f"{API}/orders/{b['id']}/status", json={"status": "rejected"})
    assert rejected.json()["status"] == "rejected"


async def test_edit_items_before_cooking(admin_client, guest_client):
    _, item, group = await seed(admin_client, guest_client)
    placed = (await order(guest_client, line(item, qty=2), line(item, group, mods=(0,)))).json()
    keep, drop = placed["items"]
    url = f"{API}/orders/{placed['id']}/items"

    resp = await admin_client.put(url, json={"items": [{"id": keep["id"], "quantity": 3}]})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert [(i["id"], i["quantity"]) for i in data["items"]] == [(keep["id"], 3)]
    assert data["total"] == 3 * 75000

    bogus = await admin_client.put(url, json={"items": [{"id": drop["id"], "quantity": 1}]})
    assert bogus.status_code == 422

    await admin_client.post(f"{API}/orders/{placed['id']}/status", json={"status": "cooking"})
    late = await admin_client.put(url, json={"items": [{"id": keep["id"], "quantity": 1}]})
    assert late.status_code == 409
    assert late.json()["detail"] == "order_not_editable"


async def test_list_filters(admin_client, guest_client):
    table, item, _ = await seed(admin_client, guest_client)
    other_table = await make_table(admin_client, number="7")
    a = (await order(guest_client, line(item))).json()
    await admin_client.post(f"{API}/orders/{a['id']}/status", json={"status": "served"})
    await scan(guest_client, other_table["token"])
    b = (await order(guest_client, line(item))).json()

    ids = lambda resp: [o["id"] for o in resp.json()]  # noqa: E731
    assert ids(await admin_client.get(f"{API}/orders")) == [b["id"], a["id"]]  # newest first
    assert ids(await admin_client.get(f"{API}/orders", params={"status": "served"})) == [a["id"]]
    assert ids(
        await admin_client.get(f"{API}/orders", params=[("status", "served"), ("status", "accepted")])
    ) == [b["id"], a["id"]]
    assert ids(await admin_client.get(f"{API}/orders", params={"table_id": other_table["id"]})) == [b["id"]]

    settings = (await admin_client.get(f"{API}/settings")).json()
    from zoneinfo import ZoneInfo

    today = datetime.now(ZoneInfo(settings["timezone"])).date()
    assert len((await admin_client.get(f"{API}/orders", params={"date": str(today)})).json()) == 2
    yesterday = today - timedelta(days=1)
    assert (await admin_client.get(f"{API}/orders", params={"date": str(yesterday)})).json() == []

    one = await admin_client.get(f"{API}/orders/{a['id']}")
    assert one.json()["table_number"] == "5"
    assert (await admin_client.get(f"{API}/orders/999")).status_code == 404


async def test_orders_need_staff(guest_client):
    assert (await guest_client.get(f"{API}/orders")).status_code == 401
