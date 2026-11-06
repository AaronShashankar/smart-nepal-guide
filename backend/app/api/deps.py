from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import ACCESS, InvalidToken, decode_token
from app.models import User
from app.models.enums import UserRole

BLOCKED = "This account has been blocked. Contact the Bato team."

bearer = HTTPBearer(auto_error=False)

UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired token",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise UNAUTHORIZED
    try:
        user_id = decode_token(creds.credentials, ACCESS)
    except InvalidToken:
        raise UNAUTHORIZED from None
    user = db.get(User, user_id)
    if user is None:
        raise UNAUTHORIZED
    if user.is_blocked:  # tokens issued before the block stop working at once
        raise HTTPException(status.HTTP_403_FORBIDDEN, BLOCKED)
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins only")
    return user
