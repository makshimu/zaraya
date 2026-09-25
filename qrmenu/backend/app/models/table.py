from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Hall(Base):
    __tablename__ = "hall"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    sort_order: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tables: Mapped[list["Table"]] = relationship(back_populates="hall")


class Table(Base):
    __tablename__ = "table"

    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(32), unique=True)
    hall_id: Mapped[int | None] = mapped_column(ForeignKey("hall.id", ondelete="SET NULL"))
    capacity: Mapped[int] = mapped_column(default=4)
    is_active: Mapped[bool] = mapped_column(default=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    # Set when a waiter seats guests; used when "table must be open" is on. Cleared on close.
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    token_issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    hall: Mapped[Hall | None] = relationship(back_populates="tables")
