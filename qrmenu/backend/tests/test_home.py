"""Guest home screen settings: tagline, cover photo, Wi-Fi, opening hours, popular dishes."""

from tests.test_menu import make_item, png_bytes
from tests.test_orders import key, line, seed

API = "/api/admin"


async def settings_with(admin_client, **changes):
    current = (await admin_client.get(f"{API}/settings")).json()
    return await admin_client.put(f"{API}/settings", json={**current, **changes})


async def test_home_settings_round_trip(admin_client, guest_client):
    cover = (
        await admin_client.post(f"{API}/uploads/image", files={"file": ("c.png", png_bytes(), "image/png")})
    ).json()
    hours = [{"open": "07:00", "close": "23:00", "closed": False}] * 6 + [{"open": "09:00", "close": "01:00", "closed": True}]
    resp = await settings_with(
        admin_client,
        tagline={"vi": "Ẩm thực Việt Nam", "en": "Vietnamese cuisine", "ru": " "},
        cover=cover["key"],
        wifi_name="  LaoDai_Guest ",
        wifi_password="laodai2024",
        opening_hours=hours,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["tagline"] == {"vi": "Ẩm thực Việt Nam", "en": "Vietnamese cuisine"}
    assert data["wifi_name"] == "LaoDai_Guest"
    assert data["cover_urls"]["w1200"].endswith("_1200.webp")
    assert data["opening_hours"][6] == {"open": "09:00:00", "close": "01:00:00", "closed": True}

    restaurant = (await guest_client.get("/api/guest/menu")).json()["restaurant"]
    assert restaurant["wifi_name"] == "LaoDai_Guest" and restaurant["wifi_password"] == "laodai2024"
    assert restaurant["tagline"]["en"] == "Vietnamese cuisine"
    assert restaurant["cover_urls"]["w1200"] == data["cover_urls"]["w1200"]
    assert len(restaurant["opening_hours"]) == 7

    # clearing: empty Wi-Fi becomes null, hours can be hidden again
    cleared = (await settings_with(admin_client, wifi_name="", wifi_password=" ", opening_hours=None, cover=None)).json()
    assert cleared["wifi_name"] is None and cleared["wifi_password"] is None
    assert cleared["opening_hours"] is None and cleared["cover_urls"] is None


async def test_home_settings_validation(admin_client):
    assert (await settings_with(admin_client, opening_hours=[{"open": "07:00", "close": "23:00"}] * 6)).status_code == 422
    assert (await settings_with(admin_client, opening_hours=[{"open": "25:00", "close": "23:00"}] * 7)).status_code == 422
    assert (await settings_with(admin_client, cover="0" * 32)).status_code == 422
    assert (await settings_with(admin_client, wifi_password="x" * 65)).status_code == 422


async def test_popular_dishes(admin_client, guest_client):
    _, item, _ = await seed(admin_client, guest_client)
    cat_id = item["category_id"]
    hit = await make_item(admin_client, cat_id, "Хит", badges=["hit"])
    best = await make_item(admin_client, cat_id, "Бестселлер")
    sold_out = await make_item(admin_client, cat_id, "Нет", badges=["hit"])
    await admin_client.patch(f"{API}/items/{sold_out['id']}", json={"is_available": False})
    await guest_client.post("/api/guest/orders", json={"items": [line(best, qty=5)]}, headers=key())
    await guest_client.post("/api/guest/orders", json={"items": [line(item)]}, headers=key())

    menu = (await guest_client.get("/api/guest/menu")).json()
    # hits first, then by quantity ordered; nothing out of stock
    assert menu["popular_item_ids"] == [hit["id"], best["id"], item["id"]]


async def test_popular_is_empty_without_menu(guest_client):
    assert (await guest_client.get("/api/guest/menu")).json()["popular_item_ids"] == []
