async def create_table(client, **kwargs):
    resp = await client.post("/api/admin/tables", json={"number": "5", **kwargs})
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_hall_crud(admin_client):
    resp = await admin_client.post("/api/admin/halls", json={"name": "Терраса"})
    assert resp.status_code == 201
    hall = resp.json()

    resp = await admin_client.put(f"/api/admin/halls/{hall['id']}", json={"name": "Веранда"})
    assert resp.json()["name"] == "Веранда"

    table = await create_table(admin_client, hall_id=hall["id"])
    assert (await admin_client.delete(f"/api/admin/halls/{hall['id']}")).status_code == 204
    assert (await admin_client.get("/api/admin/halls")).json() == []

    # tables survive hall deletion, just without a hall
    tables = (await admin_client.get("/api/admin/tables")).json()
    assert tables[0]["id"] == table["id"]
    assert tables[0]["hall_id"] is None


async def test_create_table_has_token_and_qr_url(admin_client):
    table = await create_table(admin_client, capacity=6)
    assert len(table["token"]) >= 16
    assert table["qr_url"] == f"https://menu.test/t/{table['token']}"
    assert table["capacity"] == 6
    assert table["is_active"] is True


async def test_table_number_unique(admin_client):
    await create_table(admin_client)
    resp = await admin_client.post("/api/admin/tables", json={"number": "5"})
    assert resp.status_code == 409
    assert resp.json()["detail"] == "table_number_taken"

    other = await create_table(admin_client, number="6")
    resp = await admin_client.patch(f"/api/admin/tables/{other['id']}", json={"number": "5"})
    assert resp.status_code == 409


async def test_table_unknown_hall(admin_client):
    resp = await admin_client.post("/api/admin/tables", json={"number": "1", "hall_id": 999})
    assert resp.status_code == 404


async def test_update_and_delete_table(admin_client):
    table = await create_table(admin_client)
    resp = await admin_client.patch(
        f"/api/admin/tables/{table['id']}", json={"is_active": False, "capacity": 2}
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False
    assert resp.json()["capacity"] == 2
    assert resp.json()["token"] == table["token"]

    assert (await admin_client.delete(f"/api/admin/tables/{table['id']}")).status_code == 204
    assert (await admin_client.get("/api/admin/tables")).json() == []


async def test_regenerate_token(admin_client):
    table = await create_table(admin_client)
    resp = await admin_client.post(f"/api/admin/tables/{table['id']}/regenerate-token")
    assert resp.status_code == 200
    new = resp.json()
    assert new["token"] != table["token"]
    assert new["qr_url"].endswith(new["token"])
    assert new["token_issued_at"] > table["token_issued_at"]


async def test_qr_downloads(admin_client):
    table = await create_table(admin_client)
    png = await admin_client.get(f"/api/admin/tables/{table['id']}/qr.png")
    assert png.status_code == 200
    assert png.headers["content-type"] == "image/png"
    assert png.content.startswith(b"\x89PNG")
    assert 'filename="table-5.png"' in png.headers["content-disposition"]

    svg = await admin_client.get(f"/api/admin/tables/{table['id']}/qr.svg")
    assert svg.status_code == 200
    assert svg.headers["content-type"].startswith("image/svg+xml")
    assert b"<svg" in svg.content

    assert (await admin_client.get(f"/api/admin/tables/{table['id']}/qr.gif")).status_code == 422


async def test_waiter_can_view_but_not_edit(admin_client, waiter_client):
    table = await create_table(admin_client)
    assert (await waiter_client.get("/api/admin/tables")).status_code == 200
    assert (await waiter_client.get("/api/admin/halls")).status_code == 200
    assert (await waiter_client.get(f"/api/admin/tables/{table['id']}/qr.png")).status_code == 200
    assert (await waiter_client.post("/api/admin/tables", json={"number": "7"})).status_code == 403
    assert (
        await waiter_client.patch(f"/api/admin/tables/{table['id']}", json={"capacity": 1})
    ).status_code == 403
    assert (
        await waiter_client.post(f"/api/admin/tables/{table['id']}/regenerate-token")
    ).status_code == 403
    assert (await waiter_client.post("/api/admin/halls", json={"name": "X"})).status_code == 403
