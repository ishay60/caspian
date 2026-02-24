"""Tests for ChordPro format parser.

Phase 3.4: ChordPro Format Support
"""

import pytest

from caspian.models.input import ChordLyricsLine, SectionInput, SongInput
from caspian.parsing.chord_pro_parser import ChordProParser


class TestMetadataParsing:
    """Test metadata directive parsing."""

    def test_parse_title_directive(self):
        """Test parsing title directive."""
        text = "{title: Let It Be}"
        parser = ChordProParser()
        song = parser.parse(text)

        assert song.title == "Let It Be"

    def test_parse_short_form_title(self):
        """Test parsing short form title directive."""
        text = "{t: Let It Be}"
        parser = ChordProParser()
        song = parser.parse(text)

        assert song.title == "Let It Be"

    def test_parse_artist_directive(self):
        """Test parsing artist directive."""
        text = "{artist: The Beatles}"
        parser = ChordProParser()
        song = parser.parse(text)

        assert song.artist == "The Beatles"

    def test_parse_short_form_artist(self):
        """Test parsing short form artist directive."""
        text = "{a: The Beatles}"
        parser = ChordProParser()
        song = parser.parse(text)

        assert song.artist == "The Beatles"

    def test_parse_key_directive(self):
        """Test parsing key directive."""
        text = "{key: C}"
        parser = ChordProParser()
        song = parser.parse(text)

        assert song.key == "C"

    def test_parse_multiple_metadata(self):
        """Test parsing multiple metadata directives."""
        text = """
{title: Let It Be}
{artist: The Beatles}
{key: C}
"""
        parser = ChordProParser()
        song = parser.parse(text)

        assert song.title == "Let It Be"
        assert song.artist == "The Beatles"
        assert song.key == "C"

    def test_parse_metadata_with_whitespace(self):
        """Test parsing metadata with extra whitespace."""
        text = "{  title  :  Let It Be  }"
        parser = ChordProParser()
        song = parser.parse(text)

        assert song.title == "Let It Be"

    def test_parse_case_insensitive_directives(self):
        """Test that directives are case-insensitive."""
        text = """
{TITLE: Let It Be}
{Artist: The Beatles}
{KEY: C}
"""
        parser = ChordProParser()
        song = parser.parse(text)

        assert song.title == "Let It Be"
        assert song.artist == "The Beatles"
        assert song.key == "C"


class TestInlineChordParsing:
    """Test inline chord notation parsing."""

    def test_parse_single_chord(self):
        """Test parsing line with single chord."""
        text = "[C]Hello"
        parser = ChordProParser()
        song = parser.parse(text)

        assert len(song.sections) == 1
        assert len(song.sections[0].lines) == 1
        line = song.sections[0].lines[0]
        assert len(line.chords) == 1
        assert line.chords[0] == (0, "C")
        assert line.lyrics == "Hello"

    def test_parse_multiple_chords(self):
        """Test parsing line with multiple chords."""
        text = "[Am]When I find my[F]self in [C]times of [G]trouble"
        parser = ChordProParser()
        song = parser.parse(text)

        line = song.sections[0].lines[0]
        assert len(line.chords) == 4
        assert line.chords[0] == (0, "Am")
        # "When I find my" = 14 chars
        assert line.chords[1] == (14, "F")
        # "When I find myself in " = 22 chars
        assert line.chords[2] == (22, "C")
        # "When I find myself in times of " = 31 chars
        assert line.chords[3] == (31, "G")
        assert line.lyrics == "When I find myself in times of trouble"

    def test_parse_chord_at_word_boundary(self):
        """Test parsing chord at word boundary."""
        text = "When I [C]find myself"
        parser = ChordProParser()
        song = parser.parse(text)

        line = song.sections[0].lines[0]
        assert line.chords[0] == (7, "C")
        assert line.lyrics == "When I find myself"

    def test_parse_consecutive_chords(self):
        """Test parsing consecutive chords without lyrics between."""
        text = "[Am][F][C][G]"
        parser = ChordProParser()
        song = parser.parse(text)

        line = song.sections[0].lines[0]
        assert len(line.chords) == 4
        assert line.chords[0] == (0, "Am")
        assert line.chords[1] == (0, "F")
        assert line.chords[2] == (0, "C")
        assert line.chords[3] == (0, "G")
        assert line.lyrics == ""

    def test_parse_complex_chord_symbols(self):
        """Test parsing complex chord symbols."""
        text = "[Am7]verse [Fmaj7]one [Dm7b5]testing [G7/B]slash"
        parser = ChordProParser()
        song = parser.parse(text)

        line = song.sections[0].lines[0]
        assert line.chords[0][1] == "Am7"
        assert line.chords[1][1] == "Fmaj7"
        assert line.chords[2][1] == "Dm7b5"
        assert line.chords[3][1] == "G7/B"

    def test_parse_chords_with_accidentals(self):
        """Test parsing chords with sharps and flats."""
        text = "[C#m]sharp [Bb]flat [F#7]sharp [Ebm7]flat"
        parser = ChordProParser()
        song = parser.parse(text)

        line = song.sections[0].lines[0]
        assert line.chords[0][1] == "C#m"
        assert line.chords[1][1] == "Bb"
        assert line.chords[2][1] == "F#7"
        assert line.chords[3][1] == "Ebm7"


