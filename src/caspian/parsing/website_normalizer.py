"""Normalize website-style chord sheet paste into Format A.

Typical website paste format:
- First line: song title (Hebrew)
- Second line: artist(s)
- Optional: מחבר: ... / מלחין: ...
- Then alternating: chord-only lines and lyrics-only lines (Hebrew)
- Sometimes standalone chord symbols on their own line (F7+, Dm7/9)
- Section labels: סיום: (outro), etc.

Enhanced in Phase 3.1:
- Detects and parses HTML from Ultimate Guitar and Tab4u
- Improved spacing normalization (tabs → spaces)
- Bar line detection and preservation (| Am G | F C |)
- More Hebrew section marker variants

Rules:
- If input already looks like Format A (key:, [section], or pipe "chords | lyrics"),
  return as-is.
- Otherwise: infer title from first line, artist from second or מלחין,
  merge consecutive chord-only lines, pair with next lyrics line as "chords | lyrics",
  emit section headers for Hebrew labels (סיום: → [outro]).
"""

from __future__ import annotations

import re

try:
    from bs4 import BeautifulSoup
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False

from caspian.parsing.rtl_handler import has_hebrew
from caspian.parsing.section_detector import detect_section_bracket

# Invisible Unicode characters that break chord parsing (bidi marks, zero-width chars).
# Common when copying from RTL websites or PDF chord sheets.
_BIDI_MARKS = re.compile(
    "[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]"
)

# Chord pattern: root + optional quality/slash (e.g. G6, Dm7/9, F7+, Bbdim, E/G#)
# Must not match "x2" or pure numbers
_CHORD_PATTERN = re.compile(r"[A-G][#b]?[a-zA-Z0-9+/#]*")

# Bar line pattern: | chord(s) |
_BAR_LINE_PATTERN = re.compile(r"\|[\s\w#b/+\-]+\|")


# ---------------------------------------------------------------------------
# Phase 3.1: HTML Detection and Parsing
# ---------------------------------------------------------------------------

def detect_ultimate_guitar_html(text: str) -> bool:
    """Detect if pasted text is HTML from Ultimate Guitar website."""
    indicators = [
        '<div class="js-tab-content"',
        'data-content="chord"',
        'www.ultimate-guitar.com',
        'class="js-store"',
        'ultimate-guitar.com',
    ]
    return any(indicator in text for indicator in indicators)


def detect_tab4u_html(text: str) -> bool:
    """Detect if pasted text is HTML from Tab4u website."""
    indicators = [
        'class="song_words"',
        'tab4u.com',
        'שיר:',  # Hebrew for "song:"
        'class="chords"',
        'class="lyrics"',
    ]
    return any(indicator in text for indicator in indicators)


def parse_ultimate_guitar_html(html: str) -> str:
    """Extract clean chord sheet text from Ultimate Guitar HTML.

    Falls back to original text if BeautifulSoup is not available or parsing fails.
    """
    if not BS4_AVAILABLE:
        return html

    try:
        soup = BeautifulSoup(html, 'html.parser')

        # Find main content div (try multiple possible class names)
        content = soup.find('div', class_='js-tab-content')
        if not content:
            content = soup.find('pre', class_='js-tab-content')
        if not content:
            content = soup.find('div', {'data-content': 'chord'})

        if content:
            # Extract text, preserve line breaks
            text = content.get_text(separator='\n', strip=False)
            return text.strip()
    except Exception:
        # If parsing fails, return original
        pass

    return html


def parse_tab4u_html(html: str) -> str:
    """Extract clean chord sheet text from Tab4u HTML.

    Falls back to original text if BeautifulSoup is not available or parsing fails.
    """
    if not BS4_AVAILABLE:
        return html

    try:
        soup = BeautifulSoup(html, 'html.parser')

        # Find song content (try multiple possible class names)
        content = soup.find('div', class_='song_words')
        if not content:
            content = soup.find('pre', class_='chords')
        if not content:
            content = soup.find('div', class_='lyrics')

        if content:
            # Extract text, preserve line breaks
            text = content.get_text(separator='\n', strip=False)
            return text.strip()
    except Exception:
        # If parsing fails, return original
        pass

    return html


# ---------------------------------------------------------------------------
# Phase 3.1: Bar Line Detection
# ---------------------------------------------------------------------------

