"""Tests for RTL/LTR handler."""

import pytest
from caspian.parsing.rtl_handler import has_hebrew, normalize_chord_order, detect_section_type


class TestHasHebrew:
    def test_hebrew_text(self):
        assert has_hebrew("יום שישי חזר") is True

    def test_english_text(self):
        assert has_hebrew("Am D C G") is False

    def test_mixed(self):
        assert has_hebrew("Am | יום שישי") is True

    def test_empty(self):
        assert has_hebrew("") is False


class TestNormalizeChordOrder:
    def test_rtl_with_hebrew(self):
        """Chords displayed as 'D#dim Am/E' with Hebrew context → reversed to Am/E D#dim."""
        result = normalize_chord_order(["D#dim", "Am/E"], "יש אולי סיכוי קרוב")
        assert result == ["Am/E", "D#dim"]

    def test_ltr_without_hebrew(self):
        """Chords without Hebrew context → unchanged."""
        result = normalize_chord_order(["Am", "D", "C"], "intro section")
        assert result == ["Am", "D", "C"]

    def test_chorus_rtl_full(self):
        """Full chorus line from spec: Am/E D#dim displayed → Am/E → D#dim chronologically."""
        # In the spec: displayed "D#dim Am/E" with Hebrew lyrics
        # Visual left-to-right: ["D#dim", "Am/E"]
        # But with Hebrew context, we reverse: ["Am/E", "D#dim"]
        result = normalize_chord_order(["D#dim", "Am/E"], "יש אולי סיכוי קרוב")
        assert result == ["Am/E", "D#dim"]


class TestDetectSectionType:
    @pytest.mark.parametrize("header,expected", [
        ("[intro]", "instrumental"),
        ("[outro]", "instrumental"),
        ("[instrumental]", "instrumental"),
        ("[solo]", "instrumental"),
        ("[פתיחה]", "instrumental"),
        ("[סיום]", "instrumental"),
        ("[verse]", "vocal"),
        ("[chorus]", "vocal"),
        ("[bridge]", "vocal"),
    ])
    def test_section_type(self, header, expected):
        assert detect_section_type(header) == expected
