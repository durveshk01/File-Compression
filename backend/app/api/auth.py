"""Authentication API endpoints."""

from typing import Annotated
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.common import MessageResponse
from app.schemas.user import UserResponse, UserUpdate
from app.services.auth_service import AuthService

router = APIRouter(prefix="/api", tags=["Authentication"])


@router.post("/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    req: RegisterRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """Register a new user account."""
    user = AuthService.register(db, req)
    return UserResponse.model_validate(user)


@router.post("/auth/login", response_model=TokenResponse)
def login(
    req: LoginRequest,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
):
    """Authenticate with email and password."""
    tokens = AuthService.login(db, req)
    # Set secure HttpOnly cookies as well as returning tokens
    response.set_cookie(
        key="access_token",
        value=tokens.access_token,
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True in HTTPS production
        max_age=30 * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=tokens.refresh_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=7 * 24 * 3600,
    )
    return tokens


@router.post("/auth/refresh", response_model=TokenResponse)
def refresh_token(
    req: RefreshTokenRequest,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
):
    """Exchange refresh token for a new access token."""
    tokens = AuthService.refresh_access_token(db, req.refresh_token)
    response.set_cookie(
        key="access_token",
        value=tokens.access_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=30 * 60,
    )
    return tokens


@router.post("/auth/logout", response_model=MessageResponse)
def logout(response: Response):
    """Clear session cookies on logout."""
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return MessageResponse(message="Successfully logged out.")


@router.get("/auth/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get profile of authenticated user."""
    return UserResponse.model_validate(current_user)


@router.patch("/users/me", response_model=UserResponse)
def update_profile(
    req: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Update user full name or profile settings."""
    user = AuthService.update_profile(db, current_user, req.full_name)
    return UserResponse.model_validate(user)


@router.post("/auth/change-password", response_model=MessageResponse)
def change_password(
    req: ChangePasswordRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Change account password."""
    AuthService.change_password(db, current_user, req)
    return MessageResponse(message="Password successfully changed.")
