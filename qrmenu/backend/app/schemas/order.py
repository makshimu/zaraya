from datetime import datetime

from pydantic import BaseModel, Field

from app.models import OrderStatus


class OrderLineIn(BaseModel):
    item_id: int
    price_id: int
    modifier_ids: list[int] = Field(default=[], max_length=50)
    quantity: int = Field(ge=1, le=99)
    comment: str = Field(default="", max_length=500)


class OrderIn(BaseModel):
    """Only ids and quantities: the backend looks up every price itself."""

    items: list[OrderLineIn] = Field(min_length=1, max_length=50)
    comment: str = Field(default="", max_length=500)
    language: str | None = Field(default=None, max_length=8)  # the menu language on screen


class OrderItemModifierOut(BaseModel):
    group_name: dict[str, str]
    name: dict[str, str]
    price: int


class OrderItemOut(BaseModel):
    id: int
    item_id: int | None
    name: dict[str, str]
    price_name: dict[str, str]
    unit_price: int
    quantity: int
    total: int
    comment: str
    modifiers: list[OrderItemModifierOut]


class OrderOut(BaseModel):
    id: int
    table_id: int
    table_number: str
    status: OrderStatus
    comment: str
    language: str | None
    total: int
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemOut]


class StaffOrderOut(OrderOut):
    session_id: str
    updated_by: str | None  # who last changed the status


class StatusIn(BaseModel):
    status: OrderStatus


class EditLineIn(BaseModel):
    id: int
    quantity: int = Field(ge=1, le=99)


class EditItemsIn(BaseModel):
    """Lines to keep with their new quantities; lines left out are removed."""

    items: list[EditLineIn] = Field(min_length=1, max_length=50)
