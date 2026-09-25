from datetime import datetime

from pydantic import BaseModel

from app.schemas.menu import ImageUrls, PriceOut
from app.services.sessions import SessionStatus


class RestaurantOut(BaseModel):
    name: dict[str, str]
    logo_urls: ImageUrls | None
    currency: str
    languages: list[str]
    default_language: str


class GuestModifierOut(BaseModel):
    id: int
    name: dict[str, str]
    price: int
    is_available: bool


class GuestModifierGroupOut(BaseModel):
    id: int
    name: dict[str, str]
    min_select: int
    max_select: int
    is_required: bool
    modifiers: list[GuestModifierOut]


class GuestItemOut(BaseModel):
    id: int
    name: dict[str, str]
    description: dict[str, str]
    image_urls: ImageUrls | None
    is_available: bool
    badges: list[str]
    prices: list[PriceOut]
    modifier_group_ids: list[int]


class GuestCategoryOut(BaseModel):
    id: int
    name: dict[str, str]
    image_urls: ImageUrls | None
    items: list[GuestItemOut]


class GuestMenuOut(BaseModel):
    restaurant: RestaurantOut
    categories: list[GuestCategoryOut]
    modifier_groups: list[GuestModifierGroupOut]


class GuestTableOut(BaseModel):
    number: str


class GuestSessionOut(BaseModel):
    status: SessionStatus | None  # None: no session cookie (menu opened without scanning)
    table: GuestTableOut | None = None
    expires_at: datetime | None = None
