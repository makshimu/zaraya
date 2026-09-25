import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI, Response, status
from fastapi.staticfiles import StaticFiles
from redis.asyncio import Redis
from sqlalchemy import text

from app.api import auth, guest, hall, menu, orders, settings, tables
from app.core.config import get_settings
from app.core.db import SessionLocal
from app.services.realtime import hub

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if get_settings().jwt_secret == "change-me":
        log.warning("JWT_SECRET is not set - using an insecure default")
    hub.start()
    yield
    await hub.stop()


app = FastAPI(title="QR Menu API", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json")

admin = APIRouter(prefix="/api/admin")
admin.include_router(auth.router)
admin.include_router(settings.router)
admin.include_router(tables.router)
admin.include_router(menu.router)
admin.include_router(orders.router)
admin.include_router(hall.router)
app.include_router(admin)
app.include_router(guest.router)
app.include_router(guest.qr_router)

# In production Caddy serves /media straight from the volume; this mount covers local dev
_media = get_settings()
Path(_media.media_dir).mkdir(parents=True, exist_ok=True)
app.mount(_media.media_url_prefix, StaticFiles(directory=_media.media_dir), name="media")


@app.get("/api/health", tags=["health"])
async def health(response: Response) -> dict[str, str]:
    result = {"db": "ok", "redis": "ok"}
    try:
        async with SessionLocal() as db:
            await db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 - report any failure as unhealthy
        result["db"] = "error"
    try:
        redis = Redis.from_url(get_settings().redis_url)
        async with redis:
            await redis.ping()
    except Exception:  # noqa: BLE001
        result["redis"] = "error"
    if "error" in result.values():
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return result
