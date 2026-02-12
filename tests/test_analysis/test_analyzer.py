"""Tests for the analysis pipeline orchestrator."""

import pytest
from caspian.analysis.analyzer import analyze_song
from caspian.models.input import SongInput, SectionInput, ChordInput


class TestAnalyzerSimple:
    def test_simple_am_progression(self):
        """Am → Dm → E → Am: all diatonic, no special events."""
        song = SongInput(
            title="Test",
            artist="Test",
            key="Am",
            sections=[SectionInput(
                name="verse",
                chords=[ChordInput(symbol=s) for s in ["Am", "Dm", "E", "Am"]],
            )],
        )
        result = analyze_song(song)
        assert result.key.root_name == "A"
        assert result.key.mode == "natural_minor"
        assert len(result.sections) == 1

        section = result.sections[0]
        assert len(section.chords) == 4
        # Am is diatonic
        assert section.chords[0].is_diatonic is True
        assert section.chords[0].roman_numeral == "i"
        # Dm is diatonic
        assert section.chords[1].is_diatonic is True
        assert section.chords[1].roman_numeral == "iv"


class TestAnalyzerSecondaryDominant:
    def test_c_a7_dm_g7_c(self):
        """C → A7 → Dm → G7 → C: A7 = V7/ii."""
        song = SongInput(
            key="C",
            key_mode="major",
            sections=[SectionInput(
                name="verse",
                chords=[ChordInput(symbol=s) for s in ["C", "A7", "Dm", "G7", "C"]],
            )],
        )
        result = analyze_song(song)
        section = result.sections[0]

        # A7 should be detected as secondary dominant
        a7_analysis = section.chords[1]
        assert a7_analysis.secondary_dominant is not None
        assert "V7/ii" in a7_analysis.secondary_dominant


class TestAnalyzerYomShishiChorus:
    def test_chorus_ground_truth(self):
        """Ground truth from the spec: Am/E → D#dim → F#dim → F → D → Am → E → Dm."""
        song = SongInput(
            key="Am",
            sections=[SectionInput(
                name="chorus",
                chords=[ChordInput(symbol=s) for s in
                        ["Am/E", "D#dim", "F#dim", "F", "D", "Am", "E", "Dm"]],
            )],
        )
        result = analyze_song(song)
        section = result.sections[0]
        chords = section.chords

        # Am/E: diatonic (i in 2nd inversion)
        assert chords[0].roman_numeral == "i"
        assert chords[0].is_diatonic is True

        # D#dim: non-diatonic, has chromatic and rootless interpretations
        assert chords[1].is_diatonic is False
        types = [i.type for i in chords[1].interpretations]
        assert "chromatic_approach_from" in types  # bass E→D# descending

        # F#dim: non-diatonic, chromatic approach to F + common tone
        assert chords[2].is_diatonic is False
        types = [i.type for i in chords[2].interpretations]
        assert "chromatic_approach_to" in types  # bass F#→F descending

        # F: diatonic (bVI)
        assert chords[3].is_diatonic is True
        assert chords[3].roman_numeral == "VI"

        # D: non-diatonic (borrowed from Dorian)
        assert chords[4].is_diatonic is False
        borrowed_interps = [i for i in chords[4].interpretations if i.type == "borrowed"]
        assert len(borrowed_interps) >= 1
        assert any("Dorian" in i.detail for i in borrowed_interps)

        # Am: diatonic (i)
        assert chords[5].is_diatonic is True
        assert chords[5].roman_numeral == "i"

        # E: non-diatonic in natural minor, but V
        assert chords[6].roman_numeral == "V"

        # E → Dm: deceptive resolution
        assert chords[6].deceptive_resolution is not None
        assert "Dm" in chords[6].deceptive_resolution

        # Dm: diatonic (iv)
        assert chords[7].is_diatonic is True
        assert chords[7].roman_numeral == "iv"

        # Chromatic runs: should detect E→D# and F#→F pairs
        assert len(section.chromatic_runs) >= 2
