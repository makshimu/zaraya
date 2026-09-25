from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://qrmenu:qrmenu@localhost:5432/qrmenu"
    redis_url: str = "redis://localhost:6379/0"

    # Public origin guests reach, used inside QR codes: https://example.com
    public_base_url: str = "https://localhost"

    jwt_secret: str = "change-me"
    jwt_ttl_minutes: int = 60 * 12

    # First admin, created at startup when the user table is empty
    admin_email: str = "admin@example.com"
    admin_password: str = "admin"

    # Uploaded images; served by Caddy (and by the api itself in dev) under /media
    media_dir: str = "/data/media"
    media_url_prefix: str = "/media"
    max_upload_mb: int = 10

    table_token_bytes: int = 12  # 12 bytes -> 16 url-safe chars


@lru_cache
def get_settings() -> Settings:
    return Settings()
