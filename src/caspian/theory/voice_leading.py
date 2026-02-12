"""Voice leading analysis: common tones and voice leading distance."""

from __future__ import annotations


def common_tones(pitches1: frozenset[int], pitches2: frozenset[int]) -> frozenset[int]:
    """Return pitch classes shared between two chords."""
    return pitches1 & pitches2


def voice_leading_distance(pitches1: list[int], pitches2: list[int]) -> int:
    """Total semitones of minimal voice leading motion (greedy matching).

    Uses greedy closest-pair matching. Returns sum of absolute semitone distances.
    """
    if not pitches1 or not pitches2:
        return 0

    # Greedy: for each voice in chord1, find closest unmatched voice in chord2
    remaining = list(pitches2)
    total = 0
    for p1 in pitches1:
        if not remaining:
            break
        # Find closest
        best_idx = 0
        best_dist = _shortest_distance(p1, remaining[0])
        for j in range(1, len(remaining)):
            d = _shortest_distance(p1, remaining[j])
            if d < best_dist:
                best_dist = d
                best_idx = j
        total += best_dist
        remaining.pop(best_idx)
    return total


def _shortest_distance(p1: int, p2: int) -> int:
    """Shortest distance between two pitch classes (mod 12)."""
    diff = abs((p2 - p1) % 12)
    return min(diff, 12 - diff)
