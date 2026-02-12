"""Borrowed chord detection.

A borrowed chord is one that isn't diatonic in the primary key but IS diatonic
in a parallel mode (same root, different scale).
"""

from __future__ import annotations

from caspian.models.chord import Chord
from caspian.models.key import Key, SCALES
from caspian.theory.scales import is_diatonic
from caspian.theory.pitch import note_name

# Friendly display names for modes
_MODE_NAMES: dict[str, str] = {
    "natural_minor": "Natural Minor",
    "harmonic_minor": "Harmonic Minor",
    "melodic_minor": "Melodic Minor",
    "dorian": "Dorian",
    "phrygian": "Phrygian",
    "phrygian_dominant": "Phrygian Dominant",
    "major": "Major",
    "mixolydian": "Mixolydian",
}


def detect_borrowed_chord(chord: Chord, key: Key) -> list[str]:
    """Detect if a chord is borrowed from a parallel mode.

    Returns list of mode names the chord could be borrowed from.
    Empty list if chord is diatonic or not found in any parallel mode.
    """
    if is_diatonic(chord, key):
        return []

    sources: list[str] = []
    for mode_name in SCALES:
        if mode_name == key.mode:
            continue
        parallel_key = Key.from_name(key.root_name, mode_name)
        if is_diatonic(chord, parallel_key):
            sources.append(_MODE_NAMES.get(mode_name, mode_name))

    return sources
