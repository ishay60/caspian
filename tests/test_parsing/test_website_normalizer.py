"""Tests for website-style paste normalizer."""

import pytest
from caspian.parsing.website_normalizer import normalize_website_paste
from caspian.parsing.input_parser import parse_format_a


class TestFormatADetection:
    """When input is already Format A, it is returned unchanged."""

    def test_key_line_unchanged(self):
        text = "key: Am\n[verse]\nAm Dm | hello"
        assert normalize_website_paste(text) == text

    def test_bracket_section_unchanged(self):
        text = "[intro]\nAm Am\n[verse]\nAm | שלום"
        assert normalize_website_paste(text) == text

    def test_pipe_format_unchanged(self):
        text = "title: Song\n[verse]\nG C | lyrics here"
        assert normalize_website_paste(text) == text


class TestWebsitePaste:
    """Website-style paste is converted to Format A."""

    def test_title_and_artist_from_first_lines(self):
        text = """אלוהים מרחם על ילדי הגן
מתי כספי ושלמה גרוניך
G6 Dm7/9 | אלוהים מרחם"""
        out = normalize_website_paste(text)
        assert "title: אלוהים מרחם על ילדי הגן" in out
        assert "artist: מתי כספי ושלמה גרוניך" in out
        assert "[verse]" in out
        assert "G6 Dm7/9 | אלוהים מרחם" in out

    def test_skip_machber_melachen(self):
        text = """שיר
מבצע
מחבר: יהודה עמיחי
מלחין: מתי כספי
G6 | מילים"""
        out = normalize_website_paste(text)
        assert "title: שיר" in out
        assert "artist: מבצע" in out
        assert "מחבר" not in out or "מחבר" in out and "[מחבר]" not in out
        assert "G6 | מילים" in out

    def test_merge_consecutive_chord_lines_then_lyrics(self):
        text = """Title
Artist
G6 Dm7
G6 Dm7
אלוהים מרחם"""
        out = normalize_website_paste(text)
        assert "G6 Dm7 G6 Dm7 | אלוהים מרחם" in out

    def test_hebrew_section_siyum(self):
        text = """Title
Artist
G6 | verse line
סיום:
G6 A G6"""
        out = normalize_website_paste(text)
        assert "[outro]" in out
        # Outro section should have the chord line
        lines = out.split("\n")
        outro_idx = next(i for i, l in enumerate(lines) if l == "[outro]")
        assert outro_idx >= 0
        assert "G6 A G6" in "\n".join(lines[outro_idx:])


class TestFlexibleSectionDetection:
    """Various section header formats detected by the website normalizer."""

    def test_english_colon_chorus(self):
        text = """שיר שלי
אמן שלי
Chorus:
G6 Dm7
שלום עולם"""
        out = normalize_website_paste(text)
        assert "[chorus]" in out

    def test_bare_chorus(self):
        text = """שיר שלי
אמן שלי
Chorus
G6 Dm7
שלום עולם"""
        out = normalize_website_paste(text)
        assert "[chorus]" in out

    def test_decorated_chorus(self):
        text = """שיר שלי
אמן שלי
-- Chorus --
G6 Dm7
שלום עולם"""
        out = normalize_website_paste(text)
        assert "[chorus]" in out

    def test_curly_brace_chorus(self):
        text = """שיר שלי
אמן שלי
{Chorus}
G6 Dm7
שלום עולם"""
        out = normalize_website_paste(text)
        assert "[chorus]" in out

    def test_hebrew_bare_chorus(self):
        """פזמון without colon should also be detected."""
        text = """שיר שלי
אמן שלי
פזמון
G6 Dm7
שלום עולם"""
        out = normalize_website_paste(text)
        assert "[chorus]" in out

    def test_refrain_maps_to_chorus(self):
        text = """שיר שלי
אמן שלי
Refrain:
G6 Dm7
שלום עולם"""
        out = normalize_website_paste(text)
        assert "[chorus]" in out

    def test_multiple_section_formats_in_one_paste(self):
        text = """שיר שלי
אמן שלי
Verse:
G6 Dm7
שלום עולם
-- Chorus --
Am F
פזמון שלום
Bridge
C G
גשר קטן"""
        out = normalize_website_paste(text)
        assert "[verse]" in out
        assert "[chorus]" in out
        assert "[bridge]" in out

    def test_uppercase_chorus(self):
        text = """שיר שלי
אמן שלי
CHORUS
G6 Dm7
שלום עולם"""
        out = normalize_website_paste(text)
        assert "[chorus]" in out

    def test_numbered_sections(self):
        text = """שיר שלי
אמן שלי
Verse 1
G6 Dm7
שלום עולם
Verse 2
Am F
מילים אחרות"""
        out = normalize_website_paste(text)
        lines = out.split("\n")
        verse_lines = [l for l in lines if l == "[verse]"]
        assert len(verse_lines) == 2

    def test_section_header_not_mistaken_for_title(self):
        """If paste starts with a section header, don't use it as title."""
        text = """Chorus
G6 Dm7
שלום עולם"""
        out = normalize_website_paste(text)
        assert "[chorus]" in out
        assert "title: Chorus" not in out


class TestRoundTripParse:
    """Normalized website paste parses to a valid SongInput."""

    def test_elohim_merachem_snippet(self):
        text = """אלוהים מרחם על ילדי הגן
מתי כספי ושלמה גרוניך
מחבר: יהודה עמיחי
מלחין: מתי כספי ושלמה גרוניך
G6 Dm7/9 G6 Dm7/9
אלוהים מרחם על ילדי הגן
G6 Dm7/9 G6 Dm7/9
פחות מזה על ילדי בית הספר"""
        normalized = normalize_website_paste(text)
        song = parse_format_a(normalized)
        assert song.title == "אלוהים מרחם על ילדי הגן"
        assert "מתי כספי" in song.artist
        assert len(song.sections) >= 1
        # First section should have chords with lyrics
        first = song.sections[0]
        assert len(first.chords) >= 2
        assert first.chords[0].lyrics
        assert first.chords[0].symbol in ("G6", "Dm7/9")
