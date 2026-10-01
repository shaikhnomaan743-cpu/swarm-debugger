from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from typing import Any

from app.core.clock import utcnow
from app.models import SessionEvent
from sqlalchemy.orm import Session

_queues: dict[str, list[asyncio.Queue]] = defaultdict(list)
_loop: asyncio.AbstractEventLoop | None = None


def set_event_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


async def subscribe(session_id: str) -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue(maxsize=200)
    _queues[session_id].append(queue)
    return queue


def unsubscribe(session_id: str, queue: asyncio.Queue) -> None:
    listeners = _queues.get(session_id, [])
    if queue in listeners:
        listeners.remove(queue)


async def _publish(session_id: str, payload: dict[str, Any]) -> None:
    for queue in list(_queues.get(session_id, [])):
        try:
            queue.put_nowait(payload)
        except asyncio.QueueFull:
            continue


def emit(db: Session, session_id: str, event_type: str, message: str, payload: dict | None = None) -> SessionEvent:
    event = SessionEvent(
        session_id=session_id,
        type=event_type,
        message=message,
        payload_json=json.dumps(payload or {}),
        created_at=utcnow(),
    )
    db.add(event)
    db.flush()
    body = {
        "id": event.id,
        "session_id": session_id,
        "type": event_type,
        "message": message,
        "payload": payload or {},
        "created_at": event.created_at.isoformat(),
    }
    if _loop is not None:
        asyncio.run_coroutine_threadsafe(_publish(session_id, body), _loop)
    return event
