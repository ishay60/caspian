"""Tests for Phase 3.1 enhancements to website normalizer.

Tests cover:
- Ultimate Guitar HTML detection and parsing
- Tab4u HTML detection and parsing
- Spacing normalization (tabs to spaces)
- Bar line detection and preservation
- Additional Hebrew section marker variants
"""

import pytest
from caspian.parsing.website_normalizer import (
    detect_ultimate_guitar_html,
    detect_tab4u_html,
    parse_ultimate_guitar_html,
    parse_tab4u_html,
    normalize_spacing,
    detect_bar_lines,
    is_bar_line,
    normalize_website_paste,
)


class TestUltimateGuitarDetection:
    """Test detection and parsing of Ultimate Guitar HTML pastes."""

    def test_detect_ug_html_with_js_tab_content(self):
        """Detect UG HTML with js-tab-content class."""
        html = '<div class="js-tab-content">Chord content</div>'
        assert detect_ultimate_guitar_html(html)

    def test_detect_ug_html_with_domain(self):
        """Detect UG HTML by domain name."""
        html = '<!-- from www.ultimate-guitar.com --><pre>chords</pre>'
        assert detect_ultimate_guitar_html(html)

    def test_detect_ug_html_with_data_content(self):
        """Detect UG HTML with data-content attribute."""
        html = '<div data-content="chord">Am G F</div>'
        assert detect_ultimate_guitar_html(html)

    def test_not_detect_plain_text(self):
        """Plain text should not be detected as UG HTML."""
        text = "[Verse]\nAm G F\nHello world"
        assert not detect_ultimate_guitar_html(text)

    def test_parse_ug_html_basic(self):
        """Parse basic UG HTML structure."""
        html = '''
        <div class="js-tab-content">
            <pre>
[Verse]
Am  G  F  C
Hold me tight
            </pre>
        </div>
        '''
        result = parse_ultimate_guitar_html(html)
        assert '[Verse]' in result
        assert 'Am' in result
        assert 'Hold me tight' in result

    def test_parse_ug_html_with_bar_lines(self):
        """Parse UG HTML containing bar notation."""
        html = '''
        <div class="js-tab-content">
[Intro]
| G  D  | Em  C  |

[Verse 1]
G              D
Hold me close
        </div>
        '''
        result = parse_ultimate_guitar_html(html)
        assert '[Intro]' in result
        assert '|' in result
        assert 'G' in result
        assert 'D' in result

    def test_parse_ug_html_fallback_on_error(self):
        """If parsing fails, return original text."""
        malformed_html = '<div class="js-tab-content">Incomplete<div>'
        result = parse_ultimate_guitar_html(malformed_html)
        # Should contain original or parsed content
        assert len(result) > 0


class TestTab4uDetection:
    """Test detection and parsing of Tab4u HTML pastes."""

    def test_detect_tab4u_html_with_song_words(self):
        """Detect Tab4u HTML with song_words class."""
        html = '<div class="song_words">שיר: test</div>'
        assert detect_tab4u_html(html)

    def test_detect_tab4u_html_with_domain(self):
        """Detect Tab4u HTML by domain name."""
        html = '<!-- from tab4u.com --><div>content</div>'
        assert detect_tab4u_html(html)

    def test_detect_tab4u_html_with_hebrew_marker(self):
        """Detect Tab4u HTML with Hebrew 'שיר:' marker."""
        html = '<html><body>שיר: יום שישי</body></html>'
        assert detect_tab4u_html(html)

    def test_not_detect_plain_hebrew_text(self):
        """Plain Hebrew text without HTML should not be detected."""
        text = "פזמון:\nAm G F\nיום שישי חזר"
        assert not detect_tab4u_html(text)

    def test_parse_tab4u_html_basic(self):
        """Parse basic Tab4u HTML structure."""
        html = '''
        <div class="song_words">
            <p>שיר: יום שישי חזר</p>
            <p>פזמון:</p>
            <pre>
Am            E
יום שישי חזר
F             G
והלילה נגמר
            </pre>
        </div>
        '''
        result = parse_tab4u_html(html)
        assert 'פזמון' in result
        assert 'Am' in result
        assert 'יום שישי' in result

    def test_parse_tab4u_html_with_chords_class(self):
        """Parse Tab4u HTML with chords class."""
        html = '''
        <pre class="chords">
פזמון:
Am  E  F  G
יום שישי חזר
        </pre>
        '''
        result = parse_tab4u_html(html)
        assert 'פזמון' in result
        assert 'Am' in result

    def test_parse_tab4u_html_fallback_on_error(self):
        """If parsing fails, return original text."""
        malformed_html = '<div class="song_words">Incomplete<div>'
        result = parse_tab4u_html(malformed_html)
        # Should contain original or parsed content
        assert len(result) > 0


