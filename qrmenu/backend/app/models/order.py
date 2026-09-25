import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.table import Table
from app.models.user import User


class OrderStatus(str, enum.Enum):
    pending = "pending"  # waits for a waiter to accept (first order of a session)
    accepted = "accepted"
    cooking = "cooking"
    served = "served"
    closed = "closed"
    rejected = "rejected"


# Allowed staff transitions. "accepted -> served" covers drinks that skip the kitchen.
TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.pending: {OrderStatus.accepted, OrderStatus.rejected},
    OrderStatus.accepted: {OrderStatus.cooking, OrderStatus.served, OrderStatus.rejected},
    OrderStatus.cooking: {OrderStatus.served},
    OrderStatus.served: {OrderStatus.closed},
    OrderStatus.closed: set(),
    OrderStatus.rejected: set(),
}

# Positions can be edited until the kitchen starts
EDITABLE_STATUSES = {OrderStatus.pending, OrderStatus.accepted}
ACTIVE_STATUSES = {OrderStatus.pending, OrderStatus.accepted, OrderStatus.cooking, OrderStatus.served}


class Order(Base):
    __tablename__ = "order"
    __table_args__ = (UniqueConstraint("session_id", "idempotency_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    table_id: Mapped[int] = mapped_column(ForeignKey("table.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("table_session.id", ondelete="CASCADE"), index=True
    )
    idempotency_key: Mapped[str] = mapped_column(String(64))
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status"), index=True
    )
    comment: Mapped[str] = mapped_column(String(500), default="")
    # Menu language the guest was browsing in when ordering (for analytics)
    language: Mapped[str | None] = mapped_column(String(8), index=True)
    total: Mapped[int]  # minor units, computed by the backend only
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # Staff member who last changed the status
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="SET NULL"))

    table: Mapped[Table] = relationship()
    updated_by: Mapped[User | None] = relationship()
    items: Mapped[list["OrderItem"]] = relationship(
        order_by="OrderItem.id", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    """A line of an order with a snapshot of names and prices at ordering time."""

    __tablename__ = "order_item"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("order.id", ondelete="CASCADE"), index=True)
    item_id: Mapped[int | None] = mapped_column(ForeignKey("item.id", ondelete="SET NULL"))
    price_id: Mapped[int | None] = mapped_column(ForeignKey("item_price.id", ondelete="SET NULL"))
    name: Mapped[dict] = mapped_column(JSONB)
    price_name: Mapped[dict] = mapped_column(JSONB, default=dict)
    unit_price: Mapped[int]  # variant price + modifiers
    quantity: Mapped[int]
    comment: Mapped[str] = mapped_column(String(500), default="")

    modifiers: Mapped[list["OrderItemModifier"]] = relationship(
        order_by="OrderItemModifier.id", cascade="all, delete-orphan"
    )

    @property
    def total(self) -> int:
        return self.unit_price * self.quantity


class OrderItemModifier(Base):
    __tablename__ = "order_item_modifier"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_item_id: Mapped[int] = mapped_column(
        ForeignKey("order_item.id", ondelete="CASCADE"), index=True
    )
    modifier_id: Mapped[int | None] = mapped_column(ForeignKey("modifier.id", ondelete="SET NULL"))
    group_name: Mapped[dict] = mapped_column(JSONB, default=dict)
    name: Mapped[dict] = mapped_column(JSONB)
    price: Mapped[int]
