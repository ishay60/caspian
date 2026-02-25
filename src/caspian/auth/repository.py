"""User repository — abstract interface + JSON file implementation."""

from __future__ import annotations

import json
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path

from caspian.auth.models import UserDocument


class UserRepository(ABC):
    """Abstract base for user persistence."""

    @abstractmethod
    async def get(self, user_id: str) -> UserDocument | None:
        ...

    @abstractmethod
    async def get_by_email(self, email: str) -> UserDocument | None:
        ...

    @abstractmethod
    async def save(self, user: UserDocument) -> UserDocument:
        ...

    @abstractmethod
    async def delete(self, user_id: str) -> bool:
        ...

    def generate_id(self) -> str:
        return uuid.uuid4().hex[:12]


class JsonFileUserRepository(UserRepository):
    """Store users as JSON files on disk.

    Directory layout:
        {base_dir}/{user_id}.json

    Thread-safety: uses atomic write (write to temp + rename).
    """

    def __init__(self, base_dir: str | Path | None = None):
        if base_dir is None:
            base_dir = Path(".data") / "users"
        self.base_dir = Path(base_dir)

    def _user_path(self, user_id: str) -> Path:
        return self.base_dir / f"{user_id}.json"

    async def get(self, user_id: str) -> UserDocument | None:
        path = self._user_path(user_id)
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return UserDocument(**data)
        except (json.JSONDecodeError, Exception):
            return None

    async def get_by_email(self, email: str) -> UserDocument | None:
        """Scan all user files to find one by email.

        Acceptable for JSON MVP; replace with indexed lookup for production.
        """
        if not self.base_dir.exists():
            return None
        email_lower = email.lower()
        for path in self.base_dir.glob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if data.get("email", "").lower() == email_lower:
                    return UserDocument(**data)
            except (json.JSONDecodeError, Exception):
                continue
        return None

    async def save(self, user: UserDocument) -> UserDocument:
        # Assign ID if missing
        if not user.id:
            user = user.model_copy(update={"id": self.generate_id()})

        # Update timestamp
        now = datetime.now(timezone.utc).isoformat()
        user = user.model_copy(update={"updated_at": now})

        # Ensure directory exists
        self.base_dir.mkdir(parents=True, exist_ok=True)

        # Atomic write
        path = self._user_path(user.id)
        tmp_path = path.with_suffix(".json.tmp")
        tmp_path.write_text(
            user.model_dump_json(indent=2),
            encoding="utf-8",
        )
        tmp_path.rename(path)
        return user

    async def delete(self, user_id: str) -> bool:
        path = self._user_path(user_id)
        if path.exists():
            path.unlink()
            return True
        return False
