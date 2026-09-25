"""Printable A4 sheets with one card per table: logo or name, QR, table number, a hint."""

import io
from pathlib import Path

import segno
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

from app.core.config import get_settings
from app.models import RestaurantSettings, Table
from app.services.qr import table_url

# DejaVu ships with the app (see assets/fonts/LICENSE-DejaVu.txt): it covers Cyrillic and Vietnamese
FONT_DIRS = [str(Path(__file__).resolve().parent.parent / "assets" / "fonts")]
# Card texts in the restaurant's main language. DejaVu has no CJK glyphs, so a Japanese,
# Korean or Chinese main language falls back to English on the printed cards.
HINTS = {
    "vi": "Quét mã để xem thực đơn và gọi món",
    "ru": "Отсканируйте, чтобы открыть меню и сделать заказ",
    "en": "Scan to see the menu and order",
}
TABLE_WORD = {"vi": "Bàn", "ru": "Стол", "en": "Table"}

COLS, ROWS = 2, 3
CARD_W, CARD_H = 90 * mm, 90 * mm
QR_SIZE = 52 * mm


def _register_fonts() -> tuple[str, str]:
    """The built-in PDF fonts have no Cyrillic, so embed DejaVu."""
    for directory in FONT_DIRS:
        regular, bold = Path(directory, "DejaVuSans.ttf"), Path(directory, "DejaVuSans-Bold.ttf")
        if regular.exists() and bold.exists():
            if "DejaVu" not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont("DejaVu", str(regular)))
                pdfmetrics.registerFont(TTFont("DejaVu-Bold", str(bold)))
            return "DejaVu", "DejaVu-Bold"
    return "Helvetica", "Helvetica-Bold"


def _draw_qr(c: Canvas, url: str, x: float, y: float, size: float) -> None:
    """Vector QR: stays sharp however large it is printed."""
    qr = segno.make(url, error="m")
    matrix = [list(row) for row in qr.matrix]
    n = len(matrix)
    cell = size / n
    c.setFillColorRGB(0, 0, 0)
    for r, row in enumerate(matrix):
        for col, dark in enumerate(row):
            if dark:
                c.rect(x + col * cell, y + size - (r + 1) * cell, cell + 0.05, cell + 0.05, stroke=0, fill=1)


def _logo(settings: RestaurantSettings) -> ImageReader | None:
    if not settings.logo:
        return None
    path = Path(get_settings().media_dir) / f"{settings.logo}_400.webp"
    if not path.exists():
        return None
    img = Image.open(path)
    img.load()
    return ImageReader(img.convert("RGBA"))


def _fit(c: Canvas, text: str, font: str, size: float, width: float) -> float:
    """Shrink the font until the text fits the card."""
    while size > 6 and c.stringWidth(text, font, size) > width:
        size -= 0.5
    return size


def render_tables_pdf(tables: list[Table], settings: RestaurantSettings) -> bytes:
    regular, bold = _register_fonts()
    lang = settings.default_language
    name = settings.name.get(lang) or next(iter(settings.name.values()), "")
    hint = HINTS.get(lang, HINTS["en"])
    word = TABLE_WORD.get(lang, TABLE_WORD["en"])
    logo = _logo(settings)

    buf = io.BytesIO()
    c = Canvas(buf, pagesize=A4)
    c.setTitle(f"{name} — QR")
    page_w, page_h = A4
    margin_x = (page_w - COLS * CARD_W) / 2
    margin_y = (page_h - ROWS * CARD_H) / 2
    per_page = COLS * ROWS

    for i, table in enumerate(tables):
        if i and i % per_page == 0:
            c.showPage()
        slot = i % per_page
        x = margin_x + (slot % COLS) * CARD_W
        y = page_h - margin_y - (slot // COLS + 1) * CARD_H
        cx = x + CARD_W / 2

        # dashed cutting guide
        c.setStrokeColorRGB(0.75, 0.75, 0.75)
        c.setDash(3, 3)
        c.rect(x, y, CARD_W, CARD_H, stroke=1, fill=0)
        c.setDash()

        top = y + CARD_H - 8 * mm
        if logo:
            c.drawImage(logo, cx - 6 * mm, top - 10 * mm, 12 * mm, 12 * mm, mask="auto", preserveAspectRatio=True)
            top -= 13 * mm
        else:
            size = _fit(c, name, bold, 12, CARD_W - 12 * mm)
            c.setFont(bold, size)
            c.setFillColorRGB(0.1, 0.1, 0.1)
            c.drawCentredString(cx, top - 4 * mm, name)
            top -= 10 * mm  # scanners need a white quiet zone around the code

        _draw_qr(c, table_url(table.token), cx - QR_SIZE / 2, top - QR_SIZE, QR_SIZE)
        label = f"{word} {table.number}"
        c.setFont(bold, _fit(c, label, bold, 18, CARD_W - 12 * mm))
        c.setFillColorRGB(0, 0, 0)
        c.drawCentredString(cx, top - QR_SIZE - 8 * mm, label)
        c.setFont(regular, _fit(c, hint, regular, 8, CARD_W - 12 * mm))
        c.setFillColorRGB(0.35, 0.35, 0.35)
        c.drawCentredString(cx, top - QR_SIZE - 13 * mm, hint)

    if not tables:
        c.setFont(regular, 12)
        c.drawCentredString(page_w / 2, page_h / 2, "—")
    c.save()
    return buf.getvalue()
