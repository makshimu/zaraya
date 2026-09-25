from fastapi import APIRouter, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, AdminUser, CurrentUser
from app.core.config import get_settings
from app.models import Category, Item, ItemModifierGroup, ItemPrice, Modifier, ModifierGroup
from app.schemas.menu import (
    CategoryIn,
    CategoryOut,
    CategoryPatch,
    ItemIn,
    ItemOut,
    ItemPatch,
    MenuOut,
    ModifierGroupIn,
    ModifierGroupOut,
    ReorderIn,
    UploadOut,
)
from app.services import media
from app.services.audit import audit

router = APIRouter(tags=["menu"])

UNPROCESSABLE = 422


# --- serialization ---


def category_out(c: Category) -> CategoryOut:
    return CategoryOut(
        id=c.id,
        name=c.name,
        image=c.image,
        image_urls=media.image_urls(c.image),
        is_enabled=c.is_enabled,
        available_from=c.available_from,
        available_to=c.available_to,
        sort_order=c.sort_order,
    )


def item_out(i: Item) -> ItemOut:
    return ItemOut(
        id=i.id,
        category_id=i.category_id,
        name=i.name,
        description=i.description,
        image=i.image,
        image_urls=media.image_urls(i.image),
        is_enabled=i.is_enabled,
        is_available=i.is_available,
        badges=i.badges,
        sort_order=i.sort_order,
        prices=i.prices,
        modifier_group_ids=[link.group_id for link in i.group_links],
    )


ITEM_LOAD = (selectinload(Item.prices), selectinload(Item.group_links))
GROUP_LOAD = (selectinload(ModifierGroup.modifiers),)


async def load_item(db: DB, item_id: int) -> Item:
    item = await db.scalar(select(Item).where(Item.id == item_id).options(*ITEM_LOAD))
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "item_not_found")
    return item


async def load_group(db: DB, group_id: int) -> ModifierGroup:
    group = await db.scalar(
        select(ModifierGroup).where(ModifierGroup.id == group_id).options(*GROUP_LOAD)
    )
    if group is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "modifier_group_not_found")
    return group


async def get_category_or_404(db: DB, category_id: int) -> Category:
    category = await db.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "category_not_found")
    return category


def check_image(key: str | None) -> None:
    if key is not None and not media.is_valid_key(key):
        raise HTTPException(UNPROCESSABLE, "image_not_found")


async def next_sort_order(db: DB, column, *where) -> int:
    current = await db.scalar(select(func.max(column)).where(*where))
    return (current or 0) + 1


async def apply_order(db: DB, model, ids: list[int], *where) -> None:
    """Set sort_order by position in ids; ids must be exactly the rows in scope."""
    rows = {r.id: r for r in await db.scalars(select(model).where(*where))}
    if sorted(rows) != sorted(ids):
        raise HTTPException(UNPROCESSABLE, "order_ids_mismatch")
    for position, row_id in enumerate(ids):
        rows[row_id].sort_order = position


# --- whole menu ---


@router.get("/menu", response_model=MenuOut)
async def get_menu(db: DB, _: CurrentUser) -> MenuOut:
    categories = await db.scalars(select(Category).order_by(Category.sort_order, Category.id))
    items = await db.scalars(
        select(Item)
        .join(Category)
        .options(*ITEM_LOAD)
        .order_by(Category.sort_order, Category.id, Item.sort_order, Item.id)
    )
    groups = await db.scalars(
        select(ModifierGroup).options(*GROUP_LOAD).order_by(ModifierGroup.sort_order, ModifierGroup.id)
    )
    return MenuOut(
        categories=[category_out(c) for c in categories],
        items=[item_out(i) for i in items],
        modifier_groups=[ModifierGroupOut.model_validate(g) for g in groups],
    )


# --- uploads ---


@router.post("/uploads/image", response_model=UploadOut, status_code=status.HTTP_201_CREATED)
async def upload_image(file: UploadFile, _: AdminUser) -> UploadOut:
    limit = get_settings().max_upload_mb * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "file_too_large")
    try:
        key = media.save_image(data)
    except media.InvalidImage as exc:
        raise HTTPException(UNPROCESSABLE, "invalid_image") from exc
    return UploadOut(key=key, urls=media.image_urls(key))


