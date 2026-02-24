"""Tests for bar detection heuristics."""

import pytest

from caspian.analysis.bar_detection import (
    BarSuggestion,
    ChordCountPattern,
    SpacingAnalysis,
    analyze_chord_count_consistency,
    analyze_chord_spacing,
    detect_bars_simple,
    suggest_bars_from_chord_count,
    suggest_bars_from_spacing,
)
from caspian.models.input import ChordLyricsLine


class TestBarSuggestion:
    """Tests for BarSuggestion dataclass."""

    def test_valid_suggestion(self):
        """Test creating a valid bar suggestion."""
        suggestion = BarSuggestion(
            position=2,
            confidence=0.8,
            reason="2-chord pattern detected",
            heuristic="chord_count",
        )
        assert suggestion.position == 2
        assert suggestion.confidence == 0.8
        assert suggestion.reason == "2-chord pattern detected"
        assert suggestion.heuristic == "chord_count"

    def test_confidence_validation(self):
        """Test that confidence must be between 0.0 and 1.0."""
        with pytest.raises(ValueError, match="Confidence must be 0.0-1.0"):
            BarSuggestion(
                position=2,
                confidence=1.5,
                reason="Invalid",
                heuristic="test",
            )

        with pytest.raises(ValueError, match="Confidence must be 0.0-1.0"):
            BarSuggestion(
                position=2,
                confidence=-0.1,
                reason="Invalid",
                heuristic="test",
            )


class TestChordCountConsistency:
    """Tests for analyze_chord_count_consistency function."""

    def test_empty_sequence(self):
        """Test empty chord sequence."""
        pattern = analyze_chord_count_consistency([])
        assert pattern.pattern == "irregular"
        assert pattern.confidence == 0.0
        assert pattern.chords_per_bar is None

    def test_2_chord_pattern_simple(self):
        """Test simple 2-chord pattern (4 chords total)."""
        chords = ["Am", "F", "C", "G"]
        pattern = analyze_chord_count_consistency(chords)
        assert pattern.pattern == "2_per_bar"
        assert pattern.chords_per_bar == 2
        assert pattern.confidence >= 0.65  # Divisible by 4

    def test_2_chord_pattern_long(self):
        """Test longer 2-chord pattern (8 chords total)."""
        chords = ["Am", "F", "C", "G", "Am", "F", "C", "G"]
        pattern = analyze_chord_count_consistency(chords)
        assert pattern.pattern == "2_per_bar"
        assert pattern.chords_per_bar == 2
        assert pattern.confidence >= 0.70  # More chords = higher confidence

    def test_2_chord_pattern_odd_bars(self):
        """Test 2-chord pattern with odd number of bars (6 chords)."""
        chords = ["Am", "F", "C", "G", "Dm", "E"]
        pattern = analyze_chord_count_consistency(chords)
        assert pattern.pattern == "2_per_bar"
        assert pattern.chords_per_bar == 2
        assert pattern.confidence == 0.70  # Not divisible by 4

    def test_4_chord_pattern(self):
        """Test 4-chord per bar pattern.

        NOTE: Task 4.7.2 implements only 2-chord heuristic.
        Chord count alone cannot distinguish 2 vs 4 chords per bar.
        This test documents current behavior - will be improved in Task 4.7.3-4.7.5.
        """
        chords = ["Cmaj7", "Dm7", "Em7", "Fmaj7", "Gmaj7", "Am7", "Bm7b5", "Cmaj7"]
        pattern = analyze_chord_count_consistency(chords)
        # Currently defaults to 2_per_bar for sequences divisible by 4
        assert pattern.pattern == "2_per_bar"
        assert pattern.chords_per_bar == 2
        assert pattern.confidence >= 0.65

    def test_1_chord_pattern(self):
        """Test 1-chord per bar pattern (slow song)."""
        chords = ["Am", "Dm", "F", "C", "G"]
        pattern = analyze_chord_count_consistency(chords)
        # 5 chords - prime number, irregular pattern
        assert pattern.pattern == "irregular"
        assert pattern.confidence <= 0.5

    def test_waltz_pattern_3_chords(self):
        """Test 3/4 time pattern (divisible by 3)."""
        chords = ["Am", "F", "C", "G", "Dm", "E"]  # 6 chords
        pattern = analyze_chord_count_consistency(chords)
        # Divisible by 2, so will be detected as 2_per_bar
        assert pattern.pattern == "2_per_bar"

    def test_waltz_pattern_9_chords(self):
        """Test 3/4 time pattern (9 chords - only divisible by 3)."""
        chords = ["Am", "F", "C", "G", "Dm", "E", "Am", "F", "G"]  # 9 chords
        pattern = analyze_chord_count_consistency(chords)
        # Only divisible by 3, interpreted as 1_per_bar (3 bars in 3/4)
        assert pattern.pattern == "1_per_bar"
        assert pattern.confidence == 0.55

    def test_irregular_pattern(self):
        """Test irregular pattern (not divisible by common factors)."""
        chords = ["Am", "F", "C", "G", "Dm", "E", "Am"]  # 7 chords (prime)
        pattern = analyze_chord_count_consistency(chords)
        assert pattern.pattern == "irregular"
        assert pattern.confidence <= 0.5


