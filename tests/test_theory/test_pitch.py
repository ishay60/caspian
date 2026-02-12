"""Tests for pitch class utilities."""

import pytest
from caspian.theory.pitch import parse_note_name, note_name, NOTE_TO_PITCH


@pytest.mark.parametrize("text,expected_name,expected_pitch", [
    ("C", "C", 0),
    ("C#", "C#", 1),
    ("Db", "Db", 1),
    ("D", "D", 2),
    ("D#", "D#", 3),
    ("Eb", "Eb", 3),
    ("E", "E", 4),
    ("F", "F", 5),
    ("F#", "F#", 6),
    ("Gb", "Gb", 6),
    ("G", "G", 7),
    ("G#", "G#", 8),
    ("Ab", "Ab", 8),
    ("A", "A", 9),
    ("A#", "A#", 10),
    ("Bb", "Bb", 10),
    ("B", "B", 11),
])
def test_parse_note_name(text, expected_name, expected_pitch):
    name, pitch = parse_note_name(text)
    assert name == expected_name
    assert pitch == expected_pitch


def test_parse_note_name_with_suffix():
    name, pitch = parse_note_name("C#dim")
    assert name == "C#"
    assert pitch == 1


def test_parse_note_name_invalid():
    with pytest.raises(ValueError):
        parse_note_name("X")


@pytest.mark.parametrize("pitch,sharp,expected", [
    (0, True, "C"),
    (1, True, "C#"),
    (1, False, "Db"),
    (6, True, "F#"),
    (6, False, "Gb"),
    (9, True, "A"),
])
def test_note_name(pitch, sharp, expected):
    assert note_name(pitch, prefer_sharp=sharp) == expected