# --- categories ---


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(body: CategoryIn, db: DB, user: AdminUser) -> CategoryOut:
    check_image(body.image)
    category = Category(
        **body.model_dump(), sort_order=await next_sort_order(db, Category.sort_order)
    )
    db.add(category)
    await db.flush()
    audit(db, user, "create", "category", category.id, name=category.name)
    await db.commit()
    return category_out(category)


@router.put("/categories/order", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_categories(body: ReorderIn, db: DB, user: AdminUser) -> None:
    await apply_order(db, Category, body.ids)
    audit(db, user, "reorder", "category", ids=body.ids)
    await db.commit()


@router.put("/categories/{category_id}", response_model=CategoryOut)
async def update_category(category_id: int, body: CategoryIn, db: DB, user: AdminUser) -> CategoryOut:
    category = await get_category_or_404(db, category_id)
    check_image(body.image)
    old_image = category.image
    for key, value in body.model_dump().items():
        setattr(category, key, value)
    audit(db, user, "update", "category", category.id, **body.model_dump(mode="json"))
    await db.commit()
    if old_image != category.image:
        media.delete_image(old_image)
    return category_out(category)


@router.patch("/categories/{category_id}", response_model=CategoryOut)
async def patch_category(
    category_id: int, body: CategoryPatch, db: DB, user: AdminUser
) -> CategoryOut:
    category = await get_category_or_404(db, category_id)
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    for key, value in changes.items():
        setattr(category, key, value)
    audit(db, user, "update", "category", category.id, **changes)
    await db.commit()
    return category_out(category)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(category_id: int, db: DB, user: AdminUser) -> None:
    category = await db.scalar(
        select(Category).where(Category.id == category_id).options(selectinload(Category.items))
    )
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "category_not_found")
    images = [category.image, *(i.image for i in category.items)]
    audit(db, user, "delete", "category", category.id, name=category.name)
    await db.delete(category)
    await db.commit()
    for key in images:
        media.delete_image(key)


