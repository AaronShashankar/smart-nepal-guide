from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import ACCESS, InvalidToken, decode_token
from app.models import User

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
    return user
