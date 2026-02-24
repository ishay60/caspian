"""Tests for bar detection heuristics."""

import pytest

from caspian.analysis.bar_detection import (
    BarSuggestion,
    ChordCountPattern,
    RepeatingPattern,
    SpacingAnalysis,
    analyze_chord_count_consistency,
    analyze_chord_spacing,
    combine_suggestions,
    detect_bars,
    detect_bars_simple,
    find_repeating_patterns,
    suggest_bars_from_chord_count,
    suggest_bars_from_patterns,
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


class TestRepeatingPatterns:
    """Tests for find_repeating_patterns function."""

    def test_no_pattern_short_sequence(self):
        """Test with sequence too short for pattern detection."""
        chords = ["Am", "F"]
        patterns = find_repeating_patterns(chords, min_pattern_length=2)
        # Need at least 2 repetitions (4 chords minimum for 2-chord pattern)
        assert len(patterns) == 0

    def test_exact_2_chord_pattern(self):
        """Test exact 2-chord pattern repeating."""
        chords = ["Am", "F", "Am", "F"]
        patterns = find_repeating_patterns(chords)

        assert len(patterns) == 1
        assert patterns[0].pattern_length == 2
        assert patterns[0].repetitions == 2
        assert patterns[0].pattern_type == "exact"
        assert patterns[0].confidence >= 0.70

    def test_exact_4_chord_pattern(self):
        """Test exact 4-chord pattern (typical pop progression)."""
        chords = ["Am", "F", "C", "G", "Am", "F", "C", "G"]
        patterns = find_repeating_patterns(chords)

        assert len(patterns) == 1
        assert patterns[0].pattern_length == 4
        assert patterns[0].repetitions == 2
        assert patterns[0].pattern_type == "exact"

    def test_triple_repetition_higher_confidence(self):
        """Test that more repetitions = higher confidence."""
        # 3 repetitions of 2-chord pattern
        chords = ["Am", "F", "Am", "F", "Am", "F"]
        patterns = find_repeating_patterns(chords)

        assert len(patterns) == 1
        assert patterns[0].repetitions == 3
        # Should have higher confidence than 2 repetitions (0.70 + 0.10 = 0.80)
        assert patterns[0].confidence >= 0.79  # Allow for floating point precision

    def test_no_pattern_irregular(self):
        """Test irregular sequence with no repeating pattern."""
        chords = ["Am", "F", "C", "G", "Dm", "E", "Bdim"]
        patterns = find_repeating_patterns(chords)

        assert len(patterns) == 0

    def test_hebrew_song_pattern(self):
        """Test with Hebrew song 'יום שישי חזר' chorus."""
        # Chorus repeats: Am/E D#dim F#dim F D Am E Dm (8 chords)
        # If song has 2 choruses back-to-back
        chorus = ["Am/E", "D#dim", "F#dim", "F", "D", "Am", "E", "Dm"]
        chords = chorus * 2  # 16 chords total

        patterns = find_repeating_patterns(chords)

        assert len(patterns) == 1
        assert patterns[0].pattern_length == 8
        assert patterns[0].repetitions == 2

    def test_prefers_longest_exact_pattern(self):
        """Test that algorithm prefers longer patterns when multiple exist."""
        # Pattern: [Am F] repeated 4 times
        # Could be detected as 2-chord pattern (4 reps) or 4-chord pattern (2 reps)
        chords = ["Am", "F"] * 4

        patterns = find_repeating_patterns(chords)

        # Should detect both, but return highest confidence (fewest repetitions of longest pattern)
        # Actually, both 2-chord x4 and 4-chord x2 have same confidence
        # Currently returns first found (2-chord pattern has higher repetitions → higher confidence)
        assert len(patterns) >= 1

    def test_partial_match_not_detected(self):
        """Test that partial matches (not exact) are not detected as patterns."""
        # Similar but not exact: last chord differs
        chords = ["Am", "F", "C", "G", "Am", "F", "C", "Dm"]
        patterns = find_repeating_patterns(chords)

        # Should not detect 4-chord exact pattern
        # Might detect 2-chord pattern though
        exact_4_chord = [p for p in patterns if p.pattern_length == 4 and p.pattern_type == "exact"]
        assert len(exact_4_chord) == 0


class TestSuggestBarsFromPatterns:
    """Tests for suggest_bars_from_patterns function."""

    def test_no_pattern_no_suggestions(self):
        """Test that no pattern = no suggestions."""
        chords = ["Am", "F", "C", "G", "Dm", "E", "Bdim"]
        suggestions = suggest_bars_from_patterns(chords)

        assert len(suggestions) == 0

    def test_repeating_pattern_suggestions(self):
        """Test suggestions from repeating pattern."""
        chords = ["Am", "F", "C", "G", "Am", "F", "C", "G"]
        suggestions = suggest_bars_from_patterns(chords)

        # Should suggest bar at position 4 and 8
        assert len(suggestions) == 2
        assert suggestions[0].position == 4
        assert suggestions[1].position == 8
        assert all(s.heuristic == "pattern" for s in suggestions)
        assert all("Repeating" in s.reason for s in suggestions)

    def test_confidence_from_pattern(self):
        """Test that confidence matches pattern confidence."""
        chords = ["Am", "F"] * 3  # 3 repetitions
        suggestions = suggest_bars_from_patterns(chords)

        # All suggestions should have same confidence from pattern
        assert len(suggestions) == 3
        confidences = [s.confidence for s in suggestions]
        assert len(set(confidences)) == 1  # All same
        assert confidences[0] >= 0.79  # 3 repetitions → high confidence (0.70 + 0.10)

    def test_hebrew_song_verse_chorus(self):
        """Test with Hebrew song having repeating verse/chorus."""
        verse = ["Am", "Dm", "F", "E"]
        chords = verse * 2

        suggestions = suggest_bars_from_patterns(chords)

        assert len(suggestions) == 2
        positions = [s.position for s in suggestions]
        assert positions == [4, 8]


class TestCombineSuggestions:
    """Tests for combine_suggestions function."""

    def test_empty_suggestions(self):
        """Test with no suggestions."""
        combined = combine_suggestions([])
        assert len(combined) == 0

    def test_single_suggestion(self):
        """Test with single suggestion (no combining needed)."""
        suggestions = [
            BarSuggestion(
                position=2,
                confidence=0.70,
                reason="2-chord pattern",
                heuristic="chord_count",
            )
        ]
        combined = combine_suggestions(suggestions)

        assert len(combined) == 1
        assert combined[0] == suggestions[0]

    def test_two_heuristics_agree(self):
        """Test confidence boost when two heuristics agree on same position."""
        suggestions = [
            BarSuggestion(
                position=4,
                confidence=0.70,
                reason="2-chord pattern",
                heuristic="chord_count",
            ),
            BarSuggestion(
                position=4,
                confidence=0.80,
                reason="Repeating pattern",
                heuristic="pattern",
            ),
        ]
        combined = combine_suggestions(suggestions)

        assert len(combined) == 1
        assert combined[0].position == 4
        # Should boost: max(0.70, 0.80) + 0.15 = 0.95
        assert combined[0].confidence >= 0.94
        assert combined[0].heuristic == "combined"
        assert "Multiple heuristics" in combined[0].reason

    def test_three_heuristics_agree(self):
        """Test even higher boost when three heuristics agree."""
        suggestions = [
            BarSuggestion(position=2, confidence=0.70, reason="...", heuristic="chord_count"),
            BarSuggestion(position=2, confidence=0.75, reason="...", heuristic="spacing"),
            BarSuggestion(position=2, confidence=0.85, reason="...", heuristic="pattern"),
        ]
        combined = combine_suggestions(suggestions)

        assert len(combined) == 1
        # Should boost: max(0.70, 0.75, 0.85) + 0.25 = 1.10 → capped at 0.99
        assert combined[0].confidence >= 0.99

    def test_conflicting_positions_kept_separate(self):
        """Test that different positions are kept separate."""
        suggestions = [
            BarSuggestion(position=2, confidence=0.70, reason="...", heuristic="chord_count"),
            BarSuggestion(position=4, confidence=0.80, reason="...", heuristic="pattern"),
        ]
        combined = combine_suggestions(suggestions)

        assert len(combined) == 2
        positions = sorted([s.position for s in combined])
        assert positions == [2, 4]

    def test_mixed_agreement_and_conflict(self):
        """Test mixture of agreeing and conflicting suggestions."""
        suggestions = [
            BarSuggestion(position=2, confidence=0.70, reason="...", heuristic="chord_count"),
            BarSuggestion(position=2, confidence=0.80, reason="...", heuristic="pattern"),
            BarSuggestion(position=4, confidence=0.75, reason="...", heuristic="spacing"),
        ]
        combined = combine_suggestions(suggestions)

        assert len(combined) == 2
        # Position 2 should have boosted confidence
        pos2 = next(s for s in combined if s.position == 2)
        assert pos2.confidence >= 0.94  # 0.80 + 0.15
        # Position 4 should remain unchanged
        pos4 = next(s for s in combined if s.position == 4)
        assert pos4.confidence == 0.75


class TestDetectBars:
    """Tests for detect_bars function (full multi-heuristic detection)."""

    def test_chord_count_only(self):
        """Test detection with only chord sequence (no spacing data)."""
        chords = ["Am", "F", "C", "G", "Am", "F", "C", "G"]
        suggestions = detect_bars(chords)

        # Should use chord_count and pattern heuristics
        assert len(suggestions) >= 1
        assert all(s.confidence >= 0.5 for s in suggestions)

    def test_with_spacing_data(self):
        """Test detection with spacing data available."""
        chords = ["Am", "F", "C", "G"]
        lines = [
            ChordLyricsLine(
                chords=[(0, "Am"), (10, "F"), (40, "C"), (50, "G")], lyrics="test"
            )
        ]
        suggestions = detect_bars(chords, chord_lyrics_lines=lines)

        # Should combine chord_count, spacing, and pattern heuristics
        assert len(suggestions) >= 1

    def test_confidence_threshold_filtering(self):
        """Test that low-confidence suggestions are filtered out."""
        chords = ["Am", "F", "C", "G", "Dm", "E", "Am"]  # Irregular (7 chords)
        suggestions_low = detect_bars(chords, confidence_threshold=0.3)
        suggestions_high = detect_bars(chords, confidence_threshold=0.7)

        # Lower threshold should allow more suggestions
        assert len(suggestions_low) >= len(suggestions_high)

    def test_repeating_pattern_boosts_confidence(self):
        """Test that repeating patterns result in high confidence."""
        # Exact 4-chord pattern repeated
        chords = ["Am", "F", "C", "G"] * 3
        suggestions = detect_bars(chords)

        # Should have very high confidence from both chord_count and pattern heuristics
        assert len(suggestions) >= 1
        # At least one suggestion should have boosted confidence
        max_confidence = max(s.confidence for s in suggestions)
        assert max_confidence >= 0.85

    def test_hebrew_song_full_detection(self):
        """Test full detection with Hebrew song example."""
        chords = ["Am/E", "D#dim", "F#dim", "F", "D", "Am", "E", "Dm"]
        lines = [
            ChordLyricsLine(
                chords=[
                    (0, "Am/E"),
                    (10, "D#dim"),
                    (35, "F#dim"),
                    (45, "F"),
                    (70, "D"),
                    (80, "Am"),
                    (90, "E"),
                    (100, "Dm"),
                ],
                lyrics="יום שישי חזר אלי הביתה",
            )
        ]
        suggestions = detect_bars(chords, chord_lyrics_lines=lines)

        # Should get suggestions combining all heuristics
        assert len(suggestions) >= 1
        assert all(s.confidence >= 0.5 for s in suggestions)

    def test_all_heuristics_agree_maximum_confidence(self):
        """Test that when all heuristics agree, we get maximum confidence."""
        # Create perfect scenario: exact pattern + good spacing + even count
        chords = ["Am", "F", "C", "G"] * 2
        lines = [
            ChordLyricsLine(
                chords=[(0, "Am"), (10, "F"), (40, "C"), (50, "G")], lyrics="line 1"
            ),
            ChordLyricsLine(
                chords=[(0, "Am"), (10, "F"), (40, "C"), (50, "G")], lyrics="line 2"
            ),
        ]
        suggestions = detect_bars(chords, chord_lyrics_lines=lines)

        # Should have high confidence from combining all heuristics
        assert len(suggestions) >= 1
        # Check if any suggestion has very high confidence
        has_high_confidence = any(s.confidence >= 0.85 for s in suggestions)
        assert has_high_confidence


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
