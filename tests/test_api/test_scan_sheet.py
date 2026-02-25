"""Tests for the sheet scanning module and /api/scan-sheet endpoint.

Tests scan_result_to_input_text conversion, the API endpoint with mocked
Claude Vision calls, and error handling (no file, file too large, unsupported type).
"""

from __future__ import annotations

import io
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from caspian.api import app
from caspian.sources.sheet_scanner import (
    SheetScanError,
    scan_result_to_input_text,
    scan_sheet_image,
)


client = TestClient(app)


# ---------------------------------------------------------------------------
# Helper: build a mock httpx response (sync .json(), sync .text)
# ---------------------------------------------------------------------------


def _mock_httpx_response(status_code: int, json_body: dict | None = None, text: str = ""):
    """Return a MagicMock that behaves like an httpx.Response."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.text = text
    if json_body is not None:
        resp.json.return_value = json_body
    return resp


def _patch_async_client(mock_response):
    """Return a patch context manager that replaces httpx.AsyncClient.

    The mocked client's ``post()`` coroutine resolves to *mock_response*.
    """
    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    patcher = patch("caspian.sources.sheet_scanner.httpx.AsyncClient", return_value=mock_client)
    return patcher


# ---------------------------------------------------------------------------
# scan_result_to_input_text tests
# ---------------------------------------------------------------------------


class TestScanResultToInputText:
    """Tests for converting a scan result dict to Format A text."""

    def test_full_scan_result(self):
        """A complete scan result with title, artist, key, and sections."""
        scan_result = {
            "title": "Yom Shishi",
            "artist": "Matti Caspi",
            "key": "Am",
            "time_signature": "4/4",
            "sections": [
                {
                    "name": "Verse",
                    "bars": [
                        {"chords": ["Am", "Dm"]},
                        {"chords": ["E", "Am"]},
                    ],
                },
                {
                    "name": "Chorus",
                    "bars": [
                        {"chords": ["F", "C"]},
                        {"chords": ["G", "Am"]},
                    ],
                },
            ],
        }

        text = scan_result_to_input_text(scan_result)

        assert "title: Yom Shishi" in text
        assert "artist: Matti Caspi" in text
        assert "key: Am" in text
        assert "Verse:" in text
        assert "| Am Dm | E Am |" in text
        assert "Chorus:" in text
        assert "| F C | G Am |" in text

    def test_minimal_scan_result(self):
        """Scan result with only sections (no metadata)."""
        scan_result = {
            "sections": [
                {
                    "name": "section_1",
                    "bars": [
                        {"chords": ["C", "G"]},
                    ],
                },
            ],
        }

        text = scan_result_to_input_text(scan_result)

        assert "title:" not in text
        assert "artist:" not in text
        assert "key:" not in text
        assert "section_1:" in text
        assert "| C G |" in text

    def test_empty_sections(self):
        """Scan result with no sections produces just metadata."""
        scan_result = {
            "title": "Empty Song",
            "sections": [],
        }

        text = scan_result_to_input_text(scan_result)

        assert "title: Empty Song" in text

    def test_section_with_empty_bars(self):
        """A section that has bars with no chords is handled gracefully."""
        scan_result = {
            "sections": [
                {
                    "name": "Intro",
                    "bars": [
                        {"chords": []},
                        {"chords": ["Am"]},
                    ],
                },
            ],
        }

        text = scan_result_to_input_text(scan_result)

        assert "Intro:" in text
        # Only the non-empty bar should appear
        assert "| Am |" in text

    def test_section_with_no_bars(self):
        """A section with no bars key."""
        scan_result = {
            "sections": [
                {
                    "name": "Bridge",
                },
            ],
        }

        text = scan_result_to_input_text(scan_result)

        assert "Bridge:" in text

    def test_single_chord_per_bar(self):
        """Each bar has exactly one chord."""
        scan_result = {
            "sections": [
                {
                    "name": "Verse",
                    "bars": [
                        {"chords": ["Am"]},
                        {"chords": ["F"]},
                        {"chords": ["C"]},
                        {"chords": ["G"]},
                    ],
                },
            ],
        }

        text = scan_result_to_input_text(scan_result)

        assert "| Am | F | C | G |" in text

    def test_completely_empty_result(self):
        """An empty dict produces an empty string."""
        text = scan_result_to_input_text({})

        assert text == ""

    def test_null_metadata_fields(self):
        """Null title/artist/key are omitted."""
        scan_result = {
            "title": None,
            "artist": None,
            "key": None,
            "sections": [
                {
                    "name": "section_1",
                    "bars": [{"chords": ["Dm"]}],
                },
            ],
        }

        text = scan_result_to_input_text(scan_result)

        assert "title:" not in text
        assert "artist:" not in text
        assert "key:" not in text
        assert "section_1:" in text
        assert "| Dm |" in text


# ---------------------------------------------------------------------------
# scan_sheet_image unit tests
# ---------------------------------------------------------------------------


class TestScanSheetImage:
    """Tests for the scan_sheet_image function (with mocked HTTP)."""

    @pytest.mark.anyio
    async def test_no_api_key_raises(self):
        """Raises SheetScanError when no API key is available."""
        with patch.dict("os.environ", {}, clear=True):
            os.environ.pop("ANTHROPIC_API_KEY", None)

            with pytest.raises(SheetScanError, match="No Anthropic API key"):
                await scan_sheet_image(b"fake-image-data")

    @pytest.mark.anyio
    async def test_api_error_raises(self):
        """Raises SheetScanError on non-200 API response."""
        mock_resp = _mock_httpx_response(500, text="Internal server error")

        with _patch_async_client(mock_resp):
            with pytest.raises(SheetScanError, match="Claude API error: 500"):
                await scan_sheet_image(b"fake-image-data", api_key="test-key")

    @pytest.mark.anyio
    async def test_successful_scan(self):
        """Returns parsed JSON from a successful API response."""
        expected = {
            "title": "Test Song",
            "sections": [{"name": "Verse", "bars": [{"chords": ["Am", "F"]}]}],
        }

        mock_resp = _mock_httpx_response(200, json_body={
            "content": [
                {
                    "type": "text",
                    "text": '{"title": "Test Song", "sections": [{"name": "Verse", "bars": [{"chords": ["Am", "F"]}]}]}',
                }
            ]
        })

        with _patch_async_client(mock_resp):
            result = await scan_sheet_image(b"fake-image-data", api_key="test-key")

        assert result == expected

    @pytest.mark.anyio
    async def test_handles_markdown_wrapped_json(self):
        """Strips markdown code block wrappers from API response."""
        mock_resp = _mock_httpx_response(200, json_body={
            "content": [
                {
                    "type": "text",
                    "text": '```json\n{"title": "Wrapped Song", "sections": []}\n```',
                }
            ]
        })

        with _patch_async_client(mock_resp):
            result = await scan_sheet_image(b"fake-image-data", api_key="test-key")

        assert result["title"] == "Wrapped Song"

    @pytest.mark.anyio
    async def test_invalid_json_raises(self):
        """Raises SheetScanError when API returns non-JSON text."""
        mock_resp = _mock_httpx_response(200, json_body={
            "content": [{"type": "text", "text": "This is not JSON at all"}]
        })

        with _patch_async_client(mock_resp):
            with pytest.raises(SheetScanError, match="Failed to parse Claude response"):
                await scan_sheet_image(b"fake-image-data", api_key="test-key")

    @pytest.mark.anyio
    async def test_empty_content_raises(self):
        """Raises SheetScanError when API returns no text content."""
        mock_resp = _mock_httpx_response(200, json_body={"content": []})

        with _patch_async_client(mock_resp):
            with pytest.raises(SheetScanError, match="No text response"):
                await scan_sheet_image(b"fake-image-data", api_key="test-key")


# ---------------------------------------------------------------------------
# /api/scan-sheet endpoint tests
# ---------------------------------------------------------------------------


MOCK_SCAN_RESULT = {
    "title": "Test Song",
    "artist": "Test Artist",
    "key": "Am",
    "time_signature": "4/4",
    "sections": [
        {
            "name": "Verse",
            "bars": [
                {"chords": ["Am", "F"]},
                {"chords": ["C", "G"]},
            ],
        },
    ],
}


def _make_upload(
    content: bytes = b"fake-jpeg-bytes",
    filename: str = "sheet.jpg",
    content_type: str = "image/jpeg",
):
    """Build a files dict for TestClient multipart upload."""
    return {"file": (filename, io.BytesIO(content), content_type)}


class TestScanSheetEndpoint:
    """Tests for POST /api/scan-sheet."""

    def test_successful_scan(self):
        """Uploads an image and gets scan result + input text."""
        with patch(
            "caspian.api.scan_sheet_image",
            new_callable=AsyncMock,
            return_value=MOCK_SCAN_RESULT,
        ), patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-server-key"}):
            resp = client.post(
                "/api/scan-sheet",
                files=_make_upload(),
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["scan_result"]["title"] == "Test Song"
        assert data["scan_result"]["artist"] == "Test Artist"
        assert "input_text" in data
        assert "| Am F | C G |" in data["input_text"]

    def test_no_file_returns_400(self):
        """POST without a file field returns 400."""
        with patch(
            "caspian.api.scan_sheet_image",
            new_callable=AsyncMock,
        ), patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-server-key"}):
            resp = client.post("/api/scan-sheet")

        assert resp.status_code == 400
        assert "No file uploaded" in resp.json()["detail"]

    def test_file_too_large_returns_400(self):
        """POST with >10MB file returns 400."""
        large_content = b"x" * (10 * 1024 * 1024 + 1)
        with patch(
            "caspian.api.scan_sheet_image",
            new_callable=AsyncMock,
        ), patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-server-key"}):
            resp = client.post(
                "/api/scan-sheet",
                files=_make_upload(content=large_content),
            )

        assert resp.status_code == 400
        assert "File too large" in resp.json()["detail"]

    def test_unsupported_type_returns_400(self):
        """POST with unsupported content type returns 400."""
        with patch(
            "caspian.api.scan_sheet_image",
            new_callable=AsyncMock,
        ), patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-server-key"}):
            resp = client.post(
                "/api/scan-sheet",
                files=_make_upload(
                    filename="sheet.pdf",
                    content_type="application/pdf",
                ),
            )

        assert resp.status_code == 400
        assert "Unsupported image type" in resp.json()["detail"]

    def test_scan_error_returns_502(self):
        """SheetScanError from scanner maps to 502."""
        with patch(
            "caspian.api.scan_sheet_image",
            new_callable=AsyncMock,
            side_effect=SheetScanError("Claude API error: 500"),
        ), patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-server-key"}):
            resp = client.post(
                "/api/scan-sheet",
                files=_make_upload(),
            )

        assert resp.status_code == 502
        assert "Claude API error" in resp.json()["detail"]

    def test_accepted_image_types(self):
        """All four supported image types are accepted."""
        for mime in ("image/jpeg", "image/png", "image/gif", "image/webp"):
            with patch(
                "caspian.api.scan_sheet_image",
                new_callable=AsyncMock,
                return_value=MOCK_SCAN_RESULT,
            ), patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-server-key"}):
                resp = client.post(
                    "/api/scan-sheet",
                    files=_make_upload(content_type=mime),
                )
            assert resp.status_code == 200, f"Expected 200 for {mime}, got {resp.status_code}"

    def test_no_api_key_no_pro_returns_403(self):
        """Non-pro user without API key and no server key gets 403."""
        saved = os.environ.pop("ANTHROPIC_API_KEY", None)
        try:
            resp = client.post(
                "/api/scan-sheet",
                files=_make_upload(),
            )
        finally:
            if saved is not None:
                os.environ["ANTHROPIC_API_KEY"] = saved

        assert resp.status_code == 403
        assert "Pro account" in resp.json()["detail"]

    def test_user_supplied_api_key(self):
        """Non-pro user can provide their own API key via header."""
        saved = os.environ.pop("ANTHROPIC_API_KEY", None)
        try:
            with patch(
                "caspian.api.scan_sheet_image",
                new_callable=AsyncMock,
                return_value=MOCK_SCAN_RESULT,
            ) as mock_scan:
                resp = client.post(
                    "/api/scan-sheet",
                    files=_make_upload(),
                    headers={"x-anthropic-api-key": "user-supplied-key"},
                )
        finally:
            if saved is not None:
                os.environ["ANTHROPIC_API_KEY"] = saved

        assert resp.status_code == 200
        # Verify the user-supplied key was passed through
        mock_scan.assert_called_once()
        call_kwargs = mock_scan.call_args
        assert call_kwargs.kwargs.get("api_key") == "user-supplied-key"

    def test_scan_result_converted_to_input_text(self):
        """Verifies the response includes properly formatted input text."""
        result_with_metadata = {
            "title": "My Song",
            "artist": "My Artist",
            "key": "C",
            "sections": [
                {
                    "name": "Intro",
                    "bars": [{"chords": ["C", "G", "Am", "F"]}],
                },
            ],
        }

        with patch(
            "caspian.api.scan_sheet_image",
            new_callable=AsyncMock,
            return_value=result_with_metadata,
        ), patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-server-key"}):
            resp = client.post(
                "/api/scan-sheet",
                files=_make_upload(),
            )

        assert resp.status_code == 200
        input_text = resp.json()["input_text"]
        assert "title: My Song" in input_text
        assert "artist: My Artist" in input_text
        assert "key: C" in input_text
        assert "Intro:" in input_text
        assert "| C G Am F |" in input_text
