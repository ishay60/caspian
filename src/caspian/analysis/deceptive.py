"""Deceptive resolution detection.

A deceptive resolution occurs when a dominant-function chord (V, V7, secondary dominant,
or any chord with dominant 7th quality) resolves to something other than its expected target.

Only flag chords that actually FUNCTION as dominants, not just any major chord.
"""

from __future__ import annotations

from caspian.models.chord import Chord, ChordQuality
from caspian.models.key import Key
from caspian.theory.pitch import note_name
from caspian.theory.scales import degree_of

_DOMINANT_QUALITIES = frozenset({
    ChordQuality.MAJOR,
    ChordQuality.DOMINANT7,
})


def detect_deceptive_resolution(
    chord: Chord,
    next_chord: Chord | None,
    key: Key,
) -> str | None:
    """Detect deceptive resolution.

    Only checks chords that function as dominants:
    - V or V7 of the key
    - Secondary dominants (major/dom7 whose root is a 5th above a diatonic chord)
    - Chords with dominant 7th quality

    Returns a description string or None.
    """
    if next_chord is None:
        return None

    if chord.quality not in _DOMINANT_QUALITIES:
        return None

    # Check if this chord functions as a dominant
    if not _is_dominant_function(chord, key):
        return None

    # Expected resolution target: down a perfect 5th
    expected_target = (chord.root + 5) % 12

    if next_chord.root == expected_target:
        return None  # Normal resolution

    expected_name = note_name(expected_target)
    return (
        f"Deceptive: {chord.symbol} expected → {expected_name}, "
        f"got → {next_chord.symbol}"
    )


def _is_dominant_function(chord: Chord, key: Key) -> bool:
    """Check if a chord has dominant function in the key."""
    # Dominant 7th quality always has dominant function
    if chord.quality == ChordQuality.DOMINANT7:
        return True

    # V of the key (root is a perfect 5th above key root)
    v_root = (key.root + 7) % 12  # 5th above key root
    if chord.root == v_root and chord.quality == ChordQuality.MAJOR:
        return True

    # Secondary dominant: major chord whose root is 5th above some diatonic root
    target_root = (chord.root + 5) % 12
    if degree_of(target_root, key) is not None and chord.quality == ChordQuality.MAJOR:
        return True

    return False
