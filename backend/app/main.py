"""CloudVault FastAPI Main Application Entrypoint."""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import (
    activity,
    auth,
    dashboard,
    favorites,
    files,
    folders,
    notifications,
    shares,
    tags,
    trash,
)
from app.core.config import settings
from app.core.database import Base, engine


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database schema is created on startup
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="CloudVault API",
    description="Secure, High-Performance Cloud File Storage & Sharing Platform REST API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Security Headers
app.add_middleware(SecurityHeadersMiddleware)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# Include API routers
app.include_router(auth.router)
app.include_router(files.router)
app.include_router(folders.router)
app.include_router(shares.router)
app.include_router(dashboard.router)
app.include_router(trash.router)
app.include_router(favorites.router)
app.include_router(activity.router)
app.include_router(notifications.router)
app.include_router(tags.router)


@app.get("/health", tags=["Health"])
def health_check():
    """Service health and readiness check."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "storage_backend": settings.STORAGE_BACKEND,
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log exception safely without exposing internal tracebacks in production
    if settings.DEBUG:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": str(exc)},
        )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected server error occurred."},
    )