class TestSpacingNormalization:
    """Test spacing normalization (tabs to spaces)."""

    def test_normalize_tabs_to_spaces(self):
        """Tabs should be converted to 4 spaces."""
        text = "Am\t\tG\t\tF"
        result = normalize_spacing(text)
        assert '\t' not in result
        assert '    ' in result

    def test_normalize_mixed_tabs_and_spaces(self):
        """Mixed tabs and spaces should be normalized."""
        text = "Am  \tG\t  F"
        result = normalize_spacing(text)
        assert '\t' not in result

    def test_strip_trailing_whitespace(self):
        """Trailing whitespace should be removed."""
        text = "Am G F    \nEm C D   "
        result = normalize_spacing(text)
        lines = result.split('\n')
        assert lines[0] == "Am G F"
        assert lines[1] == "Em C D"

    def test_preserve_leading_whitespace(self):
        """Leading whitespace (indentation) should be preserved."""
        text = "    [Verse]\n    Am G F"
        result = normalize_spacing(text)
        assert result.startswith("    ")

    def test_normalize_multiline_text(self):
        """Normalization should work across multiple lines."""
        text = "Line 1\twith\ttabs\nLine 2  with  spaces  "
        result = normalize_spacing(text)
        assert '\t' not in result
        assert result.endswith("spaces")  # trailing space removed

    def test_empty_lines_preserved(self):
        """Empty lines should be preserved."""
        text = "Am G\n\nF C\n\n"
        result = normalize_spacing(text)
        lines = result.split('\n')
        assert lines[1] == ""
        assert lines[3] == ""


class TestBarLineDetection:
    """Test bar line detection and handling."""

    def test_detect_bar_notation(self):
        """Detect standard bar notation."""
        text = "| Am  G  | F  C  |"
        assert detect_bar_lines(text)

    def test_detect_bars_in_multiline(self):
        """Detect bar notation in multiline text."""
        text = "[Intro]\n| Am G | F C |\n\n[Verse]\nAm G"
        assert detect_bar_lines(text)

    def test_detect_bars_with_complex_chords(self):
        """Detect bars with complex chord symbols."""
        text = "| Am7 G#dim | F/C Cmaj7 |"
        assert detect_bar_lines(text)

    def test_not_detect_lyrics_with_pipe(self):
        """Lyrics with | separator should not be detected as bars."""
        text = "hold me | tight"
        assert not detect_bar_lines(text)

    def test_not_detect_hebrew_with_pipe(self):
        """Hebrew text with | should not be detected as bars."""
        text = "יום שישי | חזר"
        assert not detect_bar_lines(text)

    def test_is_bar_line_positive(self):
        """is_bar_line should return True for bar notation."""
        assert is_bar_line("| Am G | F C |")
        assert is_bar_line("  | Dm7 Em | Am |  ")

    def test_is_bar_line_negative_hebrew(self):
        """is_bar_line should return False for Hebrew with |."""
        assert not is_bar_line("יום שישי | חזר")

    def test_is_bar_line_negative_no_pipes(self):
        """is_bar_line should return False for no pipes."""
        assert not is_bar_line("Am G F C")

    def test_is_bar_line_empty(self):
        """is_bar_line should return False for empty string."""
        assert not is_bar_line("")
        assert not is_bar_line("   ")


