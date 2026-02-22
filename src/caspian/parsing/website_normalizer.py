"""Normalize website-style chord sheet paste into Format A.

Typical website paste format:
- First line: song title (Hebrew)
- Second line: artist(s)
- Optional: מחבר: ... / מלחין: ...
- Then alternating: chord-only lines and lyrics-only lines (Hebrew)
- Sometimes standalone chord symbols on their own line (F7+, Dm7/9)
- Section labels: סיום: (outro), etc.

Rules:
- If input already looks like Format A (key:, [section], or pipe "chords | lyrics"),
  return as-is.
- Otherwise: infer title from first line, artist from second or מלחין,
  merge consecutive chord-only lines, pair with next lyrics line as "chords | lyrics",
  emit section headers for Hebrew labels (סיום: → [outro]).
"""

from __future__ import annotations

import re

from caspian.parsing.rtl_handler import has_hebrew
from caspian.parsing.section_detector import detect_section_bracket

# Chord pattern: root + optional quality/slash (e.g. G6, Dm7/9, F7+, Bbdim)
# Must not match "x2" or pure numbers
_CHORD_PATTERN = re.compile(r"[A-G][#b]?[a-zA-Z0-9+/]*")


def _looks_like_format_a(text: str) -> bool:
    """Return True if text already uses Format A (explicit key: or [section] headers)."""
    stripped = text.strip()
    if re.search(r"^\s*key\s*:\s*\S+", stripped, re.IGNORECASE | re.MULTILINE):
        return True
    if re.search(r"^\s*\[[\w\s]+\]\s*$", stripped, re.MULTILINE):
        return True
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
    """Convert website-style paste to Format A; return unchanged if already Format A."""
    if not text or not text.strip():
        return text
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
