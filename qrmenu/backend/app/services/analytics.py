"""Order analytics: when guests order, what they order at which time of day, in which language.

Everything is grouped in the restaurant's local time; rejected orders are left out.
"""

from collections import defaultdict
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from pydantic import BaseModel
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Item, Order, OrderItem, OrderStatus, RestaurantSettings

# Parts of the day, local time: [start, end) hours
DAYPARTS = [
    ("morning", 6, 11),
    ("lunch", 11, 15),
    ("afternoon", 15, 18),
    ("evening", 18, 22),
    ("night", 22, 6),  # wraps past midnight
]
TOP_ITEMS = 10
TOP_PER_GROUP = 5


def daypart(hour: int) -> str:
    for key, start, end in DAYPARTS:
        if (start <= hour < end) if start < end else (hour >= start or hour < end):
            return key
    return "night"


class Summary(BaseModel):
    orders: int
    revenue: int
    avg_check: int
    items: int
    visits: int  # distinct guest sessions that ordered


class HourStat(BaseModel):
    hour: int
    orders: int
    revenue: int


class HeatCell(BaseModel):
    weekday: int  # 1 = Monday … 7 = Sunday
    hour: int
    orders: int


class DayStat(BaseModel):
    date: date
    orders: int
    revenue: int


class ItemStat(BaseModel):
    item_id: int | None
    name: dict[str, str]
    quantity: int
    revenue: int


class DaypartStat(BaseModel):
    key: str
    from_hour: int
    to_hour: int
    orders: int
    revenue: int
    top_items: list[ItemStat]


class LanguageStat(BaseModel):
    language: str | None  # None: orders placed before languages were recorded
    orders: int
    revenue: int
    share: float  # of orders, 0..1
    top_items: list[ItemStat]


class AnalyticsOut(BaseModel):
    date_from: date
    date_to: date
    currency: str
    timezone: str
    summary: Summary
    by_hour: list[HourStat]
    heatmap: list[HeatCell]
    by_day: list[DayStat]
    top_items: list[ItemStat]
    dayparts: list[DaypartStat]
    languages: list[LanguageStat]


async def build(db: AsyncSession, date_from: date, date_to: date) -> AnalyticsOut:
    settings = await db.get_one(RestaurantSettings, 1)
    tz = settings.timezone
    start = datetime.combine(date_from, time.min, ZoneInfo(tz))
    end = datetime.combine(date_to + timedelta(days=1), time.min, ZoneInfo(tz))
    local = func.timezone(tz, Order.created_at)
    hour = extract("hour", local).label("hour")
    in_period = (
        Order.created_at >= start,
        Order.created_at < end,
        Order.status != OrderStatus.rejected,
    )

    row = (
        await db.execute(
            select(
                func.count(Order.id),
                func.coalesce(func.sum(Order.total), 0),
                func.count(func.distinct(Order.session_id)),
            ).where(*in_period)
        )
    ).one()
    orders, revenue, visits = int(row[0]), int(row[1]), int(row[2])
    items_sold = await db.scalar(
        select(func.coalesce(func.sum(OrderItem.quantity), 0)).join(Order).where(*in_period)
    )

    by_hour = {h: HourStat(hour=h, orders=0, revenue=0) for h in range(24)}
    for h, n, rev in await db.execute(
        select(hour, func.count(Order.id), func.sum(Order.total)).where(*in_period).group_by(hour)
    ):
        by_hour[int(h)] = HourStat(hour=int(h), orders=n, revenue=int(rev))

    weekday = extract("isodow", local).label("weekday")
    heatmap = [
        HeatCell(weekday=int(w), hour=int(h), orders=n)
        for w, h, n in await db.execute(
            select(weekday, hour, func.count(Order.id)).where(*in_period).group_by(weekday, hour)
        )
    ]

    day = func.date(local).label("day")
    days = {
        d: (n, int(rev))
        for d, n, rev in await db.execute(
            select(day, func.count(Order.id), func.sum(Order.total)).where(*in_period).group_by(day)
        )
    }
    by_day = []
    d = date_from
    while d <= date_to:
        n, rev = days.get(d, (0, 0))
        by_day.append(DayStat(date=d, orders=n, revenue=rev))
        d += timedelta(days=1)

    # Order lines grouped by dish, hour and language; small enough to finish in Python
    line_revenue = func.sum(OrderItem.unit_price * OrderItem.quantity)
    rows = await db.execute(
        select(
            OrderItem.item_id,
            OrderItem.name,
            hour,
            Order.language,
            func.sum(OrderItem.quantity),
            line_revenue,
        )
        .join(Order)
        .where(*in_period)
        .group_by(OrderItem.item_id, OrderItem.name, hour, Order.language)
    )
    current_names = {
        i.id: i.name for i in await db.scalars(select(Item))
    }  # show today's names; deleted dishes keep their ordered name

    def key(item_id, name) -> tuple:
        return (item_id,) if item_id is not None else (None, tuple(sorted(name.items())))

    names: dict[tuple, dict] = {}
    total_by_item: dict[tuple, list[int]] = defaultdict(lambda: [0, 0])
    by_part: dict[str, dict[tuple, list[int]]] = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    by_lang: dict[str | None, dict[tuple, list[int]]] = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    for item_id, name, h, lang, qty, rev in rows:
        k = key(item_id, name)
        names[k] = current_names.get(item_id, name)
        for bucket in (total_by_item[k], by_part[daypart(int(h))][k], by_lang[lang][k]):
            bucket[0] += int(qty)
            bucket[1] += int(rev)

    def top(bucket: dict[tuple, list[int]], n: int) -> list[ItemStat]:
        ranked = sorted(bucket.items(), key=lambda kv: (-kv[1][0], -kv[1][1]))[:n]
        return [ItemStat(item_id=k[0], name=names[k], quantity=q, revenue=r) for k, (q, r) in ranked]

    dayparts = []
    for part, from_hour, to_hour in DAYPARTS:
        hours = [h for h in range(24) if daypart(h) == part]
        dayparts.append(
            DaypartStat(
                key=part,
                from_hour=from_hour,
                to_hour=to_hour,
                orders=sum(by_hour[h].orders for h in hours),
                revenue=sum(by_hour[h].revenue for h in hours),
                top_items=top(by_part[part], TOP_PER_GROUP),
            )
        )

    languages = []
    for lang, n, rev in await db.execute(
        select(Order.language, func.count(Order.id), func.sum(Order.total))
        .where(*in_period)
        .group_by(Order.language)
        .order_by(func.count(Order.id).desc())
    ):
        languages.append(
            LanguageStat(
                language=lang,
                orders=n,
                revenue=int(rev),
                share=n / orders if orders else 0,
                top_items=top(by_lang[lang], TOP_PER_GROUP),
            )
        )

    return AnalyticsOut(
        date_from=date_from,
        date_to=date_to,
        currency=settings.currency,
        timezone=tz,
        summary=Summary(
            orders=orders,
            revenue=revenue,
            avg_check=revenue // orders if orders else 0,
            items=int(items_sold),
            visits=visits,
        ),
        by_hour=list(by_hour.values()),
        heatmap=heatmap,
        by_day=by_day,
        top_items=top(total_by_item, TOP_ITEMS),
        dayparts=dayparts,
        languages=languages,
    )
