"""Realtime events over Redis pub/sub, so every api worker can push to its own WebSocket clients.

Events are hints ("order 12 changed"); clients refetch state over REST, and after a reconnect
they refetch everything, so a lost message never leaves a screen stale.
"""

import asyncio
import json
import logging
from collections import defaultdict
from collections.abc import AsyncIterator
from typing import Any

from fastapi import Request
from redis.asyncio import Redis

from app.core.config import get_settings

log = logging.getLogger(__name__)

PREFIX = "qrmenu:"

# Channels
STAFF = "staff"  # everything the admin panel shows live
MENU = "menu"  # guest menus refetch


def session_channel(session_id: object) -> str:
    return f"session:{session_id}"


def table_channel(table_id: int) -> str:
    """Every phone scanned at the table (e.g. the waiter opened it)."""
    return f"table:{table_id}"


# One client per event loop (a worker has one loop; tests may run several)
_clients: dict[int, Redis] = {}


def _client() -> Redis:
    loop_id = id(asyncio.get_running_loop())
    if loop_id not in _clients:
        _clients[loop_id] = Redis.from_url(get_settings().redis_url)
    return _clients[loop_id]


async def publish(channel: str, event: dict[str, Any]) -> None:
    """Fire-and-forget: a Redis hiccup must not fail the request that caused the event."""
    try:
        await _client().publish(PREFIX + channel, json.dumps(event, default=str))
    except Exception:  # noqa: BLE001
        log.warning("realtime publish to %s failed", channel, exc_info=True)


class Hub:
    """Per-worker fan-out from one Redis subscription to local WebSocket queues."""

    def __init__(self) -> None:
        self._queues: dict[str, set[asyncio.Queue]] = defaultdict(set)
        self._task: asyncio.Task | None = None
        self.ready = asyncio.Event()  # set while the Redis subscription is live

    def start(self) -> None:
        if self._task is None:
            self.ready = asyncio.Event()
            self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    def subscribe(self, channels: list[str]) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=256)
        for channel in channels:
            self._queues[channel].add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        for queues in self._queues.values():
            queues.discard(queue)

    def dispatch(self, channel: str, event: dict[str, Any]) -> None:
        for queue in list(self._queues.get(channel, ())):
            self._offer(queue, event)

    def resync_all(self) -> None:
        for queue in {q for queues in self._queues.values() for q in queues}:
            self._offer(queue, {"type": "resync"})

    @staticmethod
    def _offer(queue: asyncio.Queue, event: dict[str, Any]) -> None:
        if queue.full():
            # A stuck client: drop its backlog and tell it to refetch instead of growing memory
            while not queue.empty():
                queue.get_nowait()
            event = {"type": "resync"}
        queue.put_nowait(event)

    async def _run(self) -> None:
        while True:
            redis = Redis.from_url(get_settings().redis_url)
            try:
                async with redis.pubsub() as pubsub:
                    await pubsub.psubscribe(PREFIX + "*")
                    self.ready.set()
                    # Anything published while we were disconnected is lost: make clients refetch
                    self.resync_all()
                    async for message in pubsub.listen():
                        if message["type"] != "pmessage":
                            continue
                        channel = message["channel"].decode().removeprefix(PREFIX)
                        try:
                            event = json.loads(message["data"])
                        except ValueError:
                            continue
                        self.dispatch(channel, event)
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001
                log.warning("realtime subscription lost, reconnecting", exc_info=True)
                await asyncio.sleep(1)
            finally:
                self.ready.clear()
                await redis.aclose()


hub = Hub()


async def notify_menu_changed(request: Request) -> AsyncIterator[None]:
    """Router dependency: after a successful write, tell guest menus to refetch."""
    yield
    if request.method != "GET":
        await publish(MENU, {"type": "menu.changed"})
