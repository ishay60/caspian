"""Secondary dominant detection.

A secondary dominant is a major or dominant 7th chord whose root is a perfect 5th
above a diatonic chord's root. It functions as V/x where x is the target degree.
"""

from __future__ import annotations

from caspian.models.chord import Chord, ChordQuality
from caspian.models.key import Key
from caspian.theory.scales import degree_of, is_diatonic
from caspian.theory.pitch import note_name

# Qualities that can function as secondary dominants
_DOMINANT_QUALITIES = frozenset({
    ChordQuality.MAJOR,
    ChordQuality.DOMINANT7,
})


def detect_secondary_dominant(
    chord: Chord,
    next_chord: Chord | None,
    key: Key,
) -> str | None:
    """Detect if a chord is a secondary dominant (V/x).

    Returns a string like "V/v" or "V7/ii" if detected, None otherwise.
    Only considers chords that are NOT diatonic in the primary key.
    """
    if chord.quality not in _DOMINANT_QUALITIES:
        return None

    # If it's diatonic, it's not a *secondary* dominant
    if is_diatonic(chord, key):
        return None

    # The expected resolution target is down a perfect 5th (= up a perfect 4th)
    target_root = (chord.root + 5) % 12  # down a 5th

    target_degree = degree_of(target_root, key)
    if target_degree is None:
        return None

    # Build the V/x label
    seven = "7" if chord.quality == ChordQuality.DOMINANT7 else ""
    target_numeral = _degree_numeral(target_degree, target_root, key)
    return f"V{seven}/{target_numeral}"


def detect_deceptive_secondary(
    chord: Chord,
    next_chord: Chord | None,
    key: Key,
) -> str | None:
    """Detect if a secondary dominant resolves deceptively.

    Returns a description if the chord is a secondary dominant AND the next chord
    is NOT the expected target.
    """
    sec_dom = detect_secondary_dominant(chord, next_chord, key)
    if sec_dom is None or next_chord is None:
        return None

    target_root = (chord.root + 5) % 12
    if next_chord.root != target_root:
        return f"{sec_dom} → deceptive to {next_chord.symbol}"
    return None


def _degree_numeral(degree: int, root_pitch: int, key: Key) -> str:
    """Get a simple Roman numeral for a degree, lowercase if minor in key."""
    from caspian.theory.scales import build_diatonic_triads
    triads = build_diatonic_triads(key)
    _numerals = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII"}
    numeral = _numerals[degree]
    _, quality = triads[degree]
    if quality in (ChordQuality.MINOR, ChordQuality.DIMINISHED):
        numeral = numeral.lower()
    return numeral
