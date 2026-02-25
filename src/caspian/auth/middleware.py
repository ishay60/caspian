"""FastAPI auth dependencies — current user extraction, role gates."""

from __future__ import annotations

import jwt
from fastapi import Header, HTTPException

from caspian.auth.service import decode_token


async def get_current_user(
    authorization: str | None = Header(default=None),
) -> dict | None:
    """Extract the current user from the Authorization header.

    Returns:
        A dict with ``user_id``, ``email``, and ``tier`` if a valid
        Bearer token is present, or ``None`` for anonymous/guest requests.

    Raises:
        HTTPException 401 if the header is present but the token is invalid.
    """
    if authorization is None:
        return None

    # Expect "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

    token = parts[1]
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    return {
        "user_id": payload["sub"],
        "email": payload["email"],
        "tier": payload.get("tier", "free"),
    }


async def require_auth(
    authorization: str | None = Header(default=None),
) -> dict:
    """Like ``get_current_user`` but raises 401 if no token is provided."""
    user = await get_current_user(authorization)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


async def require_pro(
    authorization: str | None = Header(default=None),
) -> dict:
    """Like ``require_auth`` but also requires ``tier == "pro"``."""
    user = await require_auth(authorization)
    if user["tier"] != "pro":
        raise HTTPException(status_code=403, detail="Pro tier required")
    return user