class TestSectionMarkers:
    """Test section marker handling."""

    def test_parse_chorus_start(self):
        """Test parsing chorus start marker."""
        text = """
{start_of_chorus}
[C]Mother Mary [G]comes to me
{end_of_chorus}
"""
        parser = ChordProParser()
        song = parser.parse(text)

        assert len(song.sections) == 1
        assert song.sections[0].name == "chorus"
        assert song.sections[0].section_type == "vocal"

    def test_parse_chorus_short_form(self):
        """Test parsing chorus short form markers."""
        text = """
{soc}
[C]Mother Mary [G]comes to me
{eoc}
"""
        parser = ChordProParser()
        song = parser.parse(text)

        assert len(song.sections) == 1
        assert song.sections[0].name == "chorus"

    def test_parse_verse_markers(self):
        """Test parsing verse markers."""
        text = """
{start_of_verse}
[Am]When I find myself
{end_of_verse}
"""
        parser = ChordProParser()
        song = parser.parse(text)

        assert len(song.sections) == 1
        assert song.sections[0].name == "verse"

    def test_parse_numbered_section(self):
        """Test parsing numbered section (e.g., verse 2)."""
        text = """
{start_of_verse: 2}
[Am]Second verse
{end_of_verse}
"""
        parser = ChordProParser()
        song = parser.parse(text)

        assert len(song.sections) == 1
        assert song.sections[0].name == "verse 2"

    def test_parse_bridge_markers(self):
        """Test parsing bridge markers."""
        text = """
{start_of_bridge}
[F]Middle eight
{end_of_bridge}
"""
        parser = ChordProParser()
        song = parser.parse(text)

        assert len(song.sections) == 1
        assert song.sections[0].name == "bridge"

    def test_parse_instrumental_section(self):
        """Test parsing instrumental section (tab)."""
        text = """
{start_of_tab}
[C][G][Am][F]
{end_of_tab}
"""
        parser = ChordProParser()
        song = parser.parse(text)

        assert len(song.sections) == 1
        assert song.sections[0].name == "instrumental"
        assert song.sections[0].section_type == "instrumental"

    def test_parse_multiple_sections(self):
        """Test parsing multiple sections."""
        text = """
{start_of_verse}
[Am]Verse line
{end_of_verse}

{start_of_chorus}
[C]Chorus line
{end_of_chorus}

{start_of_bridge}
[F]Bridge line
{end_of_bridge}
"""
        parser = ChordProParser()
        song = parser.parse(text)

        assert len(song.sections) == 3
        assert song.sections[0].name == "verse"
        assert song.sections[1].name == "chorus"
        assert song.sections[2].name == "bridge"


