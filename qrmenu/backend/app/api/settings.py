from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import DB, AdminUser, CurrentUser
from app.models import RestaurantSettings
from app.schemas import RestaurantSettingsOut
from app.schemas.menu import RestaurantSettingsIn
from app.services import media, telegram
from app.services.audit import audit
from app.services.realtime import notify_menu_changed

router = APIRouter(
    prefix="/settings", tags=["settings"], dependencies=[Depends(notify_menu_changed)]
)


def settings_out(s: RestaurantSettings) -> RestaurantSettingsOut:
    out = RestaurantSettingsOut.model_validate(s)
    out.logo_urls = media.image_urls(s.logo)
    out.telegram_token_set = bool(s.telegram_bot_token)
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
    changes = body.model_dump(exclude={"telegram_bot_token"})
    for key, value in changes.items():
        setattr(settings, key, value)
    if body.telegram_bot_token is not None:
        settings.telegram_bot_token = body.telegram_bot_token or None
    if settings.telegram_enabled and not (settings.telegram_bot_token and settings.telegram_chat_id):
        raise HTTPException(422, "telegram_not_configured")
    # The bot token is a secret: keep it out of the audit log
    audit(db, user, "update", "settings", 1, **body.model_dump(mode="json", exclude={"telegram_bot_token"}))
    await db.commit()
    if old_logo != settings.logo:
        media.delete_image(old_logo)
    return settings_out(settings)


@router.post("/telegram-test", status_code=204)
async def telegram_test(db: DB, _: AdminUser) -> None:
    """Send a test message with the saved token and chat, reporting Telegram's own error."""
    settings = await db.get_one(RestaurantSettings, 1)
    if not (settings.telegram_bot_token and settings.telegram_chat_id):
        raise HTTPException(422, "telegram_not_configured")
    try:
        await telegram.send(
            settings.telegram_bot_token, settings.telegram_chat_id, telegram.test_message(settings)
        )
    except telegram.TelegramError as exc:
        raise HTTPException(502, {"code": "telegram_error", "message": str(exc)}) from exc
