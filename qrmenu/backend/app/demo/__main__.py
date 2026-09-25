"""Fill the database with a demo café to click through and 30 days of orders for analytics.

    docker compose exec api python -m app.demo            # only into an empty menu
    docker compose exec api python -m app.demo --reset    # wipe menu, tables and orders first

Users and settings other than the ones listed here are kept. Photos are drawn on the fly.
"""

import argparse
import asyncio
import io
import logging
import random
import uuid
from datetime import UTC, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from sqlalchemy import delete, func, select

from app.core.db import SessionLocal, engine
from app.core.security import hash_password, new_table_token
from app.demo.menu_data import (
    CATEGORIES,
    DAYPART_WEIGHTS,
    HOUR_WEIGHTS,
    ITEMS,
    LANGUAGE_SHARE,
    LANGUAGE_TASTE,
    MODIFIER_GROUPS,
    RESTAURANT_NAME,
)
from app.models import (
    CallStatus,
    CallType,
    Category,
    Hall,
    Item,
    ItemModifierGroup,
    ItemPrice,
    Modifier,
    ModifierGroup,
    Order,
    OrderItem,
    OrderItemModifier,
    OrderStatus,
    PaymentMethod,
    RestaurantSettings,
    ServiceCall,
    Table,
    TableSession,
    User,
    UserRole,
)
from app.models.settings import DEFAULT_LANGUAGES
from app.services import media
from app.services.analytics import daypart
from app.services.bootstrap import ensure_initial_data

log = logging.getLogger("demo")
FONT = Path(__file__).resolve().parent.parent / "assets" / "fonts" / "DejaVuSans-Bold.ttf"
TZ = "Asia/Ho_Chi_Minh"
DAYS = 30

# Colours of the drawn "photos": background, plate, (food colour, size, count)…
STYLES = {
    "green": ((38, 44, 40), [((96, 140, 60), 70, 14), ((250, 244, 230), 48, 3), ((244, 180, 40), 30, 3)]),
    "red": ((40, 34, 32), [((190, 52, 34), 75, 16), ((250, 244, 230), 48, 3), ((244, 180, 40), 30, 3)]),
    "eggs": ((52, 46, 40), [((250, 246, 236), 90, 3), ((246, 176, 32), 38, 3), ((120, 84, 50), 40, 5)]),
    "toast": ((60, 48, 38), [((196, 146, 86), 120, 3), ((120, 170, 70), 50, 6), ((236, 110, 90), 35, 4)]),
    "avotoast": ((34, 40, 36), [((190, 140, 80), 120, 3), ((140, 176, 70), 70, 6), ((250, 246, 236), 40, 2)]),
    "pho": ((30, 32, 34), [((196, 120, 60), 150, 1), ((240, 226, 190), 60, 6), ((110, 160, 70), 30, 10)]),
    "coffee": ((58, 44, 34), [((110, 70, 40), 140, 1), ((210, 170, 120), 60, 2)]),
    "juice": ((40, 52, 38), [((246, 150, 40), 140, 1), ((250, 200, 80), 50, 4)]),
    "cake": ((52, 40, 44), [((120, 60, 40), 120, 2), ((236, 200, 210), 50, 4), ((200, 40, 60), 22, 8)]),
}


def draw_dish(style: str, seed: int) -> bytes:
    rnd = random.Random(seed)
    bg, blobs = STYLES[style]
    img = Image.new("RGB", (1200, 900), bg)
    d = ImageDraw.Draw(img)
    d.ellipse((230, 90, 970, 830), fill=(0, 0, 0))
    img = img.filter(ImageFilter.GaussianBlur(18))
    d = ImageDraw.Draw(img)
    d.ellipse((210, 60, 990, 840), fill=(236, 232, 222))
    d.ellipse((290, 140, 910, 760), fill=(224, 220, 210))
    for color, size, count in blobs:
        for _ in range(count):
            x, y, r = rnd.randint(380, 820), rnd.randint(230, 670), rnd.randint(int(size * 0.6), size)
            jitter = tuple(max(0, min(255, c + rnd.randint(-15, 15))) for c in color)
            d.ellipse((x - r, y - r, x + r, y + r), fill=jitter)
    buf = io.BytesIO()
    img.filter(ImageFilter.GaussianBlur(1.2)).save(buf, "PNG")
    return buf.getvalue()


