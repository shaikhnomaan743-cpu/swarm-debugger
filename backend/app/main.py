from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.extended import router as extended_router
from app.api.health import router as health_router
from app.api.sessions import router as sessions_router
from app.api.ws import router as ws_router
from app.core.config import settings
from app.db.seed import seed_database
from app.db.session import init_db
from app.services.events import set_event_loop
import asyncio


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    seed_database()
    try:
        from app.db.session import SessionLocal
        from app.benchmark.library import seed_cases

        with SessionLocal() as db:
            seed_cases(db)
    except Exception:
        pass
    set_event_loop(asyncio.get_running_loop())
    yield


app = FastAPI(
    title="Swarm Debugger",
    description=(
        "Swarm Debugger operationalizes adversarial debugging through executable evidence. "
        "Prosecutor and Defender compete; runtime traces and falsification tests decide; "
        "the deterministic Judge accepts a fix only from test evidence."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(sessions_router)
app.include_router(extended_router)
app.include_router(ws_router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "product": "Swarm Debugger",
        "problem_statement": "PS 02",
        "phase": "mvp",
        "principle": "AI proposes. AI challenges. Code executes. Evidence decides.",
    }
