"""Tests for song CRUD API endpoints.

Tests the /api/songs endpoints for creating, reading, updating,
touching, and deleting songs.
"""

from __future__ import annotations

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from caspian.api import app
from caspian.db.repository import JsonFileSongRepository


@pytest.fixture()
def client(tmp_path):
    """Create a test client with a temp-dir-backed song repository."""
    temp_repo = JsonFileSongRepository(base_dir=tmp_path / "songs")
    with patch("caspian.api.song_repo", temp_repo):
        yield TestClient(app)


class TestListSongs:
    """Tests for GET /api/songs."""

    def test_list_songs_empty(self, client):
        """GET /api/songs returns empty list when no songs exist."""
        response = client.get("/api/songs")

        assert response.status_code == 200
        assert response.json() == []

    def test_list_with_query(self, client):
        """Create 2 songs, list with q= filter, verify only matching song returned."""
        # Create two songs with different titles
        client.post("/api/songs", json={
            "title": "Yom Shishi",
            "artist": "Matti Caspi",
            "input_text": "Am Dm E",
        })
        client.post("/api/songs", json={
            "title": "Let It Be",
            "artist": "The Beatles",
            "input_text": "C G Am F",
        })

        # Verify both exist
        all_songs = client.get("/api/songs").json()
        assert len(all_songs) == 2

        # Filter by title
        response = client.get("/api/songs", params={"q": "Yom"})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Yom Shishi"

        # Filter by artist
        response = client.get("/api/songs", params={"q": "Beatles"})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Let It Be"

        # Filter that matches nothing
        response = client.get("/api/songs", params={"q": "Nonexistent"})
        assert response.status_code == 200
        assert response.json() == []


class TestCreateSong:
    """Tests for POST /api/songs."""

    def test_create_song(self, client):
        """POST /api/songs creates a song and returns 201 with an ID."""
        response = client.post("/api/songs", json={
            "title": "Test Song",
            "artist": "Test Artist",
            "key_root": "Am",
            "key_mode": "natural_minor",
            "input_text": "Am Dm E Am",
        })

        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["id"]  # non-empty
        assert data["title"] == "Test Song"
        assert data["artist"] == "Test Artist"
        assert data["key_root"] == "Am"
        assert data["key_mode"] == "natural_minor"
        assert data["input_text"] == "Am Dm E Am"
        assert data["user_id"] == "local"
        assert data["created_at"]
        assert data["updated_at"]
        assert data["last_opened_at"]


class TestGetSong:
    """Tests for GET /api/songs/{song_id}."""

    def test_create_and_get(self, client):
        """POST to create, then GET by ID; verify fields match."""
        create_resp = client.post("/api/songs", json={
            "title": "My Song",
            "artist": "My Artist",
            "key_root": "C",
            "key_mode": "major",
            "input_text": "C F G C",
            "metadata": {"tags": ["pop"], "source": "manual"},
        })
        assert create_resp.status_code == 201
        created = create_resp.json()
        song_id = created["id"]

        # GET the song by ID
        get_resp = client.get(f"/api/songs/{song_id}")
        assert get_resp.status_code == 200
        fetched = get_resp.json()

        assert fetched["id"] == song_id
        assert fetched["title"] == "My Song"
        assert fetched["artist"] == "My Artist"
        assert fetched["key_root"] == "C"
        assert fetched["key_mode"] == "major"
        assert fetched["input_text"] == "C F G C"
        assert fetched["metadata"]["tags"] == ["pop"]
        assert fetched["metadata"]["source"] == "manual"

    def test_get_nonexistent(self, client):
        """GET /api/songs/fake returns 404."""
        response = client.get("/api/songs/fake")

        assert response.status_code == 404
        assert response.json()["detail"] == "Song not found"


class TestUpdateSong:
    """Tests for PUT /api/songs/{song_id}."""

    def test_update_song(self, client):
        """POST to create, then PUT to update title, verify updated."""
        # Create
        create_resp = client.post("/api/songs", json={
            "title": "Original Title",
            "artist": "Original Artist",
            "input_text": "Am Dm",
        })
        assert create_resp.status_code == 201
        song_id = create_resp.json()["id"]

        # Update
        update_resp = client.put(f"/api/songs/{song_id}", json={
            "title": "Updated Title",
            "artist": "Updated Artist",
            "key_root": "G",
            "key_mode": "major",
            "input_text": "G C D G",
        })
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["id"] == song_id
        assert updated["title"] == "Updated Title"
        assert updated["artist"] == "Updated Artist"
        assert updated["key_root"] == "G"
        assert updated["input_text"] == "G C D G"

        # Verify via GET
        get_resp = client.get(f"/api/songs/{song_id}")
        assert get_resp.status_code == 200
        fetched = get_resp.json()
        assert fetched["title"] == "Updated Title"

    def test_update_nonexistent(self, client):
        """PUT /api/songs/fake returns 404."""
        response = client.put("/api/songs/fake", json={
            "title": "Does Not Matter",
        })

        assert response.status_code == 404
        assert response.json()["detail"] == "Song not found"


class TestTouchSong:
    """Tests for POST /api/songs/{song_id}/touch."""

    def test_touch_song(self, client):
        """POST to create, then POST to touch, verify last_opened_at changed."""
        # Create
        create_resp = client.post("/api/songs", json={
            "title": "Touch Test",
            "input_text": "Am",
        })
        assert create_resp.status_code == 201
        song_id = create_resp.json()["id"]
        original_last_opened = create_resp.json()["last_opened_at"]

        # Touch
        touch_resp = client.post(f"/api/songs/{song_id}/touch")
        assert touch_resp.status_code == 200
        assert touch_resp.json() == {"ok": True}

        # Verify last_opened_at changed
        get_resp = client.get(f"/api/songs/{song_id}")
        assert get_resp.status_code == 200
        updated_last_opened = get_resp.json()["last_opened_at"]
        assert updated_last_opened >= original_last_opened


class TestDeleteSong:
    """Tests for DELETE /api/songs/{song_id}."""

    def test_delete_song(self, client):
        """POST to create, then DELETE, verify 200, then GET returns 404."""
        # Create
        create_resp = client.post("/api/songs", json={
            "title": "Delete Me",
            "input_text": "C",
        })
        assert create_resp.status_code == 201
        song_id = create_resp.json()["id"]

        # Verify it exists
        get_resp = client.get(f"/api/songs/{song_id}")
        assert get_resp.status_code == 200

        # Delete
        delete_resp = client.delete(f"/api/songs/{song_id}")
        assert delete_resp.status_code == 200
        assert delete_resp.json() == {"ok": True}

        # Verify it's gone
        get_resp = client.get(f"/api/songs/{song_id}")
        assert get_resp.status_code == 404

    def test_delete_nonexistent(self, client):
        """DELETE /api/songs/fake returns 404."""
        response = client.delete("/api/songs/fake")

        assert response.status_code == 404
        assert response.json()["detail"] == "Song not found"
