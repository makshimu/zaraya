from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import UserRole


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    role: UserRole


class HallIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    sort_order: int = 0


class HallOut(HallIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class TableIn(BaseModel):
    number: str = Field(min_length=1, max_length=32)
    hall_id: int | None = None
    capacity: int = Field(default=4, ge=1, le=100)
    is_active: bool = True


class TableUpdate(BaseModel):
    number: str | None = Field(default=None, min_length=1, max_length=32)
    hall_id: int | None = None
    capacity: int | None = Field(default=None, ge=1, le=100)
    is_active: bool | None = None


class TableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    number: str
    hall_id: int | None
    capacity: int
    is_active: bool
    token: str
    token_issued_at: datetime
    qr_url: str


class RestaurantSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: dict[str, str]
    logo: str | None
    logo_urls: dict[str, str] | None = None
    currency: str
    languages: list[str]
    default_language: str
    timezone: str
    session_ttl_minutes: int
    require_first_order_confirmation: bool
    require_table_open: bool
    tagline: dict[str, str]
    cover: str | None
    cover_urls: dict[str, str] | None = None
    wifi_name: str | None
    wifi_password: str | None
    opening_hours: list[dict] | None
    telegram_enabled: bool
    telegram_chat_id: str | None
    telegram_token_set: bool = False  # the token itself is never sent back
