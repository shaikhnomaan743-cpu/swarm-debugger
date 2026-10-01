from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models import AppMeta, User


def seed_demo_user(db: Session) -> None:
    existing = db.scalar(
        select(User).where(
            or_(User.email == settings.demo_email.lower(), User.username == settings.demo_username)
        )
    )
    if existing is not None:
        return
    db.add(
        User(
            email=settings.demo_email.lower(),
            username=settings.demo_username,
            password_hash=hash_password(settings.demo_password),
        )
    )


def seed_app_meta(db: Session) -> None:
    existing = db.scalar(select(AppMeta).where(AppMeta.key == "schema_version"))
    if existing is None:
        db.add(AppMeta(key="schema_version", value="2"))
        db.add(AppMeta(key="phase", value="mvp"))
        return
    phase = db.scalar(select(AppMeta).where(AppMeta.key == "phase"))
    if phase is not None:
        phase.value = "mvp"
    schema = db.scalar(select(AppMeta).where(AppMeta.key == "schema_version"))
    if schema is not None:
        schema.value = "2"


def seed_database() -> None:
    from app.db.session import SessionLocal

    with SessionLocal() as db:
        seed_app_meta(db)
        seed_demo_user(db)
        db.commit()