def draw_logo() -> bytes:
    img = Image.new("RGB", (600, 600), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.ellipse((20, 20, 580, 580), fill=(22, 101, 52))
    font = ImageFont.truetype(str(FONT), 230)
    d.text((300, 290), "LĐ", font=font, fill=(250, 204, 21), anchor="mm")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def weighted(rnd: random.Random, weights: dict):
    keys = list(weights)
    return rnd.choices(keys, weights=[weights[k] for k in keys])[0]


async def wipe(db) -> None:
    images = [*await db.scalars(select(Item.image)), *await db.scalars(select(Category.image))]
    for model in (ServiceCall, Order, TableSession, Table, Hall, Category, ModifierGroup):
        await db.execute(delete(model))
    await db.commit()
    for key in images:
        media.delete_image(key)


async def seed(reset: bool, if_empty: bool) -> None:
    async with SessionLocal() as db:
        await ensure_initial_data(db)
        has_menu = await db.scalar(select(func.count()).select_from(Category))
        if has_menu and not reset:
            if if_empty:
                log.info("menu already present, demo data skipped")
                return
            raise SystemExit("The menu is not empty. Run with --reset to replace it with the demo data.")
        if reset:
            await wipe(db)

        rnd = random.Random(42)

        # --- restaurant settings: Vietnamese first, six menu languages
        settings = await db.get_one(RestaurantSettings, 1)
        settings.name = RESTAURANT_NAME
        settings.languages = list(DEFAULT_LANGUAGES)
        settings.default_language = "vi"
        settings.currency = "VND"
        settings.timezone = TZ
        settings.logo = media.save_image(draw_logo())
        settings.require_first_order_confirmation = True
        settings.require_table_open = False

        # --- staff
        for email, name in (("linh@laodai.vn", "Linh"), ("minh@laodai.vn", "Minh")):
            if not await db.scalar(select(User).where(User.email == email)):
                db.add(User(email=email, name=name, password_hash=hash_password("demo1234"), role=UserRole.waiter))

        # --- halls and tables
        floor = Hall(name="Tầng 1", sort_order=0)
        terrace = Hall(name="Sân thượng", sort_order=1)
        db.add_all([floor, terrace])
        await db.flush()
        tables = [Table(number=str(n), hall_id=floor.id, capacity=4, token=new_table_token()) for n in range(1, 9)]
        tables += [Table(number=f"T{n}", hall_id=terrace.id, capacity=2, token=new_table_token()) for n in range(1, 5)]
        db.add_all(tables)

        # --- menu
        groups = {}
        for i, (key, g) in enumerate(MODIFIER_GROUPS.items()):
            group = ModifierGroup(
                name=g["name"],
                min_select=g["min"],
                max_select=g["max"],
                is_required=g["min"] > 0,
                sort_order=i,
                modifiers=[Modifier(name=n, price=p, sort_order=j) for j, (n, p) in enumerate(g["modifiers"])],
            )
            db.add(group)
            groups[key] = group
        categories = {}
        for i, (key, name, schedule) in enumerate(CATEGORIES):
            start, end = schedule or (None, None)
            category = Category(
                name=name,
                sort_order=i,
                available_from=time.fromisoformat(start) if start else None,
                available_to=time.fromisoformat(end) if end else None,
            )
            db.add(category)
            categories[key] = category
        await db.flush()

        items = {}
        for i, (key, cat, name, desc, prices, badges, group_keys, style) in enumerate(ITEMS):
            item = Item(
                category_id=categories[cat].id,
                name=name,
                description=desc,
                image=media.save_image(draw_dish(style, i)),
                badges=badges,
                sort_order=i,
                prices=[
                    ItemPrice(name=pname or {}, amount=amount, is_default=j == 0, sort_order=j)
                    for j, (pname, amount) in enumerate(prices)
                ],
                group_links=[ItemModifierGroup(group_id=groups[g].id, sort_order=j) for j, g in enumerate(group_keys)],
            )
            db.add(item)
            items[key] = (item, cat, [groups[g] for g in group_keys])
        await db.flush()
        await db.commit()

        # --- 30 days of history for the analytics page
        tz = ZoneInfo(TZ)
        now = datetime.now(tz)
        n_orders = 0

        def pick_item(hour: int, lang: str):
            part = daypart(hour)
            taste = LANGUAGE_TASTE[lang]
            weights = {}
            for key, (item, cat, _) in items.items():
                w = DAYPART_WEIGHTS[part].get(cat, 1) * taste.get(cat, 1) * taste.get(key, 1)
                # evening specials are only on the menu 17:00-22:30
                if cat == "evening" and not 17 <= hour < 23:
                    w = 0
                weights[key] = w
            return items[weighted(rnd, weights)]

        def make_line(entry) -> OrderItem:
            item, _, item_groups = entry
            price = rnd.choice(item.prices) if rnd.random() < 0.3 else item.prices[0]
            chosen = []
            for g in item_groups:
                count = g.min_select if g.min_select else (1 if rnd.random() < 0.35 else 0)
                chosen += [(g, m) for m in rnd.sample(g.modifiers, min(count, len(g.modifiers)))]
            return OrderItem(
                item_id=item.id,
                price_id=price.id,
                name=item.name,
                price_name=price.name,
                unit_price=price.amount + sum(m.price for _, m in chosen),
                quantity=1 if rnd.random() < 0.8 else 2,
                modifiers=[
                    OrderItemModifier(modifier_id=m.id, group_name=g.name, name=m.name, price=m.price)
                    for g, m in chosen
                ],
            )

        def make_order(session: TableSession, table: Table, at: datetime, lang: str, status: OrderStatus) -> Order:
            lines = [make_line(pick_item(at.hour, lang)) for _ in range(rnd.choice([1, 1, 2, 2, 2, 3, 4]))]
            return Order(
                table_id=table.id,
                session_id=session.id,
                idempotency_key=uuid.uuid4().hex,
                status=status,
                language=lang,
                total=sum(line.total for line in lines),
                items=lines,
                created_at=at.astimezone(UTC),
                updated_at=(at + timedelta(minutes=25)).astimezone(UTC),
            )

        for day_offset in range(DAYS, -1, -1):
            day = (now - timedelta(days=day_offset)).date()
            weekend = day.weekday() >= 5
            visits = rnd.randint(34, 52) if weekend else rnd.randint(20, 34)
            for _ in range(visits):
                hour = weighted(rnd, HOUR_WEIGHTS)
                at = datetime.combine(day, time(hour, rnd.randint(0, 59)), tz)
                if at > now - timedelta(minutes=45):
                    continue  # today: only visits that are already over
                lang = weighted(rnd, LANGUAGE_SHARE)
                table = rnd.choice(tables)
                session = TableSession(
                    table_id=table.id,
                    created_at=(at - timedelta(minutes=3)).astimezone(UTC),
                    expires_at=(at + timedelta(hours=3)).astimezone(UTC),
                    closed_at=(at + timedelta(minutes=70)).astimezone(UTC),
                )
                db.add(session)
                await db.flush()
                for k in range(1 if rnd.random() < 0.65 else 2):
                    status = OrderStatus.rejected if rnd.random() < 0.03 else OrderStatus.closed
                    db.add(make_order(session, table, at + timedelta(minutes=20 * k), lang, status))
                    n_orders += 1
            await db.commit()

        # --- the hall right now: guests, a new order, a waiter call, a bill request
        live = {t.number: t for t in tables}

        async def seat(number: str, lang: str, minutes_ago: int) -> tuple[TableSession, Table]:
            table = live[number]
            started = now - timedelta(minutes=minutes_ago)
            session = TableSession(
                table_id=table.id,
                created_at=started.astimezone(UTC),
                expires_at=(started + timedelta(hours=3)).astimezone(UTC),
            )
            db.add(session)
            await db.flush()
            return session, table

        session, table = await seat("2", "en", 4)
        db.add(make_order(session, table, now - timedelta(minutes=2), "en", OrderStatus.pending))
        session, table = await seat("5", "ko", 35)
        db.add(make_order(session, table, now - timedelta(minutes=30), "ko", OrderStatus.served))
        db.add(ServiceCall(table_id=table.id, session_id=session.id, type=CallType.waiter,
                           status=CallStatus.open, created_at=(now - timedelta(minutes=1)).astimezone(UTC)))
        session, table = await seat("7", "vi", 20)
        db.add(make_order(session, table, now - timedelta(minutes=15), "vi", OrderStatus.cooking))
        session, table = await seat("T1", "ru", 60)
        db.add(make_order(session, table, now - timedelta(minutes=55), "ru", OrderStatus.served))
        db.add(ServiceCall(table_id=table.id, session_id=session.id, type=CallType.bill,
                           payment_method=PaymentMethod.card, status=CallStatus.open,
                           created_at=(now - timedelta(minutes=3)).astimezone(UTC)))
        await seat("3", "ja", 10)
        await db.commit()

        log.info(
            "demo ready: %d dishes, %d tables, %d orders over %d days; waiters linh@laodai.vn / minh@laodai.vn, password demo1234",
            len(items), len(tables), n_orders, DAYS,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--reset", action="store_true", help="delete menu, tables, orders and calls first")
    parser.add_argument("--if-empty", action="store_true", help="do nothing if a menu already exists")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    async def run() -> None:
        try:
            await seed(args.reset, args.if_empty)
        finally:
            await engine.dispose()

    asyncio.run(run())


if __name__ == "__main__":
    main()
