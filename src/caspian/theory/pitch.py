"""Pitch class representation and note name utilities.

Uses integer mod 12 pitch classes: C=0, C#=1, D=2, ... B=11.
"""

from __future__ import annotations

NOTE_TO_PITCH: dict[str, int] = {
    "C": 0, "C#": 1, "Db": 1,
    "D": 2, "D#": 3, "Eb": 3,
    "E": 4, "Fb": 4, "E#": 5,
    "F": 5, "F#": 6, "Gb": 6,
    "G": 7, "G#": 8, "Ab": 8,
    "A": 9, "A#": 10, "Bb": 10,
    "B": 11, "Cb": 11, "B#": 0,
}

PITCH_TO_NOTE_SHARP: dict[int, str] = {
    0: "C", 1: "C#", 2: "D", 3: "D#", 4: "E", 5: "F",
    6: "F#", 7: "G", 8: "G#", 9: "A", 10: "A#", 11: "B",
}

PITCH_TO_NOTE_FLAT: dict[int, str] = {
    0: "C", 1: "Db", 2: "D", 3: "Eb", 4: "E", 5: "F",
    6: "Gb", 7: "G", 8: "Ab", 9: "A", 10: "Bb", 11: "B",
}


def parse_note_name(text: str) -> tuple[str, int]:
    """Parse a note name from the start of a string.

    Returns (note_name, pitch_class).
    Raises ValueError if no valid note found.
    """
    # Try two-char match first (e.g. "C#", "Bb")
    if len(text) >= 2 and text[:2] in NOTE_TO_PITCH:
        name = text[:2]
        return name, NOTE_TO_PITCH[name]
    if len(text) >= 1 and text[0] in NOTE_TO_PITCH:
        name = text[0]
        return name, NOTE_TO_PITCH[name]
    raise ValueError(f"No valid note name at start of '{text}'")


def note_name(pitch: int, prefer_sharp: bool = True) -> str:
    """Convert pitch class to note name."""
    pitch = pitch % 12
    if prefer_sharp:
        return PITCH_TO_NOTE_SHARP[pitch]
    return PITCH_TO_NOTE_FLAT[pitch]