class TestCommentHandling:
    """Test comment handling."""

    def test_ignore_hash_comments(self):
        """Test that hash comments are ignored."""
        text = """
# This is a comment
[C]Hello
# Another comment
"""
        parser = ChordProParser()
        song = parser.parse(text)

        assert len(song.sections) == 1
        assert len(song.sections[0].lines) == 1

    def test_ignore_comment_directive(self):
        """Test that comment directives are ignored."""
        text = """
{comment: This is a comment}
[C]Hello
"""
        parser = ChordProParser()
        song = parser.parse(text)

        assert len(song.sections) == 1
        assert len(song.sections[0].lines) == 1

    def test_ignore_short_form_comment(self):
        """Test that short form comment directives are ignored."""
        text = """
{c: This is a comment}
[C]Hello
"""
        parser = ChordProParser()
        song = parser.parse(text)

        assert len(song.sections) == 1
        assert len(song.sections[0].lines) == 1


class TestFullSongParsing:
    """Test parsing complete songs."""

    def test_parse_complete_song(self):
        """Test parsing a complete song with metadata and sections."""
        text = """
{title: Let It Be}
{artist: The Beatles}
{key: C}

{start_of_verse}
[C]When I [G]find myself in [Am]times of [F]trouble
[C]Mother [G]Mary [F]comes to [C]me
{end_of_verse}

{start_of_chorus}
[Am]Let it [G]be, let it [F]be, let it [C]be
{end_of_chorus}
"""
        parser = ChordProParser()
        song = parser.parse(text)

        # Check metadata
        assert song.title == "Let It Be"
        assert song.artist == "The Beatles"
        assert song.key == "C"

        # Check sections
        assert len(song.sections) == 2
        assert song.sections[0].name == "verse"
        assert song.sections[1].name == "chorus"

        # Check content
        assert len(song.sections[0].lines) == 2
        assert len(song.sections[1].lines) == 1

    def test_parse_song_without_sections(self):
        """Test parsing song without explicit section markers."""
        text = """
{title: Simple Song}
[C]Line one
[G]Line two
[Am]Line three
"""
        parser = ChordProParser()
        song = parser.parse(text)

        assert song.title == "Simple Song"
        assert len(song.sections) == 1
        assert song.sections[0].name == "section_1"
        assert len(song.sections[0].lines) == 3

    def test_parse_song_with_mixed_content(self):
        """Test parsing song with mixed metadata, sections, and lyrics."""
        text = """
{title: Mixed Content}
{artist: Test Artist}

# Verse section
{sov}
[Am]First line
[F]Second line
{eov}

# Chorus section
{soc}
[C]Chorus line
[G]Chorus line two
{eoc}
"""
        parser = ChordProParser()
        song = parser.parse(text)

        assert song.title == "Mixed Content"
        assert song.artist == "Test Artist"
        assert len(song.sections) == 2