@router.put("/categories/{category_id}/items/order", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_items(category_id: int, body: ReorderIn, db: DB, user: AdminUser) -> None:
    await get_category_or_404(db, category_id)
    await apply_order(db, Item, body.ids, Item.category_id == category_id)
    audit(db, user, "reorder", "item", category_id=category_id, ids=body.ids)
    await db.commit()


# --- items ---


async def apply_item(db: DB, item: Item, body: ItemIn) -> None:
    await get_category_or_404(db, body.category_id)
    check_image(body.image)

    if body.modifier_group_ids:
        found = set(
            await db.scalars(
                select(ModifierGroup.id).where(ModifierGroup.id.in_(body.modifier_group_ids))
            )
        )
        if found != set(body.modifier_group_ids):
            raise HTTPException(UNPROCESSABLE, "modifier_group_not_found")

    if item.id is not None and item.category_id != body.category_id:
        # Moved to another category: append at its end
        item.sort_order = await next_sort_order(
            db, Item.sort_order, Item.category_id == body.category_id
        )

    item.category_id = body.category_id
    item.name = body.name
    item.description = body.description
    item.image = body.image
    item.is_enabled = body.is_enabled
    item.is_available = body.is_available
    item.badges = body.badges

    # Prices: keep rows by id (stable ids), create new ones, drop the rest
    existing = {p.id: p for p in item.prices}
    prices = []
    for position, price_in in enumerate(body.prices):
        if price_in.id is not None:
            price = existing.get(price_in.id)
            if price is None:
                raise HTTPException(UNPROCESSABLE, "price_not_found")
        else:
            price = ItemPrice()
        price.name = price_in.name
        price.amount = price_in.amount
        price.is_default = price_in.is_default
        price.sort_order = position
        prices.append(price)
    item.prices = prices

    links = {link.group_id: link for link in item.group_links}
    item.group_links = [
        links.get(group_id) or ItemModifierGroup(group_id=group_id)
        for group_id in body.modifier_group_ids
    ]
    for position, link in enumerate(item.group_links):
        link.sort_order = position


@router.post("/items", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
async def create_item(body: ItemIn, db: DB, user: AdminUser) -> ItemOut:
    item = Item(prices=[], group_links=[])
    await apply_item(db, item, body)
    item.sort_order = await next_sort_order(db, Item.sort_order, Item.category_id == body.category_id)
    db.add(item)
    await db.flush()
    audit(db, user, "create", "item", item.id, name=item.name)
    await db.commit()
    return item_out(await load_item(db, item.id))


@router.put("/items/{item_id}", response_model=ItemOut)
async def update_item(item_id: int, body: ItemIn, db: DB, user: AdminUser) -> ItemOut:
    item = await load_item(db, item_id)
    old_image = item.image
    await apply_item(db, item, body)
    audit(db, user, "update", "item", item.id, **body.model_dump(mode="json"))
    await db.commit()
    if old_image != item.image:
        media.delete_image(old_image)
    db.expire_all()
    return item_out(await load_item(db, item_id))


@router.patch("/items/{item_id}", response_model=ItemOut)
async def patch_item(item_id: int, body: ItemPatch, db: DB, user: AdminUser) -> ItemOut:
    item = await load_item(db, item_id)
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    for key, value in changes.items():
        setattr(item, key, value)
    audit(db, user, "update", "item", item.id, **changes)
    await db.commit()
    return item_out(await load_item(db, item_id))


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: int, db: DB, user: AdminUser) -> None:
    item = await load_item(db, item_id)
    audit(db, user, "delete", "item", item.id, name=item.name)
    await db.delete(item)
    await db.commit()
    media.delete_image(item.image)


# --- modifier groups ---


def apply_group(group: ModifierGroup, body: ModifierGroupIn) -> None:
    group.name = body.name
    group.min_select = body.min_select
    group.max_select = body.max_select
    group.is_required = body.is_required

    existing = {m.id: m for m in group.modifiers}
    modifiers = []
    for position, mod_in in enumerate(body.modifiers):
        if mod_in.id is not None:
            modifier = existing.get(mod_in.id)
            if modifier is None:
                raise HTTPException(UNPROCESSABLE, "modifier_not_found")
        else:
            modifier = Modifier()
        modifier.name = mod_in.name
        modifier.price = mod_in.price
        modifier.is_available = mod_in.is_available
        modifier.sort_order = position
        modifiers.append(modifier)
    group.modifiers = modifiers


@router.post("/modifier-groups", response_model=ModifierGroupOut, status_code=status.HTTP_201_CREATED)
async def create_group(body: ModifierGroupIn, db: DB, user: AdminUser) -> ModifierGroup:
    group = ModifierGroup(
        modifiers=[], sort_order=await next_sort_order(db, ModifierGroup.sort_order)
    )
    apply_group(group, body)
    db.add(group)
    await db.flush()
    audit(db, user, "create", "modifier_group", group.id, name=group.name)
    await db.commit()
    return await load_group(db, group.id)


@router.put("/modifier-groups/order", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_groups(body: ReorderIn, db: DB, user: AdminUser) -> None:
    await apply_order(db, ModifierGroup, body.ids)
    audit(db, user, "reorder", "modifier_group", ids=body.ids)
    await db.commit()


@router.put("/modifier-groups/{group_id}", response_model=ModifierGroupOut)
async def update_group(group_id: int, body: ModifierGroupIn, db: DB, user: AdminUser) -> ModifierGroup:
    group = await load_group(db, group_id)
    apply_group(group, body)
    audit(db, user, "update", "modifier_group", group.id, **body.model_dump(mode="json"))
    await db.commit()
    db.expire_all()
    return await load_group(db, group_id)


@router.delete("/modifier-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(group_id: int, db: DB, user: AdminUser) -> None:
    group = await load_group(db, group_id)
    audit(db, user, "delete", "modifier_group", group.id, name=group.name)
    await db.delete(group)
    await db.commit()
