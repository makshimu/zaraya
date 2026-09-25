from sqlalchemy import String
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


# Menu languages of a new restaurant; the first one is the main language
DEFAULT_LANGUAGES = ("vi", "en", "ru", "ja", "ko", "zh")


class RestaurantSettings(Base):
    """Single-row table (id=1): the restaurant is single-tenant."""

    __tablename__ = "restaurant_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[dict] = mapped_column(JSONB, default=dict)
    logo: Mapped[str | None] = mapped_column(String(64))  # media key
    currency: Mapped[str] = mapped_column(String(3), default="VND")
    languages: Mapped[list[str]] = mapped_column(
        ARRAY(String(8)), default=lambda: list(DEFAULT_LANGUAGES)
    )
    default_language: Mapped[str] = mapped_column(String(8), default=DEFAULT_LANGUAGES[0])
    # IANA zone used for category display schedules
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Ho_Chi_Minh")
    session_ttl_minutes: Mapped[int] = mapped_column(default=180)
    require_first_order_confirmation: Mapped[bool] = mapped_column(default=True)
    require_table_open: Mapped[bool] = mapped_column(default=False)
    # Staff chat in Telegram that mirrors new orders and calls
    telegram_enabled: Mapped[bool] = mapped_column(default=False)
    telegram_bot_token: Mapped[str | None] = mapped_column(String(128))  # write-only in the API
    telegram_chat_id: Mapped[str | None] = mapped_column(String(64))
