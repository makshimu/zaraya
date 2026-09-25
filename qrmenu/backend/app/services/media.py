"""Image uploads: resized on the backend to webp 400px and 1200px, stored on a local volume."""

import io
import uuid
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import get_settings

SIZES = (400, 1200)
Image.MAX_IMAGE_PIXELS = 50_000_000  # refuse decompression bombs


class InvalidImage(ValueError):
    pass


def _dir() -> Path:
    path = Path(get_settings().media_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _file(key: str, size: int) -> Path:
    return _dir() / f"{key}_{size}.webp"


def image_urls(key: str | None) -> dict[str, str] | None:
    if not key:
        return None
    prefix = get_settings().media_url_prefix.rstrip("/")
    return {f"w{size}": f"{prefix}/{key}_{size}.webp" for size in SIZES}


def save_image(data: bytes) -> str:
    """Store an uploaded image in every size and return its key."""
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise InvalidImage from exc

    img = ImageOps.exif_transpose(img)  # respect phone camera orientation; EXIF is dropped
    img = img.convert("RGBA" if img.mode in ("RGBA", "LA", "P") else "RGB")

    key = uuid.uuid4().hex
    for size in SIZES:
        copy = img.copy()
        copy.thumbnail((size, size), Image.Resampling.LANCZOS)
        copy.save(_file(key, size), "WEBP", quality=82, method=6)
    return key


def is_valid_key(key: str) -> bool:
    return len(key) == 32 and all(c in "0123456789abcdef" for c in key) and _file(key, SIZES[0]).exists()


def delete_image(key: str | None) -> None:
    if not key:
        return
    for size in SIZES:
        _file(key, size).unlink(missing_ok=True)
