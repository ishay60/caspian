"""Tests for scale library and diatonic chord functions."""

import pytest
from caspian.models.key import Key
from caspian.models.chord import ChordQuality
from caspian.theory.scales import build_scale, build_diatonic_triads, is_diatonic, degree_of
from caspian.parsing.chord_parser import parse_chord


class TestBuildScale:
    def test_a_natural_minor(self):
        # A B C D E F G = 9 11 0 2 4 5 7
        assert build_scale(9, "natural_minor") == [9, 11, 0, 2, 4, 5, 7]

    def test_a_harmonic_minor(self):
        # A B C D E F G# = 9 11 0 2 4 5 8
        assert build_scale(9, "harmonic_minor") == [9, 11, 0, 2, 4, 5, 8]

    def test_c_major(self):
        # C D E F G A B = 0 2 4 5 7 9 11
        assert build_scale(0, "major") == [0, 2, 4, 5, 7, 9, 11]

    def test_a_dorian(self):
        # A B C D E F# G = 9 11 0 2 4 6 7
        assert build_scale(9, "dorian") == [9, 11, 0, 2, 4, 6, 7]


class TestDiatonicTriads:
    def test_am_natural_minor(self):
        key = Key.from_name("A", "natural_minor")
        triads = build_diatonic_triads(key)
        # i=Am, ii°=Bdim, III=C, iv=Dm, v=Em, VI=F, VII=G
        assert triads[1] == (9, ChordQuality.MINOR)       # Am
        assert triads[2] == (11, ChordQuality.DIMINISHED)  # Bdim
        assert triads[3] == (0, ChordQuality.MAJOR)        # C
        assert triads[4] == (2, ChordQuality.MINOR)        # Dm
        assert triads[5] == (4, ChordQuality.MINOR)        # Em
        assert triads[6] == (5, ChordQuality.MAJOR)        # F
        assert triads[7] == (7, ChordQuality.MAJOR)        # G

    def test_a_harmonic_minor(self):
        key = Key.from_name("A", "harmonic_minor")
        triads = build_diatonic_triads(key)
        # V = E major (G# gives major quality)
        assert triads[5] == (4, ChordQuality.MAJOR)  # E major


class TestIsDiatonic:
    def test_am_in_am(self):
        key = Key.from_name("A", "natural_minor")
        assert is_diatonic(parse_chord("Am"), key) is True

    def test_dm_in_am(self):
        key = Key.from_name("A", "natural_minor")
        assert is_diatonic(parse_chord("Dm"), key) is True

    def test_em_in_am(self):
        key = Key.from_name("A", "natural_minor")
        assert is_diatonic(parse_chord("Em"), key) is True

    def test_f_in_am(self):
        key = Key.from_name("A", "natural_minor")
        assert is_diatonic(parse_chord("F"), key) is True

    def test_c_in_am(self):
        key = Key.from_name("A", "natural_minor")
        assert is_diatonic(parse_chord("C"), key) is True

    def test_g_in_am(self):
        key = Key.from_name("A", "natural_minor")
        assert is_diatonic(parse_chord("G"), key) is True

    def test_d_major_not_in_am_natural(self):
        """D major is NOT diatonic in A natural minor (it's borrowed from Dorian)."""
        key = Key.from_name("A", "natural_minor")
        assert is_diatonic(parse_chord("D"), key) is False

    def test_e_major_not_in_am_natural(self):
        """E major is NOT diatonic in natural minor (needs harmonic minor)."""
        key = Key.from_name("A", "natural_minor")
        assert is_diatonic(parse_chord("E"), key) is False

    def test_e_major_in_am_harmonic(self):
        """E major IS diatonic in A harmonic minor."""
        key = Key.from_name("A", "harmonic_minor")
        assert is_diatonic(parse_chord("E"), key) is True

    def test_d_major_in_a_dorian(self):
        """D major IS diatonic in A Dorian."""
        key = Key.from_name("A", "dorian")
        assert is_diatonic(parse_chord("D"), key) is True

    def test_e7_in_am_harmonic(self):
        """E7 should be treated as diatonic in harmonic minor (dominant extension)."""
        key = Key.from_name("A", "harmonic_minor")
        assert is_diatonic(parse_chord("E7"), key) is True

    def test_bm7b5_in_am(self):
        """Bm7b5 (half-dim) is diatonic in Am natural minor."""
        key = Key.from_name("A", "natural_minor")
        assert is_diatonic(parse_chord("Bm7b5"), key) is True


class TestDegreeOf:
    def test_a_in_am(self):
        key = Key.from_name("A", "natural_minor")
        assert degree_of(9, key) == 1

    def test_d_in_am(self):
        key = Key.from_name("A", "natural_minor")
        assert degree_of(2, key) == 4

    def test_fsharp_not_in_am(self):
        key = Key.from_name("A", "natural_minor")
        assert degree_of(6, key) is None
