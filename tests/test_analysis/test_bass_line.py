"""Tests for bass line extraction and chromatic run detection."""

import pytest
from caspian.analysis.bass_line import extract_bass_line, detect_chromatic_runs
from caspian.parsing.chord_parser import parse_chord


class TestExtractBassLine:
    def test_chorus_bass(self, yom_shishi_chorus_chords):
        """Verify bass line from the ground truth chorus."""
        bass = extract_bass_line(yom_shishi_chorus_chords)
        names = [b.name for b in bass]
        # Am/E→D#dim→F#dim→F→D→Am→E→Dm
        # Bass: E, D#, F#, F, D, A, E, D
        assert names == ["E", "D#", "F#", "F", "D", "A", "E", "D"]

    def test_bass_motion_chromatic(self, yom_shishi_chorus_chords):
        bass = extract_bass_line(yom_shishi_chorus_chords)
        # E→D# should be chromatic_desc
        assert bass[1].motion_from_previous == "chromatic_desc"
        # F#→F should be chromatic_desc
        assert bass[3].motion_from_previous == "chromatic_desc"


class TestChromaticRuns:
    def test_chorus_chromatic_pairs(self, yom_shishi_chorus_chords):
        """Chorus should have two chromatic pairs: E→D# and F#→F."""
        bass = extract_bass_line(yom_shishi_chorus_chords)
        runs = detect_chromatic_runs(bass, min_length=2)
        # At least 2 chromatic pairs
        assert len(runs) >= 2
        # First pair: E→D# (descending)
        assert runs[0].direction == "descending"
        assert runs[0].notes[0].name == "E"
        assert runs[0].notes[1].name == "D#"

    def test_bridge_chromatic_run(self):
        """Bridge: Bm7b5 → Am/C → A/C# → Dm = bass B→C→C#→D (ascending)."""
        chords = [parse_chord(s) for s in ["Bm7b5", "Am/C", "A/C#", "Dm"]]
        bass = extract_bass_line(chords)
        runs = detect_chromatic_runs(bass, min_length=3)
        assert len(runs) == 1
        assert runs[0].direction == "ascending"
        assert runs[0].length == 4
        assert [n.name for n in runs[0].notes] == ["B", "C", "C#", "D"]

    def test_no_chromatic_run(self):
        """Am → Dm → G → C has no chromatic motion."""
        chords = [parse_chord(s) for s in ["Am", "Dm", "G", "C"]]
        bass = extract_bass_line(chords)
        runs = detect_chromatic_runs(bass, min_length=2)
        assert len(runs) == 0
