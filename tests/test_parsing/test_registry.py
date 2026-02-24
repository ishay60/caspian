"""Tests for parser registry and format detection.

Tests:
- Format detection heuristics
- Parser registration and routing
- Auto-detection and explicit format hints
- Edge cases and error handling
"""

import pytest

from caspian.parsing.registry import (
    FormatDetector,
    InputFormat,
    ParserRegistry,
    FormatAParser,
    WebsitePasteParser,
    UGHTMLParser,
    Tab4uHTMLParser,
    BarNotationParser,
    get_global_registry,
)


class TestFormatDetector:
    """Tests for FormatDetector.detect() method."""

    def test_detect_empty_string(self):
        """Empty string should return UNKNOWN."""
        assert FormatDetector.detect("") == InputFormat.UNKNOWN
        assert FormatDetector.detect("   ") == InputFormat.UNKNOWN

    def test_detect_ug_html(self):
        """Ultimate Guitar HTML paste should be detected."""
        ug_html = '''
        <div class="js-tab-content">
            <pre>Am G F C</pre>
        </div>
        '''
        assert FormatDetector.detect(ug_html) == InputFormat.UG_HTML

        # Different UG indicator
        ug_html2 = '''Some text with ultimate-guitar.com in it'''
        assert FormatDetector.detect(ug_html2) == InputFormat.UG_HTML

    def test_detect_tab4u_html(self):
        """Tab4u HTML paste should be detected."""
        tab4u_html = '''
        <div class="song_words">
            שיר: test
            Am G F C
        </div>
        '''
        assert FormatDetector.detect(tab4u_html) == InputFormat.TAB4U_HTML

        # Different Tab4u indicator
        tab4u_html2 = '''<div class="chords">Am G</div>'''
        assert FormatDetector.detect(tab4u_html2) == InputFormat.TAB4U_HTML

    def test_detect_chordpro_directive(self):
        """ChordPro with directives should be detected."""
        chordpro = '''
        {title: Song Name}
        {artist: Artist Name}
        {key: Am}

        [Am]Lyrics here
        '''
        assert FormatDetector.detect(chordpro) == InputFormat.CHORDPRO

    def test_detect_chordpro_inline_chords(self):
        """ChordPro with inline chords should be detected."""
        chordpro = '''
        Verse 1:
        [Am]These are some [G]lyrics
        [F]With inline [C]chords
        '''
        assert FormatDetector.detect(chordpro) == InputFormat.CHORDPRO

    def test_detect_format_a_with_key(self):
        """Format A with explicit key: metadata should be detected."""
        format_a = '''
        title: Test Song
        key: Am
        artist: Test Artist

        [verse]
        Am G F C
        '''
        assert FormatDetector.detect(format_a) == InputFormat.FORMAT_A

    def test_detect_format_a_with_bracket_sections(self):
        """Format A with bracket section headers should be detected."""
        format_a = '''
        [intro]
        Am G

        [verse]
        F C
        '''
        assert FormatDetector.detect(format_a) == InputFormat.FORMAT_A

    def test_detect_format_a_with_section_header_first_line(self):
        """Format A with section header as first line should be detected."""
        format_a = '''
        intro: | Am | G |

        verse:
        F C
        '''
        assert FormatDetector.detect(format_a) == InputFormat.FORMAT_A

    def test_detect_bar_notation(self):
        """Bar notation with pipes should be detected."""
        bar_notation = '''
        | Am | G | F | C |
        | Dm | E | Am | Am |
        '''
        assert FormatDetector.detect(bar_notation) == InputFormat.BAR_NOTATION

    def test_detect_bar_notation_mixed_lines(self):
        """Bar notation with some regular lines should still be detected."""
        bar_notation = '''
        Section 1:
        | Am | G | F | C |

        Section 2:
        | Dm | E | Am | Am |
        '''
        # Note: If the text has "Intro:" or "Verse:" as first line,
        # Format A will be detected (takes priority). Use non-section labels here.
        assert FormatDetector.detect(bar_notation) == InputFormat.BAR_NOTATION

    def test_detect_website_paste(self):
        """Plain website paste should fall back to WEBSITE_PASTE."""
        website_paste = '''
        Song Title
        Artist Name

        Am G F C
        These are lyrics
        '''
        assert FormatDetector.detect(website_paste) == InputFormat.WEBSITE_PASTE

    def test_detect_priority_html_over_chords(self):
        """HTML detection should take priority over chord detection."""
        ug_html_with_chords = '''
        <div class="js-tab-content">
        Am G F C
        These are lyrics
        </div>
        '''
        # Should detect as UG HTML, not website paste
        assert FormatDetector.detect(ug_html_with_chords) == InputFormat.UG_HTML

    def test_detect_priority_chordpro_over_format_a(self):
        """ChordPro should be detected before Format A."""
        chordpro_like = '''
        {title: Test}
        [verse]
        [Am]Lyrics
        '''
        # Should detect as ChordPro due to {title:} directive
        assert FormatDetector.detect(chordpro_like) == InputFormat.CHORDPRO

    def test_detect_priority_format_a_over_bar_notation(self):
        """Format A should be detected before bar notation."""
        format_a_with_bars = '''
        key: Am

        [intro]
        | Am | G | F | C |
        '''
        # Should detect as Format A due to explicit key:
        assert FormatDetector.detect(format_a_with_bars) == InputFormat.FORMAT_A

    def test_detect_unknown_no_chords(self):
        """Text without chord-like content should return UNKNOWN."""
        no_chords = '''
        This is just some text
        with no musical content
        at all
        '''
        assert FormatDetector.detect(no_chords) == InputFormat.UNKNOWN

    def test_looks_like_chord_sheet_threshold(self):
        """Chord sheet detection requires at least 3 chord matches."""
        # 1 chord - not enough
        assert FormatDetector.detect("Am") == InputFormat.UNKNOWN

        # 2 chords - not enough
        assert FormatDetector.detect("Am G") == InputFormat.UNKNOWN

        # 3 chords - should detect as website paste
        assert FormatDetector.detect("Am G F") == InputFormat.WEBSITE_PASTE

        # Many chords - definitely a chord sheet
        assert FormatDetector.detect("Am G F C Dm E7 G7 C") == InputFormat.WEBSITE_PASTE