class TestSuggestBarsFromChordCount:
    """Tests for suggest_bars_from_chord_count function."""

    def test_2_chord_pattern_suggestions(self):
        """Test bar suggestions for 2-chord pattern."""
        chords = ["Am", "F", "C", "G"]
        suggestions = suggest_bars_from_chord_count(chords)

        assert len(suggestions) == 2
        assert suggestions[0].position == 2
        assert suggestions[1].position == 4
        assert all(s.heuristic == "chord_count" for s in suggestions)
        assert all("2-chord pattern" in s.reason for s in suggestions)

    def test_4_chord_pattern_suggestions(self):
        """Test bar suggestions for sequence divisible by 4.

        NOTE: Currently detects as 2-chord pattern (Task 4.7.2).
        Will be improved with spacing/pattern heuristics in later tasks.
        """
        chords = ["C", "Dm", "Em", "F", "G", "Am", "Bdim", "C"]
        suggestions = suggest_bars_from_chord_count(chords)

        # Currently suggests 2-chord pattern
        assert len(suggestions) == 4
        assert suggestions[0].position == 2
        assert suggestions[1].position == 4
        assert suggestions[2].position == 6
        assert suggestions[3].position == 8
        assert all("2-chord pattern" in s.reason for s in suggestions)

    def test_irregular_pattern_no_suggestions(self):
        """Test that irregular patterns return no suggestions."""
        chords = ["Am", "F", "C", "G", "Dm", "E", "Am"]  # 7 chords (irregular)
        suggestions = suggest_bars_from_chord_count(chords)

        # Irregular pattern should not generate suggestions
        assert len(suggestions) == 0

    def test_long_sequence_suggestions(self):
        """Test suggestions for longer sequence."""
        # 16 chords - should suggest 8 bar boundaries (every 2 chords)
        chords = ["Am", "F"] * 8
        suggestions = suggest_bars_from_chord_count(chords)

        assert len(suggestions) == 8
        positions = [s.position for s in suggestions]
        assert positions == [2, 4, 6, 8, 10, 12, 14, 16]


