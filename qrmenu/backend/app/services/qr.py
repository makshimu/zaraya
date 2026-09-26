import io
from urllib.parse import urlsplit

import segno

from app.core.config import get_settings


def menu_url() -> str:
    """The menu without a table: guests can browse it, ordering needs a table QR."""
    return f"{get_settings().public_base_url.rstrip('/')}/"


def table_url(token: str) -> str:
    return f"{menu_url()}t/{token}"


def is_local_url() -> bool:
    """QR codes that point at this computer only: a phone can't open them."""
    host = urlsplit(get_settings().public_base_url).hostname or ""
    return host in {"localhost", "127.0.0.1", "::1"} or host.endswith(".localhost")


def render_qr(token: str, fmt: str, scale: int = 10) -> bytes:
    return render_url_qr(table_url(token), fmt, scale)


def render_url_qr(url: str, fmt: str, scale: int = 10) -> bytes:
    qr = segno.make(url, error="m")
    buf = io.BytesIO()
    qr.save(buf, kind=fmt, scale=scale, border=2)
    return buf.getvalue()
