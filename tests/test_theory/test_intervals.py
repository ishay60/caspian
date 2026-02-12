"""Tests for interval calculations."""

import pytest
from caspian.theory.intervals import interval_semitones, interval_name, classify_bass_motion


class TestIntervalSemitones:
    @pytest.mark.parametrize("note1,note2,expected", [
        (4, 3, -1),    # E → D# = descending half step
        (6, 5, -1),    # F# → F = descending half step
        (9, 4, -5),    # A → E = descending 5th (shortest path)
        (4, 9, 5),     # E → A = ascending 5th
        (0, 0, 0),     # C → C = unison
        (11, 0, 1),    # B → C = ascending half step
        (0, 11, -1),   # C → B = descending half step
        (0, 6, 6),     # C → F# = tritone (ambiguous, returns +6)
    ])
    def test_interval(self, note1, note2, expected):
        assert interval_semitones(note1, note2) == expected


class TestIntervalName:
    @pytest.mark.parametrize("semitones,expected", [
        (0, "unison"),
        (1, "minor 2nd"),
        (-1, "minor 2nd"),
        (5, "perfect 4th"),
        (7, "perfect 5th"),
        (6, "tritone"),
    ])
    def test_name(self, semitones, expected):
        assert interval_name(semitones) == expected


class TestClassifyBassMotion:
    @pytest.mark.parametrize("semitones,expected", [
        (0, "static"),
        (1, "chromatic_asc"),
        (-1, "chromatic_desc"),
        (2, "step_asc"),
        (-2, "step_desc"),
        (5, "leap_asc"),
        (-5, "leap_desc"),
    ])
    def test_classify(self, semitones, expected):
        assert classify_bass_motion(semitones) == expected
