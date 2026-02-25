"""Tests for auth API endpoints.

Tests the /api/auth endpoints for user registration, login,
and authenticated access to protected resources.
"""

from __future__ import annotations

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from caspian.api import app


@pytest.fixture()
def client(tmp_path):
    """Create a test client with temp-dir-backed user and song repositories."""
    from caspian.auth.repository import JsonFileUserRepository
    from caspian.db.repository import JsonFileSongRepository

    user_repo = JsonFileUserRepository(base_dir=tmp_path / "users")
    song_repo = JsonFileSongRepository(base_dir=tmp_path / "songs")
    with patch("caspian.api.user_repo", user_repo), \
         patch("caspian.api.song_repo", song_repo):
        yield TestClient(app)


def _register_user(client, email="test@example.com", password="secret123",
                    display_name="Test User"):
    """Helper to register a user and return the response."""
    return client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "display_name": display_name,
    })


class TestRegister:
    """Tests for POST /api/auth/register."""

    def test_register_success(self, client):
        """Register a new user, verify 201, token and user fields returned."""
        response = _register_user(client)

        assert response.status_code == 201
        data = response.json()
        assert "token" in data
        assert data["token"]  # non-empty
        assert "user" in data
        user = data["user"]
        assert user["id"]  # non-empty
        assert user["email"] == "test@example.com"
        assert user["display_name"] == "Test User"
        assert user["tier"] == "free"
        assert user["created_at"]

    def test_register_duplicate_email(self, client):
        """Register twice with the same email, verify 409 on second attempt."""
        resp1 = _register_user(client, email="dup@example.com")
        assert resp1.status_code == 201

        resp2 = _register_user(client, email="dup@example.com")
        assert resp2.status_code == 409
        assert "already exists" in resp2.json()["detail"]


class TestLogin:
    """Tests for POST /api/auth/login."""

    def test_login_success(self, client):
        """Register then login, verify token and user returned."""
        _register_user(client, email="login@example.com", password="mypassword")

        response = client.post("/api/auth/login", json={
            "email": "login@example.com",
            "password": "mypassword",
        })

        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["token"]
        assert "user" in data
        user = data["user"]
        assert user["email"] == "login@example.com"
        assert user["display_name"] == "Test User"
        assert user["tier"] == "free"

    def test_login_wrong_password(self, client):
        """Register then login with wrong password, verify 401."""
        _register_user(client, email="wrong@example.com", password="correct")

        response = client.post("/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "incorrect",
        })

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password"

    def test_login_nonexistent_email(self, client):
        """Login with an email that was never registered, verify 401."""
        response = client.post("/api/auth/login", json={
            "email": "nobody@example.com",
            "password": "whatever",
        })

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password"


class TestMe:
    """Tests for GET /api/auth/me."""

    def test_me_with_valid_token(self, client):
        """Register, use returned token to call /me, verify user info matches."""
        reg_resp = _register_user(
            client, email="me@example.com", display_name="Me User",
        )
        assert reg_resp.status_code == 201
        token = reg_resp.json()["token"]
        registered_user = reg_resp.json()["user"]

        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == registered_user["id"]
        assert data["email"] == "me@example.com"
        assert data["display_name"] == "Me User"
        assert data["tier"] == "free"
        assert data["created_at"]

    def test_me_without_token(self, client):
        """Call /me without Authorization header, verify 401."""
        response = client.get("/api/auth/me")

        assert response.status_code == 401
        assert response.json()["detail"] == "Authentication required"

    def test_me_with_invalid_token(self, client):
        """Call /me with a garbage token, verify 401."""
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer garbage-token-value"},
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid token"


class TestSongsWithAuth:
    """Tests for song CRUD with and without authentication."""

    def test_songs_with_auth(self, client):
        """Register, create song with auth token, verify song stored under user's ID."""
        reg_resp = _register_user(client, email="songuser@example.com")
        assert reg_resp.status_code == 201
        token = reg_resp.json()["token"]
        user_id = reg_resp.json()["user"]["id"]

        # Create a song with the auth token
        create_resp = client.post(
            "/api/songs",
            json={
                "title": "Auth Song",
                "artist": "Auth Artist",
                "input_text": "Am Dm E",
            },
            headers={"Authorization": f"Bearer {token}"},
        )

        assert create_resp.status_code == 201
        song = create_resp.json()
        assert song["user_id"] == user_id
        assert song["user_id"] != "local"

    def test_songs_without_auth_uses_local(self, client):
        """Create song without auth, verify it uses 'local' user_id."""
        create_resp = client.post("/api/songs", json={
            "title": "Local Song",
            "artist": "Local Artist",
            "input_text": "C G Am F",
        })

        assert create_resp.status_code == 201
        song = create_resp.json()
        assert song["user_id"] == "local"