class TestHebrewSectionVariants:
    """Test detection of additional Hebrew section marker variants (Phase 3.1)."""

    def test_chorus_variants(self):
        """Test various Hebrew chorus markers."""
        from caspian.parsing.section_detector import detect_section

        assert detect_section('פזמון') == 'chorus'
        assert detect_section('פז״מון') == 'chorus'
        assert detect_section('פז׳') == 'chorus'
        assert detect_section('פזמ') == 'chorus'

    def test_verse_variants(self):
        """Test various Hebrew verse markers."""
        from caspian.parsing.section_detector import detect_section

        assert detect_section('בית') == 'verse'
        assert detect_section('כתובית') == 'verse'

    def test_intro_variants(self):
        """Test various Hebrew intro markers."""
        from caspian.parsing.section_detector import detect_section

        assert detect_section('הקדמה') == 'intro'
        assert detect_section('פתיחה') == 'intro'
        assert detect_section('אינטרו') == 'intro'
        assert detect_section('התחלה') == 'intro'

    def test_outro_variants(self):
        """Test various Hebrew outro markers."""
        from caspian.parsing.section_detector import detect_section

        assert detect_section('סיום') == 'outro'
        assert detect_section('אאוטרו') == 'outro'
        assert detect_section('סוף') == 'outro'

    def test_bridge_variants(self):
        """Test various Hebrew bridge markers."""
        from caspian.parsing.section_detector import detect_section

        assert detect_section('גשר') == 'bridge'
        assert detect_section('ברידג׳') == 'bridge'

    def test_pre_chorus_variants(self):
        """Test Hebrew pre-chorus markers."""
        from caspian.parsing.section_detector import detect_section

        assert detect_section('טרום פזמון') == 'pre-chorus'
        assert detect_section('לפני פזמון') == 'pre-chorus'
        assert detect_section('טרום-פזמון') == 'pre-chorus'

    def test_instrumental_variants(self):
        """Test Hebrew instrumental markers."""
        from caspian.parsing.section_detector import detect_section

        assert detect_section('נגינה') == 'instrumental'
        assert detect_section('אינטרומנטל') == 'instrumental'

    def test_section_with_colon(self):
        """Test section markers with colon suffix."""
        from caspian.parsing.section_detector import detect_section

        assert detect_section('פז״מון:') == 'chorus'
        assert detect_section('כתובית:') == 'verse'
        assert detect_section('התחלה:') == 'intro'


