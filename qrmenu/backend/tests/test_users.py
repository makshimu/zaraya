from tests.conftest import ADMIN

API = "/api/admin"


async def test_admin_manages_waiters(admin_client, client):
    resp = await admin_client.post(
        f"{API}/users",
        json={"email": "Anna@Example.com", "name": "Анна", "password": "secret1", "role": "waiter"},
    )
    assert resp.status_code == 201, resp.text
    anna = resp.json()
    assert anna["email"] == "anna@example.com"
    assert anna["role"] == "waiter" and anna["is_active"] is True

    login = await client.post(f"{API}/auth/login", json={"email": "anna@example.com", "password": "secret1"})
    assert login.status_code == 200

    dup = await admin_client.post(f"{API}/users", json={"email": "anna@example.com", "password": "xxxxxx"})
    assert dup.status_code == 409
    assert dup.json()["detail"] == "email_taken"

    # new password, then deactivate: her old token and new logins stop working
    token = login.json()["access_token"]
    await admin_client.patch(f"{API}/users/{anna['id']}", json={"password": "newpass1"})
    assert (await client.post(f"{API}/auth/login", json={"email": "anna@example.com", "password": "secret1"})).status_code == 401
    resp = await admin_client.patch(f"{API}/users/{anna['id']}", json={"is_active": False})
    assert resp.json()["is_active"] is False
    me = await client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 401

    users = (await admin_client.get(f"{API}/users")).json()
    assert {u["email"] for u in users} >= {"admin@example.com", "anna@example.com"}


async def test_last_admin_is_protected(admin_client):
    me = (await admin_client.get(f"{API}/auth/me")).json()
    for body in ({"role": "waiter"}, {"is_active": False}):
        resp = await admin_client.patch(f"{API}/users/{me['id']}", json=body)
        assert resp.status_code == 409
        assert resp.json()["detail"] == "last_admin"

    second = (
        await admin_client.post(
            f"{API}/users", json={"email": "boss2@example.com", "password": "secret2", "role": "admin"}
        )
    ).json()
    assert (await admin_client.patch(f"{API}/users/{me['id']}", json={"role": "waiter"})).status_code == 200
    assert second["role"] == "admin"


async def test_validation_and_permissions(admin_client, waiter_client):
    short = await admin_client.post(f"{API}/users", json={"email": "x@y.z", "password": "123"})
    assert short.status_code == 422
    bad_email = await admin_client.post(f"{API}/users", json={"email": "nope", "password": "123456"})
    assert bad_email.status_code == 422
    assert (await waiter_client.get(f"{API}/users")).status_code == 403
    assert (
        await waiter_client.post(f"{API}/users", json={"email": "a@b.c", "password": "123456"})
    ).status_code == 403
    assert ADMIN["email"]  # fixture sanity