class TestChordLyricsAlignment:
    """Test chord-lyrics alignment."""

    def test_chord_at_start(self):
        """Test chord at start of lyrics."""
        text = "[C]Hello world"
        parser = ChordProParser()
        song = parser.parse(text)

        line = song.sections[0].lines[0]
        assert line.chords[0] == (0, "C")
        assert line.lyrics == "Hello world"

    def test_chord_in_middle(self):
        """Test chord in middle of lyrics."""
        text = "Hello [C]world"
        parser = ChordProParser()
        song = parser.parse(text)

        line = song.sections[0].lines[0]
        assert line.chords[0] == (6, "C")
        assert line.lyrics == "Hello world"

    def test_chord_at_end(self):
        """Test chord at end of lyrics."""
        text = "Hello world[C]"
        parser = ChordProParser()
        song = parser.parse(text)

        line = song.sections[0].lines[0]
        assert line.chords[0] == (11, "C")
        assert line.lyrics == "Hello world"

    def test_multiple_chords_alignment(self):
        """Test alignment of multiple chords."""
        text = "[Am]When I [F]find my[C]self"
        parser = ChordProParser()
        song = parser.parse(text)

        line = song.sections[0].lines[0]
        # "When I " = 7 chars (0-6), chord at position 0
        # "find my" = 7 more chars (7-13), chord at position 7
        # "self" = 4 more chars, chord at position 14
        assert line.chords[0] == (0, "Am")
        assert line.chords[1] == (7, "F")
        assert line.chords[2] == (14, "C")
        assert line.lyrics == "When I find myself"


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_input_raises_error(self):
        """Test empty input raises ValueError."""
        parser = ChordProParser()
        with pytest.raises(ValueError, match="Empty input text"):
            parser.parse("")

    def test_whitespace_only_input_raises_error(self):
        """Test whitespace-only input raises ValueError."""
        parser = ChordProParser()
        with pytest.raises(ValueError, match="Empty input text"):
            parser.parse("   \n\n   ")

    def test_only_metadata_creates_empty_sections(self):
        """Test that metadata-only input creates empty section list."""
        text = """
{title: Metadata Only}
{artist: Test}
"""
        parser = ChordProParser()
        song = parser.parse(text)

        assert song.title == "Metadata Only"
        assert song.artist == "Test"
        assert len(song.sections) == 0

    def test_unknown_directives_ignored(self):
        """Test that unknown directives are ignored."""
        text = """
{unknown_directive: value}
{x_custom: custom value}
[C]Hello
"""
        parser = ChordProParser()
        song = parser.parse(text)

        # Should not crash, just ignore unknown directives
        assert len(song.sections) == 1
        assert len(song.sections[0].lines) == 1

    def test_malformed_directive_treated_as_lyrics(self):
        """Test that malformed directives are treated as lyrics."""
        text = """
{no_colon}
[C]Hello
"""
        parser = ChordProParser()
        song = parser.parse(text)

        # Malformed directive should be ignored (no crash)
        assert len(song.sections) == 1

    def test_empty_lines_ignored(self):
        """Test that empty lines are ignored."""
        text = """

{title: Test}


[C]Hello

"""
        parser = ChordProParser()
        song = parser.parse(text)

        assert song.title == "Test"
        assert len(song.sections) == 1
        assert len(song.sections[0].lines) == 1

    def test_line_without_chords_ignored(self):
        """Test that lines without chords are ignored."""
        text = """
[C]Line with chord
Line without chord
[G]Another chord line
"""
        parser = ChordProParser()
        song = parser.parse(text)

        # Only lines with chords should be parsed
        assert len(song.sections[0].lines) == 2


class TestChordProFormatDetection:
    """Test ChordPro format detection in registry."""

    def test_detect_title_directive(self):
        """Test detection of ChordPro via title directive."""
        from caspian.parsing.registry import FormatDetector, InputFormat

        text = "{title: Test Song}"
        assert FormatDetector.detect(text) == InputFormat.CHORDPRO

    def test_detect_key_directive(self):
        """Test detection of ChordPro via key directive."""
        from caspian.parsing.registry import FormatDetector, InputFormat

        text = "{key: Am}"
        assert FormatDetector.detect(text) == InputFormat.CHORDPRO

    def test_detect_section_marker(self):
        """Test detection of ChordPro via section marker."""
        from caspian.parsing.registry import FormatDetector, InputFormat

        text = "{start_of_chorus}"
        assert FormatDetector.detect(text) == InputFormat.CHORDPRO

    def test_detect_inline_chord(self):
        """Test detection of ChordPro via inline chord notation."""
        from caspian.parsing.registry import FormatDetector, InputFormat

        text = "[Am]When I find myself"
        assert FormatDetector.detect(text) == InputFormat.CHORDPRO

    def test_detect_short_form_directive(self):
        """Test detection of ChordPro via short form directive."""
        from caspian.parsing.registry import FormatDetector, InputFormat

        text = "{soc}"
        assert FormatDetector.detect(text) == InputFormat.CHORDPRO


class TestRegistryIntegration:
    """Test integration with global registry."""

    def test_registry_routes_to_chordpro_parser(self):
        """Test that registry correctly routes ChordPro format."""
        from caspian.parsing.registry import get_global_registry, InputFormat

        text = """
{title: Test Song}
{artist: Test Artist}
[C]Hello world
"""
        registry = get_global_registry()
        song = registry.parse(text, format_hint=InputFormat.CHORDPRO)

        assert song.title == "Test Song"
        assert song.artist == "Test Artist"
        assert len(song.sections) == 1

    def test_registry_auto_detects_chordpro(self):
        """Test that registry auto-detects ChordPro format."""
        from caspian.parsing.registry import get_global_registry

        text = """
{title: Auto Detect}
[C]Hello world
"""
        registry = get_global_registry()
        song = registry.parse(text)  # No format hint

        assert song.title == "Auto Detect"
        assert len(song.sections) == 1
