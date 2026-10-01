import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import AuthSession, DebugSession, SessionEvent, User
from app.services.events import subscribe, unsubscribe

router = APIRouter(tags=["ws"])


def _user_from_cookie(websocket: WebSocket) -> User | None:
    token = websocket.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    with SessionLocal() as db:
        record = db.query(AuthSession).filter(AuthSession.token == token).one_or_none()
        if record is None:
            return None
        return db.get(User, record.user_id)


@router.websocket("/api/ws/sessions/{session_id}")
async def session_ws(websocket: WebSocket, session_id: str) -> None:
    user = _user_from_cookie(websocket)
    if user is None:
        await websocket.close(code=4401)
        return
    with SessionLocal() as db:
        session = db.get(DebugSession, session_id)
        if session is None or session.user_id != user.id:
            await websocket.close(code=4404)
            return
        history = db.scalars(
            select(SessionEvent)
            .where(SessionEvent.session_id == session_id)
            .order_by(SessionEvent.created_at)
        ).all()
        snapshot = [
            {
                "id": event.id,
                "session_id": event.session_id,
                "type": event.type,
                "message": event.message,
                "payload": json.loads(event.payload_json or "{}"),
                "created_at": event.created_at.isoformat(),
            }
            for event in history
        ]
    await websocket.accept()
    for event in snapshot:
        await websocket.send_json(event)
    queue = await subscribe(session_id)
    try:
        while True:
            event = await queue.get()
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    finally:
        unsubscribe(session_id, queue)
        try:
            await websocket.close()
        except Exception:  # noqa: BLE001
            pass
