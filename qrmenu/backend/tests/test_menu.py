import io
from pathlib import Path

from PIL import Image

from app.core.config import get_settings

API = "/api/admin"


def png_bytes(size=(1600, 900), color=(200, 30, 30)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "PNG")
    return buf.getvalue()


async def make_category(client, name="Яйца", **kwargs):
    resp = await client.post(f"{API}/categories", json={"name": {"ru": name, "en": name}, **kwargs})
    assert resp.status_code == 201, resp.text
    return resp.json()


async def make_group(client, **kwargs):
    body = {
        "name": {"ru": "Топпинги", "en": "Toppings"},
        "min_select": 0,
        "max_select": 2,
        "modifiers": [
            {"name": {"ru": "Сыр", "en": "Cheese"}, "price": 15000},
            {"name": {"ru": "Бекон", "en": "Bacon"}, "price": 20000},
        ],
        **kwargs,
    }
    resp = await client.post(f"{API}/modifier-groups", json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def make_item(client, category_id, name="Шакшука", **kwargs):
    body = {
        "category_id": category_id,
        "name": {"ru": name, "en": name},
        "description": {"ru": "с фетой"},
        "prices": [{"amount": 75000}],
        **kwargs,
    }
    resp = await client.post(f"{API}/items", json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def menu(client):
    resp = await client.get(f"{API}/menu")
    assert resp.status_code == 200
    return resp.json()


# --- categories ---


async def test_category_crud_and_schedule(admin_client):
    cat = await make_category(admin_client)
    assert cat["is_enabled"] is True
    assert cat["available_from"] is None

    resp = await admin_client.put(
        f"{API}/categories/{cat['id']}",
        json={
            "name": {"ru": "Вечернее меню", "en": "Evening", "vi": "  "},
            "available_from": "18:00",
            "available_to": "23:30",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == {"ru": "Вечернее меню", "en": "Evening"}  # empty translations dropped
    assert data["available_from"] == "18:00:00"

    resp = await admin_client.patch(f"{API}/categories/{cat['id']}", json={"is_enabled": False})
    assert resp.json()["is_enabled"] is False

    assert (await admin_client.delete(f"{API}/categories/{cat['id']}")).status_code == 204
    assert (await menu(admin_client))["categories"] == []


async def test_category_validation(admin_client):
    no_name = await admin_client.post(f"{API}/categories", json={"name": {"ru": " "}})
    assert no_name.status_code == 422
    bad_lang = await admin_client.post(f"{API}/categories", json={"name": {"RU!": "x"}})
    assert bad_lang.status_code == 422
    half_schedule = await admin_client.post(
        f"{API}/categories", json={"name": {"ru": "x"}, "available_from": "18:00"}
    )
    assert half_schedule.status_code == 422


async def test_reorder_categories(admin_client):
    a = await make_category(admin_client, "A")
    b = await make_category(admin_client, "B")
    c = await make_category(admin_client, "C")
    assert [x["id"] for x in (await menu(admin_client))["categories"]] == [a["id"], b["id"], c["id"]]

    resp = await admin_client.put(f"{API}/categories/order", json={"ids": [c["id"], a["id"], b["id"]]})
    assert resp.status_code == 204
    assert [x["id"] for x in (await menu(admin_client))["categories"]] == [c["id"], a["id"], b["id"]]

    partial = await admin_client.put(f"{API}/categories/order", json={"ids": [c["id"]]})
    assert partial.status_code == 422


# --- items ---


async def test_item_with_prices_and_modifiers(admin_client):
    cat = await make_category(admin_client)
    group = await make_group(admin_client)
    item = await make_item(
        admin_client,
        cat["id"],
        badges=["spicy", "hit", "spicy"],
        prices=[
            {"name": {"ru": "Маленькая"}, "amount": 65000},
            {"name": {"ru": "Большая"}, "amount": 85000},
        ],
        modifier_group_ids=[group["id"]],
    )
    assert item["badges"] == ["spicy", "hit"]
    assert [p["amount"] for p in item["prices"]] == [65000, 85000]
    # first price becomes the default when none is marked
    assert [p["is_default"] for p in item["prices"]] == [True, False]
    assert item["modifier_group_ids"] == [group["id"]]

    # Update: keep first price by id, drop second, add a new default
    first = item["prices"][0]
    resp = await admin_client.put(
        f"{API}/items/{item['id']}",
        json={
            "category_id": cat["id"],
            "name": item["name"],
            "prices": [
                {"id": first["id"], "name": first["name"], "amount": 70000},
                {"name": {"ru": "XL"}, "amount": 99000, "is_default": True},
            ],
            "modifier_group_ids": [],
        },
    )
    assert resp.status_code == 200, resp.text
    updated = resp.json()
    assert updated["prices"][0]["id"] == first["id"]
    assert [(p["amount"], p["is_default"]) for p in updated["prices"]] == [(70000, False), (99000, True)]
    assert updated["modifier_group_ids"] == []
    assert updated["description"] == {}


async def test_item_validation(admin_client):
    cat = await make_category(admin_client)
    base = {"category_id": cat["id"], "name": {"ru": "X"}}

    async def post(**kw):
        return await admin_client.post(f"{API}/items", json={**base, **kw})

    assert (await post(prices=[])).status_code == 422
    assert (await post(prices=[{"amount": 1.5}])).status_code == 422  # money is int only
    assert (await post(prices=[{"amount": -1}])).status_code == 422
    two_defaults = [{"amount": 1, "is_default": True}, {"amount": 2, "is_default": True}]
    assert (await post(prices=two_defaults)).status_code == 422
    assert (await post(prices=[{"amount": 1}], badges=["gluten"])).status_code == 422
    missing_group = await post(prices=[{"amount": 1}], modifier_group_ids=[999])
    assert missing_group.status_code == 422
    missing_cat = await admin_client.post(
        f"{API}/items", json={**base, "category_id": 999, "prices": [{"amount": 1}]}
    )
    assert missing_cat.status_code == 404
    foreign_price = await post(prices=[{"id": 12345, "amount": 1}])
    assert foreign_price.status_code == 422


async def test_item_toggles_and_delete(admin_client):
    cat = await make_category(admin_client)
    item = await make_item(admin_client, cat["id"])
    resp = await admin_client.patch(f"{API}/items/{item['id']}", json={"is_available": False})
    assert resp.json()["is_available"] is False
    assert resp.json()["is_enabled"] is True
    resp = await admin_client.patch(f"{API}/items/{item['id']}", json={"is_enabled": False})
    assert resp.json()["is_enabled"] is False

    assert (await admin_client.delete(f"{API}/items/{item['id']}")).status_code == 204
    assert (await menu(admin_client))["items"] == []


async def test_reorder_and_move_items(admin_client):
    eggs = await make_category(admin_client, "Яйца")
    toast = await make_category(admin_client, "Тосты")
    a = await make_item(admin_client, eggs["id"], "A")
    b = await make_item(admin_client, eggs["id"], "B")
    c = await make_item(admin_client, toast["id"], "C")

    resp = await admin_client.put(
        f"{API}/categories/{eggs['id']}/items/order", json={"ids": [b["id"], a["id"]]}
    )
    assert resp.status_code == 204
    items = (await menu(admin_client))["items"]
    assert [i["id"] for i in items] == [b["id"], a["id"], c["id"]]

    # items of another category are rejected
    bad = await admin_client.put(
        f"{API}/categories/{eggs['id']}/items/order", json={"ids": [b["id"], a["id"], c["id"]]}
    )
    assert bad.status_code == 422

    # move B to toasts: lands at the end
    resp = await admin_client.put(
        f"{API}/items/{b['id']}",
        json={"category_id": toast["id"], "name": b["name"], "prices": [{"amount": 1}]},
    )
    assert resp.status_code == 200
    items = (await menu(admin_client))["items"]
    assert [(i["id"], i["category_id"]) for i in items] == [
        (a["id"], eggs["id"]),
        (c["id"], toast["id"]),
        (b["id"], toast["id"]),
    ]


async def test_delete_category_cascades_items(admin_client):
    cat = await make_category(admin_client)
    await make_item(admin_client, cat["id"])
    await admin_client.delete(f"{API}/categories/{cat['id']}")
    assert (await menu(admin_client))["items"] == []


# --- modifier groups ---


async def test_modifier_group_crud(admin_client):
    group = await make_group(admin_client)
    assert [m["price"] for m in group["modifiers"]] == [15000, 20000]
    assert group["is_required"] is False

    cheese, bacon = group["modifiers"]
    resp = await admin_client.put(
        f"{API}/modifier-groups/{group['id']}",
        json={
            "name": group["name"],
            "is_required": True,
            "max_select": 1,
            "modifiers": [
                {"id": bacon["id"], "name": bacon["name"], "price": 25000},
                {"name": {"ru": "Авокадо"}, "price": 30000, "is_available": False},
            ],
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["is_required"] is True
    assert data["min_select"] == 1  # required implies at least one pick
    assert [(m["id"] == bacon["id"], m["price"]) for m in data["modifiers"]] == [
        (True, 25000),
        (False, 30000),
    ]
    assert cheese["id"] not in [m["id"] for m in data["modifiers"]]


async def test_modifier_group_validation(admin_client):
    bad = await admin_client.post(
        f"{API}/modifier-groups", json={"name": {"ru": "X"}, "min_select": 3, "max_select": 2}
    )
    assert bad.status_code == 422


async def test_group_shared_between_items_and_delete_unlinks(admin_client):
    cat = await make_category(admin_client)
    group = await make_group(admin_client)
    a = await make_item(admin_client, cat["id"], "A", modifier_group_ids=[group["id"]])
    b = await make_item(admin_client, cat["id"], "B", modifier_group_ids=[group["id"]])
    assert a["modifier_group_ids"] == b["modifier_group_ids"] == [group["id"]]

    assert (await admin_client.delete(f"{API}/modifier-groups/{group['id']}")).status_code == 204
    data = await menu(admin_client)
    assert data["modifier_groups"] == []
    assert all(i["modifier_group_ids"] == [] for i in data["items"])


# --- images ---


async def test_image_upload_resizes_to_webp(admin_client):
    resp = await admin_client.post(
        f"{API}/uploads/image", files={"file": ("dish.png", png_bytes(), "image/png")}
    )
    assert resp.status_code == 201, resp.text
    upload = resp.json()
    assert upload["urls"]["w400"] == f"/media/{upload['key']}_400.webp"

    media_dir = Path(get_settings().media_dir)
    for size in (400, 1200):
        with Image.open(media_dir / f"{upload['key']}_{size}.webp") as img:
            assert img.format == "WEBP"
            assert max(img.size) == size

    served = await admin_client.get(upload["urls"]["w400"])
    assert served.status_code == 200

    cat = await make_category(admin_client)
    item = await make_item(admin_client, cat["id"], image=upload["key"])
    assert item["image_urls"]["w1200"].endswith("_1200.webp")

    # replacing the image removes the old files
    second = (
        await admin_client.post(
            f"{API}/uploads/image", files={"file": ("x.png", png_bytes(color=(0, 0, 0)), "image/png")}
        )
    ).json()
    resp = await admin_client.put(
        f"{API}/items/{item['id']}",
        json={"category_id": cat["id"], "name": item["name"], "image": second["key"], "prices": [{"amount": 1}]},
    )
    assert resp.status_code == 200
    assert not (media_dir / f"{upload['key']}_400.webp").exists()


async def test_image_upload_rejects_garbage(admin_client):
    resp = await admin_client.post(
        f"{API}/uploads/image", files={"file": ("x.png", b"not an image", "image/png")}
    )
    assert resp.status_code == 422
    assert resp.json()["detail"] == "invalid_image"


async def test_unknown_image_key_rejected(admin_client):
    resp = await admin_client.post(
        f"{API}/categories", json={"name": {"ru": "x"}, "image": "0" * 32}
    )
    assert resp.status_code == 422
    assert resp.json()["detail"] == "image_not_found"


# --- permissions ---


async def test_waiter_reads_menu_but_cannot_edit(admin_client, waiter_client):
    cat = await make_category(admin_client)
    assert (await waiter_client.get(f"{API}/menu")).status_code == 200
    assert (await waiter_client.post(f"{API}/categories", json={"name": {"ru": "x"}})).status_code == 403
    assert (
        await waiter_client.patch(f"{API}/categories/{cat['id']}", json={"is_enabled": False})
    ).status_code == 403
    assert (
        await waiter_client.post(
            f"{API}/uploads/image", files={"file": ("x.png", png_bytes(), "image/png")}
        )
    ).status_code == 403
    assert (
        await waiter_client.post(f"{API}/modifier-groups", json={"name": {"ru": "x"}})
    ).status_code == 403
