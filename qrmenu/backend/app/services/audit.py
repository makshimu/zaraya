from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog, User


def audit(
    db: AsyncSession,
    user: User | None,
    action: str,
    entity: str,
    entity_id: int | None = None,
    **data: Any,
) -> None:
    """Queue an audit record; it is committed together with the caller's transaction."""
    db.add(
        AuditLog(
            user_id=user.id if user else None,
            action=action,
            entity=entity,
            entity_id=entity_id,
            data=data,
        )
    )