def detect_bar_lines(text: str) -> bool:
    """Detect if text contains bar line notation like | Am G | F C |."""
    return bool(_BAR_LINE_PATTERN.search(text))


def is_bar_line(line: str) -> bool:
    """Check if a specific line uses bar notation."""
    stripped = line.strip()
    if not stripped:
        return False

    # Must have pipes and chord-like content between them
    if '|' not in stripped:
        return False

    # If it has Hebrew text, it's likely lyrics with | separator, not bars
    if has_hebrew(stripped):
        return False

    # Check if it matches bar pattern
    return bool(_BAR_LINE_PATTERN.search(stripped))


# ---------------------------------------------------------------------------
# Phase 3.1: Spacing Normalization
# ---------------------------------------------------------------------------

def normalize_spacing(text: str) -> str:
    """Normalize mixed tabs/spaces to consistent spacing.

    - Converts tabs to 4 spaces
    - Preserves relative spacing in chord lines
    - Strips trailing whitespace
    """
    lines = text.split('\n')
    normalized = []

    for line in lines:
        # Convert tabs to 4 spaces
        line = line.replace('\t', '    ')

        # Strip trailing whitespace (but preserve leading indent)
        line = line.rstrip()

        normalized.append(line)

    return '\n'.join(normalized)


def _looks_like_format_a(text: str) -> bool:
    """Return True if text already uses Format A (explicit key:, [section], or leading section header).

    A section header (like 'intro:', 'verse:') as one of the first non-empty lines
    indicates structured Format A input, not a website paste.
    """
    stripped = text.strip()
    if re.search(r"^\s*key\s*:\s*\S+", stripped, re.IGNORECASE | re.MULTILINE):
        return True
    if re.search(r"^\s*\[[\w\s]+\]\s*$", stripped, re.MULTILINE):
        return True
    # Check if the first non-empty line is a section header (with or without inline content).
    # Website pastes start with title/artist, not section names.
    from caspian.parsing.section_detector import detect_section
    for line in stripped.split("\n"):
        s = line.strip()
        if not s:
            continue
        # First non-empty line: check if it starts with a section name + colon
        colon_match = re.match(r"^(\w[\w\s-]*):", s)
        if colon_match:
            field = colon_match.group(1).strip()
            if detect_section(field + ":") is not None:
                return True
        break  # only check the very first non-empty line
    return False


def _is_chord_token(t: str) -> bool:
    """True if token looks like a chord symbol (not a word like 'Artist' or 'Title')."""
    if not _CHORD_PATTERN.fullmatch(t):
        return False
    # Single note A-G is a chord
    if len(t) <= 2 and t[0] in "ABCDEFG" and (len(t) == 1 or t[1] in "#b"):
        return True
    # Must contain chord-like character: digit, /, +, or quality letter m/M
    return any(c in t for c in "0123456789/+mM") or "dim" in t or "aug" in t or "sus" in t


def _is_chord_only_line(line: str) -> bool:
    """True if line contains only chord symbols and spaces (no Hebrew, no metadata)."""
    line = line.strip()
    if not line or has_hebrew(line):
        return False
    # Skip metadata-like lines
    if re.match(r"^[\w]+\s*:\s*.+", line) and not has_hebrew(line):
        return False
    tokens = line.split()
    for t in tokens:
        if not _is_chord_token(t):
            return False
    return len(tokens) > 0


def _is_lyrics_only_line(line: str) -> bool:
    """True if line is mainly Hebrew (lyrics), no chord symbols."""
    line = line.strip()
    if not line:
        return False
    if not has_hebrew(line):
        return False
    chords = _CHORD_PATTERN.findall(line)
    # If there are chord symbols mixed in, treat as mixed (we'll still use it)
    return True


def _extract_chords_from_line(line: str) -> list[str]:
    """Extract chord symbols from a line (chord-only or mixed)."""
    return _CHORD_PATTERN.findall(line)


def _is_section_header(line: str) -> str | None:
    """Return ``[name]`` bracket string if *line* is any section header, else None."""
    return detect_section_bracket(line)


