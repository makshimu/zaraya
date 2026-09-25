from datetime import datetime, time
from zoneinfo import ZoneInfo

from app.models import Category


def in_window(now: time, start: time, end: time) -> bool:
    """Minute-precision window, both ends inclusive (18:00-23:59 covers the whole evening).
    A window with start > end crosses midnight."""
    now = now.replace(second=0, microsecond=0)
    if start <= end:
        return start <= now <= end
    return now >= start or now <= end


def category_visible(category: Category, now_local: time) -> bool:
    if not category.is_enabled:
        return False
    if category.available_from is None or category.available_to is None:
        return True
    return in_window(now_local, category.available_from, category.available_to)


def local_now(timezone: str) -> time:
    return datetime.now(ZoneInfo(timezone)).time()
