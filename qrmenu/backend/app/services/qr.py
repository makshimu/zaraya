import io

import segno

from app.core.config import get_settings


def table_url(token: str) -> str:
    return f"{get_settings().public_base_url.rstrip('/')}/t/{token}"


def render_qr(token: str, fmt: str, scale: int = 10) -> bytes:
    qr = segno.make(table_url(token), error="m")
    buf = io.BytesIO()
    qr.save(buf, kind=fmt, scale=scale, border=2)
    return buf.getvalue()
