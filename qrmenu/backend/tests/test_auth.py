from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import AuditLog
from tests.conftest import ADMIN


async def test_health(client):
    resp = await client.get("/api/health")
    assert resp.status_code in (200, 503)  # redis may be absent when running tests locally
    assert resp.json()["db"] == "ok"


async def test_login_and_me(client):
    resp = await client.post("/api/admin/auth/login", json=ADMIN)
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    me = await client.get("/api/admin/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == ADMIN["email"]
    assert me.json()["role"] == "admin"

    async with SessionLocal() as db:
        actions = list(await db.scalars(select(AuditLog.action)))
    assert "login" in actions


async def test_login_is_case_insensitive_on_email(client):
    resp = await client.post(
        "/api/admin/auth/login", json={**ADMIN, "email": ADMIN["email"].upper()}
    )
    assert resp.status_code == 200


async def test_login_wrong_password(client):
    resp = await client.post("/api/admin/auth/login", json={**ADMIN, "password": "nope"})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "invalid_credentials"


async def test_protected_routes_require_token(client):
    assert (await client.get("/api/admin/auth/me")).status_code == 401
    assert (await client.get("/api/admin/tables")).status_code == 401
    bad = await client.get("/api/admin/tables", headers={"Authorization": "Bearer garbage"})
    assert bad.status_code == 401


async def test_settings_defaults(admin_client):
    resp = await admin_client.get("/api/admin/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_ttl_minutes"] == 180
    assert data["require_first_order_confirmation"] is True
    assert data["require_table_open"] is False
