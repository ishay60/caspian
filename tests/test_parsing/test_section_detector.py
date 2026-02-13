"""Tests for flexible section header detection."""

import pytest
from caspian.parsing.section_detector import detect_section, detect_section_bracket


class TestBracketFormat:
    """Standard [section] bracket headers."""

    @pytest.mark.parametrize("line,expected", [
        ("[chorus]", "chorus"),
        ("[Chorus]", "chorus"),
        ("[CHORUS]", "chorus"),
        ("[verse]", "verse"),
        ("[Verse]", "verse"),
        ("[bridge]", "bridge"),
        ("[Bridge]", "bridge"),
        ("[intro]", "intro"),
        ("[Intro]", "intro"),
        ("[outro]", "outro"),
        ("[Outro]", "outro"),
        ("[solo]", "solo"),
        ("[Solo]", "solo"),
        ("[instrumental]", "instrumental"),
        ("[interlude]", "interlude"),
        ("[pre-chorus]", "pre-chorus"),
        ("[Pre-Chorus]", "pre-chorus"),
    ])
    def test_bracket_sections(self, line, expected):
        assert detect_section(line) == expected

    @pytest.mark.parametrize("line,expected", [
        ("[Chorus 1]", "chorus"),
        ("[Verse 2]", "verse"),
        ("[chorus 3]", "chorus"),
        ("[Bridge #2]", "bridge"),
    ])
    def test_bracket_numbered(self, line, expected):
        assert detect_section(line) == expected

    def test_bracket_with_spaces(self):
        assert detect_section("  [ chorus ]  ") == "chorus"
        assert detect_section("  [Verse]  ") == "verse"


class TestColonFormat:
    """Section headers with colon suffix."""

    @pytest.mark.parametrize("line,expected", [
        ("Chorus:", "chorus"),
        ("chorus:", "chorus"),
        ("CHORUS:", "chorus"),
        ("Verse:", "verse"),
        ("Bridge:", "bridge"),
        ("Intro:", "intro"),
        ("Outro:", "outro"),
        ("Pre-Chorus:", "pre-chorus"),
        ("Instrumental:", "instrumental"),
    ])
    def test_colon_sections(self, line, expected):
        assert detect_section(line) == expected

    def test_colon_with_spaces(self):
        assert detect_section("  Chorus:  ") == "chorus"
        assert detect_section("Chorus :") == "chorus"

    def test_colon_numbered(self):
        assert detect_section("Chorus 1:") == "chorus"
        assert detect_section("Verse 2:") == "verse"


class TestBareFormat:
    """Bare section name on its own line."""

    @pytest.mark.parametrize("line,expected", [
        ("Chorus", "chorus"),
        ("chorus", "chorus"),
        ("CHORUS", "chorus"),
        ("Verse", "verse"),
        ("Bridge", "bridge"),
        ("Intro", "intro"),
        ("Outro", "outro"),
        ("Solo", "solo"),
        ("Instrumental", "instrumental"),
        ("Interlude", "interlude"),
        ("Pre-Chorus", "pre-chorus"),
        ("Refrain", "chorus"),
    ])
    def test_bare_sections(self, line, expected):
        assert detect_section(line) == expected

    def test_bare_numbered(self):
        assert detect_section("Chorus 1") == "chorus"
        assert detect_section("Verse 2") == "verse"

    def test_bare_with_padding(self):
        assert detect_section("  Chorus  ") == "chorus"
        assert detect_section("   Verse  ") == "verse"


class TestDecoratedFormat:
    """Section names decorated with dashes, equals, asterisks."""

    @pytest.mark.parametrize("line,expected", [
        ("-- Chorus --", "chorus"),
        ("--- Chorus ---", "chorus"),
        ("-- Verse --", "verse"),
        ("== Bridge ==", "bridge"),
        ("=== Intro ===", "intro"),
        ("** Chorus **", "chorus"),
        ("*** Bridge ***", "bridge"),
        ("-- Pre-Chorus --", "pre-chorus"),
    ])
    def test_decorated_sections(self, line, expected):
        assert detect_section(line) == expected

    def test_decorated_with_spaces(self):
        assert detect_section("  -- Chorus --  ") == "chorus"


class TestCurlyBraceFormat:
    """Section headers in {curly braces}."""

    @pytest.mark.parametrize("line,expected", [
        ("{Chorus}", "chorus"),
        ("{chorus}", "chorus"),
        ("{Verse}", "verse"),
        ("{Bridge}", "bridge"),
        ("{Intro}", "intro"),
    ])
    def test_curly_brace_sections(self, line, expected):
        assert detect_section(line) == expected


