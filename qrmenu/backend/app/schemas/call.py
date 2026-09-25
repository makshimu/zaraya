from datetime import datetime
from typing import Literal

from pydantic import BaseModel, model_validator

from app.models import CallStatus, CallType, PaymentMethod
from app.schemas.order import StaffOrderOut


class CallIn(BaseModel):
    type: CallType
    payment_method: PaymentMethod | None = None

    @model_validator(mode="after")
    def check(self):
        if self.type == CallType.bill and self.payment_method is None:
            raise ValueError("payment_method is required for the bill")
        if self.type == CallType.waiter and self.payment_method is not None:
            raise ValueError("payment_method only applies to the bill")
        return self


class GuestCallOut(BaseModel):
    id: int
    type: CallType
    payment_method: PaymentMethod | None
    status: CallStatus
    created_at: datetime


class StaffCallOut(GuestCallOut):
    table_id: int
    table_number: str
    taken_at: datetime | None
    taken_by: str | None


# Hall tile colour, most urgent first
TableState = Literal["bill", "waiter", "new_order", "occupied", "free"]


class HallTableOut(BaseModel):
    id: int
    number: str
    hall_id: int | None
    capacity: int
    is_active: bool
    opened_at: datetime | None
    state: TableState
    guests: int  # phones with a live session
    active_orders: int
    pending_orders: int
    visit_total: int  # all non-rejected orders of the current visit
    open_calls: list[StaffCallOut]


class TableVisitOut(BaseModel):
    table: HallTableOut
    orders: list[StaffOrderOut]
    calls: list[StaffCallOut]
