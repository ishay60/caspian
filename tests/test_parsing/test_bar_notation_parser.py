"""Tests for bar notation parser.

Phase 3.3: Bar Line Detection
"""

import pytest

from caspian.models.input import Bar, BarChord, BeatPosition, SectionInput, SongInput
from caspian.parsing.bar_notation_parser import BarNotationParser


class TestBarNotationDetection:
    """Test bar notation line detection."""

    def test_detect_simple_bar_line(self):
        """Test detection of simple bar notation."""
        parser = BarNotationParser()
        assert parser.is_bar_notation_line("| Am |")
        assert parser.is_bar_notation_line("| Am | F |")
        assert parser.is_bar_notation_line("| Am | F | C | G |")

    def test_detect_bar_line_with_repeat_markers(self):
        """Test detection of bar notation with repeat markers."""
        parser = BarNotationParser()
        assert parser.is_bar_notation_line("|: Am | F :|")
        assert parser.is_bar_notation_line("|: Am | F | C | G :|")

    def test_detect_multiple_chords_per_bar(self):
        """Test detection of multiple chords per bar."""
        parser = BarNotationParser()
        assert parser.is_bar_notation_line("| Am F | C G |")
        assert parser.is_bar_notation_line("| Am7 Fmaj7 C/E | Dm7 G7 |")

    def test_detect_mixed_densities(self):
        """Test detection of mixed chord densities."""
        parser = BarNotationParser()
        assert parser.is_bar_notation_line("| Am7 | Fmaj7 C/E | Dm7 G7 |")
        assert parser.is_bar_notation_line("| Am | F G | C |")

    def test_reject_non_bar_lines(self):
        """Test rejection of non-bar notation lines."""
        parser = BarNotationParser()
        assert not parser.is_bar_notation_line("Am F C G")
        assert not parser.is_bar_notation_line("verse:")
        assert not parser.is_bar_notation_line("[chorus]")
        assert not parser.is_bar_notation_line("| |")  # empty bars
        assert not parser.is_bar_notation_line("|")  # single pipe

    def test_reject_invalid_chord_symbols(self):
        """Test rejection of invalid chord symbols."""
        parser = BarNotationParser()
        assert not parser.is_bar_notation_line("| xyz | abc |")
        assert not parser.is_bar_notation_line("| 123 | 456 |")


class TestSingleBarParsing:
    """Test parsing single bars."""

    def test_parse_single_chord_bar(self):
        """Test parsing bar with single chord."""
        parser = BarNotationParser()
        bars = parser.parse_bar_line("| Am |")

        assert len(bars) == 1
        assert len(bars[0].content.chords) == 1
        assert bars[0].content.chords[0].symbol == "Am"
        assert bars[0].content.chords[0].beat_position.beat == 1
        assert bars[0].content.chords[0].beat_position.subdivision == 0

    def test_parse_two_chords_per_bar(self):
        """Test parsing bar with two chords (beats 1 and 3)."""
        parser = BarNotationParser()
        bars = parser.parse_bar_line("| Am F |")

        assert len(bars) == 1
        assert len(bars[0].content.chords) == 2
        assert bars[0].content.chords[0].symbol == "Am"
        assert bars[0].content.chords[0].beat_position.beat == 1
        assert bars[0].content.chords[1].symbol == "F"
        assert bars[0].content.chords[1].beat_position.beat == 3

    def test_parse_three_chords_per_bar(self):
        """Test parsing bar with three chords (beats 1, 2, 3)."""
        parser = BarNotationParser()
        bars = parser.parse_bar_line("| Am F C |")

        assert len(bars) == 1
        assert len(bars[0].content.chords) == 3
        assert bars[0].content.chords[0].beat_position.beat == 1
        assert bars[0].content.chords[1].beat_position.beat == 2
        assert bars[0].content.chords[2].beat_position.beat == 3

    def test_parse_four_chords_per_bar(self):
        """Test parsing bar with four chords (beats 1, 2, 3, 4)."""
        parser = BarNotationParser()
        bars = parser.parse_bar_line("| Am F C G |")

        assert len(bars) == 1
        assert len(bars[0].content.chords) == 4
        for i in range(4):
            assert bars[0].content.chords[i].beat_position.beat == i + 1
            assert bars[0].content.chords[i].beat_position.subdivision == 0


