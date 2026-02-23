"""Tests for chord-above-lyrics tab format parsing."""

from caspian.parsing.input_parser import parse_format_a


class TestChordAboveLyrics:
    def test_basic_pair(self):
        """Chord line followed by Hebrew lyrics line should be parsed as a pair."""
        text = "[verse]\nAm    Dm    G\nשלום עולם יפה"
        result = parse_format_a(text)
        section = result.sections[0]
        # Chords should be reversed (Hebrew → RTL)
        symbols = [c.symbol for c in section.chords]
        assert symbols == ["G", "Dm", "Am"]
        # Lines data should be populated
        assert len(section.lines) == 1
        assert section.lines[0].lyrics.strip() == "שלום עולם יפה"
        assert len(section.lines[0].chords) == 3

    def test_positions_preserved(self):
        """Column positions of chords should be preserved in lines data."""
        text = "[verse]\nCm7b5    Bbm/Db    Cm7b5      Bbm\nעוד מעט כמעט       אנו גוף      אחד"
        result = parse_format_a(text)
        section = result.sections[0]
        assert len(section.lines) == 1
        line = section.lines[0]
        # First chord should be at column 0
        assert line.chords[0][0] == 0
        assert line.chords[0][1] == "Cm7b5"

    def test_multiple_pairs(self):
        """Multiple chord-lyrics pairs in sequence."""
        text = "[verse]\nAm    Dm\nשלום עולם\nG     C\nלילה טוב"
        result = parse_format_a(text)
        section = result.sections[0]
        assert len(section.lines) == 2
        # 4 chords total (2 per line, reversed)
        assert len(section.chords) == 4

    def test_non_hebrew_next_line_not_paired(self):
        """If next line has no Hebrew, chord line is not paired."""
        text = "[intro]\nAm Dm G\nC F G"
        result = parse_format_a(text)
        section = result.sections[0]
        # Both are chord lines, no pairing
        assert len(section.lines) == 0
        assert len(section.chords) == 6

    def test_chord_line_with_no_next_line(self):
        """Chord line at end of input (no next line) should not crash."""
        text = "[intro]\nAm Dm G"
        result = parse_format_a(text)
        section = result.sections[0]
        assert len(section.chords) == 3
        assert len(section.lines) == 0

    def test_lyrics_attached_to_chords(self):
        """Each chord in a pair should have lyrics set."""
        text = "[verse]\nAm    Dm\nשלום עולם"
        result = parse_format_a(text)
        section = result.sections[0]
        for chord in section.chords:
            assert chord.lyrics == "שלום עולם"

    def test_mixed_pipe_and_tab_format(self):
        """A section can have both pipe-format and tab-format lines."""
        text = "[verse]\nAm    Dm\nשלום עולם\nG C | לילה טוב"
        result = parse_format_a(text)
        section = result.sections[0]
        # 2 from tab pair (reversed) + 2 from pipe (reversed)
        assert len(section.chords) == 4
        assert len(section.lines) == 1
