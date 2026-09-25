import asyncio
import contextlib

from fastapi import WebSocket, WebSocketDisconnect

from app.services.realtime import hub

PING_SECONDS = 25  # keeps proxies from closing idle connections


async def stream(ws: WebSocket, channels: list[str]) -> None:
    """Forward hub events for the channels to an accepted WebSocket until it disconnects."""
    queue = hub.subscribe(channels)
    try:
        # "hello" means live: wait until the Redis subscription is up so no event slips by
        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(hub.ready.wait(), 5)
        await ws.send_json({"type": "hello"})

        async def send() -> None:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), PING_SECONDS)
                except TimeoutError:
                    event = {"type": "ping"}
                await ws.send_json(event)

        async def receive() -> None:
            # Clients don't send anything meaningful; this just notices the disconnect
            while True:
                await ws.receive_text()

        tasks = [asyncio.create_task(send()), asyncio.create_task(receive())]
        _, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
        for task in tasks:
            with contextlib.suppress(asyncio.CancelledError, WebSocketDisconnect, RuntimeError):
                await task
    finally:
        hub.unsubscribe(queue)
