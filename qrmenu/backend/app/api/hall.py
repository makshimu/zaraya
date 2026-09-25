from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import DB, CurrentUser
from app.models import CallStatus, ServiceCall, Table
from app.schemas.call import HallTableOut, StaffCallOut, TableVisitOut
from app.services import realtime
from app.services.audit import audit
from app.services.hall import (
    CALL_LOAD,
    close_table,
    hall_tables,
    load_call,
    notify_call,
    staff_call_out,
    take_call,
    visit_calls,
    visit_orders,
)
from app.services.orders import staff_order_out

# Operational screens: waiters and admins alike
router = APIRouter(tags=["hall"])


async def get_table_or_404(db: DB, table_id: int) -> Table:
    table = await db.get(Table, table_id)
    if table is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "table_not_found")
    return table


async def notify_table(table_id: int) -> None:
    await realtime.publish(realtime.STAFF, {"type": "table.updated", "table_id": table_id})


@router.get("/hall", response_model=list[HallTableOut])
async def get_hall(db: DB, _: CurrentUser) -> list[HallTableOut]:
    return await hall_tables(db)


@router.get("/tables/{table_id}/visit", response_model=TableVisitOut)
async def get_visit(table_id: int, db: DB, _: CurrentUser) -> TableVisitOut:
    """Everything of the current visit: orders, their sum, the call history."""
    await get_table_or_404(db, table_id)
    (table,) = await hall_tables(db, [table_id])
    return TableVisitOut(
        table=table,
        orders=[staff_order_out(o) for o in await visit_orders(db, table_id)],
        calls=[staff_call_out(c) for c in await visit_calls(db, table_id)],
    )


@router.post("/tables/{table_id}/open", response_model=HallTableOut)
async def open_table(table_id: int, db: DB, user: CurrentUser) -> HallTableOut:
    """Seat guests: with "table must be open" on, ordering from this table is allowed now."""
    table = await get_table_or_404(db, table_id)
    if table.opened_at is None:
        table.opened_at = datetime.now(UTC)
        audit(db, user, "open", "table", table.id, number=table.number)
        await db.commit()
    await notify_table(table_id)
    # Phones already scanned at this table may now order: let them refetch their session
    await realtime.publish(realtime.table_channel(table_id), {"type": "session.changed"})
    (out,) = await hall_tables(db, [table_id])
    return out


@router.post("/tables/{table_id}/close", response_model=HallTableOut)
async def close(table_id: int, db: DB, user: CurrentUser) -> HallTableOut:
    """Guests left: close every session of the table; their tokens stop working at once."""
    table = await get_table_or_404(db, table_id)
    session_ids = await close_table(db, table, user)
    audit(db, user, "close", "table", table.id, number=table.number, sessions=len(session_ids))
    await db.commit()
    await notify_table(table_id)
    for session_id in session_ids:
        await realtime.publish(realtime.session_channel(session_id), {"type": "session.changed"})
    (out,) = await hall_tables(db, [table_id])
    return out


@router.get("/calls", response_model=list[StaffCallOut])
async def list_calls(db: DB, _: CurrentUser, only_open: bool = True) -> list[StaffCallOut]:
    query = select(ServiceCall).options(*CALL_LOAD).order_by(ServiceCall.created_at.desc()).limit(200)
    if only_open:
        query = query.where(ServiceCall.status == CallStatus.open)
    return [staff_call_out(c) for c in await db.scalars(query)]


@router.post("/calls/{call_id}/take", response_model=StaffCallOut)
async def take(call_id: int, db: DB, user: CurrentUser) -> StaffCallOut:
    """"Taken": records which waiter went to the table. Taking a taken call is a no-op."""
    call = await load_call(db, call_id)
    if call is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "call_not_found")
    was_open = call.status == CallStatus.open
    call = await take_call(db, call, user)
    if was_open:
        await notify_call(call, "call.updated")
    return staff_call_out(call)
