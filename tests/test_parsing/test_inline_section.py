"""Tests for section headers with inline chord content (e.g., 'intro: | Gm7b5 |')."""

from caspian.parsing.input_parser import parse_format_a


class TestInlineSection:
    def test_intro_with_inline_chords(self):
        """'intro: | Gm7b5 | Fm/Ab |' should create an intro section with bars."""
        text = "intro: | Gm7b5 | Fm/Ab | Ebm | Bbm |"
        result = parse_format_a(text)
        assert len(result.sections) == 1
        assert result.sections[0].name == "intro"
        assert result.sections[0].section_type == "instrumental"
        # Bar notation now creates bars instead of flat chords
        assert len(result.sections[0].bars) == 4
        symbols = [bar.content.chords[0].symbol for bar in result.sections[0].bars]
        assert "Gm7b5" in symbols
        assert "Bbm" in symbols

    def test_verse_with_inline_chords(self):
        text = "Verse: Am Dm G C"
        result = parse_format_a(text)
        assert len(result.sections) == 1
        assert result.sections[0].name == "verse"
        symbols = [c.symbol for c in result.sections[0].chords]
        assert symbols == ["Am", "Dm", "G", "C"]

    def test_chorus_with_inline_chords(self):
        text = "Chorus: F G Am"
        result = parse_format_a(text)
        assert result.sections[0].name == "chorus"
        assert len(result.sections[0].chords) == 3

    def test_metadata_still_works(self):
        """Regular metadata like 'key: Am' should not be treated as a section."""
        text = "key: Am\n[verse]\nAm Dm"
        result = parse_format_a(text)
        assert result.key == "Am"
        assert len(result.sections) == 1
        assert result.sections[0].name == "verse"

    def test_intro_inline_then_verse(self):
        """Inline section followed by a regular section."""
        text = "intro: | Gm7b5 | Fm |\n[verse]\nAm Dm"
        result = parse_format_a(text)
        names = [s.name for s in result.sections]
        assert names == ["intro", "verse"]
        # Intro should have bars (bar notation), verse should have chords (no bar notation)
        assert len(result.sections[0].bars) == 2
        assert len(result.sections[1].chords) == 2

    def test_unknown_field_no_chords_skipped(self):
        """Unknown metadata fields without chords are skipped."""
        text = "capo: 3\n[verse]\nAm Dm"
        result = parse_format_a(text)
        assert len(result.sections) == 1
        assert result.sections[0].name == "verse"