def normalize_website_paste(text: str) -> str:
    """Convert website-style paste to Format A; return unchanged if already Format A.

    Phase 3.1 enhancements:
    - Detects and parses HTML from Ultimate Guitar and Tab4u
    - Normalizes spacing (tabs → spaces)
    - Strips invisible bidi marks
    """
    if not text or not text.strip():
        return text

    # Phase 3.1: Detect and parse HTML pastes
    if detect_ultimate_guitar_html(text):
        text = parse_ultimate_guitar_html(text)
    elif detect_tab4u_html(text):
        text = parse_tab4u_html(text)

    # Phase 3.1: Normalize spacing (tabs → spaces)
    text = normalize_spacing(text)

    # Strip invisible bidi marks that break chord parsing (e.g. G#\u200em → G#m)
    text = _BIDI_MARKS.sub("", text)

    if _looks_like_format_a(text):
        return text

    lines = [ln.rstrip() for ln in text.split("\n")]
    out: list[str] = []
    i = 0
    title = ""
    artist = ""
    first_section_emitted = False

    # --- Title (first line with Hebrew or any non-empty line that's not metadata)
    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if not s:
            i += 1
            continue
        if re.match(r"^[\w]+\s*:\s*", s) and has_hebrew(s):
            # מחבר: / מלחין: might be first content
            if "מחבר" in s or "מלחין" in s:
                if not artist and "מלחין" in s:
                    artist = re.sub(r"^[\w]+\s*:\s*", "", s).strip()
                i += 1
                continue
        # If this line is a section header, stop title search — no title found
        if _is_section_header(s):
            break
        # First substantive line: if it has Hebrew and is not only chord symbols, treat as title
        if has_hebrew(s) and not _is_chord_only_line(s):
            title = s
            i += 1
            break
        # First line might be Latin title (no Hebrew)
        if not title and s and not _is_chord_only_line(s):
            title = s
            i += 1
            break
        # Chord-only line at start: no title/artist here; leave for sections (don't consume)
        if _is_chord_only_line(s):
            break
        i += 1
        break

    # --- Artist (next non-empty line that looks like a name, or keep from מלחין)
    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if not s:
            i += 1
            continue
        if re.match(r"^מחבר\s*:\s*", s) or re.match(r"^מלחין\s*:\s*", s):
            if not artist and "מלחין" in s:
                artist = re.sub(r"^[\w]+\s*:\s*", "", s).strip()
            i += 1
            continue
        # If this line is a section header, stop artist search
        if _is_section_header(s):
            break
        # Only treat a line as artist if we already have a title (otherwise first line was chords and this may be lyrics)
        if not title:
            break
        if has_hebrew(s) and not _is_chord_only_line(s) and not artist:
            artist = s
            i += 1
            break
        if not artist and s and not _is_chord_only_line(s):
            artist = s
            i += 1
            break
        break

    if title:
        out.append(f"title: {title}")
    if artist:
        out.append(f"artist: {artist}")
    out.append("")  # blank before sections

    # --- Sections: chord blocks + lyrics, Hebrew section labels
    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if not s:
            i += 1
            continue

        # Skip metadata lines (מחבר, מלחין)
        if re.match(r"^מחבר\s*:\s*", s) or re.match(r"^מלחין\s*:\s*", s):
            i += 1
            continue

        # Section header: [Chorus], Chorus:, פזמון, -- Bridge --, etc.
        bracket = _is_section_header(s)
        if bracket:
            out.append(bracket)
            first_section_emitted = True
            i += 1
            continue

        # Ensure we have a section
        if not first_section_emitted:
            out.append("[verse]")
            first_section_emitted = True

        # Collect consecutive chord-only lines (including standalone chord tokens)
        chord_parts: list[str] = []
        while i < len(lines):
            line = lines[i]
            s = line.strip()
            if not s:
                i += 1
                continue
            if _is_section_header(s):
                break
            if _is_chord_only_line(s):
                chord_parts.append(s)
                i += 1
                continue
            if _is_lyrics_only_line(s) or has_hebrew(s):
                break
            i += 1
            break

        chord_line = " ".join(chord_parts).strip() if chord_parts else ""

        # Next line(s): lyrics (skip section headers like סיום:)
        lyrics_line = ""
        if i < len(lines):
            line = lines[i]
            s = line.strip()
            if s and not _is_section_header(s) and (_is_lyrics_only_line(s) or has_hebrew(s)):
                lyrics_line = s
                i += 1

        if chord_line and lyrics_line:
            out.append(f"{chord_line} | {lyrics_line}")
        elif chord_line:
            out.append(chord_line)
        elif lyrics_line:
            out.append(f"| {lyrics_line}")

    return "\n".join(out)
