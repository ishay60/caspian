"""Authentication package — user management, JWT tokens, and middleware."""

from caspian.auth.models import UserDocument
from caspian.auth.repository import UserRepository, JsonFileUserRepository
from caspian.auth.service import (
    hash_password,
    verify_password,
    create_token,
    decode_token,
    register,
    login,
)
from caspian.auth.middleware import get_current_user, require_auth, require_pro

__all__ = [
    "UserDocument",
    "UserRepository",
    "JsonFileUserRepository",
    "hash_password",
    "verify_password",
    "create_token",
    "decode_token",
    "register",
    "login",
    "get_current_user",
    "require_auth",
    "require_pro",
]