class TestChordSpacing:
    """Tests for analyze_chord_spacing function."""

    def test_empty_chords(self):
        """Test with no chords."""
        line = ChordLyricsLine(chords=[], lyrics="")
        analysis = analyze_chord_spacing(line)
        assert analysis.gaps == []
        assert analysis.avg_gap == 0.0
        assert analysis.large_gap_positions == []

    def test_single_chord(self):
        """Test with single chord."""
        line = ChordLyricsLine(chords=[(0, "Am")], lyrics="test")
        analysis = analyze_chord_spacing(line)
        assert analysis.gaps == []
        assert analysis.avg_gap == 0.0
        assert analysis.large_gap_positions == []

    def test_uniform_spacing(self):
        """Test with uniform spacing (no clear bar boundaries)."""
        line = ChordLyricsLine(
            chords=[(0, "Am"), (10, "F"), (20, "C"), (30, "G")], lyrics="test lyrics"
        )
        analysis = analyze_chord_spacing(line)
        assert analysis.gaps == [10, 10, 10]
        assert analysis.avg_gap == 10.0
        assert analysis.std_dev == 0.0
        # No large gaps (all equal to average)
        assert len(analysis.large_gap_positions) == 0

    def test_large_gap_detection(self):
        """Test detection of large gaps indicating bar boundaries."""
        # Small gaps, then large gap, then small gaps
        line = ChordLyricsLine(
            chords=[(0, "Am"), (8, "F"), (35, "C"), (43, "G")], lyrics="test lyrics"
        )
        analysis = analyze_chord_spacing(line)
        assert analysis.gaps == [8, 27, 8]
        # Large gap at index 1 → position 2 (after chord "F")
        assert 2 in analysis.large_gap_positions

    def test_multiple_large_gaps(self):
        """Test multiple bar boundaries in one line."""
        # Pattern: small, large, small, large
        line = ChordLyricsLine(
            chords=[(0, "Am"), (8, "F"), (30, "C"), (38, "G"), (60, "Am")],
            lyrics="test lyrics",
        )
        analysis = analyze_chord_spacing(line)
        # Gaps: 8, 22, 8, 22
        # Large gaps at indices 1 and 3 → positions 2 and 4
        assert 2 in analysis.large_gap_positions
        assert 4 in analysis.large_gap_positions

    def test_hebrew_song_spacing(self):
        """Test with Hebrew song example (RTL-normalized chord positions)."""
        # "יום שישי חזר" chorus spacing pattern
        line = ChordLyricsLine(
            chords=[
                (0, "Am/E"),
                (10, "D#dim"),
                (35, "F#dim"),
                (45, "F"),
                (70, "D"),
                (80, "Am"),
            ],
            lyrics="יום שישי חזר אלי הביתה",
        )
        analysis = analyze_chord_spacing(line)
        # Should detect large gaps before F and D
        assert len(analysis.large_gap_positions) >= 1


class TestSuggestBarsFromSpacing:
    """Tests for suggest_bars_from_spacing function."""

    def test_empty_lines(self):
        """Test with no lines."""
        suggestions = suggest_bars_from_spacing([])
        assert len(suggestions) == 0

    def test_no_spacing_info(self):
        """Test with lines that have no spacing gaps."""
        lines = [
            ChordLyricsLine(chords=[(0, "Am")], lyrics="test"),
            ChordLyricsLine(chords=[(0, "F")], lyrics="test"),
        ]
        suggestions = suggest_bars_from_spacing(lines)
        assert len(suggestions) == 0

    def test_single_line_with_gaps(self):
        """Test single line with clear bar boundaries."""
        lines = [
            ChordLyricsLine(
                chords=[(0, "Am"), (8, "F"), (35, "C"), (43, "G")], lyrics="test"
            )
        ]
        suggestions = suggest_bars_from_spacing(lines)

        # Should suggest bar after "F" (before large gap)
        assert len(suggestions) >= 1
        assert any(s.position == 2 for s in suggestions)
        assert all(s.heuristic == "spacing" for s in suggestions)

    def test_multiple_lines(self):
        """Test multiple lines with cumulative chord counting."""
        lines = [
            # Line 1: chords 0-1 (Am, F)
            ChordLyricsLine(chords=[(0, "Am"), (8, "F")], lyrics="line 1"),
            # Line 2: chords 2-4 (C, G, Dm) with gap before Dm
            ChordLyricsLine(chords=[(0, "C"), (8, "G"), (30, "Dm")], lyrics="line 2"),
        ]
        suggestions = suggest_bars_from_spacing(lines)

        # Should suggest bar at position 4 (after G, before Dm)
        # Position 4 = 2 chords from line 1 + 2 chords from line 2
        assert any(s.position == 4 for s in suggestions)

    def test_confidence_scores(self):
        """Test that confidence scores are reasonable and vary with gap size."""
        lines = [
            # Very large gap (3x average)
            ChordLyricsLine(
                chords=[(0, "Am"), (10, "F"), (40, "C"), (50, "G")], lyrics="test"
            )
        ]
        suggestions = suggest_bars_from_spacing(lines)

        # Should have high confidence for very large gap
        assert len(suggestions) >= 1
        large_gap_suggestion = next(s for s in suggestions if s.position == 2)
        assert large_gap_suggestion.confidence >= 0.70

    def test_hebrew_song_ohev_otach(self):
        """Test with 'אוהב אותך' Hebrew song (chord-above-lyrics format)."""
        # Typical Hebrew song spacing pattern
        lines = [
            ChordLyricsLine(
                chords=[
                    (0, "Bbm"),
                    (15, "Gb"),
                    (45, "Db"),
                    (60, "Ab"),
                ],
                lyrics="אוהב אותך כל כך",
            )
        ]
        suggestions = suggest_bars_from_spacing(lines)

        # Should detect bar boundaries based on spacing
        assert len(suggestions) >= 1
        assert all(0.0 <= s.confidence <= 1.0 for s in suggestions)


