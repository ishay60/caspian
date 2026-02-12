"""Shared fixtures for tests."""

import pytest
from caspian.models.key import Key
from caspian.parsing.chord_parser import parse_chord


@pytest.fixture
def key_am():
    """A natural minor key."""
    return Key.from_name("A", "natural_minor")


@pytest.fixture
def key_am_harmonic():
    """A harmonic minor key."""
    return Key.from_name("A", "harmonic_minor")


@pytest.fixture
def key_c_major():
    """C major key."""
    return Key.from_name("C", "major")


@pytest.fixture
def yom_shishi_chorus_chords():
    """Ground truth chorus chords for יום שישי חזר in chronological order."""
    symbols = ["Am/E", "D#dim", "F#dim", "F", "D", "Am", "E", "Dm"]
    return [parse_chord(s) for s in symbols]
