"""Tests for secondary dominant detection."""

import pytest
from caspian.analysis.secondary_dominants import detect_secondary_dominant
from caspian.models.key import Key
from caspian.parsing.chord_parser import parse_chord


class TestSecondaryDominants:
    def test_a7_is_v_of_dm_in_am(self):
        """A7 → Dm: A7 is V7/iv in Am."""
        key = Key.from_name("A", "natural_minor")
        chord = parse_chord("A7")
        next_chord = parse_chord("Dm")
        result = detect_secondary_dominant(chord, next_chord, key)
        assert result is not None
        assert "V7/iv" in result

    def test_b_is_v_of_em_in_am(self):
        """B → Em: B is V/v in Am."""
        key = Key.from_name("A", "natural_minor")
        chord = parse_chord("B")
        next_chord = parse_chord("Em")
        result = detect_secondary_dominant(chord, next_chord, key)
        assert result is not None
        assert "V/v" in result

    def test_a7_is_v7_of_dm_in_c_major(self):
        """A7 → Dm in C: A7 = V7/ii."""
        key = Key.from_name("C", "major")
        chord = parse_chord("A7")
        next_chord = parse_chord("Dm")
        result = detect_secondary_dominant(chord, next_chord, key)
        assert result is not None
        assert "V7/ii" in result

    def test_diatonic_v_not_secondary(self):
        """G in C major is diatonic V, not a secondary dominant."""
        key = Key.from_name("C", "major")
        chord = parse_chord("G")
        next_chord = parse_chord("C")
        result = detect_secondary_dominant(chord, next_chord, key)
        assert result is None

    def test_minor_chord_not_secondary(self):
        """Minor chords can't be secondary dominants."""
        key = Key.from_name("A", "natural_minor")
        chord = parse_chord("Dm")
        next_chord = parse_chord("Am")
        result = detect_secondary_dominant(chord, next_chord, key)
        assert result is None

    def test_e_major_in_am_is_not_secondary_but_diatonic_in_harmonic(self):
        """E major in Am natural minor: V/i — but since Em is diatonic in
        natural minor and E major is not, this should be detected.
        However E's target (A) is degree 1, making it V/i which is really just V."""
        key = Key.from_name("A", "natural_minor")
        chord = parse_chord("E")
        next_chord = parse_chord("Am")
        result = detect_secondary_dominant(chord, next_chord, key)
        # E is not diatonic in natural minor, and its target A is degree 1
        # So it should be detected as V/i
        assert result is not None
