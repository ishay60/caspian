"""Tests for pattern detection."""

import pytest
from caspian.analysis.patterns import detect_repeated_progressions, detect_pedal_points
from caspian.parsing.chord_parser import parse_chord


class TestRepeatedProgressions:
    def test_repeated_pair(self):
        chords = [parse_chord(s) for s in ["Am", "D", "Am", "D"]]
        patterns = detect_repeated_progressions(chords)
        assert len(patterns) >= 1
        assert any("Am → D" in p.detail for p in patterns)

    def test_no_repeat(self):
        chords = [parse_chord(s) for s in ["Am", "Dm", "E", "F"]]
        patterns = detect_repeated_progressions(chords)
        assert len(patterns) == 0


class TestPedalPoints:
    def test_pedal_on_e(self):
        """Am/E → D#dim (has bass D#) — no pedal. But Am/E Am/E Am/E → pedal on E."""
        chords = [parse_chord(s) for s in ["Am/E", "Am/E", "Am/E", "Dm"]]
        patterns = detect_pedal_points(chords)
        assert len(patterns) == 1
        assert "E" in patterns[0].detail

    def test_no_pedal(self):
        chords = [parse_chord(s) for s in ["Am", "Dm", "E", "F"]]
        patterns = detect_pedal_points(chords)
        assert len(patterns) == 0
