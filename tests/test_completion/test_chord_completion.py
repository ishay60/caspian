"""Tests for musicgraphic chord completion."""

import pytest
from caspian.completion.chord_completion import chord_completions


class TestChordCompletionsOrder:
    """Completion order: Am before A (musicgraphic, not lexicographic)."""

    def test_a_in_a_minor_am_before_a(self):
        result = chord_completions("A", "A", "natural_minor", limit=20)
        assert "Am" in result
        assert "A" in result
        assert result.index("Am") < result.index("A")

    def test_a_in_a_minor_am_first(self):
        result = chord_completions("A", "A", "natural_minor", limit=5)
        assert result[0] == "Am"

    def test_diatonic_chords_first_for_prefix(self):
        # In A natural minor, diatonic triads include Am, C, F, G, Bdim, Dm, E
        result = chord_completions("A", "A", "natural_minor", limit=30)
        am_pos = result.index("Am")
        a_pos = result.index("A")
        # Am is diatonic and should appear before non-diatonic A#/Ab variants
        assert am_pos < a_pos


class TestChordCompletionsEdgeCases:
    def test_empty_prefix_returns_empty(self):
        assert chord_completions("", "A", "natural_minor") == []
        assert chord_completions("   ", "C", "major") == []

    def test_unknown_key_raises(self):
        with pytest.raises(ValueError, match="Unknown root note"):
            chord_completions("A", "X", "major")
        with pytest.raises(ValueError, match="Unknown mode"):
            chord_completions("A", "A", "unknown_mode")

    def test_limit_respected(self):
        result = chord_completions("A", "A", "natural_minor", limit=5)
        assert len(result) <= 5

    def test_case_insensitive_prefix(self):
        result_lower = chord_completions("a", "A", "natural_minor", limit=5)
        result_upper = chord_completions("A", "A", "natural_minor", limit=5)
        assert result_lower == result_upper
        assert result_lower[0] == "Am"