class TestParenthesisFormat:
    """Section headers in (parentheses)."""

    @pytest.mark.parametrize("line,expected", [
        ("(Chorus)", "chorus"),
        ("(Verse)", "verse"),
        ("(Bridge)", "bridge"),
    ])
    def test_parenthesis_sections(self, line, expected):
        assert detect_section(line) == expected


class TestHebrewSections:
    """Hebrew section headers."""

    @pytest.mark.parametrize("line,expected", [
        ("פזמון", "chorus"),
        ("פזמון:", "chorus"),
        ("בית", "verse"),
        ("בית:", "verse"),
        ("הקדמה", "intro"),
        ("הקדמה:", "intro"),
        ("סיום", "outro"),
        ("סיום:", "outro"),
        ("גשר", "bridge"),
        ("גשר:", "bridge"),
        ("סולו", "solo"),
        ("סולו:", "solo"),
        ("אינטרומנטל", "instrumental"),
        ("פתיחה", "intro"),
        ("[פזמון]", "chorus"),
        ("[בית]", "verse"),
        ("[סיום]", "outro"),
    ])
    def test_hebrew_sections(self, line, expected):
        assert detect_section(line) == expected


class TestAliases:
    """Aliases that map to canonical names."""

    def test_refrain_is_chorus(self):
        assert detect_section("Refrain") == "chorus"
        assert detect_section("[Refrain]") == "chorus"
        assert detect_section("Refrain:") == "chorus"

    def test_hook_is_chorus(self):
        assert detect_section("Hook") == "chorus"

    def test_introduction_is_intro(self):
        assert detect_section("Introduction") == "intro"

    def test_ending_is_outro(self):
        assert detect_section("Ending") == "outro"

    def test_coda_is_outro(self):
        assert detect_section("Coda") == "outro"

    def test_prechorus_variants(self):
        assert detect_section("Pre-Chorus") == "pre-chorus"
        assert detect_section("PreChorus") == "pre-chorus"
        assert detect_section("Pre Chorus") == "pre-chorus"


class TestNonSections:
    """Lines that should NOT be detected as section headers."""

    @pytest.mark.parametrize("line", [
        "Am Dm G C",
        "Am | שלום עולם",
        "שלום עולם",
        "key: Am",
        "title: My Song",
        "artist: Someone",
        "",
        "   ",
        "The chorus was great",
        "G6 Dm7/9 G6 Dm7/9",
        "Am/E D#dim",
    ])
    def test_not_section(self, line):
        assert detect_section(line) is None


class TestRepeatSuffix:
    """Numbered and repeat-count suffixes."""

    def test_x_repeat(self):
        assert detect_section("Chorus (x2)") == "chorus"
        assert detect_section("[Chorus (x3)]") == "chorus"

    def test_hash_number(self):
        assert detect_section("Verse #1") == "verse"
        assert detect_section("[Bridge #2]") == "bridge"


class TestDetectSectionBracket:
    """Convenience wrapper returning [name] strings."""

    def test_returns_bracket_format(self):
        assert detect_section_bracket("Chorus") == "[chorus]"
        assert detect_section_bracket("Verse:") == "[verse]"
        assert detect_section_bracket("-- Bridge --") == "[bridge]"
        assert detect_section_bracket("פזמון") == "[chorus]"

    def test_returns_none_for_non_section(self):
        assert detect_section_bracket("Am Dm G C") is None
        assert detect_section_bracket("שלום עולם") is None


class TestEndToEndChorusDetection:
    """Realistic chorus header formats that should all resolve to 'chorus'."""

    @pytest.mark.parametrize("line", [
        "[Chorus]",
        "[chorus]",
        "[CHORUS]",
        "Chorus",
        "chorus",
        "CHORUS",
        "Chorus:",
        "chorus:",
        "CHORUS:",
        "-- Chorus --",
        "--- Chorus ---",
        "== Chorus ==",
        "** Chorus **",
        "{Chorus}",
        "(Chorus)",
        "Refrain",
        "refrain",
        "Refrain:",
        "Hook",
        "פזמון",
        "פזמון:",
        "[פזמון]",
        "Chorus 1",
        "Chorus 2",
        "[Chorus 1]",
        "Chorus (x2)",
    ])
    def test_all_chorus_formats(self, line):
        assert detect_section(line) == "chorus", f"Failed for: {line!r}"
