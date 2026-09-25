from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://qrmenu:qrmenu@localhost:5432/qrmenu"
    # Tests drive the app from several event loops; pooled asyncpg connections can't cross them
    database_null_pool: bool = False
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

    # Guest session cookie. Keep secure=True in production (Caddy serves HTTPS)
    guest_cookie_name: str = "qr_session"
    guest_cookie_secure: bool = True

    table_token_bytes: int = 12  # 12 bytes -> 16 url-safe chars


@lru_cache
def get_settings() -> Settings:
    return Settings()
