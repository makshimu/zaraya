import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.table import Table


class TableSession(Base):
    """A guest's visit started by scanning a table QR. One per phone, not per table."""

    __tablename__ = "table_session"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    table_id: Mapped[int] = mapped_column(ForeignKey("table.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # Set when staff close the table; the guest token stops working immediately
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    table: Mapped[Table] = relationship()
