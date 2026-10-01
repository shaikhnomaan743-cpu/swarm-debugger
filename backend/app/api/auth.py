from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.errors import auth_error, validation_error
from app.core.security import new_session_token, verify_password
from app.db.session import get_db
from app.models import AuthSession, User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=1)
    password: str = Field(min_length=1)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    username: str


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=int(settings.session_ttl.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
    )


@router.post("/login", response_model=UserResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> User:
    identifier = payload.identifier.strip()
    password = payload.password
    if not identifier or not password:
        raise validation_error("Email/username and password are required")

    normalized = identifier.lower()
    user = db.scalar(
        select(User).where(
            or_(User.email == normalized, func.lower(User.username) == normalized)
        )
    )
    if user is None or not verify_password(password, user.password_hash):
        raise auth_error("Invalid email or password")

    token = new_session_token()
    expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + settings.session_ttl
    db.add(AuthSession(token=token, user_id=user.id, expires_at=expires_at))
    db.commit()
    _set_session_cookie(response, token)
    return user


@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    db.query(AuthSession).filter(AuthSession.user_id == current_user.id).delete()
    db.commit()
    _clear_session_cookie(response)
    return {"status": "ok"}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
