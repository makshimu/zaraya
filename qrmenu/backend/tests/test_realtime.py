"""WebSockets end to end through Redis pub/sub, driven by Starlette's sync TestClient."""

import uuid

import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core.config import get_settings
from app.main import app
from tests.conftest import ADMIN

COOKIE = get_settings().guest_cookie_name

API = "/api/admin"


def next_event(ws, *types):
    """Skip hello/ping/resync until an event of one of the given types arrives."""
    while True:
        event = ws.receive_json()
        if event["type"] in types:
            return event


@pytest.fixture
def client():
    with TestClient(app, base_url="https://testserver") as c:  # https: Secure cookie
        yield c


def guest_ws(client):
    # TestClient always dials ws://, so the Secure session cookie has to be passed by hand
    cookie = client.cookies.get(COOKIE)
    headers = {"cookie": f"{COOKIE}={cookie}"} if cookie else {}
    return client.websocket_connect("/api/guest/ws", headers=headers)


def seed(client):
    token = client.post(f"{API}/auth/login", json=ADMIN).json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}
    cat = client.post(f"{API}/categories", json={"name": {"ru": "Яйца"}}, headers=auth).json()
    item = client.post(
        f"{API}/items",
        json={"category_id": cat["id"], "name": {"ru": "Шакшука"}, "prices": [{"amount": 75000}]},
        headers=auth,
    ).json()
    table = client.post(f"{API}/tables", json={"number": "5"}, headers=auth).json()
    return token, auth, item, table


def place(client, item):
    return client.post(
        "/api/guest/orders",
        json={"items": [{"item_id": item["id"], "price_id": item["prices"][0]["id"], "quantity": 1}]},
        headers={"Idempotency-Key": uuid.uuid4().hex},
    ).json()


def test_staff_feed_gets_new_order_and_guest_gets_status(client):
    token, auth, item, table = seed(client)
    client.get(f"/t/{table['token']}")  # this client is now also the guest phone

    with client.websocket_connect(f"/api/admin/ws?token={token}") as staff:
        assert staff.receive_json()["type"] == "hello"
        with guest_ws(client) as guest:
            assert guest.receive_json()["type"] == "hello"

            placed = place(client, item)
            event = next_event(staff, "order.created")
            assert event["order"]["id"] == placed["id"]
            assert event["order"]["table_number"] == "5"

            assert placed["status"] == "pending"  # first order of the visit waits for a waiter
            resp = client.post(
                f"{API}/orders/{placed['id']}/status", json={"status": "accepted"}, headers=auth
            )
            assert resp.status_code == 200
            assert next_event(staff, "order.updated")["order"]["status"] == "accepted"
            update = next_event(guest, "order.updated")
            assert update["order"]["status"] == "accepted"
            assert "session_id" not in update["order"]  # guest view, no staff fields


def test_menu_change_reaches_guests(client):
    _, auth, item, _ = seed(client)
    with guest_ws(client) as guest:  # no session: menu events only
        assert guest.receive_json()["type"] == "hello"
        client.patch(f"{API}/items/{item['id']}", json={"is_enabled": False}, headers=auth)
        assert next_event(guest, "menu.changed")


def test_other_sessions_do_not_get_my_order_updates(client):
    token, auth, item, table = seed(client)
    client.get(f"/t/{table['token']}")
    placed = place(client, item)

    # Scanning again gives this client a new session cookie: now it is "another phone"
    client.get(f"/t/{table['token']}")
    with guest_ws(client) as other:
        assert other.receive_json()["type"] == "hello"
        resp = client.post(
            f"{API}/orders/{placed['id']}/status", json={"status": "accepted"}, headers=auth
        )
        assert resp.status_code == 200
        # A menu change is broadcast; if the order update had leaked it would arrive first
        client.patch(f"{API}/items/{item['id']}", json={"is_available": False}, headers=auth)
        assert next_event(other, "menu.changed", "order.updated")["type"] == "menu.changed"


def test_staff_ws_requires_valid_token(client):
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/api/admin/ws?token=garbage") as ws:
            ws.receive_json()
    assert exc.value.code == 4401
