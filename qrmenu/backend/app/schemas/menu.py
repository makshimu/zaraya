import re
from datetime import time
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

LANG_RE = re.compile(r"^[a-z]{2,8}$")
BADGES = ("spicy", "vegan", "vegetarian", "hit", "new")


def _clean_localized(value: dict[str, str]) -> dict[str, str]:
    out = {}
    for lang, text in value.items():
        if not LANG_RE.match(lang):
            raise ValueError(f"invalid language code: {lang}")
        text = text.strip()
        if text:
            out[lang] = text
    return out


def _require_text(value: dict[str, str]) -> dict[str, str]:
    if not value:
        raise ValueError("at least one language is required")
    return value


# {"ru": "...", "en": "..."}; empty translations are dropped
Localized = Annotated[dict[str, Annotated[str, Field(max_length=2000)]], AfterValidator(_clean_localized)]
LocalizedRequired = Annotated[Localized, AfterValidator(_require_text)]
Money = Annotated[int, Field(ge=0, le=10**12)]  # minor units of the restaurant currency
ImageKey = Annotated[str | None, Field(default=None, pattern=r"^[0-9a-f]{32}$")]


class ImageUrls(BaseModel):
    w400: str
    w1200: str


class UploadOut(BaseModel):
    key: str
    urls: ImageUrls


class ReorderIn(BaseModel):
    ids: list[int] = Field(max_length=10_000)


# --- categories ---


class CategoryIn(BaseModel):
    name: LocalizedRequired
    image: ImageKey = None
    is_enabled: bool = True
    available_from: time | None = None
    available_to: time | None = None

    @model_validator(mode="after")
    def schedule_is_complete(self):
        if (self.available_from is None) != (self.available_to is None):
            raise ValueError("available_from and available_to must be set together")
        return self


class CategoryPatch(BaseModel):
    """Quick toggles from the menu tree."""

    is_enabled: bool | None = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: dict[str, str]
    image: str | None
    image_urls: ImageUrls | None
    is_enabled: bool
    available_from: time | None
    available_to: time | None
    sort_order: int


# --- items ---


class PriceIn(BaseModel):
    id: int | None = None
    name: Localized = {}
    amount: Money
    is_default: bool = False


class PriceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: dict[str, str]
    amount: int
    is_default: bool


class ItemIn(BaseModel):
    category_id: int
    name: LocalizedRequired
    description: Localized = {}
    image: ImageKey = None
    is_enabled: bool = True
    is_available: bool = True
    badges: list[str] = []
    prices: list[PriceIn] = Field(min_length=1, max_length=20)
    modifier_group_ids: list[int] = Field(default=[], max_length=50)

    @model_validator(mode="after")
    def check(self):
        defaults = [p for p in self.prices if p.is_default]
        if len(defaults) > 1:
            raise ValueError("only one price can be the default")
        if not defaults:
            self.prices[0].is_default = True
        unknown = set(self.badges) - set(BADGES)
        if unknown:
            raise ValueError(f"unknown badges: {sorted(unknown)}")
        self.badges = list(dict.fromkeys(self.badges))
        self.modifier_group_ids = list(dict.fromkeys(self.modifier_group_ids))
        return self


class ItemPatch(BaseModel):
    """Quick toggles from the menu tree."""

    is_enabled: bool | None = None
    is_available: bool | None = None


class ItemOut(BaseModel):
    id: int
    category_id: int
    name: dict[str, str]
    description: dict[str, str]
    image: str | None
    image_urls: ImageUrls | None
    is_enabled: bool
    is_available: bool
    badges: list[str]
    sort_order: int
    prices: list[PriceOut]
    modifier_group_ids: list[int]


# --- modifier groups ---


class ModifierIn(BaseModel):
    id: int | None = None
    name: LocalizedRequired
    price: Money = 0
    is_available: bool = True


class ModifierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: dict[str, str]
    price: int
    is_available: bool


class ModifierGroupIn(BaseModel):
    name: LocalizedRequired
    min_select: int = Field(default=0, ge=0, le=50)
    max_select: int = Field(default=1, ge=1, le=50)
    is_required: bool = False
    modifiers: list[ModifierIn] = Field(default=[], max_length=100)

    @model_validator(mode="after")
    def check(self):
        # A required group needs at least one pick; a group with min >= 1 is required
        if self.is_required and self.min_select == 0:
            self.min_select = 1
        if self.min_select > 0:
            self.is_required = True
        if self.min_select > self.max_select:
            raise ValueError("min_select must not exceed max_select")
        return self


class ModifierGroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: dict[str, str]
    min_select: int
    max_select: int
    is_required: bool
    sort_order: int
    modifiers: list[ModifierOut]


class MenuOut(BaseModel):
    categories: list[CategoryOut]
    items: list[ItemOut]
    modifier_groups: list[ModifierGroupOut]


class RestaurantSettingsIn(BaseModel):
    name: LocalizedRequired
    logo: ImageKey = None
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    languages: list[Annotated[str, Field(pattern=r"^[a-z]{2,8}$")]] = Field(min_length=1, max_length=20)
    default_language: str
    timezone: str
    session_ttl_minutes: int = Field(ge=1, le=24 * 60)
    require_first_order_confirmation: bool
    require_table_open: bool
    telegram_enabled: bool = False
    telegram_chat_id: str | None = Field(default=None, pattern=r"^(-?\d{1,20}|@[A-Za-z0-9_]{5,32})$")
    # None keeps the stored token, "" removes it
    telegram_bot_token: str | None = Field(default=None, pattern=r"^(|\d{5,15}:[A-Za-z0-9_-]{30,64})$")

    @model_validator(mode="after")
    def check(self):
        from zoneinfo import available_timezones

        self.languages = list(dict.fromkeys(self.languages))
        if self.default_language not in self.languages:
            raise ValueError("default_language must be one of languages")
        # Default language first: the admin shows it first and requires it
        self.languages.remove(self.default_language)
        self.languages.insert(0, self.default_language)
        if self.timezone not in available_timezones():
            raise ValueError("unknown timezone")
        return self
