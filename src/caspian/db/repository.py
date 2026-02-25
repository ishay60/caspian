"""Song repository — abstract interface + JSON file implementation."""

from __future__ import annotations

import json
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path

from caspian.db.models import SongDocument


class SongRepository(ABC):
    """Abstract base for song persistence."""

    @abstractmethod
    async def get(self, song_id: str, user_id: str = "local") -> SongDocument | None:
        ...

    @abstractmethod
    async def list(
        self,
        user_id: str = "local",
        query: str | None = None,
        limit: int = 100,
    ) -> list[SongDocument]:
        ...

    @abstractmethod
    async def save(self, song: SongDocument) -> SongDocument:
        ...

    @abstractmethod
    async def delete(self, song_id: str, user_id: str = "local") -> bool:
        ...

    def generate_id(self) -> str:
        return uuid.uuid4().hex[:12]


class JsonFileSongRepository(SongRepository):
    """Store songs as JSON files on disk.

    Directory layout:
        {base_dir}/{user_id}/{song_id}.json

    Thread-safety: uses atomic write (write to temp + rename).
    """

    def __init__(self, base_dir: str | Path | None = None):
        if base_dir is None:
            base_dir = Path(".data") / "songs"
        self.base_dir = Path(base_dir)

    def _user_dir(self, user_id: str) -> Path:
        return self.base_dir / user_id

    def _song_path(self, user_id: str, song_id: str) -> Path:
        return self._user_dir(user_id) / f"{song_id}.json"

    async def get(self, song_id: str, user_id: str = "local") -> SongDocument | None:
        path = self._song_path(user_id, song_id)
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return SongDocument(**data)
        except (json.JSONDecodeError, Exception):
            return None

    async def list(
        self,
        user_id: str = "local",
        query: str | None = None,
        limit: int = 100,
    ) -> list[SongDocument]:
        user_dir = self._user_dir(user_id)
        if not user_dir.exists():
            return []

        songs: list[SongDocument] = []
        for path in user_dir.glob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                song = SongDocument(**data)
                songs.append(song)
            except (json.JSONDecodeError, Exception):
                continue

        # Filter by query (title or artist, case-insensitive)
        if query:
            q = query.lower()
            songs = [
                s for s in songs
                if q in s.title.lower() or q in s.artist.lower()
            ]

        # Sort by last_opened_at descending
        songs.sort(key=lambda s: s.last_opened_at, reverse=True)
        return songs[:limit]

    async def save(self, song: SongDocument) -> SongDocument:
        # Assign ID if missing
        if not song.id:
            song = song.model_copy(update={"id": self.generate_id()})

        # Update timestamp
        now = datetime.now(timezone.utc).isoformat()
        song = song.model_copy(update={"updated_at": now})

        # Ensure directory exists
        user_dir = self._user_dir(song.user_id)
        user_dir.mkdir(parents=True, exist_ok=True)

        # Atomic write
        path = self._song_path(song.user_id, song.id)
        tmp_path = path.with_suffix(".json.tmp")
        tmp_path.write_text(
            song.model_dump_json(indent=2),
            encoding="utf-8",
        )
        tmp_path.rename(path)
        return song

    async def delete(self, song_id: str, user_id: str = "local") -> bool:
        path = self._song_path(user_id, song_id)
        if path.exists():
            path.unlink()
            return True
        return False
