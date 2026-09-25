from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query

from app.api.deps import DB, AdminUser
from app.models import RestaurantSettings
from app.services.analytics import AnalyticsOut, build

router = APIRouter(tags=["analytics"])

MAX_DAYS = 366


@router.get("/analytics", response_model=AnalyticsOut)
async def analytics(
    db: DB,
    _: AdminUser,
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
) -> AnalyticsOut:
    """Defaults to the last 30 days including today (restaurant time zone)."""
    settings = await db.get_one(RestaurantSettings, 1)
    today = datetime.now(ZoneInfo(settings.timezone)).date()
    date_to = date_to or today
    date_from = date_from or date_to - timedelta(days=29)
    if date_from > date_to:
        raise HTTPException(422, "invalid_period")
    if (date_to - date_from).days >= MAX_DAYS:
        raise HTTPException(422, "period_too_long")
    return await build(db, date_from, date_to)
