"""Authentication and User management service."""

import uuid
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException, status

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, ChangePasswordRequest, TokenResponse
from app.services.activity_service import ActivityService


class AuthService:
    @staticmethod
    def register(db: Session, req: RegisterRequest) -> User:
        # Check if email exists
        existing = db.scalar(select(User).where(User.email == req.email.lower()))
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists.",
            )

        user = User(
            email=req.email.lower(),
            full_name=req.full_name,
            password_hash=hash_password(req.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        ActivityService.log_activity(
            db,
            user_id=user.id,
            action="account_created",
            resource_type="user",
            resource_id=user.id,
            resource_name=user.email,
        )
        return user

    @staticmethod
    def login(db: Session, req: LoginRequest) -> TokenResponse:
        user = db.scalar(select(User).where(User.email == req.email.lower()))
        if not user or not verify_password(req.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive.",
            )

        token_data = {"sub": str(user.id), "email": user.email}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        ActivityService.log_activity(
            db,
            user_id=user.id,
            action="login",
            resource_type="user",
            resource_id=user.id,
            resource_name=user.email,
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
        )

    @staticmethod
    def refresh_access_token(db: Session, refresh_token: str) -> TokenResponse:
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token.",
            )

        user_id_str = payload.get("sub")
        try:
            user_id = uuid.UUID(user_id_str)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Malformed token subject.",
            )

        user = db.scalar(select(User).where(User.id == user_id))
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive.",
            )

        token_data = {"sub": str(user.id), "email": user.email}
        new_access_token = create_access_token(token_data)
        new_refresh_token = create_refresh_token(token_data)

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
        )

    @staticmethod
    def change_password(db: Session, user: User, req: ChangePasswordRequest) -> None:
        if not verify_password(req.current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect.",
            )

        user.password_hash = hash_password(req.new_password)
        db.commit()

        ActivityService.log_activity(
            db,
            user_id=user.id,
            action="password_changed",
            resource_type="user",
            resource_id=user.id,
        )

    @staticmethod
    def update_profile(db: Session, user: User, full_name: str | None) -> User:
        if full_name:
            user.full_name = full_name
            db.commit()
            db.refresh(user)
            ActivityService.log_activity(
                db,
                user_id=user.id,
                action="profile_updated",
                resource_type="user",
                resource_id=user.id,
            )
        return user
