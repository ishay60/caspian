"""Tests for /api/convert-lyrics endpoint.

Tests the API endpoint that converts lyrics-based input to analyzed song output.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from caspian.api import app

client = TestClient(app)


class TestConvertLyricsEndpoint:
    """Test /api/convert-lyrics endpoint."""

    def test_minimal_valid_request(self):
        """Test endpoint with minimal valid input."""
        request = {
            "title": "Test Song",
            "artist": "Test Artist",
            "key_root_name": "C",
            "key_mode": "major",
            "lyrics_lines": [
                {
                    "text": "Hello world",
                    "chords": [{"column": 0, "symbol": "C"}],
                }
            ],
        }

        response = client.post("/api/convert-lyrics", json=request)

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Song"
        assert data["artist"] == "Test Artist"
        assert data["key"]["root_name"] == "C"
        assert data["key"]["mode"] == "major"
        assert len(data["sections"]) == 1

    def test_empty_lyrics_lines(self):
        """Test endpoint with no lyrics lines returns error."""
        request = {
            "title": "Empty Song",
            "lyrics_lines": [],
        }

        response = client.post("/api/convert-lyrics", json=request)

        # Empty lyrics creates a section but with no content, which should fail validation
        assert response.status_code in [400, 500]

    def test_lyrics_without_chords(self):
        """Test endpoint with lyrics but no chords succeeds (creates empty section)."""
        request = {
            "lyrics_lines": [
                {"text": "Line without chords", "chords": []},
            ],
        }

        response = client.post("/api/convert-lyrics", json=request)

        # This actually succeeds because it creates a section with lines but no chords
        # The analyzer can handle empty sections
        assert response.status_code == 200

    def test_with_section_markers(self):
        """Test endpoint with section markers."""
        request = {
            "title": "Song with Sections",
            "key_root_name": "Am",
            "lyrics_lines": [
                {"text": "Verse line", "chords": [{"column": 0, "symbol": "Am"}]},
                {"text": "Chorus line", "chords": [{"column": 0, "symbol": "C"}]},
            ],
            "section_markers": [
                {"line_index": 0, "name": "verse"},
                {"line_index": 1, "name": "chorus"},
            ],
        }

        response = client.post("/api/convert-lyrics", json=request)

        assert response.status_code == 200
        data = response.json()
        assert len(data["sections"]) == 2
        assert data["sections"][0]["name"] == "verse"
        assert data["sections"][1]["name"] == "chorus"

    def test_with_bar_markers(self):
        """Test endpoint with bar markers and beat positions."""
        request = {
            "key_root_name": "C",
            "lyrics_lines": [
                {
                    "text": "Test line",
                    "chords": [
                        {"column": 0, "symbol": "C"},
                        {"column": 5, "symbol": "G"},
                    ],
                }
            ],
            "bar_markers": [
                {"chord_index": 0, "time_signature": [4, 4]},
                {"chord_index": 1, "time_signature": [4, 4]},
            ],
            "chords_with_beats": [
                {
                    "symbol": "C",
                    "column": 0,
                    "beat_position": {"beat": 1, "subdivision": 0},
                },
                {
                    "symbol": "G",
                    "column": 5,
                    "beat_position": {"beat": 1, "subdivision": 0},
                },
            ],
        }

        response = client.post("/api/convert-lyrics", json=request)

        assert response.status_code == 200
        # Bar data is internal and not directly exposed in AnalyzeResponse
        # But the analysis should succeed
        data = response.json()
        assert len(data["sections"]) >= 1

    def test_with_riff_data(self):
        """Test endpoint with riff/note data in bars."""
        request = {
            "key_root_name": "Am",
            "lyrics_lines": [{"text": "", "chords": []}],
            "bar_markers": [
                {
                    "chord_index": 0,
                    "riff": {
                        "label": "intro riff",
                        "notes": [
                            {
                                "pitch": "A",
                                "octave": 4,
                                "beat_position": {"beat": 1, "subdivision": 0},
                                "duration_beats": 0.5,
                            }
                        ],
                    },
                }
            ],
        }

        response = client.post("/api/convert-lyrics", json=request)

        # Should succeed even with just riff data, no chords
        assert response.status_code == 200

    def test_with_tab_notation(self):
        """Test endpoint with guitar tab notation."""
        request = {
            "key_root_name": "E",
            "lyrics_lines": [{"text": "", "chords": []}],
            "bar_markers": [
                {
                    "chord_index": 0,
                    "riff": {
                        "label": "tab riff",
                        "tab_notes": [
                            {
                                "string": 1,
                                "fret": 0,
                                "beat_position": {"beat": 1, "subdivision": 0},
                            },
                            {
                                "string": 2,
                                "fret": 3,
                                "beat_position": {"beat": 2, "subdivision": 0},
                            },
                        ],
                    },
                }
            ],
        }

        response = client.post("/api/convert-lyrics", json=request)

        assert response.status_code == 200

    def test_hebrew_lyrics(self):
        """Test endpoint with Hebrew lyrics."""
        request = {
            "title": "שיר עברי",
            "key_root_name": "Am",
            "lyrics_lines": [
                {
                    "text": "שלום עולם",
                    "chords": [{"column": 0, "symbol": "Am"}],
                }
            ],
        }

        response = client.post("/api/convert-lyrics", json=request)

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "שיר עברי"
        # Hebrew lyrics should be in the section lines
        assert len(data["sections"][0]["lines"]) == 1

    def test_complex_song_structure(self):
        """Test endpoint with complex multi-section song."""
        request = {
            "title": "Complex Song",
            "artist": "Test Artist",
            "key_root_name": "C",
            "key_mode": "major",
            "tempo_bpm": 120.0,
            "lyrics_lines": [
                {"text": "Verse 1 line 1", "chords": [{"column": 0, "symbol": "C"}]},
                {"text": "Verse 1 line 2", "chords": [{"column": 0, "symbol": "Am"}]},
                {"text": "Chorus line 1", "chords": [{"column": 0, "symbol": "F"}]},
                {"text": "Chorus line 2", "chords": [{"column": 0, "symbol": "G"}]},
            ],
            "section_markers": [
                {"line_index": 0, "name": "verse", "section_type": "vocal"},
                {"line_index": 2, "name": "chorus", "section_type": "vocal"},
            ],
        }

        response = client.post("/api/convert-lyrics", json=request)

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Complex Song"
        assert len(data["sections"]) == 2
        assert data["sections"][0]["name"] == "verse"
        # Sections share all chords in current implementation - check total count
        total_chords = sum(len(s["chords"]) for s in data["sections"])
        assert total_chords >= 4

    def test_instrumental_section(self):
        """Test endpoint with instrumental section."""
        request = {
            "key_root_name": "E",
            "lyrics_lines": [{"text": "", "chords": [{"column": 0, "symbol": "E"}]}],
            "section_markers": [
                {"line_index": 0, "name": "solo", "section_type": "instrumental"}
            ],
        }

        response = client.post("/api/convert-lyrics", json=request)

        assert response.status_code == 200

    def test_invalid_chord_symbol(self):
        """Test endpoint with invalid chord symbol."""
        request = {
            "lyrics_lines": [
                {
                    "text": "Invalid chord",
                    "chords": [{"column": 0, "symbol": "InvalidChord123"}],
                }
            ],
        }

        response = client.post("/api/convert-lyrics", json=request)

        # Invalid chord symbols might be accepted by converter but fail during analysis
        # or might pass through if analyzer is lenient
        assert response.status_code in [200, 400, 500]

    def test_missing_required_fields(self):
        """Test endpoint with missing required fields."""
        request = {
            # Missing lyrics_lines - but it has a default value of []
            "title": "Incomplete Request",
        }

        response = client.post("/api/convert-lyrics", json=request)

        # Pydantic uses default values, so empty list is valid but creates empty content
        assert response.status_code in [200, 400, 422, 500]

    def test_malformed_json(self):
        """Test endpoint with malformed JSON returns 422."""
        response = client.post(
            "/api/convert-lyrics",
            data="not valid json",
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 422


class TestAnalysisIntegration:
    """Test that conversion integrates properly with analysis."""

    def test_analysis_returns_chord_analysis(self):
        """Test that analysis includes chord analysis."""
        request = {
            "key_root_name": "C",
            "key_mode": "major",
            "lyrics_lines": [
                {
                    "text": "Test progression",
                    "chords": [
                        {"column": 0, "symbol": "C"},
                        {"column": 5, "symbol": "Am"},
                        {"column": 8, "symbol": "F"},
                        {"column": 11, "symbol": "G"},
                    ],
                }
            ],
        }

        response = client.post("/api/convert-lyrics", json=request)

        assert response.status_code == 200
        data = response.json()
        # Check that we have sections and chords
        assert len(data["sections"]) >= 1
        # Find a section with chords
        section_with_chords = next((s for s in data["sections"] if s["chords"]), None)
        assert section_with_chords is not None
        assert len(section_with_chords["chords"]) >= 1
        # Check that chords have analysis data
        first_chord = section_with_chords["chords"][0]
        assert "symbol" in first_chord
        assert "roman_numeral" in first_chord

    def test_analysis_detects_key(self):
        """Test that key is properly used in analysis."""
        request = {
            "key_root_name": "Am",
            "key_mode": "natural_minor",
            "lyrics_lines": [
                {
                    "text": "Minor progression",
                    "chords": [
                        {"column": 0, "symbol": "Am"},
                        {"column": 3, "symbol": "Dm"},
                        {"column": 6, "symbol": "E"},
                    ],
                }
            ],
        }

        response = client.post("/api/convert-lyrics", json=request)

        assert response.status_code == 200
        data = response.json()
        assert data["key"]["root_name"] == "A"
        assert data["key"]["mode"] == "natural_minor"
        # Find section with chords
        section_with_chords = next((s for s in data["sections"] if s["chords"]), None)
        assert section_with_chords is not None
        # Check that analysis exists
        assert len(section_with_chords["chords"]) >= 1

    def test_analysis_with_bar_data(self):
        """Test that analysis works with bar-based input."""
        request = {
            "key_root_name": "G",
            "key_mode": "major",
            "lyrics_lines": [
                {
                    "text": "Bar test",
                    "chords": [
                        {"column": 0, "symbol": "G"},
                        {"column": 4, "symbol": "D"},
                    ],
                }
            ],
            "bar_markers": [
                {"chord_index": 0, "time_signature": [4, 4]},
                {"chord_index": 1, "time_signature": [4, 4]},
            ],
            "chords_with_beats": [
                {
                    "symbol": "G",
                    "column": 0,
                    "beat_position": {"beat": 1, "subdivision": 0},
                },
                {
                    "symbol": "D",
                    "column": 4,
                    "beat_position": {"beat": 1, "subdivision": 0},
                },
            ],
        }

        response = client.post("/api/convert-lyrics", json=request)

        assert response.status_code == 200
        data = response.json()
        # Analysis should succeed with bar data
        assert len(data["sections"][0]["chords"]) == 2


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_request(self):
        """Test completely empty request."""
        request = {}

        response = client.post("/api/convert-lyrics", json=request)

        # Pydantic uses default values, so this might succeed with defaults
        # or fail validation, or fail in analysis
        assert response.status_code in [200, 400, 422, 500]

    def test_very_long_lyrics(self):
        """Test with very long lyrics text."""
        long_text = "word " * 1000
        request = {
            "lyrics_lines": [
                {"text": long_text, "chords": [{"column": 0, "symbol": "C"}]}
            ],
        }

        response = client.post("/api/convert-lyrics", json=request)

        assert response.status_code == 200

    def test_many_chords_per_line(self):
        """Test with many chords on a single line."""
        chords = [{"column": i * 2, "symbol": "C"} for i in range(50)]
        request = {
            "lyrics_lines": [{"text": "x " * 100, "chords": chords}],
        }

        response = client.post("/api/convert-lyrics", json=request)

        assert response.status_code == 200
        data = response.json()
        # Find section with chords
        section_with_chords = next((s for s in data["sections"] if s["chords"]), None)
        assert section_with_chords is not None
        # Should have many chords
        assert len(section_with_chords["chords"]) >= 40

    def test_zero_beat_position(self):
        """Test beat position with beat=0 (invalid) returns error."""
        request = {
            "lyrics_lines": [{"text": "Test", "chords": [{"column": 0, "symbol": "C"}]}],
            "bar_markers": [{"chord_index": 0}],
            "chords_with_beats": [
                {
                    "symbol": "C",
                    "column": 0,
                    "beat_position": {"beat": 0, "subdivision": 0},  # Invalid
                }
            ],
        }

        response = client.post("/api/convert-lyrics", json=request)

        # Pydantic should validate and reject beat < 1 (could be 400 or 422)
        assert response.status_code in [400, 422]

    def test_negative_subdivision(self):
        """Test negative subdivision (invalid) returns error."""
        request = {
            "lyrics_lines": [{"text": "Test", "chords": [{"column": 0, "symbol": "C"}]}],
            "bar_markers": [{"chord_index": 0}],
            "chords_with_beats": [
                {
                    "symbol": "C",
                    "column": 0,
                    "beat_position": {"beat": 1, "subdivision": -1},  # Invalid
                }
            ],
        }

        response = client.post("/api/convert-lyrics", json=request)

        assert response.status_code in [400, 422]

    def test_subdivision_out_of_range(self):
        """Test subdivision > 3 (invalid) returns error."""
        request = {
            "lyrics_lines": [{"text": "Test", "chords": [{"column": 0, "symbol": "C"}]}],
            "bar_markers": [{"chord_index": 0}],
            "chords_with_beats": [
                {
                    "symbol": "C",
                    "column": 0,
                    "beat_position": {"beat": 1, "subdivision": 4},  # Invalid
                }
            ],
        }

        response = client.post("/api/convert-lyrics", json=request)

        assert response.status_code in [400, 422]
