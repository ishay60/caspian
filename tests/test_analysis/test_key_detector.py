"""Tests for key detection."""

import pytest
from caspian.analysis.key_detector import detect_key
from caspian.parsing.chord_parser import parse_chord


class TestUserProvidedKey:
    def test_am_key(self):
        chords = [parse_chord("Am"), parse_chord("Dm")]
        key = detect_key(chords, user_key="Am")
        assert key.root_name == "A"
        assert key.mode == "natural_minor"

    def test_c_major_key(self):
        chords = [parse_chord("C"), parse_chord("G")]
        key = detect_key(chords, user_key="C")
        assert key.root_name == "C"
        assert key.mode == "major"

    def test_user_mode_override(self):
        chords = [parse_chord("Am")]
        key = detect_key(chords, user_key="Am", user_mode="harmonic_minor")
        assert key.mode == "harmonic_minor"


class TestAutoDetect:
    def test_simple_am_progression(self):
        chords = [parse_chord(s) for s in ["Am", "Dm", "E", "Am"]]
        key = detect_key(chords)
        assert key.root_name == "A"
        assert "minor" in key.mode

    def test_simple_c_major_progression(self):
        chords = [parse_chord(s) for s in ["C", "F", "G", "C"]]
        key = detect_key(chords)
        assert key.root_name == "C"
        assert key.mode == "major"
