from typing import Literal

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DB, AdminUser, CurrentUser
from app.core.security import new_table_token
from app.models import Hall, Table
from app.schemas import HallIn, HallOut, TableIn, TableOut, TableUpdate
from app.services.audit import audit
from app.services.qr import render_qr, table_url

router = APIRouter(tags=["tables"])


def table_out(table: Table) -> TableOut:
    return TableOut(
        id=table.id,
        number=table.number,
        hall_id=table.hall_id,
        capacity=table.capacity,
        is_active=table.is_active,
        token=table.token,
        token_issued_at=table.token_issued_at,
        qr_url=table_url(table.token),
    )


async def get_hall_or_404(db: DB, hall_id: int) -> Hall:
    hall = await db.get(Hall, hall_id)
    if hall is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "hall_not_found")
    return hall


async def get_table_or_404(db: DB, table_id: int) -> Table:
    table = await db.get(Table, table_id)
    if table is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "table_not_found")
    return table


async def flush_or_conflict(db: DB) -> None:
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "table_number_taken") from exc


# --- halls ---


@router.get("/halls", response_model=list[HallOut])
async def list_halls(db: DB, _: CurrentUser) -> list[Hall]:
    return list(await db.scalars(select(Hall).order_by(Hall.sort_order, Hall.id)))


@router.post("/halls", response_model=HallOut, status_code=status.HTTP_201_CREATED)
async def create_hall(body: HallIn, db: DB, user: AdminUser) -> Hall:
    hall = Hall(**body.model_dump())
    db.add(hall)
    await db.flush()
    audit(db, user, "create", "hall", hall.id, name=hall.name)
    await db.commit()
    return hall


@router.put("/halls/{hall_id}", response_model=HallOut)
async def update_hall(hall_id: int, body: HallIn, db: DB, user: AdminUser) -> Hall:
    hall = await get_hall_or_404(db, hall_id)
    for key, value in body.model_dump().items():
        setattr(hall, key, value)
    audit(db, user, "update", "hall", hall.id, **body.model_dump())
    await db.commit()
    return hall


@router.delete("/halls/{hall_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hall(hall_id: int, db: DB, user: AdminUser) -> None:
    hall = await get_hall_or_404(db, hall_id)
    audit(db, user, "delete", "hall", hall.id, name=hall.name)
    await db.delete(hall)
    await db.commit()


# --- tables ---


@router.get("/tables", response_model=list[TableOut])
async def list_tables(db: DB, _: CurrentUser) -> list[TableOut]:
    tables = await db.scalars(select(Table).order_by(Table.hall_id, Table.number))
    return [table_out(t) for t in tables]


@router.post("/tables", response_model=TableOut, status_code=status.HTTP_201_CREATED)
async def create_table(body: TableIn, db: DB, user: AdminUser) -> TableOut:
    if body.hall_id is not None:
        await get_hall_or_404(db, body.hall_id)
    table = Table(**body.model_dump(), token=new_table_token())
    db.add(table)
    await flush_or_conflict(db)
    audit(db, user, "create", "table", table.id, number=table.number)
    await db.commit()
    await db.refresh(table)
    return table_out(table)


@router.patch("/tables/{table_id}", response_model=TableOut)
async def update_table(table_id: int, body: TableUpdate, db: DB, user: AdminUser) -> TableOut:
    table = await get_table_or_404(db, table_id)
    changes = body.model_dump(exclude_unset=True)
    if changes.get("hall_id") is not None:
        await get_hall_or_404(db, changes["hall_id"])
    for key, value in changes.items():
        setattr(table, key, value)
    await flush_or_conflict(db)
    audit(db, user, "update", "table", table.id, **changes)
    await db.commit()
    await db.refresh(table)
    return table_out(table)


@router.delete("/tables/{table_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_table(table_id: int, db: DB, user: AdminUser) -> None:
    table = await get_table_or_404(db, table_id)
    audit(db, user, "delete", "table", table.id, number=table.number)
    await db.delete(table)
    await db.commit()


@router.post("/tables/{table_id}/regenerate-token", response_model=TableOut)
async def regenerate_token(table_id: int, db: DB, user: AdminUser) -> TableOut:
    """Issue a new QR token; the previously printed QR stops working."""
    table = await get_table_or_404(db, table_id)
    table.token = new_table_token()
    table.token_issued_at = func.now()
    audit(db, user, "regenerate_token", "table", table.id, number=table.number)
    await db.commit()
    await db.refresh(table)
    return table_out(table)


QR_MEDIA_TYPES = {"png": "image/png", "svg": "image/svg+xml"}


@router.get("/tables/{table_id}/qr.{fmt}")
async def table_qr(table_id: int, fmt: Literal["png", "svg"], db: DB, _: CurrentUser) -> Response:
    table = await get_table_or_404(db, table_id)
    return Response(
        render_qr(table.token, fmt),
        media_type=QR_MEDIA_TYPES[fmt],
        headers={"Content-Disposition": f'attachment; filename="table-{table.number}.{fmt}"'},
    )
