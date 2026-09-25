from fastapi import APIRouter

from app.api.deps import DB, CurrentUser
from app.models import RestaurantSettings
from app.schemas import RestaurantSettingsOut

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=RestaurantSettingsOut)
async def get_settings(db: DB, _: CurrentUser) -> RestaurantSettings:
    return await db.get_one(RestaurantSettings, 1)
