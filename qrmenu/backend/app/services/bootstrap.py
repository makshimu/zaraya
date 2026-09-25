import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password
from app.models import RestaurantSettings, User, UserRole

log = logging.getLogger(__name__)


async def ensure_initial_data(db: AsyncSession) -> None:
    """Create the settings row and the first admin on an empty database."""
    if await db.get(RestaurantSettings, 1) is None:
        db.add(RestaurantSettings(id=1, name={"ru": "Мой ресторан", "en": "My restaurant"}))

    if await db.scalar(select(User.id).limit(1)) is None:
        settings = get_settings()
        db.add(
            User(
                email=settings.admin_email.lower(),
                name="Admin",
                password_hash=hash_password(settings.admin_password),
                role=UserRole.admin,
            )
        )
        log.info("Created initial admin %s", settings.admin_email)

    await db.commit()


async def main() -> None:
    from app.core.db import SessionLocal, engine

    async with SessionLocal() as db:
        await ensure_initial_data(db)
    await engine.dispose()


if __name__ == "__main__":
    import asyncio

    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
