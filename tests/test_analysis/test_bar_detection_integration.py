"""Integration tests for bar detection with real song examples.

Tests the complete bar detection pipeline with actual song files.
"""

from pathlib import Path

import pytest

from caspian.analysis.bar_detection import detect_bars
from caspian.models.input import ChordLyricsLine


class TestRealSongExamples:
    """Tests with real song examples from examples/ directory."""

    def test_yom_shishi_chorus(self):
        """Test bar detection for 'יום שישי חזר' chorus (Am, 2-chord pattern)."""
        # Chorus: Am/E D#dim F#dim F D Am E Dm (8 chords)
        chords = ["Am/E", "D#dim", "F#dim", "F", "D", "Am", "E", "Dm"]

        suggestions = detect_bars(chords)

        # Should detect 2-chord pattern (4 bars)
        # Positions: 2, 4, 6, 8
        assert len(suggestions) >= 3

        # Check that suggestions cover the full sequence
        positions = sorted([s.position for s in suggestions])
        assert 2 in positions or 4 in positions
        assert 8 in positions or 6 in positions

        # Should have reasonable confidence
        assert all(s.confidence >= 0.5 for s in suggestions)

    def test_yom_shishi_with_spacing(self):
        """Test bar detection for 'יום שישי חזר' with spacing information."""
        chords = ["Am/E", "D#dim", "F#dim", "F", "D", "Am", "E", "Dm"]

        # Simulate spacing from ChordLyricsLine (larger gaps at bar boundaries)
        lines = [
            ChordLyricsLine(
                chords=[
                    (0, "Am/E"),
                    (10, "D#dim"),
                    (35, "F#dim"),  # Large gap before
                    (45, "F"),
                    (70, "D"),  # Large gap before
                    (80, "Am"),
                    (100, "E"),  # Large gap before
                    (110, "Dm"),
                ],
                lyrics="יום שישי חזר אלי הביתה שוב",
            )
        ]

        suggestions = detect_bars(chords, chord_lyrics_lines=lines)

        # Should get higher confidence from combining heuristics
        assert len(suggestions) >= 1

        # At least one suggestion should have high confidence from combining
        max_confidence = max(s.confidence for s in suggestions)
        assert max_confidence >= 0.70

    def test_let_it_be_pattern(self):
        """Test bar detection for 'Let It Be' (C G Am F pattern)."""
        # Verse: C G Am F C G F C (classic pattern)
        chords = ["C", "G", "Am", "F", "C", "G", "F", "C"]

        suggestions = detect_bars(chords)

        # Should detect 2-chord or 4-chord pattern
        assert len(suggestions) >= 1

        # Check reasonable positions
        positions = [s.position for s in suggestions]
        # Could be 2-chord (2,4,6,8) or 4-chord (4,8)
        assert any(pos in [2, 4, 8] for pos in positions)

    def test_hallelujah_progression(self):
        """Test bar detection for 'Hallelujah' (C Am C Am F G C G pattern)."""
        # Famous progression
        chords = ["C", "Am", "C", "Am", "F", "G", "C", "G"]

        suggestions = detect_bars(chords)

        # Should detect some pattern (likely 2-chord)
        assert len(suggestions) >= 1
        assert all(s.confidence >= 0.5 for s in suggestions)

    def test_ohev_otach_hebrew_spacing(self):
        """Test bar detection for 'אוהב אותך' (Bbm, chord-above-lyrics format)."""
        # Typical Hebrew chord progression
        chords = ["Bbm", "Gb", "Db", "Ab", "Bbm", "Gb", "Db", "Ab"]

        # Wide spacing between chords (typical of chord-above-lyrics)
        lines = [
            ChordLyricsLine(
                chords=[(0, "Bbm"), (20, "Gb"), (60, "Db"), (80, "Ab")],
                lyrics="אוהב אותך כל כך הרבה",
            ),
            ChordLyricsLine(
                chords=[(0, "Bbm"), (20, "Gb"), (60, "Db"), (80, "Ab")],
                lyrics="אין לי מילים להגיד",
            ),
        ]

        suggestions = detect_bars(chords, chord_lyrics_lines=lines)

        # Should detect pattern repetition
        assert len(suggestions) >= 1

        # Should have pattern heuristic suggestions
        pattern_suggestions = [
            s for s in suggestions if s.heuristic in ["pattern", "combined"]
        ]
        assert len(pattern_suggestions) > 0

    def test_simple_pop_progression_i_v_vi_iv(self):
        """Test detection for I-V-vi-IV progression (most popular pattern)."""
        # In key of C: C G Am F
        chords = ["C", "G", "Am", "F"] * 4  # 4 repetitions

        suggestions = detect_bars(chords)

        # Should detect 4-chord repeating pattern
        assert len(suggestions) >= 1

        # Should have very high confidence from pattern repetition
        pattern_suggestions = [
            s for s in suggestions if s.heuristic in ["pattern", "combined"]
        ]
        assert len(pattern_suggestions) > 0
        max_pattern_confidence = max((s.confidence for s in pattern_suggestions), default=0.0)
        assert max_pattern_confidence >= 0.80

    def test_waltz_time_pattern(self):
        """Test detection for 3/4 time (waltz pattern)."""
        # 3 chords per bar or 1 chord per bar
        chords = ["Am", "F", "C"] * 3  # 9 chords total

        suggestions = detect_bars(chords)

        # Should detect 3-chord pattern
        assert len(suggestions) >= 1

        # Positions should be multiples of 3
        positions = [s.position for s in suggestions]
        assert any(pos % 3 == 0 for pos in positions)

    def test_jazz_ii_v_i_progression(self):
        """Test detection for jazz ii-V-I progression."""
        # In key of C: Dm7 G7 Cmaj7
        chords = ["Dm7", "G7", "Cmaj7"] * 4  # 12 chords

        suggestions = detect_bars(chords)

        # Should detect 3-chord repeating pattern
        assert len(suggestions) >= 1

        # Should detect pattern
        pattern_suggestions = [
            s for s in suggestions if s.heuristic in ["pattern", "combined"]
        ]
        assert len(pattern_suggestions) > 0

    def test_mixed_irregular_progression(self):
        """Test with irregular, non-repeating progression."""
        # No clear pattern
        chords = ["Am", "F", "Dm", "G", "C", "Em", "Bdim", "E7", "Am"]

        suggestions = detect_bars(chords, confidence_threshold=0.5)

        # May return few or no suggestions (irregular pattern)
        # Just verify it doesn't crash
        assert isinstance(suggestions, list)

    def test_very_short_song(self):
        """Test with very short song (4 chords)."""
        chords = ["Am", "Dm", "E", "Am"]

        suggestions = detect_bars(chords)

        # Should handle gracefully
        assert isinstance(suggestions, list)
        # May or may not have suggestions depending on pattern


