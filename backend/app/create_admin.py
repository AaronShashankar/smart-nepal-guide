"""Create (or promote) an admin user for the admin panel.

uv run python -m app.create_admin admin@example.com 'a-strong-password'
"""

import sys

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import func, select

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import User
from app.models.enums import AuthProvider, UserRole


def main() -> None:
    if len(sys.argv) != 3 or len(sys.argv[2]) < 8:
        sys.exit("usage: python -m app.create_admin EMAIL PASSWORD(8+ chars)")
    try:  # same email rules as /auth/login, so the admin can actually log in
        email = TypeAdapter(EmailStr).validate_python(sys.argv[1]).lower()
    except ValidationError:
        sys.exit(f"invalid email address: {sys.argv[1]}")
    password = sys.argv[2]
    with SessionLocal() as db, db.begin():
        user = db.scalar(select(User).where(func.lower(User.email) == email))
        if user is None:
            user = User(email=email, auth_provider=AuthProvider.email)
            db.add(user)
        user.password_hash = hash_password(password)
        user.role = UserRole.admin
    print(f"Admin ready: {email}")


if __name__ == "__main__":
    main()
