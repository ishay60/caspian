"""Authentication service — password hashing, JWT tokens, register/login."""

from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt

from caspian.auth.models import UserDocument
from caspian.auth.repository import UserRepository

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

JWT_SECRET = os.getenv("CASPIAN_JWT_SECRET", "caspian-dev-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRY_DAYS = 7


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ---------------------------------------------------------------------------
# JWT tokens
# ---------------------------------------------------------------------------


def create_token(user_id: str, email: str, tier: str) -> str:
    """Create a signed JWT access token (7-day expiry)."""
    payload = {
        "sub": user_id,
        "email": email,
        "tier": tier,
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRY_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and verify a JWT token.

    Returns the payload dict on success.
    Raises ``jwt.ExpiredSignatureError`` or ``jwt.InvalidTokenError`` on failure.
    """
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


# ---------------------------------------------------------------------------
# High-level auth operations
# ---------------------------------------------------------------------------


async def register(
    email: str,
    password: str,
    display_name: str,
    repo: UserRepository,
) -> UserDocument:
    """Register a new user.

    Raises ``ValueError`` if the email is already taken.
    """
    existing = await repo.get_by_email(email)
    if existing is not None:
        raise ValueError("A user with this email already exists")

    user = UserDocument(
        id=repo.generate_id(),
        email=email.lower().strip(),
        display_name=display_name,
        password_hash=hash_password(password),
    )
    return await repo.save(user)


async def login(
    email: str,
    password: str,
    repo: UserRepository,
) -> tuple[UserDocument, str]:
    """Authenticate a user and return (user, token).

    Raises ``ValueError`` on invalid credentials.
    """
    user = await repo.get_by_email(email)
    if user is None:
        raise ValueError("Invalid email or password")

    if not verify_password(password, user.password_hash):
        raise ValueError("Invalid email or password")

    token = create_token(user.id, user.email, user.tier)
    return user, token
