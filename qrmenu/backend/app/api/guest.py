from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DB
from app.core.config import get_settings
from app.core.security import create_guest_token, decode_guest_token
from app.models import Category, Item, ModifierGroup, RestaurantSettings, Table, TableSession
from app.schemas.guest import (
    GuestCategoryOut,
    GuestItemOut,
    GuestMenuOut,
    GuestModifierGroupOut,
    GuestSessionOut,
    GuestTableOut,
    RestaurantOut,
)
from app.services import media
from app.services.schedule import category_visible, local_now
from app.services.sessions import SessionStatus, load_session, session_status, start_session

COOKIE = get_settings().guest_cookie_name

# /t/{token} is what the printed QR points at; it lives outside /api
qr_router = APIRouter(tags=["guest"])
router = APIRouter(prefix="/api/guest", tags=["guest"])


@qr_router.get("/t/{token}", include_in_schema=False)
async def scan_qr(token: str, db: DB) -> RedirectResponse:
    """Start a table session and hand the guest a signed httpOnly cookie."""
    table = await db.scalar(select(Table).where(Table.token == token))
    if table is None:
        return RedirectResponse("/?error=invalid_qr", status.HTTP_303_SEE_OTHER)
    if not table.is_active:
        return RedirectResponse("/?error=table_inactive", status.HTTP_303_SEE_OTHER)

    session = await start_session(db, table)
    await db.commit()

    settings = get_settings()
    resp = RedirectResponse("/", status.HTTP_303_SEE_OTHER)
    resp.set_cookie(
        COOKIE,
        create_guest_token(session.id, session.expires_at),
        max_age=int((session.expires_at - session.created_at).total_seconds()) + 24 * 3600,
        httponly=True,
        secure=settings.guest_cookie_secure,
        samesite="lax",
        path="/",
    )
    # Never let a proxy or the browser cache a response that sets a session
    resp.headers["Cache-Control"] = "no-store"
    return resp


async def optional_session(
    db: DB, qr_session: Annotated[str | None, Cookie(alias=COOKIE)] = None
) -> TableSession | None:
    session_id = decode_guest_token(qr_session) if qr_session else None
    return await load_session(db, session_id) if session_id else None


async def active_session(
    session: Annotated[TableSession | None, Depends(optional_session)],
) -> TableSession:
    """For actions that need a live visit: ordering, calling the waiter, asking for the bill."""
    if session is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "session_required")
    current = session_status(session)
    if current != SessionStatus.active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"session_{current.value}")
    return session


OptionalSession = Annotated[TableSession | None, Depends(optional_session)]
ActiveSession = Annotated[TableSession, Depends(active_session)]


@router.get("/session", response_model=GuestSessionOut)
async def get_session(session: OptionalSession) -> GuestSessionOut:
    if session is None:
        return GuestSessionOut(status=None)
    return GuestSessionOut(
        status=session_status(session),
        table=GuestTableOut(number=session.table.number),
        expires_at=session.expires_at,
    )


@router.get("/menu", response_model=GuestMenuOut)
async def get_menu(db: DB) -> GuestMenuOut:
    """Public menu as the guest sees it right now. Viewable without a session."""
    settings = await db.get_one(RestaurantSettings, 1)
    now = local_now(settings.timezone)

    categories = await db.scalars(
        select(Category)
        .where(Category.is_enabled)
        .options(
            selectinload(Category.items).selectinload(Item.prices),
            selectinload(Category.items).selectinload(Item.group_links),
        )
        .order_by(Category.sort_order, Category.id)
    )

    out_categories: list[GuestCategoryOut] = []
    used_groups: set[int] = set()
    for category in categories:
        if not category_visible(category, now):
            continue
        items = []
        for item in category.items:
            if not item.is_enabled or not item.prices:
                continue
            group_ids = [link.group_id for link in item.group_links]
            used_groups.update(group_ids)
            items.append(
                GuestItemOut(
                    id=item.id,
                    name=item.name,
                    description=item.description,
                    image_urls=media.image_urls(item.image),
                    is_available=item.is_available,
                    badges=item.badges,
                    prices=item.prices,
                    modifier_group_ids=group_ids,
                )
            )
        if items:
            out_categories.append(
                GuestCategoryOut(
                    id=category.id,
                    name=category.name,
                    image_urls=media.image_urls(category.image),
                    items=items,
                )
            )

    groups = []
    if used_groups:
        groups = await db.scalars(
            select(ModifierGroup)
            .where(ModifierGroup.id.in_(used_groups))
            .options(selectinload(ModifierGroup.modifiers))
        )

    return GuestMenuOut(
        restaurant=RestaurantOut(
            name=settings.name,
            logo_urls=media.image_urls(settings.logo),
            currency=settings.currency,
            languages=settings.languages,
            default_language=settings.default_language,
        ),
        categories=out_categories,
        modifier_groups=[GuestModifierGroupOut.model_validate(g, from_attributes=True) for g in groups],
    )
