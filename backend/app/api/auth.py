from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import BLOCKED
from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import (
    ACCESS,
    REFRESH,
    InvalidToken,
    create_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models import User
from app.models.enums import AuthProvider
from app.schemas.auth import GoogleIn, LoginIn, RefreshIn, RegisterIn, TokenOut
from app.services import google

router = APIRouter(prefix="/auth", tags=["auth"])


def _tokens(user: User) -> TokenOut:
    return TokenOut(
        access_token=create_token(user.id, ACCESS),
        refresh_token=create_token(user.id, REFRESH),
        expires_in=get_settings().access_token_minutes * 60,
    )


def _check_not_blocked(user: User) -> None:
    if user.is_blocked:
        raise HTTPException(status.HTTP_403_FORBIDDEN, BLOCKED)


def _find_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(func.lower(User.email) == email.lower()))


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: Session = Depends(get_db)) -> TokenOut:
    if _find_by_email(db, body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email is already registered")
    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        auth_provider=AuthProvider.email,
        preferred_lang=body.preferred_lang,
    )
    db.add(user)
    db.commit()
    return _tokens(user)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    user = _find_by_email(db, body.email)
    # Same message for "no such user" and "wrong password": don't reveal which emails exist.
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    _check_not_blocked(user)
    return _tokens(user)


@router.post("/google", response_model=TokenOut)
def google_login(body: GoogleIn, db: Session = Depends(get_db)) -> TokenOut:
    try:
        claims = google.verify_google_id_token(body.id_token)
    except google.GoogleAuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Google sign-in failed: {exc}") from exc
    user = _find_by_email(db, claims["email"])
    if user is None:
        user = User(
            email=claims["email"].lower(),
            full_name=claims.get("name"),
            auth_provider=AuthProvider.google,
        )
        if body.preferred_lang:
            user.preferred_lang = body.preferred_lang
        db.add(user)
        db.commit()
    _check_not_blocked(user)
    return _tokens(user)


@router.post("/refresh", response_model=TokenOut)
def refresh(body: RefreshIn, db: Session = Depends(get_db)) -> TokenOut:
    try:
        user_id = decode_token(body.refresh_token, REFRESH)
    except InvalidToken:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token") from None
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    _check_not_blocked(user)
    return _tokens(user)
