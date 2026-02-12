"""Tests for deceptive resolution detection."""

import pytest
from caspian.analysis.deceptive import detect_deceptive_resolution
from caspian.models.key import Key
from caspian.parsing.chord_parser import parse_chord


class TestDeceptiveResolution:
    def test_e_to_dm_in_am(self):
        """E → Dm in Am: E is V, expected Am, got Dm = deceptive."""
        key = Key.from_name("A", "natural_minor")
        chord = parse_chord("E")
        next_chord = parse_chord("Dm")
        result = detect_deceptive_resolution(chord, next_chord, key)
        assert result is not None
        assert "Deceptive" in result
        assert "Dm" in result

    def test_e_to_am_not_deceptive(self):
        """E → Am: normal V → i resolution."""
        key = Key.from_name("A", "natural_minor")
        chord = parse_chord("E")
        next_chord = parse_chord("Am")
        result = detect_deceptive_resolution(chord, next_chord, key)
        assert result is None

    def test_g7_to_c_in_c_major_not_deceptive(self):
        """G7 → C: normal V7 → I resolution."""
        key = Key.from_name("C", "major")
        chord = parse_chord("G7")
        next_chord = parse_chord("C")
        result = detect_deceptive_resolution(chord, next_chord, key)
        assert result is None

    def test_g7_to_am_in_c_major(self):
        """G7 → Am in C: deceptive V7 → vi."""
        key = Key.from_name("C", "major")
        chord = parse_chord("G7")
        next_chord = parse_chord("Am")
        result = detect_deceptive_resolution(chord, next_chord, key)
        assert result is not None
        assert "Deceptive" in result

    def test_minor_chord_not_deceptive(self):
        """Dm → G in C: Dm is not a dominant, so no deceptive detection."""
        key = Key.from_name("C", "major")
        chord = parse_chord("Dm")
        next_chord = parse_chord("G")
        result = detect_deceptive_resolution(chord, next_chord, key)
        assert result is None

    def test_no_next_chord(self):
        """No next chord → no deceptive resolution."""
        key = Key.from_name("A", "natural_minor")
        chord = parse_chord("E")
        result = detect_deceptive_resolution(chord, None, key)
        assert result is None
