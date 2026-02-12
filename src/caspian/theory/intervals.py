"""Interval calculation and naming utilities."""

from __future__ import annotations


def interval_semitones(note1: int, note2: int) -> int:
    """Signed interval using shortest path (max +/-6 semitones).

    Positive = ascending, negative = descending.
    """
    diff = (note2 - note1) % 12
    if diff > 6:
        diff -= 12
    return diff


_INTERVAL_NAMES: dict[int, str] = {
    0: "unison",
    1: "minor 2nd",
    2: "major 2nd",
    3: "minor 3rd",
    4: "major 3rd",
    5: "perfect 4th",
    6: "tritone",
    7: "perfect 5th",
    8: "minor 6th",
    9: "major 6th",
    10: "minor 7th",
    11: "major 7th",
}


def interval_name(semitones: int) -> str:
    """Human-readable interval name for a semitone distance."""
    return _INTERVAL_NAMES.get(abs(semitones) % 12, f"{abs(semitones)} semitones")


def classify_bass_motion(semitones: int) -> str:
    """Classify bass motion between two notes.

    Returns one of: 'static', 'chromatic_asc', 'chromatic_desc',
    'step_asc', 'step_desc', 'leap_asc', 'leap_desc'.
    """
    if semitones == 0:
        return "static"
    direction = "asc" if semitones > 0 else "desc"
    magnitude = abs(semitones)
    if magnitude == 1:
        return f"chromatic_{direction}"
    if magnitude == 2:
        return f"step_{direction}"
    return f"leap_{direction}"