class TestConfidenceAccuracy:
    """Tests to verify confidence scores are accurate predictors."""

    def test_perfect_pattern_has_highest_confidence(self):
        """Test that perfect repeating patterns have highest confidence."""
        perfect_pattern = ["Am", "F", "C", "G"] * 4
        irregular = ["Am", "F", "C", "G", "Dm", "E", "Bdim"]

        perfect_suggestions = detect_bars(perfect_pattern)
        irregular_suggestions = detect_bars(irregular)

        # Perfect pattern should have higher max confidence
        max_perfect = max((s.confidence for s in perfect_suggestions), default=0.0)
        max_irregular = max((s.confidence for s in irregular_suggestions), default=0.0)

        assert max_perfect > max_irregular

    def test_multiple_heuristics_boost_confidence(self):
        """Test that multiple agreeing heuristics boost confidence."""
        # This sequence should match both chord_count and pattern heuristics
        chords = ["Am", "F", "C", "G"] * 2

        # With spacing that agrees
        lines = [
            ChordLyricsLine(
                chords=[(0, "Am"), (10, "F"), (40, "C"), (50, "G")], lyrics="line1"
            ),
            ChordLyricsLine(
                chords=[(0, "Am"), (10, "F"), (40, "C"), (50, "G")], lyrics="line2"
            ),
        ]

        with_spacing = detect_bars(chords, chord_lyrics_lines=lines)
        without_spacing = detect_bars(chords)

        # With spacing should have higher confidence at some positions
        max_with = max((s.confidence for s in with_spacing), default=0.0)
        max_without = max((s.confidence for s in without_spacing), default=0.0)

        # Should boost confidence when heuristics agree
        assert max_with >= max_without

    def test_longer_patterns_have_higher_confidence(self):
        """Test that longer repetition counts increase confidence."""
        two_reps = ["Am", "F"] * 2  # 2 repetitions
        four_reps = ["Am", "F"] * 4  # 4 repetitions

        suggestions_2 = detect_bars(two_reps)
        suggestions_4 = detect_bars(four_reps)

        # Find pattern suggestions
        pattern_2 = [s for s in suggestions_2 if "pattern" in s.heuristic.lower()]
        pattern_4 = [s for s in suggestions_4 if "pattern" in s.heuristic.lower()]

        if pattern_2 and pattern_4:
            max_conf_2 = max(s.confidence for s in pattern_2)
            max_conf_4 = max(s.confidence for s in pattern_4)

            # More repetitions should have higher confidence
            assert max_conf_4 >= max_conf_2


class TestPerformance:
    """Performance tests for large sequences."""

    def test_large_sequence_performance(self):
        """Test that detection completes quickly for large sequences."""
        import time

        # 500 chord sequence
        large_sequence = ["C", "G", "Am", "F"] * 125

        start = time.time()
        suggestions = detect_bars(large_sequence)
        elapsed = time.time() - start

        # Should complete in under 1 second
        assert elapsed < 1.0
        assert len(suggestions) > 0

    def test_many_lines_performance(self):
        """Test performance with many ChordLyricsLine objects."""
        import time

        chords = ["Am", "F"] * 50  # 100 chords
        lines = [
            ChordLyricsLine(chords=[(0, "Am"), (20, "F")], lyrics=f"line {i}")
            for i in range(50)
        ]

        start = time.time()
        suggestions = detect_bars(chords, chord_lyrics_lines=lines)
        elapsed = time.time() - start

        # Should complete in under 1 second
        assert elapsed < 1.0
        assert len(suggestions) > 0
