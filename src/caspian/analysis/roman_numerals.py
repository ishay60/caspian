"""Roman numeral assignment for chords in a key."""

from __future__ import annotations

from caspian.models.chord import Chord, ChordQuality
from caspian.models.key import Key
from caspian.theory.intervals import interval_semitones
from caspian.theory.pitch import note_name

_DEGREE_NUMERALS = {
    1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII",
}

# Accidentals for roots that aren't scale degrees
_ACCIDENTALS = {
    -1: "b", 1: "#",
}


def assign_roman_numeral(chord: Chord, key: Key) -> str:
    """Assign a Roman numeral to a chord in the given key.

    Returns strings like "i", "V", "bVI", "#iv°", "V7", etc.
    """
    # Find the interval from key root to chord root
    interval = (chord.root - key.root) % 12

    # Try to find the scale degree
    degree = None
    accidental = ""
    for i, pitch in enumerate(key.scale_pitches):
        if pitch == chord.root:
            degree = i + 1
            break

    if degree is None:
        # Not a scale degree — find closest and add accidental
        for i, pitch in enumerate(key.scale_pitches):
            diff = (chord.root - pitch) % 12
            if diff == 1:  # one semitone above a scale degree
                degree = i + 1
                accidental = "#"
                break
            if diff == 11:  # one semitone below a scale degree
                degree = i + 1
                accidental = "b"
                break

    if degree is None:
        # Fallback: use interval-based naming
        return _fallback_numeral(chord, interval)

    numeral = _DEGREE_NUMERALS[degree]

    # Case: lowercase for minor/diminished, uppercase for major/dominant/augmented
    if chord.quality in (
        ChordQuality.MINOR, ChordQuality.MINOR7, ChordQuality.MINOR6,
        ChordQuality.DIMINISHED, ChordQuality.HALF_DIMINISHED, ChordQuality.DIMINISHED7,
    ):
        numeral = numeral.lower()

    # Quality suffixes
    suffix = ""
    if chord.quality == ChordQuality.DIMINISHED:
        suffix = "°"
    elif chord.quality == ChordQuality.HALF_DIMINISHED:
        suffix = "ø7"
    elif chord.quality == ChordQuality.DIMINISHED7:
        suffix = "°7"
    elif chord.quality == ChordQuality.AUGMENTED:
        suffix = "+"
    elif chord.quality == ChordQuality.DOMINANT7:
        suffix = "7"
    elif chord.quality == ChordQuality.MINOR7:
        suffix = "7"
    elif chord.quality == ChordQuality.MAJOR7:
        suffix = "maj7"
    elif chord.quality == ChordQuality.DOMINANT7SUS4:
        suffix = "7sus4"
    elif chord.quality == ChordQuality.MAJOR6:
        suffix = "6"
    elif chord.quality == ChordQuality.MINOR6:
        suffix = "6"

    return accidental + numeral + suffix


def _fallback_numeral(chord: Chord, interval: int) -> str:
    """Generate a roman numeral when chord root isn't near any scale degree."""
    # Simple fallback based on semitone interval
    numeral = f"[{interval}]"
    if chord.quality in (ChordQuality.MINOR, ChordQuality.MINOR7):
        return numeral.lower()
    return numeral
