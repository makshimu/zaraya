from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Category,
    Item,
    ModifierGroup,
    Order,
    OrderItem,
    OrderItemModifier,
    OrderStatus,
    RestaurantSettings,
    TableSession,
)
from app.schemas.order import OrderIn, OrderItemModifierOut, OrderItemOut, OrderOut, StaffOrderOut
from app.services.schedule import category_visible, local_now

MAX_ORDERS_PER_HOUR = 10

ORDER_LOAD = (
    selectinload(Order.items).selectinload(OrderItem.modifiers),
    selectinload(Order.table),
    selectinload(Order.updated_by),
)


def order_error(code: str, item_id: int | None = None) -> HTTPException:
    detail: dict = {"code": code}
    if item_id is not None:
        detail["item_id"] = item_id
    return HTTPException(422, detail)


async def load_order(db: AsyncSession, order_id: int) -> Order | None:
    return await db.scalar(select(Order).where(Order.id == order_id).options(*ORDER_LOAD))


async def build_lines(db: AsyncSession, body: OrderIn) -> list[OrderItem]:
    """Validate the cart against the live menu and price every line from the database."""
    settings = await db.get_one(RestaurantSettings, 1)
    now = local_now(settings.timezone)

    item_ids = {line.item_id for line in body.items}
    items = {
        i.id: i
        for i in await db.scalars(
            select(Item)
            .where(Item.id.in_(item_ids))
            .options(selectinload(Item.prices), selectinload(Item.group_links))
        )
    }
    categories = {
        c.id: c
        for c in await db.scalars(
            select(Category).where(Category.id.in_({i.category_id for i in items.values()}))
        )
    }
    group_ids = {link.group_id for i in items.values() for link in i.group_links}
    groups = {
        g.id: g
        for g in await db.scalars(
            select(ModifierGroup)
            .where(ModifierGroup.id.in_(group_ids))
            .options(selectinload(ModifierGroup.modifiers))
        )
    }

    lines = []
    for line in body.items:
        item = items.get(line.item_id)
        if (
            item is None
            or not item.is_enabled
            or not item.is_available
            or not category_visible(categories[item.category_id], now)
        ):
            raise order_error("item_unavailable", line.item_id)

        price = next((p for p in item.prices if p.id == line.price_id), None)
        if price is None:
            raise order_error("price_invalid", line.item_id)

        item_groups = [groups[link.group_id] for link in item.group_links]
        by_modifier = {m.id: (g, m) for g in item_groups for m in g.modifiers}
        if len(set(line.modifier_ids)) != len(line.modifier_ids):
            raise order_error("modifier_invalid", line.item_id)
        chosen = []
        for modifier_id in line.modifier_ids:
            if modifier_id not in by_modifier:
                raise order_error("modifier_invalid", line.item_id)
            group, modifier = by_modifier[modifier_id]
            if not modifier.is_available:
                raise order_error("modifier_unavailable", line.item_id)
            chosen.append((group, modifier))
        for group in item_groups:
            picked = sum(1 for g, _ in chosen if g.id == group.id)
            if not group.min_select <= picked <= group.max_select:
                raise order_error("modifier_selection_invalid", line.item_id)

        lines.append(
            OrderItem(
                item_id=item.id,
                price_id=price.id,
                name=item.name,
                price_name=price.name,
                unit_price=price.amount + sum(m.price for _, m in chosen),
                quantity=line.quantity,
                comment=line.comment.strip(),
                modifiers=[
                    OrderItemModifier(
                        modifier_id=m.id, group_name=g.name, name=m.name, price=m.price
                    )
                    for g, m in chosen
                ],
            )
        )
    return lines


async def create_order(
    db: AsyncSession, session: TableSession, body: OrderIn, idempotency_key: str
) -> tuple[Order, bool]:
    """Returns (order, created). A repeated Idempotency-Key returns the first order."""
    existing = await db.scalar(
        select(Order.id).where(
            Order.session_id == session.id, Order.idempotency_key == idempotency_key
        )
    )
    if existing:
        return await load_order(db, existing), False

    recent = await db.scalar(
        select(func.count())
        .select_from(Order)
        .where(
            Order.session_id == session.id,
            Order.created_at > datetime.now(UTC) - timedelta(hours=1),
        )
    )
    if recent >= MAX_ORDERS_PER_HOUR:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, {"code": "too_many_orders"})

    lines = await build_lines(db, body)
    settings = await db.get_one(RestaurantSettings, 1)
    # Guard against orders from a photographed QR: the first order of a visit needs a waiter
    first_of_session = not await db.scalar(
        select(Order.id).where(
            Order.session_id == session.id, Order.status != OrderStatus.rejected
        )
    )
    needs_confirmation = settings.require_first_order_confirmation and first_of_session

    order = Order(
        table_id=session.table_id,
        session_id=session.id,
        idempotency_key=idempotency_key,
        status=OrderStatus.pending if needs_confirmation else OrderStatus.cooking,
        comment=body.comment.strip(),
        # Only languages the restaurant offers; anything else counts as the default one
        language=body.language if body.language in settings.languages else settings.default_language,
        total=sum(line.total for line in lines),
        items=lines,
    )
    db.add(order)
    try:
        await db.commit()
    except IntegrityError:
        # Two identical requests raced: the other one won
        await db.rollback()
        existing = await db.scalar(
            select(Order.id).where(
                Order.session_id == session.id, Order.idempotency_key == idempotency_key
            )
        )
        if existing is None:
            raise
        return await load_order(db, existing), False
    return await load_order(db, order.id), True


def order_out(order: Order) -> OrderOut:
    return OrderOut(
        id=order.id,
        table_id=order.table_id,
        table_number=order.table.number,
        status=order.status,
        comment=order.comment,
        language=order.language,
        total=order.total,
        created_at=order.created_at,
        updated_at=order.updated_at,
        items=[
            OrderItemOut(
                id=line.id,
                item_id=line.item_id,
                name=line.name,
                price_name=line.price_name,
                unit_price=line.unit_price,
                quantity=line.quantity,
                total=line.total,
                comment=line.comment,
                modifiers=[
                    OrderItemModifierOut(group_name=m.group_name, name=m.name, price=m.price)
                    for m in line.modifiers
                ],
            )
            for line in order.items
        ],
    )


def staff_order_out(order: Order) -> StaffOrderOut:
    by = order.updated_by
    return StaffOrderOut(
        **order_out(order).model_dump(),
        session_id=str(order.session_id),
        updated_by=(by.name or by.email) if by else None,
    )
