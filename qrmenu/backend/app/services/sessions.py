import enum
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import RestaurantSettings, Table, TableSession


class SessionStatus(str, enum.Enum):
    active = "active"
    expired = "expired"  # TTL passed: menu is viewable, ordering is blocked
    closed = "closed"  # staff closed the table
    table_inactive = "table_inactive"
    table_not_open = "table_not_open"  # "table must be open" is on and no waiter opened it yet


async def start_session(db: AsyncSession, table: Table) -> TableSession:
    settings = await db.get_one(RestaurantSettings, 1)
    now = datetime.now(UTC)
    session = TableSession(
        table_id=table.id,
        created_at=now,
        expires_at=now + timedelta(minutes=settings.session_ttl_minutes),
    )
    db.add(session)
    await db.flush()
    return session


async def load_session(db: AsyncSession, session_id: uuid.UUID) -> TableSession | None:
    return await db.get(TableSession, session_id, options=[selectinload(TableSession.table)])


def session_status(
    session: TableSession, require_table_open: bool, now: datetime | None = None
) -> SessionStatus:
    now = now or datetime.now(UTC)
    if session.closed_at is not None:
        return SessionStatus.closed
    if not session.table.is_active:
        return SessionStatus.table_inactive
    if session.expires_at <= now:
        return SessionStatus.expired
    if require_table_open and session.table.opened_at is None:
        return SessionStatus.table_not_open
    return SessionStatus.active