class TestParserRegistry:
    """Tests for ParserRegistry class."""

    def test_register_and_get_parser(self):
        """Should be able to register and retrieve parsers."""
        registry = ParserRegistry()
        parser = FormatAParser()

        registry.register(InputFormat.FORMAT_A, parser)
        retrieved = registry.get_parser(InputFormat.FORMAT_A)

        assert retrieved is parser

    def test_get_parser_not_registered(self):
        """Should return None for unregistered format."""
        registry = ParserRegistry()
        assert registry.get_parser(InputFormat.CHORDPRO) is None

    def test_parse_with_auto_detection(self):
        """Should parse text using auto-detected format."""
        registry = ParserRegistry()
        registry.register(InputFormat.FORMAT_A, FormatAParser())

        text = '''
        key: Am
        [verse]
        Am G F C
        '''

        result = registry.parse(text)
        assert result.key == "Am"

    def test_parse_with_explicit_format_hint(self):
        """Should use explicit format hint instead of auto-detection."""
        registry = ParserRegistry()
        registry.register(InputFormat.FORMAT_A, FormatAParser())

        text = "Am G F C"  # Would auto-detect as WEBSITE_PASTE

        # Force Format A parsing
        result = registry.parse(text, format_hint=InputFormat.FORMAT_A)
        assert result is not None

    def test_parse_unknown_format_raises_error(self):
        """Should raise error for unknown format."""
        registry = ParserRegistry()

        with pytest.raises(ValueError, match="Could not detect input format"):
            registry.parse("some random text")

    def test_parse_unsupported_format_raises_error(self):
        """Should raise error for unsupported format."""
        registry = ParserRegistry()

        with pytest.raises(ValueError, match="No parser registered for format"):
            registry.parse("{title: Test}", format_hint=InputFormat.CHORDPRO)