class TestMultipleBarsPerLine:
    """Test parsing multiple bars per line."""

    def test_parse_four_single_chord_bars(self):
        """Test parsing four bars with one chord each."""
        parser = BarNotationParser()
        bars = parser.parse_bar_line("| Am | F | C | G |")

        assert len(bars) == 4
        assert bars[0].content.chords[0].symbol == "Am"
        assert bars[1].content.chords[0].symbol == "F"
        assert bars[2].content.chords[0].symbol == "C"
        assert bars[3].content.chords[0].symbol == "G"

    def test_parse_mixed_densities(self):
        """Test parsing bars with mixed chord densities."""
        parser = BarNotationParser()
        bars = parser.parse_bar_line("| Am | F G | C | Dm Em F G |")

        assert len(bars) == 4
        assert len(bars[0].content.chords) == 1  # Am
        assert len(bars[1].content.chords) == 2  # F G
        assert len(bars[2].content.chords) == 1  # C
        assert len(bars[3].content.chords) == 4  # Dm Em F G


class TestBeatPositionMapping:
    """Test chord-to-beat position mapping."""

    def test_one_chord_maps_to_beat_1(self):
        """Test single chord maps to beat 1."""
        parser = BarNotationParser()
        bar_chords = parser._map_chords_to_beats(["Am"])

        assert len(bar_chords) == 1
        assert bar_chords[0].beat_position.beat == 1
        assert bar_chords[0].beat_position.subdivision == 0

    def test_two_chords_map_to_beats_1_and_3(self):
        """Test two chords map to beats 1 and 3."""
        parser = BarNotationParser()
        bar_chords = parser._map_chords_to_beats(["Am", "F"])

        assert len(bar_chords) == 2
        assert bar_chords[0].beat_position.beat == 1
        assert bar_chords[1].beat_position.beat == 3

    def test_three_chords_map_to_beats_1_2_3(self):
        """Test three chords map to beats 1, 2, 3."""
        parser = BarNotationParser()
        bar_chords = parser._map_chords_to_beats(["Am", "F", "C"])

        assert len(bar_chords) == 3
        assert bar_chords[0].beat_position.beat == 1
        assert bar_chords[1].beat_position.beat == 2
        assert bar_chords[2].beat_position.beat == 3

    def test_four_chords_map_to_all_beats(self):
        """Test four chords map to beats 1, 2, 3, 4."""
        parser = BarNotationParser()
        bar_chords = parser._map_chords_to_beats(["Am", "F", "C", "G"])

        assert len(bar_chords) == 4
        for i in range(4):
            assert bar_chords[i].beat_position.beat == i + 1
            assert bar_chords[i].beat_position.subdivision == 0

    def test_five_chords_use_subdivisions(self):
        """Test five chords use beat subdivisions."""
        parser = BarNotationParser()
        bar_chords = parser._map_chords_to_beats(["Am", "F", "C", "G", "Dm"])

        assert len(bar_chords) == 5
        # Exact positions depend on implementation
        # Just verify they all have valid beat/subdivision
        for chord in bar_chords:
            assert 1 <= chord.beat_position.beat <= 4
            assert 0 <= chord.beat_position.subdivision <= 3

    def test_eight_chords_eighth_note_grid(self):
        """Test eight chords use eighth note grid."""
        parser = BarNotationParser()
        bar_chords = parser._map_chords_to_beats(
            ["Am", "F", "C", "G", "Dm", "Em", "Am7", "G7"]
        )

        assert len(bar_chords) == 8
        # All should be on beats 1-4 with subdivisions
        for chord in bar_chords:
            assert 1 <= chord.beat_position.beat <= 4


