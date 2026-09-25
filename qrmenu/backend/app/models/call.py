import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.table import Table
from app.models.user import User


class CallType(str, enum.Enum):
    waiter = "waiter"
    bill = "bill"


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    card = "card"
    qr = "qr"  # bank transfer by QR code


class CallStatus(str, enum.Enum):
    open = "open"
    taken = "taken"  # a waiter pressed "Take"; who did is recorded


class ServiceCall(Base):
    """A guest calling the waiter or asking for the bill."""

    __tablename__ = "service_call"

    id: Mapped[int] = mapped_column(primary_key=True)
    table_id: Mapped[int] = mapped_column(ForeignKey("table.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("table_session.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[CallType] = mapped_column(Enum(CallType, name="call_type"))
    payment_method: Mapped[PaymentMethod | None] = mapped_column(
        Enum(PaymentMethod, name="payment_method")
    )
    status: Mapped[CallStatus] = mapped_column(
        Enum(CallStatus, name="call_status"), default=CallStatus.open, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    taken_by_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="SET NULL"))

    table: Mapped[Table] = relationship()
    taken_by: Mapped[User | None] = relationship()