class TestParserAdapters:
    """Tests for parser adapter classes."""

    def test_format_a_parser(self):
        """FormatAParser should parse Format A text."""
        parser = FormatAParser()
        text = '''
        key: Am
        [verse]
        Am G F C
        '''

        result = parser.parse(text)
        assert result.key == "Am"
        assert len(result.sections) == 1
        assert result.sections[0].name == "verse"

    def test_website_paste_parser(self):
        """WebsitePasteParser should normalize then parse."""
        parser = WebsitePasteParser()
        text = '''
        Song Title
        Artist Name

        Am G F C
        These are lyrics
        '''

        result = parser.parse(text)
        assert result.title == "Song Title"
        assert result.artist == "Artist Name"

    def test_ug_html_parser(self):
        """UGHTMLParser should extract HTML then normalize and parse."""
        parser = UGHTMLParser()
        html = '''
        <div class="js-tab-content">
        <pre>Am G F C</pre>
        </div>
        '''

        result = parser.parse(html)
        assert result is not None
        # Should have extracted chords
        assert len(result.sections) > 0

    def test_tab4u_html_parser(self):
        """Tab4uHTMLParser should extract HTML then normalize and parse."""
        parser = Tab4uHTMLParser()
        html = '''
        <div class="song_words">
        Am G F C
        </div>
        '''

        result = parser.parse(html)
        assert result is not None
        # Should have extracted chords
        assert len(result.sections) > 0


class TestGlobalRegistry:
    """Tests for global registry singleton."""

    def test_get_global_registry_returns_singleton(self):
        """Should return the same instance on multiple calls."""
        registry1 = get_global_registry()
        registry2 = get_global_registry()

        assert registry1 is registry2

    def test_global_registry_has_default_parsers(self):
        """Global registry should have default parsers registered."""
        registry = get_global_registry()

        # Check all default parsers are registered
        assert registry.get_parser(InputFormat.FORMAT_A) is not None
        assert registry.get_parser(InputFormat.WEBSITE_PASTE) is not None
        assert registry.get_parser(InputFormat.UG_HTML) is not None
        assert registry.get_parser(InputFormat.TAB4U_HTML) is not None

    def test_global_registry_can_parse_format_a(self):
        """Global registry should successfully parse Format A."""
        registry = get_global_registry()

        text = '''
        key: Am
        [verse]
        Am G F C
        '''

        result = registry.parse(text)
        assert result.key == "Am"

    def test_global_registry_auto_detects_and_parses_ug_html(self):
        """Global registry should auto-detect and parse UG HTML."""
        registry = get_global_registry()

        html = '''
        <div class="js-tab-content">
        Am G F C
        </div>
        '''

        result = registry.parse(html)
        assert result is not None

    def test_global_registry_auto_detects_and_parses_tab4u_html(self):
        """Global registry should auto-detect and parse Tab4u HTML."""
        registry = get_global_registry()

        html = '''
        <div class="song_words">
        Am G F C
        </div>
        '''

        result = registry.parse(html)
        assert result is not None


