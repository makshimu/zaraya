import os
from collections.abc import AsyncIterator

# Point the app at a dedicated test database before anything imports app.core.db
BASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://qrmenu:qrmenu@localhost:5432/qrmenu"
)
TEST_DB = BASE_URL.rsplit("/", 1)[1] + "_test"
TEST_URL = BASE_URL.rsplit("/", 1)[0] + "/" + TEST_DB
os.environ["DATABASE_URL"] = TEST_URL
os.environ["DATABASE_NULL_POOL"] = "true"
os.environ["PUBLIC_BASE_URL"] = "https://menu.test"
os.environ["ADMIN_EMAIL"] = "admin@example.com"
os.environ["ADMIN_PASSWORD"] = "secret-pass"
import tempfile  # noqa: E402

os.environ["MEDIA_DIR"] = tempfile.mkdtemp(prefix="qrmenu-media-")
os.environ["JWT_SECRET"] = "test-secret-that-is-long-enough-for-hs256"

import asyncpg  # noqa: E402
import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.db import SessionLocal, engine  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User, UserRole  # noqa: E402
from app.services.bootstrap import ensure_initial_data  # noqa: E402

ADMIN = {"email": "admin@example.com", "password": "secret-pass"}
WAITER = {"email": "waiter@example.com", "password": "waiter-pass"}


def _asyncpg_dsn(url: str) -> str:
    return url.replace("postgresql+asyncpg://", "postgresql://")


@pytest.fixture(scope="session", autouse=True)
async def database() -> AsyncIterator[None]:
    admin_dsn = _asyncpg_dsn(BASE_URL.rsplit("/", 1)[0] + "/postgres")
    conn = await asyncpg.connect(admin_dsn)
    await conn.execute(f'DROP DATABASE IF EXISTS "{TEST_DB}" WITH (FORCE)')
    await conn.execute(f'CREATE DATABASE "{TEST_DB}"')
    await conn.close()

    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    cfg.attributes["configure_logger"] = False
    cfg.attributes["database_url"] = TEST_URL
    # alembic's async env runs its own event loop, so run it in a worker thread
    import asyncio

    await asyncio.to_thread(command.upgrade, cfg, "head")
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
async def clean_db() -> AsyncIterator[None]:
    async with engine.begin() as conn:
        await conn.execute(
            text(
                'TRUNCATE "audit_log", "table", "hall", "user", "restaurant_settings", '
                '"category", "modifier_group", "table_session", "order", "service_call" '
                "RESTART IDENTITY CASCADE"
            )
        )
    async with SessionLocal() as db:
        await ensure_initial_data(db)
        db.add(
            User(
                email=WAITER["email"],
                name="Waiter",
                password_hash=hash_password(WAITER["password"]),
                role=UserRole.waiter,
            )
        )
        await db.commit()
    yield


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def _login(client: AsyncClient, creds: dict) -> AsyncClient:
    resp = await client.post("/api/admin/auth/login", json=creds)
    assert resp.status_code == 200, resp.text
    client.headers["Authorization"] = f"Bearer {resp.json()['access_token']}"
    return client


@pytest.fixture
async def admin_client(client: AsyncClient) -> AsyncClient:
    return await _login(client, ADMIN)


@pytest.fixture
async def waiter_client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield await _login(c, WAITER)


@pytest.fixture
async def guest_client() -> AsyncIterator[AsyncClient]:
    """A guest phone: https so the Secure session cookie round-trips."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as c:
        yield c