class TestDetectBarsSimple:
    """Tests for detect_bars_simple function (MVP implementation)."""

    def test_simple_pop_song_pattern(self):
        """Test typical pop song chord progression."""
        chords = ["C", "G", "Am", "F", "C", "G", "Am", "F"]
        suggestions = detect_bars_simple(chords)

        assert len(suggestions) == 4
        assert suggestions[0].position == 2
        assert suggestions[1].position == 4
        assert suggestions[2].position == 6
        assert suggestions[3].position == 8
        assert all(s.confidence >= 0.7 for s in suggestions)

    def test_hebrew_song_yom_shishi(self):
        """Test with Hebrew song example (יום שישי חזר)."""
        # Chorus: Am/E D#dim F#dim F D Am E Dm (8 chords)
        chords = ["Am/E", "D#dim", "F#dim", "F", "D", "Am", "E", "Dm"]
        suggestions = detect_bars_simple(chords)

        # Should detect 2-chord pattern (4 bars)
        assert len(suggestions) == 4
        positions = [s.position for s in suggestions]
        assert positions == [2, 4, 6, 8]

    def test_jazz_progression(self):
        """Test jazz progression.

        NOTE: Jazz often has 4 chords/bar, but chord count alone cannot detect this.
        Currently defaults to 2-chord pattern. Will improve with spacing heuristic.
        """
        chords = ["Cmaj7", "Dm7", "Em7", "Fmaj7", "G7", "Am7", "Bm7b5", "Cmaj7"]
        suggestions = detect_bars_simple(chords)

        # Currently detects 2-chord pattern
        assert len(suggestions) == 4
        assert suggestions[0].position == 2
        assert suggestions[1].position == 4
        assert suggestions[2].position == 6
        assert suggestions[3].position == 8

    def test_empty_sequence(self):
        """Test empty chord sequence."""
        suggestions = detect_bars_simple([])
        assert len(suggestions) == 0

    def test_single_chord(self):
        """Test single chord (irregular)."""
        suggestions = detect_bars_simple(["Am"])
        assert len(suggestions) == 0  # Irregular pattern

    def test_two_chords(self):
        """Test two chords (minimal 2-chord pattern)."""
        suggestions = detect_bars_simple(["Am", "F"])
        assert len(suggestions) == 1
        assert suggestions[0].position == 2

    def test_confidence_scores_are_reasonable(self):
        """Test that all confidence scores are in valid range."""
        test_sequences = [
            ["Am", "F", "C", "G"],
            ["Am"] * 8,
            ["Cmaj7", "Dm7", "Em7", "Fmaj7"] * 2,
            ["Am", "F", "C", "G", "Dm", "E"],
        ]

        for chords in test_sequences:
            suggestions = detect_bars_simple(chords)
            for suggestion in suggestions:
                assert 0.0 <= suggestion.confidence <= 1.0
                assert isinstance(suggestion.reason, str)
                assert len(suggestion.reason) > 0
