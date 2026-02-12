"""Tests for chord parser — Sprint 1 core tests."""

import pytest
from caspian.parsing.chord_parser import parse_chord
from caspian.models.chord import ChordQuality


@pytest.mark.parametrize("symbol,root_name,root_pitch,quality,bass_name,bass_pitch", [
    ("Am", "A", 9, ChordQuality.MINOR, "A", 9),
    ("Am/E", "A", 9, ChordQuality.MINOR, "E", 4),
    ("D#dim", "D#", 3, ChordQuality.DIMINISHED, "D#", 3),
    ("Bm7b5", "B", 11, ChordQuality.HALF_DIMINISHED, "B", 11),
    ("Fmaj7", "F", 5, ChordQuality.MAJOR7, "F", 5),
    ("A/C#", "A", 9, ChordQuality.MAJOR, "C#", 1),
    ("E7", "E", 4, ChordQuality.DOMINANT7, "E", 4),
    ("Gsus4", "G", 7, ChordQuality.SUSPENDED4, "G", 7),
    ("C", "C", 0, ChordQuality.MAJOR, "C", 0),
    ("Dm", "D", 2, ChordQuality.MINOR, "D", 2),
    ("F", "F", 5, ChordQuality.MAJOR, "F", 5),
    ("B", "B", 11, ChordQuality.MAJOR, "B", 11),
    ("Em", "E", 4, ChordQuality.MINOR, "E", 4),
    ("F#dim", "F#", 6, ChordQuality.DIMINISHED, "F#", 6),
    ("Am/C", "A", 9, ChordQuality.MINOR, "C", 0),
    ("Cm7", "C", 0, ChordQuality.MINOR7, "C", 0),
    ("G7", "G", 7, ChordQuality.DOMINANT7, "G", 7),
    ("A7", "A", 9, ChordQuality.DOMINANT7, "A", 9),
    ("Eaug", "E", 4, ChordQuality.AUGMENTED, "E", 4),
    ("C+", "C", 0, ChordQuality.AUGMENTED, "C", 0),
    ("A6", "A", 9, ChordQuality.MAJOR6, "A", 9),
    ("Bbm", "Bb", 10, ChordQuality.MINOR, "Bb", 10),
    ("Ebdim", "Eb", 3, ChordQuality.DIMINISHED, "Eb", 3),
    ("GM7", "G", 7, ChordQuality.MAJOR7, "G", 7),
    ("Gsus2", "G", 7, ChordQuality.SUSPENDED2, "G", 7),
])
def test_parse_chord(symbol, root_name, root_pitch, quality, bass_name, bass_pitch):
    chord = parse_chord(symbol)
    assert chord.root_name == root_name
    assert chord.root == root_pitch
    assert chord.quality == quality
    assert chord.bass_name == bass_name
    assert chord.bass == bass_pitch


def test_tab4u_sus7_normalization():
    """tab4u writes Bsus7 meaning B7sus4."""
    chord = parse_chord("Bsus7")
    assert chord.quality == ChordQuality.DOMINANT7SUS4
    assert chord.root_name == "B"
    assert chord.root == 11


def test_chord_pitches_am():
    chord = parse_chord("Am")
    # A=9, C=0, E=4 → sorted: (0, 4, 9)
    assert set(chord.pitches) == {9, 0, 4}


def test_chord_pitches_d_sharp_dim():
    chord = parse_chord("D#dim")
    # D#=3, F#=6, A=9 → sorted: (3, 6, 9)
    assert set(chord.pitches) == {3, 6, 9}


def test_chord_is_inverted():
    assert parse_chord("Am/E").is_inverted is True
    assert parse_chord("Am").is_inverted is False


def test_chord_symbol_preserved():
    chord = parse_chord("Am/E")
    assert chord.symbol == "Am/E"


def test_empty_chord_raises():
    with pytest.raises(ValueError):
        parse_chord("")


def test_invalid_chord_raises():
    with pytest.raises(ValueError):
        parse_chord("XYZ")
