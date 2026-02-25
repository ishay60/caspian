"""Tests for JsonFileSongRepository."""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone

import pytest

from caspian.db.models import SongDocument
from caspian.db.repository import JsonFileSongRepository


def _run(coro):
    """Run an async coroutine synchronously (no pytest-asyncio needed)."""
    return asyncio.run(coro)


def _make_song(
    *,
    id: str = "",
    title: str = "Test Song",
    artist: str = "Test Artist",
    user_id: str = "local",
    last_opened_at: str | None = None,
) -> SongDocument:
    """Helper to create a SongDocument with sensible defaults."""
    kwargs: dict = {
        "id": id,
        "title": title,
        "artist": artist,
        "user_id": user_id,
    }
    if last_opened_at is not None:
        kwargs["last_opened_at"] = last_opened_at
    return SongDocument(**kwargs)


class TestSaveAssignsId:
    def test_save_assigns_id(self, tmp_path):
        """Saving a song with empty id should assign a 12-char hex id."""
        repo = JsonFileSongRepository(base_dir=tmp_path)
        song = _make_song(id="")
        saved = _run(repo.save(song))

        assert saved.id != ""
        assert len(saved.id) == 12
        assert re.fullmatch(r"[0-9a-f]{12}", saved.id)


class TestSaveAndGet:
    def test_save_and_get(self, tmp_path):
        """Saving a song and retrieving it should return matching fields."""
        repo = JsonFileSongRepository(base_dir=tmp_path)
        song = _make_song(title="Yom Shishi", artist="Matti Caspi")
        saved = _run(repo.save(song))

        retrieved = _run(repo.get(saved.id, saved.user_id))
        assert retrieved is not None
        assert retrieved.id == saved.id
        assert retrieved.title == "Yom Shishi"
        assert retrieved.artist == "Matti Caspi"
        assert retrieved.user_id == saved.user_id


class TestGetNonexistent:
    def test_get_nonexistent(self, tmp_path):
        """Getting a song that doesn't exist should return None."""
        repo = JsonFileSongRepository(base_dir=tmp_path)
        result = _run(repo.get("nonexistent_id", "local"))
        assert result is None


class TestListEmpty:
    def test_list_empty(self, tmp_path):
        """Listing when no songs are saved should return an empty list."""
        repo = JsonFileSongRepository(base_dir=tmp_path)
        result = _run(repo.list("local"))
        assert result == []


class TestListReturnsSorted:
    def test_list_returns_sorted(self, tmp_path):
        """Listing songs should return them sorted by last_opened_at descending."""
        repo = JsonFileSongRepository(base_dir=tmp_path)

        songs = [
            _make_song(
                title="Oldest",
                last_opened_at="2024-01-01T00:00:00+00:00",
            ),
            _make_song(
                title="Newest",
                last_opened_at="2024-03-01T00:00:00+00:00",
            ),
            _make_song(
                title="Middle",
                last_opened_at="2024-02-01T00:00:00+00:00",
            ),
        ]
        for s in songs:
            _run(repo.save(s))

        result = _run(repo.list("local"))
        assert len(result) == 3
        assert result[0].title == "Newest"
        assert result[1].title == "Middle"
        assert result[2].title == "Oldest"


class TestListQueryFilter:
    def test_list_query_filters_by_title(self, tmp_path):
        """Query should filter songs by title (case-insensitive)."""
        repo = JsonFileSongRepository(base_dir=tmp_path)

        _run(repo.save(_make_song(title="Yom Shishi", artist="Matti Caspi")))
        _run(repo.save(_make_song(title="Ohev Otach", artist="Shlomo Artzi")))
        _run(repo.save(_make_song(title="Let It Be", artist="Beatles")))

        result = _run(repo.list("local", query="yom"))
        assert len(result) == 1
        assert result[0].title == "Yom Shishi"

    def test_list_query_filters_by_artist(self, tmp_path):
        """Query should filter songs by artist (case-insensitive)."""
        repo = JsonFileSongRepository(base_dir=tmp_path)

        _run(repo.save(_make_song(title="Yom Shishi", artist="Matti Caspi")))
        _run(repo.save(_make_song(title="Ohev Otach", artist="Shlomo Artzi")))

        result = _run(repo.list("local", query="artzi"))
        assert len(result) == 1
        assert result[0].artist == "Shlomo Artzi"

    def test_list_query_no_match(self, tmp_path):
        """Query that matches nothing should return an empty list."""
        repo = JsonFileSongRepository(base_dir=tmp_path)

        _run(repo.save(_make_song(title="Yom Shishi", artist="Matti Caspi")))

        result = _run(repo.list("local", query="nonexistent"))
        assert result == []


class TestListLimit:
    def test_list_limit(self, tmp_path):
        """Listing with limit should return at most that many songs."""
        repo = JsonFileSongRepository(base_dir=tmp_path)

        for i in range(5):
            _run(repo.save(_make_song(title=f"Song {i}")))

        result = _run(repo.list("local", limit=2))
        assert len(result) == 2


class TestDeleteExisting:
    def test_delete_existing(self, tmp_path):
        """Deleting an existing song should return True, and get should return None after."""
        repo = JsonFileSongRepository(base_dir=tmp_path)
        saved = _run(repo.save(_make_song(title="To Delete")))

        deleted = _run(repo.delete(saved.id, saved.user_id))
        assert deleted is True

        retrieved = _run(repo.get(saved.id, saved.user_id))
        assert retrieved is None


class TestDeleteNonexistent:
    def test_delete_nonexistent(self, tmp_path):
        """Deleting a non-existent song should return False."""
        repo = JsonFileSongRepository(base_dir=tmp_path)
        result = _run(repo.delete("nonexistent_id", "local"))
        assert result is False


class TestSaveUpdatesTimestamp:
    def test_save_updates_timestamp(self, tmp_path):
        """Saving a song should set updated_at to a recent UTC timestamp."""
        repo = JsonFileSongRepository(base_dir=tmp_path)
        before = datetime.now(timezone.utc)

        song = _make_song(title="Timestamp Test")
        saved = _run(repo.save(song))

        after = datetime.now(timezone.utc)

        updated_at = datetime.fromisoformat(saved.updated_at)
        assert before <= updated_at <= after
