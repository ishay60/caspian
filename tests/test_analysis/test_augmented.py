"""Tests for augmented chord analysis."""

import pytest
from caspian.analysis.augmented import analyze_augmented
from caspian.models.key import Key
from caspian.parsing.chord_parser import parse_chord


class TestDominantAugmented:
    """V+ — dominant with raised 5th."""

    def test_faug_in_bbm_is_v_plus(self):
        """Faug in Bb minor is V+ (F is the 5th degree of Bb)."""
        key = Key.from_name("Bb", "natural_minor")
        chord = parse_chord("Faug")
        results = analyze_augmented(chord, None, None, key)

        dom = [r for r in results if r.type == "dominant_augmented"]
        assert len(dom) == 1
        assert "V+" in dom[0].detail
        assert dom[0].confidence >= 0.85

    def test_eaug_resolving_to_am(self):
        """Eaug → Am in A minor: V+ resolving to tonic gets higher confidence."""
        key = Key.from_name("A", "natural_minor")
        chord = parse_chord("Eaug")
        next_c = parse_chord("Am")
        results = analyze_augmented(chord, None, next_c, key)

        dom = [r for r in results if r.type == "dominant_augmented"]
        assert len(dom) == 1
        assert dom[0].confidence >= 0.95
        assert "resolves" in dom[0].detail

    def test_gaug_resolving_to_c(self):
        """Gaug → C in C major: V+ resolving to tonic."""
        key = Key.from_name("C", "major")
        chord = parse_chord("Gaug")
        next_c = parse_chord("C")
        results = analyze_augmented(chord, None, next_c, key)

        dom = [r for r in results if r.type == "dominant_augmented"]
        assert len(dom) == 1
        assert dom[0].confidence >= 0.95

    def test_non_v_degree_not_dominant(self):
        """Caug in C major is NOT V+ (it's degree 1, not 5)."""
        key = Key.from_name("C", "major")
        chord = parse_chord("Caug")
        results = analyze_augmented(chord, None, None, key)

        dom = [r for r in results if r.type == "dominant_augmented"]
        assert len(dom) == 0


class TestSecondaryDominantAug:
    """V+/X — augmented secondary dominant."""

    def test_eaug_to_am_in_c_major(self):
        """Eaug → Am in C major: V+/vi (E is V of A, and A is vi in C)."""
        key = Key.from_name("C", "major")
        chord = parse_chord("Eaug")
        next_c = parse_chord("Am")
        results = analyze_augmented(chord, None, next_c, key)

        sec = [r for r in results if r.type == "secondary_dominant_aug"]
        assert len(sec) == 1
        assert "V+/" in sec[0].detail
        assert sec[0].confidence >= 0.80


class TestHarmonicMinorIII:
    """III+ from harmonic minor."""

    def test_caug_in_am(self):
        """Caug in A minor: III+ from harmonic minor (C E G#)."""
        key = Key.from_name("A", "natural_minor")
        chord = parse_chord("Caug")
        results = analyze_augmented(chord, None, None, key)

        hm = [r for r in results if r.type == "harmonic_minor_III"]
        assert len(hm) == 1
        assert "harmonic minor" in hm[0].detail
        assert hm[0].confidence >= 0.80

    def test_not_iii_in_major(self):
        """Caug in C major: NOT III+ from harmonic minor."""
        key = Key.from_name("C", "major")
        chord = parse_chord("Caug")
        results = analyze_augmented(chord, None, None, key)

        hm = [r for r in results if r.type == "harmonic_minor_III"]
        assert len(hm) == 0

    def test_ebaug_in_cm(self):
        """Ebaug in C minor: III+ from C harmonic minor (Eb G B)."""
        key = Key.from_name("C", "natural_minor")
        chord = parse_chord("Ebaug")
        results = analyze_augmented(chord, None, None, key)

        hm = [r for r in results if r.type == "harmonic_minor_III"]
        assert len(hm) == 1


class TestChromaticVoiceLeading:
    """Chromatic voice leading of the raised 5th."""

    def test_raised_5th_resolves_up(self):
        """Faug → Bb: raised 5th C# resolves up to D (3rd of Bb)."""
        key = Key.from_name("Bb", "natural_minor")
        chord = parse_chord("Faug")
        next_c = parse_chord("Bb")
        results = analyze_augmented(chord, None, next_c, key)

        vl = [r for r in results if r.type == "chromatic_voice_leading"]
        assert len(vl) >= 1
        # At least one interpretation should mention resolving by half step
        assert any("half step" in v.detail for v in vl)

    def test_chromatic_approach_from_prev(self):
        """Prev chord → Faug: raised 5th approached chromatically."""
        key = Key.from_name("Bb", "natural_minor")
        prev = parse_chord("Bb")
        chord = parse_chord("Faug")
        results = analyze_augmented(chord, prev, None, key)

        ca = [r for r in results if r.type == "chromatic_approach"]
        # Bb pitches = {10, 2, 5} (Bb, D, F); Faug raised 5th = C# = 1
        # D (2) is one semitone above C# (1), so chromatic approach exists
        assert len(ca) >= 1


class TestCommonTones:
    """Common tones with neighboring chords."""

    def test_common_tones_with_next(self):
        """Caug (C E G#) shares E with Am (A C E) → 2+ common tones."""
        key = Key.from_name("A", "natural_minor")
        chord = parse_chord("Caug")
        next_c = parse_chord("Am")
        results = analyze_augmented(chord, None, next_c, key)

        ct = [r for r in results if r.type == "common_tone_aug"]
        # Caug = {0, 4, 8}, Am = {9, 0, 4} → shares C(0) and E(4) → 2 common tones
        assert len(ct) >= 1


class TestNonAugmentedChord:
    """Non-augmented chords should return empty."""

    def test_major_chord_returns_empty(self):
        key = Key.from_name("C", "major")
        chord = parse_chord("C")
        results = analyze_augmented(chord, None, None, key)
        assert results == []

    def test_minor_chord_returns_empty(self):
        key = Key.from_name("A", "natural_minor")
        chord = parse_chord("Am")
        results = analyze_augmented(chord, None, None, key)
        assert results == []
