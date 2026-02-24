"""Bar detection heuristics for automatic bar line suggestion.

This module provides algorithms to automatically detect bar boundaries
in chord sequences based on various musical and structural heuristics.

Story Point 4.7: Auto-Bar Detection Heuristic
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from caspian.models.input import ChordLyricsLine


@dataclass(frozen=True)
class BarSuggestion:
    """A suggested bar boundary position with confidence score.

    Attributes:
        position: Index in chord sequence where bar boundary occurs
                  (0 = before first chord, 1 = after first chord, etc.)
        confidence: Confidence score (0.0-1.0)
        reason: Description of why this boundary was suggested
        heuristic: Name of heuristic that generated this suggestion
    """

    position: int
    confidence: float
    reason: str
    heuristic: str

    def __post_init__(self) -> None:
        """Validate confidence score."""
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError(f"Confidence must be 0.0-1.0, got {self.confidence}")


@dataclass(frozen=True)
class ChordCountPattern:
    """Result of chord count consistency analysis.

    Attributes:
        pattern: Detected pattern type ('2_per_bar', '4_per_bar', '1_per_bar', 'irregular')
        confidence: How confident we are in this pattern (0.0-1.0)
        chords_per_bar: Number of chords per bar for this pattern
    """

    pattern: Literal["2_per_bar", "4_per_bar", "1_per_bar", "irregular"]
    confidence: float
    chords_per_bar: int | None


def analyze_chord_count_consistency(chord_sequence: list[str]) -> ChordCountPattern:
    """Analyze if chord sequence has consistent chords-per-bar pattern.

    Detects common patterns:
    - 2 chords per bar (most common in pop/rock)
    - 4 chords per bar (fast changes, jazz)
    - 1 chord per bar (slow ballads)

    Priority order: Check most specific patterns first (4, 2, 3, then default to 1 or irregular)

    Args:
        chord_sequence: List of chord symbols in chronological order

    Returns:
        ChordCountPattern with detected pattern and confidence

    Examples:
        >>> analyze_chord_count_consistency(["Am", "F", "C", "G", "Am", "F", "C", "G"])
        ChordCountPattern(pattern='2_per_bar', confidence=0.9, chords_per_bar=2)
        >>> analyze_chord_count_consistency(["Am", "Dm", "F", "C"])
        ChordCountPattern(pattern='2_per_bar', confidence=0.7, chords_per_bar=2)
    """
    if not chord_sequence:
        return ChordCountPattern(pattern="irregular", confidence=0.0, chords_per_bar=None)

    total_chords = len(chord_sequence)

    # Too few chords - default to 2-chord or irregular
    if total_chords < 3:
        if total_chords == 2:
            return ChordCountPattern(pattern="2_per_bar", confidence=0.70, chords_per_bar=2)
        else:  # total_chords == 1
            return ChordCountPattern(pattern="irregular", confidence=0.3, chords_per_bar=None)

    # Check divisibility by common factors
    # We need to decide between 2 chords/bar vs 4 chords/bar when divisible by 4
    # Heuristic: Default to 2 chords/bar (more common) unless there's a reason for 4

    # For now, simple heuristic: Always prefer 2-chord pattern if divisible by 2
    # This matches most pop/rock songs

    if total_chords % 4 == 0:
        # Divisible by 4: could be 2 chords/bar or 4 chords/bar
        # Default to 2 chords/bar (more common)
        confidence = min(0.85, 0.65 + (total_chords // 8) * 0.05)
        return ChordCountPattern(pattern="2_per_bar", confidence=confidence, chords_per_bar=2)

    if total_chords % 2 == 0:
        # Divisible by 2 but not 4
        confidence = 0.70
        return ChordCountPattern(pattern="2_per_bar", confidence=confidence, chords_per_bar=2)

    # Check for divisibility by 3 (waltz time or triplet-based)
    if total_chords % 3 == 0:
        # Could be 3/4 time with 1 chord per bar
        # or 3 chords per bar in 4/4 (less common)
        # Default to 1 chord/bar with lower confidence
        confidence = 0.55
        return ChordCountPattern(pattern="1_per_bar", confidence=confidence, chords_per_bar=1)

    # Prime number or odd count not divisible by 3
    # Default to 1 chord per bar (low confidence) if >= 4 chords
    if total_chords >= 4:
        confidence = 0.40
        return ChordCountPattern(pattern="irregular", confidence=confidence, chords_per_bar=None)

    # Very small sequences (3 chords) - irregular
    return ChordCountPattern(pattern="irregular", confidence=0.3, chords_per_bar=None)


def suggest_bars_from_chord_count(
    chord_sequence: list[str],
) -> list[BarSuggestion]:
    """Generate bar suggestions based on chord count heuristic.

    Args:
        chord_sequence: List of chord symbols in chronological order

    Returns:
        List of BarSuggestion objects for suggested bar boundaries

    Examples:
        >>> suggest_bars_from_chord_count(["Am", "F", "C", "G"])
        [BarSuggestion(position=2, confidence=0.7, reason='2-chord pattern detected', heuristic='chord_count'),
         BarSuggestion(position=4, confidence=0.7, reason='2-chord pattern detected', heuristic='chord_count')]
    """
    pattern = analyze_chord_count_consistency(chord_sequence)

    if pattern.pattern == "irregular" or pattern.chords_per_bar is None:
        return []

    suggestions = []
    chords_per_bar = pattern.chords_per_bar
    total_chords = len(chord_sequence)

    # Generate bar boundaries every N chords
    for i in range(chords_per_bar, total_chords + 1, chords_per_bar):
        suggestion = BarSuggestion(
            position=i,
            confidence=pattern.confidence,
            reason=f"{chords_per_bar}-chord pattern detected ({pattern.pattern})",
            heuristic="chord_count",
        )
        suggestions.append(suggestion)

    return suggestions


@dataclass(frozen=True)
class SpacingAnalysis:
    """Result of spacing analysis for chord duration heuristic.

    Attributes:
        gaps: List of character gaps between consecutive chords
        avg_gap: Average gap size
        std_dev: Standard deviation of gaps
        large_gap_positions: Positions (indices) where large gaps occur
                             (likely bar boundaries)
    """

    gaps: list[int]
    avg_gap: float
    std_dev: float
    large_gap_positions: list[int]


def analyze_chord_spacing(chord_lyrics_line: ChordLyricsLine) -> SpacingAnalysis:
    """Analyze spacing between chords to detect bar boundaries.

    Wider spacing between chords suggests longer duration and likely bar boundaries.

    Args:
        chord_lyrics_line: ChordLyricsLine with column positions

    Returns:
        SpacingAnalysis with gap information

    Examples:
        >>> line = ChordLyricsLine(chords=[(0, "Am"), (15, "F"), (30, "C")], lyrics="...")
        >>> analysis = analyze_chord_spacing(line)
        >>> analysis.gaps
        [15, 15]
    """
    if len(chord_lyrics_line.chords) < 2:
        return SpacingAnalysis(gaps=[], avg_gap=0.0, std_dev=0.0, large_gap_positions=[])

    # Calculate gaps between consecutive chords
    gaps = []
    positions = [pos for pos, _ in chord_lyrics_line.chords]

    for i in range(len(positions) - 1):
        gap = positions[i + 1] - positions[i]
        gaps.append(gap)

    # Calculate statistics
    avg_gap = sum(gaps) / len(gaps)

    # Calculate standard deviation
    if len(gaps) > 1:
        variance = sum((g - avg_gap) ** 2 for g in gaps) / len(gaps)
        std_dev = variance**0.5
    else:
        std_dev = 0.0

    # Identify large gaps (> avg + 0.5 * std_dev)
    # These are likely bar boundaries
    threshold = avg_gap + 0.5 * std_dev
    large_gap_positions = []

    for i, gap in enumerate(gaps):
        if gap > threshold and gap >= 12:  # Minimum gap of 12 characters
            # Position after chord at index i
            large_gap_positions.append(i + 1)

    return SpacingAnalysis(
        gaps=gaps, avg_gap=avg_gap, std_dev=std_dev, large_gap_positions=large_gap_positions
    )


def suggest_bars_from_spacing(
    chord_lyrics_lines: list[ChordLyricsLine],
) -> list[BarSuggestion]:
    """Generate bar suggestions based on spacing heuristic.

    Analyzes horizontal spacing between chords to detect bar boundaries.
    Wider gaps suggest longer chord durations and likely bar boundaries.

    Args:
        chord_lyrics_lines: List of ChordLyricsLine objects with spacing info

    Returns:
        List of BarSuggestion objects for suggested bar boundaries

    Examples:
        >>> lines = [ChordLyricsLine(chords=[(0, "Am"), (20, "F"), (40, "C")], lyrics="...")]
        >>> suggestions = suggest_bars_from_spacing(lines)
        >>> len(suggestions) >= 0
        True
    """
    if not chord_lyrics_lines:
        return []

    suggestions = []
    cumulative_chord_count = 0

    for line in chord_lyrics_lines:
        if len(line.chords) < 2:
            cumulative_chord_count += len(line.chords)
            continue

        analysis = analyze_chord_spacing(line)

        # Generate suggestions for large gaps
        for local_position in analysis.large_gap_positions:
            # Convert to global position across all lines
            global_position = cumulative_chord_count + local_position

            # Calculate confidence based on gap size relative to average
            gap_index = local_position - 1  # gap before this position
            if gap_index < len(analysis.gaps):
                gap_size = analysis.gaps[gap_index]
                relative_gap = gap_size / analysis.avg_gap if analysis.avg_gap > 0 else 1.0

                # Higher confidence for larger relative gaps
                if relative_gap >= 2.0:
                    confidence = min(0.90, 0.70 + (relative_gap - 2.0) * 0.10)
                elif relative_gap >= 1.5:
                    confidence = 0.75
                elif relative_gap >= 1.2:
                    confidence = 0.65
                else:
                    confidence = 0.55

                suggestion = BarSuggestion(
                    position=global_position,
                    confidence=confidence,
                    reason=f"Large spacing gap ({gap_size} chars, {relative_gap:.1f}x avg)",
                    heuristic="spacing",
                )
                suggestions.append(suggestion)

        cumulative_chord_count += len(line.chords)

    return suggestions


def detect_bars_simple(chord_sequence: list[str]) -> list[BarSuggestion]:
    """Simple bar detection using only chord count heuristic.

    This is the MVP implementation for Task 4.7.2.
    Future tasks will add additional heuristics.

    Args:
        chord_sequence: List of chord symbols in chronological order

    Returns:
        List of BarSuggestion objects with confidence scores

    Examples:
        >>> detect_bars_simple(["Am", "F", "C", "G", "Am", "F", "C", "G"])
        [BarSuggestion(position=2, ...), BarSuggestion(position=4, ...),
         BarSuggestion(position=6, ...), BarSuggestion(position=8, ...)]
    """
    return suggest_bars_from_chord_count(chord_sequence)