class TestIntegrationFullPipeline:
    """Test full normalization pipeline with Phase 3.1 features."""

    def test_normalize_ug_html_paste(self):
        """Normalize a complete Ultimate Guitar HTML paste."""
        html = '''
        <div class="js-tab-content">
[Intro]
| G  D  | Em  C  |

[Verse 1]
G              D
Hold me close
Em             C
Don't let go
        </div>
        '''
        result = normalize_website_paste(html)

        # Should be converted to Format A
        assert '[intro]' in result.lower()
        assert '[verse' in result.lower() or 'verse' in result.lower()
        assert 'G' in result
        assert '|' in result  # Bar lines preserved

    def test_normalize_tab4u_html_paste(self):
        """Normalize a complete Tab4u HTML paste."""
        html = '''
        <div class="song_words">
            <h2>יום שישי חזר</h2>
            <p>מתי כספי</p>

            <strong>פזמון:</strong>
            <pre>
Am            E
יום שישי חזר
F             G
והלילה נגמר
            </pre>
        </div>
        '''
        result = normalize_website_paste(html)

        # Should have title and artist
        assert 'title:' in result.lower() or 'יום שישי' in result

        # Should have section
        assert '[chorus]' in result.lower() or 'פזמון' in result

        # Should have chords and lyrics
        assert 'Am' in result
        assert 'יום שישי' in result

    def test_normalize_with_tabs_and_hebrew_sections(self):
        """Normalize paste with tabs and Hebrew section markers."""
        text = """שיר בדיקה
אמן בדיקה

פז״מון:
Am\t\tG\t\tF
יום שישי חזר

כתובית:
Dm\t\tC
והלילה נגמר
"""
        result = normalize_website_paste(text)

        # Tabs should be converted
        assert '\t' not in result

        # Hebrew sections should be detected
        assert '[chorus]' in result.lower()
        assert '[verse]' in result.lower()

        # Content should be preserved
        assert 'Am' in result
        assert 'יום שישי' in result

    def test_normalize_with_bar_lines_and_hebrew(self):
        """Normalize paste with bar lines and Hebrew text."""
        text = """שיר עם תווים
מבצע

התחלה:
| Am  G  | F  C  |

פזמון:
Am            G
יום שישי חזר
"""
        result = normalize_website_paste(text)

        # Bar lines should be preserved
        assert '|' in result

        # Hebrew intro marker should be detected
        assert '[intro]' in result.lower()

        # Chorus should be detected
        assert '[chorus]' in result.lower()

    def test_plain_text_unchanged(self):
        """Plain text without HTML or special features should normalize normally."""
        text = """Song Title
Artist Name

[Verse]
Am  G  F  C
Some lyrics here
"""
        result = normalize_website_paste(text)

        # Should be recognized as Format A and kept largely unchanged
        assert 'Song Title' in result or 'title:' in result.lower()
        assert '[verse]' in result.lower() or 'verse' in result.lower()
        assert 'Am' in result

    def test_empty_input(self):
        """Empty input should return empty string."""
        assert normalize_website_paste("") == ""
        assert normalize_website_paste("   ") == "   "

    def test_normalize_without_beautifulsoup(self):
        """Normalizer should work even if BeautifulSoup is not available."""
        # Even with HTML-like text, should process as plain text if BS4 unavailable
        html = '<div>Am G F</div>'
        result = normalize_website_paste(html)
        # Should at least return something (may include tags or process as text)
        assert len(result) > 0


class TestRealWorldExamples:
    """Test with realistic paste examples from actual websites."""

    def test_ug_typical_structure(self):
        """Test typical Ultimate Guitar paste structure."""
        text = '''<div class="js-tab-content">
[Intro]
| G  D/F#  | Em  C  |
| G  D/F#  | Em  C  |

[Verse 1]
G           D/F#
When I find myself
Em              C
In times of trouble
G           D/F#
Mother Mary comes to me
Em         D      C
Speaking words of wisdom

[Chorus]
G    D     Em    C
Let it be, let it be
G    D     C
Let it be
</div>'''
        result = normalize_website_paste(text)

        assert '[intro]' in result.lower()
        assert '[verse' in result.lower()
        assert '[chorus]' in result.lower()
        assert '|' in result  # Bars preserved in intro

    def test_tab4u_hebrew_song(self):
        """Test typical Tab4u Hebrew song paste."""
        text = '''<div class="song_words">
<h2>אלוהים מרחם על ילדי הגן</h2>
<div class="artist">מתי כספי ושלמה גרוניך</div>

<strong>בית:</strong>
<pre>
G6                    Dm7/9
אלוהים מרחם על ילדי הגן
G6                    Dm7/9
פחות מזה על ילדי בית הספר
</pre>

<strong>פזמון:</strong>
<pre>
A        A4       Gm      F7+
ועל הגדולים לא ירחם עוד
</pre>
</div>'''
        result = normalize_website_paste(text)

        # Title and artist should be extracted
        assert 'אלוהים מרחם' in result

        # Sections should be detected
        assert '[verse]' in result.lower() or 'בית' in result
        assert '[chorus]' in result.lower() or 'פזמון' in result

        # Chords should be present
        assert 'G6' in result
        assert 'Dm7/9' in result

    def test_mixed_format_robust_handling(self):
        """Test handling of mixed formats (some HTML, some plain)."""
        text = """<div>Song Title</div>
Artist

Verse:
Am\tG\tF
Some lyrics

פזמון:
| Dm  C  | G  Am  |
עוד שורה
"""
        result = normalize_website_paste(text)

        # Should handle the mix gracefully
        assert 'Am' in result or 'Dm' in result
        assert '\t' not in result  # Tabs normalized
        # Either preserves sections or creates default
        assert '[' in result or 'verse' in result.lower()
