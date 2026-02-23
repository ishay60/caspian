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


def note_name_in_key(pitch: int, scale_pitches: tuple[int, ...], mode: str) -> str:
    """Convert pitch class to note name using key-appropriate spelling.

    In natural/harmonic minor, scale degrees 6 and 7 (b6, b7) are spelled with
    flats (e.g. Bb not A# in D minor) so they don't clash with scale degree 5 (A).
    """
    pitch = pitch % 12
    if pitch not in scale_pitches:
        return note_name(pitch, prefer_sharp=True)
    idx = scale_pitches.index(pitch)
    # b6 and b7 in natural/harmonic minor → flat spelling (Bb, C in C minor; Bb, Eb in D minor's relative etc.)
    if mode in ("natural_minor", "harmonic_minor") and idx >= 5:
        return note_name(pitch, prefer_sharp=False)
    return note_name(pitch, prefer_sharp=True)