class TestFullParsing:
    """Test full text parsing to SongInput."""

    def test_parse_simple_bar_notation(self):
        """Test parsing simple bar notation text."""
        text = """
| Am | F | C | G |
"""
        parser = BarNotationParser()
        song = parser.parse(text)

        assert len(song.sections) == 1
        assert len(song.sections[0].bars) == 4

    def test_parse_with_section_headers(self):
        """Test parsing with section headers."""
        text = """
[intro]
| Am | F |

[verse]
| C | G | Am | F |
"""
        parser = BarNotationParser()
        song = parser.parse(text)

        assert len(song.sections) == 2
        assert song.sections[0].name == "intro"
        assert len(song.sections[0].bars) == 2
        assert song.sections[1].name == "verse"
        assert len(song.sections[1].bars) == 4

    def test_parse_inline_section_content(self):
        """Test parsing inline section content (e.g., 'intro: | Gm7b5 |')."""
        text = """
intro: | Am | F |
verse: | C | G |
"""
        parser = BarNotationParser()
        song = parser.parse(text)

        assert len(song.sections) == 2
        assert song.sections[0].name == "intro"
        assert len(song.sections[0].bars) == 2
        assert song.sections[1].name == "verse"
        assert len(song.sections[1].bars) == 2

    def test_parse_multiple_bars_per_section(self):
        """Test parsing multiple bar lines per section."""
        text = """
[verse]
| Am | F | C | G |
| Am | F | C | G |
"""
        parser = BarNotationParser()
        song = parser.parse(text)

        assert len(song.sections) == 1
        assert song.sections[0].name == "verse"
        assert len(song.sections[0].bars) == 8

    def test_parse_complex_chord_symbols(self):
        """Test parsing complex chord symbols."""
        text = """
| Am7 | Fmaj7 | Cmaj7 | G7 |
| Dm7b5 | Gdim | Caug | Fsus4 |
"""
        parser = BarNotationParser()
        song = parser.parse(text)

        assert len(song.sections) == 1
        assert len(song.sections[0].bars) == 8
        # Verify chord symbols are preserved
        chords = [bar.content.chords[0].symbol for bar in song.sections[0].bars]
        assert "Am7" in chords
        assert "Fmaj7" in chords
        assert "Dm7b5" in chords


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_input_raises_error(self):
        """Test empty input raises ValueError."""
        parser = BarNotationParser()
        with pytest.raises(ValueError, match="Empty input text"):
            parser.parse("")

    def test_invalid_chord_symbol_raises_error(self):
        """Test invalid chord symbol raises ValueError."""
        parser = BarNotationParser()
        with pytest.raises(ValueError, match="Invalid chord symbol"):
            parser.parse_bar_line("| xyz | abc |")

    def test_empty_bar_line_raises_error(self):
        """Test empty bar line raises ValueError."""
        parser = BarNotationParser()
        with pytest.raises(ValueError, match="Empty bar line"):
            parser.parse_bar_line("")

    def test_no_bar_content_raises_error(self):
        """Test line with no bar content raises ValueError."""
        parser = BarNotationParser()
        with pytest.raises(ValueError, match="No bar content found"):
            parser.parse_bar_line("| |")

    def test_section_type_detection(self):
        """Test section type is correctly detected."""
        text = """
[intro]
| Am |

[verse]
| C |

[solo]
| G |
"""
        parser = BarNotationParser()
        song = parser.parse(text)

        assert song.sections[0].section_type == "instrumental"  # intro
        assert song.sections[1].section_type == "vocal"  # verse
        assert song.sections[2].section_type == "instrumental"  # solo


class TestRepeatMarkers:
    """Test repeat marker handling."""

    def test_repeat_markers_removed(self):
        """Test repeat markers are removed during parsing."""
        parser = BarNotationParser()
        bars = parser.parse_bar_line("|: Am | F :|")

        # Repeat markers should be stripped, leaving valid bars
        assert len(bars) == 2
        assert bars[0].content.chords[0].symbol == "Am"
        assert bars[1].content.chords[0].symbol == "F"

    def test_detect_bar_line_with_repeat_start(self):
        """Test detection of bar line with repeat start marker."""
        parser = BarNotationParser()
        assert parser.is_bar_notation_line("|: Am | F | C | G |")

    def test_detect_bar_line_with_repeat_end(self):
        """Test detection of bar line with repeat end marker."""
        parser = BarNotationParser()
        assert parser.is_bar_notation_line("| Am | F | C | G :|")