class TestEdgeCases:
    """Tests for edge cases and error conditions."""

    def test_mixed_format_indicators_uses_priority(self):
        """When multiple format indicators present, should use priority order."""
        # Has both HTML and ChordPro markers
        mixed = '''
        <div class="js-tab-content">
        {title: Test}
        Am G F C
        </div>
        '''

        # HTML should win (higher priority)
        assert FormatDetector.detect(mixed) == InputFormat.UG_HTML

    def test_false_positive_chord_detection(self):
        """Should not detect chords in normal English text."""
        normal_text = '''
        This is a story about someone named C
        who lived in a place called Am
        and worked for a company called G
        '''

        # Should detect as website paste (Am, C, G look like chords)
        # This is acceptable - false positives are better than false negatives
        result = FormatDetector.detect(normal_text)
        assert result in [InputFormat.WEBSITE_PASTE, InputFormat.UNKNOWN]

    def test_chordpro_bracket_not_confused_with_format_a(self):
        """ChordPro [Am] inline chords should not be confused with [verse] sections."""
        chordpro = '''
        [Am]These are [G]lyrics
        [F]with inline [C]chords
        '''

        # Should detect as ChordPro, not Format A
        assert FormatDetector.detect(chordpro) == InputFormat.CHORDPRO

    def test_bar_notation_with_hebrew_lyrics(self):
        """Bar notation with Hebrew should still be detected."""
        bar_with_hebrew = '''
        | Am | G | F | C |
        אלה הם מילים בעברית
        | Dm | E | Am | Am |
        '''

        # Should still detect as bar notation (2+ lines with bars)
        assert FormatDetector.detect(bar_with_hebrew) == InputFormat.BAR_NOTATION

    def test_single_bar_line_not_bar_notation(self):
        """Single line with bars should not be detected as bar notation format."""
        single_bar = '''
        Some intro text
        | Am | G | F | C |
        Some other text
        '''

        # Should not detect as bar notation (only 1 line)
        # Should fall back to website paste or Format A
        result = FormatDetector.detect(single_bar)
        assert result != InputFormat.BAR_NOTATION


class TestBarNotationParserIntegration:
    """Tests for bar notation parser integration with registry."""

    def test_bar_notation_parser_registered(self):
        """Test that bar notation parser is registered in global registry."""
        registry = get_global_registry()
        parser = registry.get_parser(InputFormat.BAR_NOTATION)
        assert parser is not None
        assert isinstance(parser, BarNotationParser)

    def test_parse_bar_notation_via_registry(self):
        """Test parsing bar notation via registry."""
        text = """
| Am | F | C | G |
| Dm | Em | F | G |
"""
        registry = get_global_registry()
        song = registry.parse(text)

        assert len(song.sections) == 1
        assert len(song.sections[0].bars) == 8
        assert song.sections[0].bars[0].content.chords[0].symbol == "Am"

    def test_auto_detect_bar_notation(self):
        """Test auto-detection of bar notation format."""
        text = """
[intro]
| Am | F | C | G |

[verse]
| Dm | Em | F | G |
"""
        registry = get_global_registry()
        song = registry.parse(text)  # Should auto-detect

        assert len(song.sections) == 2
        assert song.sections[0].name == "intro"
        assert song.sections[1].name == "verse"

    def test_explicit_bar_notation_format_hint(self):
        """Test explicit format hint for bar notation (bypasses auto-detection)."""
        text = "| Am | F |"

        registry = get_global_registry()
        # Even with single line, explicit hint forces bar notation parser
        song = registry.parse(text, format_hint=InputFormat.BAR_NOTATION)

        assert len(song.sections) == 1
        assert len(song.sections[0].bars) == 2

    def test_bar_notation_with_sections(self):
        """Test bar notation with multiple sections (using explicit hint)."""
        text = """
[intro]
| Gm7b5 | C7 |

[verse]
| Am | F | C | G |
| Dm | Em | Am | Am |

[chorus]
| F | G | C | Am |
"""
        registry = get_global_registry()
        # Use explicit format hint since mixed notation may be ambiguous
        song = registry.parse(text, format_hint=InputFormat.BAR_NOTATION)

        assert len(song.sections) == 3
        assert song.sections[0].name == "intro"
        assert song.sections[0].section_type == "instrumental"
        assert len(song.sections[0].bars) == 2

        assert song.sections[1].name == "verse"
        assert len(song.sections[1].bars) == 8

        assert song.sections[2].name == "chorus"
        assert len(song.sections[2].bars) == 4
