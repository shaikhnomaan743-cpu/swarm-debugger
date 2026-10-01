from app.api.auth import router as auth_router
from app.api.health import router as health_router

__all__ = ["auth_router", "health_router"]
