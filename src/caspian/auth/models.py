"""User document model for persistence."""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field


class UserDocument(BaseModel):
    """A persisted user."""

    id: str
    email: str
    display_name: str = ""
    password_hash: str
    tier: str = "free"  # "free" | "pro"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
