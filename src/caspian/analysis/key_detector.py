"""Key detection from chord progressions.

Uses user-provided key as override, with auto-detect as fallback.
Auto-detect heuristics:
1. First and last chord
2. Chord frequency
3. Cadence detection (V→I)
4. Scale coverage
"""

from __future__ import annotations

from collections import Counter

from caspian.models.chord import Chord, ChordQuality
from caspian.models.key import Key, SCALES
from caspian.theory.scales import is_diatonic, build_diatonic_triads
from caspian.theory.pitch import NOTE_TO_PITCH, note_name


def detect_key(
    chords: list[Chord],
    user_key: str | None = None,
    user_mode: str | None = None,
) -> Key:
    """Detect or validate the key of a chord progression.

    If user_key is provided, use it as the override.
    Otherwise, auto-detect from the chords.
    """
    if user_key:
        root_name = user_key.rstrip("m")  # Handle "Am" → "A"
        mode = user_mode or _guess_mode_from_key_string(user_key)
        return Key.from_name(root_name, mode)

    return _auto_detect_key(chords)


def _guess_mode_from_key_string(key_str: str) -> str:
    """Guess mode from a key string like 'Am', 'C', 'Dm'."""
    key_str = key_str.strip()
    if key_str.endswith("m") and not key_str.endswith("#m"):
        return "natural_minor"
    if len(key_str) >= 2 and key_str[-1] == "m" and key_str[-2] != "#" and key_str[-2] != "b":
        return "natural_minor"
    return "major"


def _preferred_name(pitch: int, chords: list[Chord]) -> str:
    """Pick the enharmonic spelling most used in the input chords for a pitch class.

    For example, if input has Bbm, Ebm, Db — pitch 10 appears as "Bb" not "A#".
    Falls back to sharp spelling if no input chords use that root.
    """
    pitch = pitch % 12
    counts: Counter[str] = Counter()
    for c in chords:
        if c.root % 12 == pitch:
            counts[c.root_name] += 1
    if counts:
        return counts.most_common(1)[0][0]
    return note_name(pitch)


def _auto_detect_key(chords: list[Chord]) -> Key:
    """Auto-detect key using multiple heuristics.

    Uses (pitch_class, mode) tuples internally to avoid vote-splitting
    between enharmonic spellings (e.g. Bb vs A#).
    """
    if not chords:
        return Key.from_name("C", "major")

    candidates: Counter[tuple[int, str]] = Counter()

    # Heuristic 1: First and last chord (weight: 3)
    first = chords[0]
    last = chords[-1]
    for chord in (first, last):
        mode = "minor" if chord.quality in (
            ChordQuality.MINOR, ChordQuality.MINOR7
        ) else "major"
        mode_key = "natural_minor" if mode == "minor" else "major"
        candidates[(chord.root % 12, mode_key)] += 3

    # Heuristic 2: Most common root (weight: 2)
    root_counts = Counter(c.root % 12 for c in chords)
    most_common_root_pitch, _ = root_counts.most_common(1)[0]
    # Check if most common appears as minor or major
    minor_count = sum(1 for c in chords if c.root % 12 == most_common_root_pitch
                      and c.quality in (ChordQuality.MINOR, ChordQuality.MINOR7))
    major_count = sum(1 for c in chords if c.root % 12 == most_common_root_pitch
                      and c.quality in (ChordQuality.MAJOR, ChordQuality.DOMINANT7, ChordQuality.MAJOR7))
    mode_key = "natural_minor" if minor_count >= major_count else "major"
    candidates[(most_common_root_pitch, mode_key)] += 2

    # Heuristic 3: V→I cadence detection (weight: 5)
    for i in range(len(chords) - 1):
        if chords[i].quality in (ChordQuality.MAJOR, ChordQuality.DOMINANT7):
            expected_tonic = (chords[i].root + 5) % 12  # down a 5th
            if chords[i + 1].root == expected_tonic:
                tonic_pitch = chords[i + 1].root % 12
                mode = "natural_minor" if chords[i + 1].quality in (
                    ChordQuality.MINOR, ChordQuality.MINOR7
                ) else "major"
                candidates[(tonic_pitch, mode)] += 5

    # Heuristic 4: Scale coverage (weight: 1 per diatonic chord)
    for root_pitch in range(12):
        rname = note_name(root_pitch)
        for mode_name in ("natural_minor", "major"):
            try:
                test_key = Key.from_name(rname, mode_name)
            except ValueError:
                continue
            coverage = sum(1 for c in chords if is_diatonic(c, test_key))
            candidates[(root_pitch, mode_name)] += coverage

    if not candidates:
        return Key.from_name("C", "major")

    best_pitch, best_mode = candidates.most_common(1)[0][0]
    best_name = _preferred_name(best_pitch, chords)
    return Key.from_name(best_name, best_mode)
