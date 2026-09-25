from datetime import datetime, time

from sqlalchemy import DateTime, ForeignKey, String, Time, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

# Multilingual fields are JSONB: {"ru": "...", "en": "..."}
# Money is stored as int in the currency's minor units.


class Category(Base):
    __tablename__ = "category"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[dict] = mapped_column(JSONB, default=dict)
    image: Mapped[str | None] = mapped_column(String(64))
    is_enabled: Mapped[bool] = mapped_column(default=True)
    # Optional display window in restaurant local time, e.g. 18:00-23:59 for an evening menu.
    # available_from > available_to means the window crosses midnight.
    available_from: Mapped[time | None] = mapped_column(Time)
    available_to: Mapped[time | None] = mapped_column(Time)
    sort_order: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["Item"]] = relationship(
        back_populates="category", order_by="Item.sort_order, Item.id", cascade="all, delete-orphan"
    )


class Item(Base):
    __tablename__ = "item"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("category.id", ondelete="CASCADE"), index=True)
    name: Mapped[dict] = mapped_column(JSONB, default=dict)
    description: Mapped[dict] = mapped_column(JSONB, default=dict)
    image: Mapped[str | None] = mapped_column(String(64))
    is_enabled: Mapped[bool] = mapped_column(default=True)
    is_available: Mapped[bool] = mapped_column(default=True)  # False = "out of stock"
    badges: Mapped[list[str]] = mapped_column(ARRAY(String(32)), default=list)
    sort_order: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    category: Mapped[Category] = relationship(back_populates="items")
    prices: Mapped[list["ItemPrice"]] = relationship(
        order_by="ItemPrice.sort_order, ItemPrice.id", cascade="all, delete-orphan"
    )
    group_links: Mapped[list["ItemModifierGroup"]] = relationship(
        order_by="ItemModifierGroup.sort_order", cascade="all, delete-orphan"
    )


class ItemPrice(Base):
    """A price variant (size/portion). Exactly one per item is the default."""

    __tablename__ = "item_price"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("item.id", ondelete="CASCADE"), index=True)
    name: Mapped[dict] = mapped_column(JSONB, default=dict)
    amount: Mapped[int]
    is_default: Mapped[bool] = mapped_column(default=False)
    sort_order: Mapped[int] = mapped_column(default=0)


class ModifierGroup(Base):
    """A reusable group of toppings/options, attachable to many items."""

    __tablename__ = "modifier_group"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[dict] = mapped_column(JSONB, default=dict)
    min_select: Mapped[int] = mapped_column(default=0)
    max_select: Mapped[int] = mapped_column(default=1)
    is_required: Mapped[bool] = mapped_column(default=False)
    sort_order: Mapped[int] = mapped_column(default=0)

    modifiers: Mapped[list["Modifier"]] = relationship(
        order_by="Modifier.sort_order, Modifier.id", cascade="all, delete-orphan"
    )


class Modifier(Base):
    __tablename__ = "modifier"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("modifier_group.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[dict] = mapped_column(JSONB, default=dict)
    price: Mapped[int] = mapped_column(default=0)
    is_available: Mapped[bool] = mapped_column(default=True)
    sort_order: Mapped[int] = mapped_column(default=0)


class ItemModifierGroup(Base):
    __tablename__ = "item_modifier_group"

    item_id: Mapped[int] = mapped_column(ForeignKey("item.id", ondelete="CASCADE"), primary_key=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("modifier_group.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    sort_order: Mapped[int] = mapped_column(default=0)
