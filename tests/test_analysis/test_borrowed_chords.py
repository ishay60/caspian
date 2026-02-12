"""Tests for borrowed chord detection."""

import pytest
from caspian.analysis.borrowed_chords import detect_borrowed_chord
from caspian.models.key import Key
from caspian.parsing.chord_parser import parse_chord


class TestBorrowedChords:
    def test_d_major_in_am_borrowed_from_dorian(self):
        """D major in Am = borrowed from A Dorian (IV instead of iv)."""
        key = Key.from_name("A", "natural_minor")
        chord = parse_chord("D")
        sources = detect_borrowed_chord(chord, key)
        assert "Dorian" in sources

    def test_am_is_not_borrowed(self):
        """Am in Am = diatonic, not borrowed."""
        key = Key.from_name("A", "natural_minor")
        chord = parse_chord("Am")
        sources = detect_borrowed_chord(chord, key)
        assert sources == []

    def test_f_is_not_borrowed(self):
        """F major in Am = diatonic (bVI), not borrowed."""
        key = Key.from_name("A", "natural_minor")
        chord = parse_chord("F")
        sources = detect_borrowed_chord(chord, key)
        assert sources == []

    def test_e_major_borrowed_from_harmonic_minor(self):
        """E major in Am natural minor is borrowed from harmonic minor."""
        key = Key.from_name("A", "natural_minor")
        chord = parse_chord("E")
        sources = detect_borrowed_chord(chord, key)
        assert "Harmonic Minor" in sources
