"""Mirror new orders and calls into the staff Telegram chat.

Each event is sent from the request that created it, so running several api workers never
sends a message twice. Delivery is best effort: Telegram being slow or down must not slow
down or fail a guest's order.
"""

import asyncio
import html
import logging

import httpx

from app.models import Order, RestaurantSettings, ServiceCall

log = logging.getLogger(__name__)

API = "https://api.telegram.org"
TIMEOUT = 10

TEXTS = {
    "ru": {
        "order": "🆕 <b>Стол {table}</b>: заказ №{id}",
        "pending": "⏳ ждёт подтверждения",
        "total": "Итого",
        "waiter": "🙋 <b>Стол {table}</b> зовёт официанта",
        "bill": "🧾 <b>Стол {table}</b> просит счёт",
        "cash": "наличные",
        "card": "карта",
        "qr": "QR-перевод",
        "test": "✅ Уведомления QR-меню подключены",
    },
    "en": {
        "order": "🆕 <b>Table {table}</b>: order #{id}",
        "pending": "⏳ waiting for confirmation",
        "total": "Total",
        "waiter": "🙋 <b>Table {table}</b> is calling the waiter",
        "bill": "🧾 <b>Table {table}</b> wants the bill",
        "cash": "cash",
        "card": "card",
        "qr": "QR transfer",
        "test": "✅ QR menu notifications are connected",
    },
}

# Keep references to fire-and-forget tasks so they aren't garbage collected mid-flight
_tasks: set[asyncio.Task] = set()


class TelegramError(Exception):
    pass


def _t(settings: RestaurantSettings, key: str, **kw) -> str:
    texts = TEXTS.get(settings.default_language, TEXTS["en"])
    return texts[key].format(**{k: html.escape(str(v)) for k, v in kw.items()})


def _pick(value: dict[str, str], settings: RestaurantSettings) -> str:
    return value.get(settings.default_language) or next(iter(value.values()), "")


def _money(amount: int, currency: str) -> str:
    # Plain formatting: the chat needs to be readable, not locale-perfect
    digits = 0 if currency in {"VND", "JPY", "KRW", "IDR"} else 2
    value = amount / 10**digits
    text = f"{value:,.{digits}f}".replace(",", " ")
    return f"{text} {currency}"


def order_text(order: Order, settings: RestaurantSettings) -> str:
    lines = [_t(settings, "order", table=order.table.number, id=order.id)]
    if order.status.value == "pending":
        lines.append(_t(settings, "pending"))
    for item in order.items:
        name = html.escape(_pick(item.name, settings))
        variant = _pick(item.price_name, settings) if item.price_name else ""
        if variant:
            name += f", {html.escape(variant)}"
        mods = ", ".join(html.escape(_pick(m.name, settings)) for m in item.modifiers)
        line = f"• {item.quantity}× {name}"
        if mods:
            line += f" + {mods}"
        if item.comment:
            line += f" <i>«{html.escape(item.comment)}»</i>"
        lines.append(line)
    if order.comment:
        lines.append(f"<i>«{html.escape(order.comment)}»</i>")
    lines.append(f"{_t(settings, 'total')}: <b>{_money(order.total, settings.currency)}</b>")
    return "\n".join(lines)


def call_text(call: ServiceCall, settings: RestaurantSettings) -> str:
    text = _t(settings, call.type.value, table=call.table.number)
    if call.payment_method:
        text += f" ({_t(settings, call.payment_method.value)})"
    return text


def configured(settings: RestaurantSettings) -> bool:
    return bool(settings.telegram_enabled and settings.telegram_bot_token and settings.telegram_chat_id)


async def send(token: str, chat_id: str, text: str) -> None:
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            resp = await client.post(
                f"{API}/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            )
        except httpx.HTTPError as exc:
            raise TelegramError("network") from exc
    if resp.status_code != 200:
        try:
            description = resp.json().get("description", "")
        except ValueError:
            description = resp.text[:200]
        raise TelegramError(description or f"HTTP {resp.status_code}")


def notify(settings: RestaurantSettings, text: str) -> None:
    """Send in the background; never raises."""
    if not configured(settings):
        return
    token, chat_id = settings.telegram_bot_token, settings.telegram_chat_id

    async def run() -> None:
        try:
            await send(token, chat_id, text)
        except TelegramError as exc:
            log.warning("telegram notification failed: %s", exc)

    task = asyncio.create_task(run())
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


def test_message(settings: RestaurantSettings) -> str:
    return _t(settings, "test")
