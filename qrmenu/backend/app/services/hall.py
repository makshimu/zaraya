"""Live state of the dining room: who sits where, what they ordered, who is calling."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    ACTIVE_STATUSES,
    CallStatus,
    CallType,
    Order,
    OrderStatus,
    ServiceCall,
    Table,
    TableSession,
    User,
)
from app.schemas.call import CallIn, GuestCallOut, HallTableOut, StaffCallOut, TableState
from app.services import realtime
from app.services.orders import ORDER_LOAD

CALL_COOLDOWN = timedelta(seconds=60)
CALL_LOAD = (selectinload(ServiceCall.table), selectinload(ServiceCall.taken_by))


def guest_call_out(call: ServiceCall) -> GuestCallOut:
    return GuestCallOut(
        id=call.id,
        type=call.type,
        payment_method=call.payment_method,
        status=call.status,
        created_at=call.created_at,
    )


def staff_call_out(call: ServiceCall) -> StaffCallOut:
    by = call.taken_by
    return StaffCallOut(
        **guest_call_out(call).model_dump(),
        table_id=call.table_id,
        table_number=call.table.number,
        taken_at=call.taken_at,
        taken_by=(by.name or by.email) if by else None,
    )


async def load_call(db: AsyncSession, call_id: int) -> ServiceCall | None:
    return await db.scalar(select(ServiceCall).where(ServiceCall.id == call_id).options(*CALL_LOAD))


async def create_call(db: AsyncSession, session: TableSession, body: CallIn) -> ServiceCall:
    """At most one call of each kind per minute per phone."""
    last = await db.scalar(
        select(ServiceCall.created_at)
        .where(ServiceCall.session_id == session.id, ServiceCall.type == body.type)
        .order_by(ServiceCall.created_at.desc())
        .limit(1)
    )
    if last is not None:
        wait = last + CALL_COOLDOWN - datetime.now(UTC)
        if wait > timedelta(0):
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                {"code": "too_many_calls", "retry_after": int(wait.total_seconds()) + 1},
            )
    call = ServiceCall(
        table_id=session.table_id,
        session_id=session.id,
        type=body.type,
        payment_method=body.payment_method,
    )
    db.add(call)
    await db.commit()
    return await load_call(db, call.id)


async def take_call(db: AsyncSession, call: ServiceCall, user: User) -> ServiceCall:
    call_id = call.id  # attributes are expired after the commit below
    if call.status == CallStatus.open:
        call.status = CallStatus.taken
        call.taken_by_id = user.id
        call.taken_at = datetime.now(UTC)
        await db.commit()
        db.expire_all()
    return await load_call(db, call_id)


async def notify_call(call: ServiceCall, event: str) -> None:
    await realtime.publish(
        realtime.STAFF, {"type": event, "call": staff_call_out(call).model_dump(mode="json")}
    )
    await realtime.publish(
        realtime.session_channel(call.session_id),
        {"type": "call.updated", "call": guest_call_out(call).model_dump(mode="json")},
    )


# --- hall ---


async def _visit_sessions(db: AsyncSession, table_ids: list[int]) -> dict[int, list[TableSession]]:
    """Sessions of the current visit: everything not yet closed by staff (expired ones too:
    the guests may still be sitting there)."""
    rows = await db.scalars(
        select(TableSession).where(
            TableSession.table_id.in_(table_ids), TableSession.closed_at.is_(None)
        )
    )
    out: dict[int, list[TableSession]] = {tid: [] for tid in table_ids}
    for s in rows:
        out[s.table_id].append(s)
    return out


def _state(
    open_calls: list[ServiceCall], pending: int, guests: int, active: int, opened: bool
) -> TableState:
    if any(c.type == CallType.bill for c in open_calls):
        return "bill"
    if any(c.type == CallType.waiter for c in open_calls):
        return "waiter"
    if pending:
        return "new_order"
    if guests or active or opened:
        return "occupied"
    return "free"


async def hall_tables(db: AsyncSession, table_ids: list[int] | None = None) -> list[HallTableOut]:
    query = select(Table).order_by(Table.hall_id, Table.number)
    if table_ids is not None:
        query = query.where(Table.id.in_(table_ids))
    tables = list(await db.scalars(query))
    ids = [t.id for t in tables]
    sessions = await _visit_sessions(db, ids)
    session_ids = [s.id for group in sessions.values() for s in group]

    orders: dict[uuid.UUID, list[Order]] = {}
    for o in await db.scalars(select(Order).where(Order.session_id.in_(session_ids))):
        orders.setdefault(o.session_id, []).append(o)
    calls: dict[int, list[ServiceCall]] = {}
    for c in await db.scalars(
        select(ServiceCall)
        .where(ServiceCall.table_id.in_(ids), ServiceCall.status == CallStatus.open)
        .options(*CALL_LOAD)
        .order_by(ServiceCall.created_at)
    ):
        calls.setdefault(c.table_id, []).append(c)

    now = datetime.now(UTC)
    out = []
    for t in tables:
        visit = sessions[t.id]
        visit_orders = [o for s in visit for o in orders.get(s.id, [])]
        live = [o for o in visit_orders if o.status != OrderStatus.rejected]
        active = sum(o.status in ACTIVE_STATUSES for o in visit_orders)
        pending = sum(o.status == OrderStatus.pending for o in visit_orders)
        guests = sum(s.expires_at > now for s in visit)
        open_calls = calls.get(t.id, [])
        out.append(
            HallTableOut(
                id=t.id,
                number=t.number,
                hall_id=t.hall_id,
                capacity=t.capacity,
                is_active=t.is_active,
                opened_at=t.opened_at,
                state=_state(open_calls, pending, guests, active, t.opened_at is not None),
                guests=guests,
                active_orders=active,
                pending_orders=pending,
                visit_total=sum(o.total for o in live),
                open_calls=[staff_call_out(c) for c in open_calls],
            )
        )
    return out


async def visit_orders(db: AsyncSession, table_id: int) -> list[Order]:
    session_ids = [s.id for s in (await _visit_sessions(db, [table_id]))[table_id]]
    return list(
        await db.scalars(
            select(Order)
            .where(Order.session_id.in_(session_ids))
            .options(*ORDER_LOAD)
            .order_by(Order.created_at.desc())
        )
    )


async def visit_calls(db: AsyncSession, table_id: int) -> list[ServiceCall]:
    session_ids = [s.id for s in (await _visit_sessions(db, [table_id]))[table_id]]
    return list(
        await db.scalars(
            select(ServiceCall)
            .where(ServiceCall.session_id.in_(session_ids))
            .options(*CALL_LOAD)
            .order_by(ServiceCall.created_at.desc())
        )
    )


async def close_table(db: AsyncSession, table: Table, user: User) -> list[uuid.UUID]:
    """End the visit: guest tokens stop working at once, orders and calls are wrapped up.
    Returns the closed session ids so their phones can be told."""
    now = datetime.now(UTC)
    session_ids = [s.id for s in (await _visit_sessions(db, [table.id]))[table.id]]
    if session_ids:
        await db.execute(
            update(TableSession).where(TableSession.id.in_(session_ids)).values(closed_at=now)
        )
        await db.execute(
            update(Order)
            .where(Order.session_id.in_(session_ids), Order.status.in_(ACTIVE_STATUSES))
            .values(status=OrderStatus.closed, updated_by_id=user.id)
        )
    await db.execute(
        update(ServiceCall)
        .where(ServiceCall.table_id == table.id, ServiceCall.status == CallStatus.open)
        .values(status=CallStatus.taken, taken_by_id=user.id, taken_at=now)
    )
    table.opened_at = None
    return session_ids
