from sqlalchemy import String
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class RestaurantSettings(Base):
    """Single-row table (id=1): the restaurant is single-tenant."""

    __tablename__ = "restaurant_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[dict] = mapped_column(JSONB, default=dict)
    logo_url: Mapped[str | None] = mapped_column(String(512))
    currency: Mapped[str] = mapped_column(String(3), default="VND")
    languages: Mapped[list[str]] = mapped_column(ARRAY(String(8)), default=lambda: ["ru", "en"])
    default_language: Mapped[str] = mapped_column(String(8), default="ru")
    session_ttl_minutes: Mapped[int] = mapped_column(default=180)
    require_first_order_confirmation: Mapped[bool] = mapped_column(default=True)
    require_table_open: Mapped[bool] = mapped_column(default=False)
