from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query, WebSocket, status
from sqlalchemy import select

from app.api.deps import DB, CurrentUser
from app.api.ws import stream
from app.core.db import SessionLocal
from app.core.security import decode_access_token
from app.models import EDITABLE_STATUSES, TRANSITIONS, Order, OrderStatus, RestaurantSettings, User
from app.schemas.order import EditItemsIn, StaffOrderOut, StatusIn
from app.services import realtime
from app.services.audit import audit
from app.services.orders import ORDER_LOAD, load_order, order_out, staff_order_out

router = APIRouter(tags=["orders"])


async def get_order_or_404(db: DB, order_id: int) -> Order:
    order = await load_order(db, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "order_not_found")
    return order


async def notify(order: Order, event: str) -> None:
    """Staff get the full order; the guest's phone gets its own view of it."""
    await realtime.publish(
        realtime.STAFF, {"type": event, "order": staff_order_out(order).model_dump(mode="json")}
    )
    await realtime.publish(
        realtime.session_channel(order.session_id),
        {"type": "order.updated", "order": order_out(order).model_dump(mode="json")},
    )


@router.get("/orders", response_model=list[StaffOrderOut])
async def list_orders(
    db: DB,
    _: CurrentUser,
    status_: list[OrderStatus] = Query(default=[], alias="status"),
    table_id: int | None = None,
    day: date | None = Query(default=None, alias="date"),
    limit: int = Query(default=200, ge=1, le=500),
) -> list[StaffOrderOut]:
    query = select(Order).options(*ORDER_LOAD).order_by(Order.created_at.desc()).limit(limit)
    if status_:
        query = query.where(Order.status.in_(status_))
    if table_id is not None:
        query = query.where(Order.table_id == table_id)
    if day is not None:
        # A calendar day in the restaurant's time zone
        tz = ZoneInfo((await db.get_one(RestaurantSettings, 1)).timezone)
        start = datetime.combine(day, time.min, tz)
        query = query.where(Order.created_at >= start, Order.created_at < start + timedelta(days=1))
    return [staff_order_out(o) for o in await db.scalars(query)]


@router.get("/orders/{order_id}", response_model=StaffOrderOut)
async def get_order(order_id: int, db: DB, _: CurrentUser) -> StaffOrderOut:
    return staff_order_out(await get_order_or_404(db, order_id))


@router.post("/orders/{order_id}/status", response_model=StaffOrderOut)
async def set_status(order_id: int, body: StatusIn, db: DB, user: CurrentUser) -> StaffOrderOut:
    order = await get_order_or_404(db, order_id)
    if body.status not in TRANSITIONS[order.status]:
        raise HTTPException(status.HTTP_409_CONFLICT, "invalid_transition")
    audit(db, user, "status", "order", order.id, old=order.status.value, new=body.status.value)
    order.status = body.status
    order.updated_by_id = user.id
    await db.commit()
    db.expire_all()
    order = await get_order_or_404(db, order_id)
    await notify(order, "order.updated")
    return staff_order_out(order)


@router.put("/orders/{order_id}/items", response_model=StaffOrderOut)
async def edit_items(order_id: int, body: EditItemsIn, db: DB, user: CurrentUser) -> StaffOrderOut:
    """Change quantities or remove lines before the kitchen starts."""
    order = await get_order_or_404(db, order_id)
    if order.status not in EDITABLE_STATUSES:
        raise HTTPException(status.HTTP_409_CONFLICT, "order_not_editable")
    wanted = {line.id: line.quantity for line in body.items}
    if len(wanted) != len(body.items) or not set(wanted) <= {i.id for i in order.items}:
        raise HTTPException(422, "order_item_not_found")

    before = {i.id: i.quantity for i in order.items}
    order.items = [i for i in order.items if i.id in wanted]
    for line in order.items:
        line.quantity = wanted[line.id]
    order.total = sum(line.total for line in order.items)
    order.updated_by_id = user.id
    audit(db, user, "edit_items", "order", order.id, before=before, after=wanted)
    await db.commit()
    db.expire_all()
    order = await get_order_or_404(db, order_id)
    await notify(order, "order.updated")
    return staff_order_out(order)


@router.websocket("/ws")
async def staff_ws(ws: WebSocket, token: str = "") -> None:
    """Live feed for the admin panel. Browsers can't set headers on WebSockets: token in query."""
    user_id = decode_access_token(token)
    async with SessionLocal() as db:
        user = await db.get(User, user_id) if user_id else None
    if user is None or not user.is_active:
        await ws.close(code=4401)
        return
    await ws.accept()
    await stream(ws, [realtime.STAFF, realtime.MENU])
