"""Scale library, diatonic chord builder, and membership tests.

Supports 8 scale types from the spec: natural minor, harmonic minor,
melodic minor, dorian, phrygian, phrygian dominant, major, mixolydian.
"""

from __future__ import annotations

from caspian.models.chord import Chord, ChordQuality, QUALITY_INTERVALS
from caspian.models.key import Key, SCALES
from caspian.theory.pitch import note_name


def build_scale(root: int, mode: str) -> list[int]:
    """Build absolute pitch classes for a scale.

    Returns list of 7 pitch classes.
    """
    intervals = SCALES[mode]
    return [(root + i) % 12 for i in intervals]


def _triad_quality(intervals: tuple[int, int]) -> ChordQuality:
    """Determine triad quality from (third_interval, fifth_interval) above root."""
    third, fifth = intervals
    if third == 4 and fifth == 7:
        return ChordQuality.MAJOR
    if third == 3 and fifth == 7:
        return ChordQuality.MINOR
    if third == 3 and fifth == 6:
        return ChordQuality.DIMINISHED
    if third == 4 and fifth == 8:
        return ChordQuality.AUGMENTED
    return ChordQuality.MAJOR  # fallback


def build_diatonic_triads(key: Key) -> dict[int, tuple[int, ChordQuality]]:
    """Build diatonic triads for each degree of a key.

    Returns {degree (1-7): (root_pitch, quality)}.
    """
    pitches = list(key.scale_pitches)
    result: dict[int, tuple[int, ChordQuality]] = {}
    for i in range(7):
        root = pitches[i]
        third = pitches[(i + 2) % 7]
        fifth = pitches[(i + 4) % 7]
        third_interval = (third - root) % 12
        fifth_interval = (fifth - root) % 12
        quality = _triad_quality((third_interval, fifth_interval))
        result[i + 1] = (root, quality)
    return result


def is_diatonic(chord: Chord, key: Key) -> bool:
    """Check if a chord is diatonic in the given key.

    A chord is diatonic if its root is a scale degree AND its quality matches
    the diatonic triad built on that degree.
    """
    if chord.root not in key.scale_pitches:
        return False
    diatonic = build_diatonic_triads(key)
    for _degree, (root, quality) in diatonic.items():
        if root == chord.root and quality == chord.quality:
            return True
        # Allow dominant7 to match major degree (e.g. E7 is "diatonic" as V7 in harmonic minor)
        if root == chord.root and quality == ChordQuality.MAJOR and chord.quality == ChordQuality.DOMINANT7:
            return True
        # Allow minor7 to match minor degree
        if root == chord.root and quality == ChordQuality.MINOR and chord.quality == ChordQuality.MINOR7:
            return True
        # Allow half-diminished to match diminished degree
        if root == chord.root and quality == ChordQuality.DIMINISHED and chord.quality == ChordQuality.HALF_DIMINISHED:
            return True
    return False


def degree_of(chord_root: int, key: Key) -> int | None:
    """Return the scale degree (1-7) of a pitch in a key, or None if not in scale."""
    for i, pitch in enumerate(key.scale_pitches):
        if pitch == chord_root:
            return i + 1
    return None
