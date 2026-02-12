"""Pattern detection: repeated progressions and pedal points."""

from __future__ import annotations

from caspian.models.analysis import Pattern
from caspian.models.chord import Chord


def detect_patterns(chords: list[Chord]) -> list[Pattern]:
    """Detect higher-level patterns in a chord progression."""
    patterns: list[Pattern] = []
    patterns.extend(detect_repeated_progressions(chords))
    patterns.extend(detect_pedal_points(chords))
    return patterns


def detect_repeated_progressions(chords: list[Chord], min_length: int = 2) -> list[Pattern]:
    """Detect repeated chord sequences."""
    if len(chords) < min_length * 2:
        return []

    patterns: list[Pattern] = []
    roots = [c.root for c in chords]
    qualities = [c.quality for c in chords]

    # Check for repeated subsequences of various lengths
    for length in range(min_length, len(chords) // 2 + 1):
        for start in range(len(chords) - length * 2 + 1):
            seq_roots = roots[start : start + length]
            seq_quals = qualities[start : start + length]

            # Look for the same sequence later
            for check_start in range(start + length, len(chords) - length + 1):
                check_roots = roots[check_start : check_start + length]
                check_quals = qualities[check_start : check_start + length]

                if seq_roots == check_roots and seq_quals == check_quals:
                    symbols = [chords[start + i].symbol for i in range(length)]
                    prog_str = " → ".join(symbols)
                    # Avoid duplicate pattern reports
                    existing = [
                        p for p in patterns
                        if p.detail == f"Repeated: {prog_str}"
                    ]
                    if not existing:
                        patterns.append(Pattern(
                            type="repeated_progression",
                            detail=f"Repeated: {prog_str}",
                            positions=[start, check_start],
                        ))

    return patterns


def detect_pedal_points(chords: list[Chord], min_length: int = 3) -> list[Pattern]:
    """Detect pedal points (same bass note for several chords)."""
    if len(chords) < min_length:
        return []

    patterns: list[Pattern] = []
    run_start = 0
    run_bass = chords[0].bass

    for i in range(1, len(chords)):
        if chords[i].bass == run_bass:
            continue
        else:
            run_length = i - run_start
            if run_length >= min_length:
                from caspian.theory.pitch import note_name
                patterns.append(Pattern(
                    type="pedal_point",
                    detail=f"Pedal on {note_name(run_bass)} (positions {run_start}-{i-1})",
                    positions=list(range(run_start, i)),
                ))
            run_start = i
            run_bass = chords[i].bass

    # Check final run
    run_length = len(chords) - run_start
    if run_length >= min_length:
        from caspian.theory.pitch import note_name
        patterns.append(Pattern(
            type="pedal_point",
            detail=f"Pedal on {note_name(run_bass)} (positions {run_start}-{len(chords)-1})",
            positions=list(range(run_start, len(chords))),
        ))

    return patterns
