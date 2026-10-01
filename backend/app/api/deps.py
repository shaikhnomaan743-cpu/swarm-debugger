from collections.abc import Generator
from datetime import datetime, timezone

from fastapi import Cookie, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import auth_error
from app.db.session import get_db
from app.models import AuthSession, User


def db_session() -> Generator[Session, None, None]:
    yield from get_db()


def get_current_user(
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=settings.session_cookie_name),
) -> User:
    if not session_token:
        raise auth_error("Not authenticated")

    record = db.query(AuthSession).filter(AuthSession.token == session_token).one_or_none()
    if record is None:
        raise auth_error("Not authenticated")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if record.expires_at < now:
        db.delete(record)
        db.commit()
        raise auth_error("Session expired")

    user = db.get(User, record.user_id)
    if user is None:
        raise auth_error("Not authenticated")
    return user
