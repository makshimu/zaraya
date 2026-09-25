from fastapi import APIRouter, HTTPException

from app.api.deps import DB, AdminUser, CurrentUser
from app.models import RestaurantSettings
from app.schemas import RestaurantSettingsOut
from app.schemas.menu import RestaurantSettingsIn
from app.services import media
from app.services.audit import audit

router = APIRouter(prefix="/settings", tags=["settings"])


def settings_out(s: RestaurantSettings) -> RestaurantSettingsOut:
    out = RestaurantSettingsOut.model_validate(s)
    out.logo_urls = media.image_urls(s.logo)
    return out


@router.get("", response_model=RestaurantSettingsOut)
async def get_settings(db: DB, _: CurrentUser) -> RestaurantSettingsOut:
    return settings_out(await db.get_one(RestaurantSettings, 1))


@router.put("", response_model=RestaurantSettingsOut)
async def update_settings(body: RestaurantSettingsIn, db: DB, user: AdminUser) -> RestaurantSettingsOut:
    settings = await db.get_one(RestaurantSettings, 1)
    if body.logo is not None and body.logo != settings.logo and not media.is_valid_key(body.logo):
        raise HTTPException(422, "image_not_found")
    old_logo = settings.logo
    for key, value in body.model_dump().items():
        setattr(settings, key, value)
    audit(db, user, "update", "settings", 1, **body.model_dump(mode="json"))
    await db.commit()
    if old_logo != settings.logo:
        media.delete_image(old_logo)
    return settings_out(settings)
