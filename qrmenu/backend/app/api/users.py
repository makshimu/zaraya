from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DB, AdminUser
from app.core.security import hash_password
from app.models import User, UserRole
from app.schemas import UserOut
from app.services.audit import audit

router = APIRouter(prefix="/users", tags=["users"])


class UserAdminOut(UserOut):
    is_active: bool


class UserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=255, pattern=r"^[^@\s]+@[^@\s]+$")
    name: str = Field(default="", max_length=255)
    password: str = Field(min_length=6, max_length=128)
    role: UserRole = UserRole.waiter


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    role: UserRole | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)


async def get_user_or_404(db: DB, user_id: int) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user_not_found")
    return user


async def other_active_admins(db: DB, user_id: int) -> int:
    return await db.scalar(
        select(func.count())
        .select_from(User)
        .where(User.role == UserRole.admin, User.is_active, User.id != user_id)
    )


@router.get("", response_model=list[UserAdminOut])
async def list_users(db: DB, _: AdminUser) -> list[User]:
    return list(await db.scalars(select(User).order_by(User.role, User.name, User.email)))


@router.post("", response_model=UserAdminOut, status_code=status.HTTP_201_CREATED)
async def create_user(body: UserCreate, db: DB, admin: AdminUser) -> User:
    user = User(
        email=body.email.strip().lower(),
        name=body.name.strip(),
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "email_taken") from exc
    audit(db, admin, "create", "user", user.id, email=user.email, role=user.role.value)
    await db.commit()
    return user


@router.patch("/{user_id}", response_model=UserAdminOut)
async def update_user(user_id: int, body: UserUpdate, db: DB, admin: AdminUser) -> User:
    user = await get_user_or_404(db, user_id)
    # The restaurant must always keep at least one admin who can sign in
    loses_admin = (body.role not in (None, UserRole.admin)) or body.is_active is False
    if user.role == UserRole.admin and loses_admin and not await other_active_admins(db, user.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "last_admin")

    changes = body.model_dump(exclude_unset=True, exclude_none=True, exclude={"password"})
    for key, value in changes.items():
        setattr(user, key, value.strip() if isinstance(value, str) else value)
    if body.password:
        user.password_hash = hash_password(body.password)
    audit(
        db, admin, "update", "user", user.id,
        **{k: getattr(v, "value", v) for k, v in changes.items()},
        password_changed=bool(body.password),
    )
    await db.commit()
    return user
