"""Parse Format A text input into SongInput.

Format A rules:
- Metadata lines: "key: Am", "title: ...", "artist: ..."
- Section headers: [intro], [verse], [chorus], [bridge], [outro]
- Chord lines with lyrics: "Am/E D#dim | יש אולי סיכוי קרוב" (pipe separator)
- Pure chord lines (no pipe, no Hebrew): "Am Am D D" (LTR)
- Pure chord lines with Hebrew (no pipe): RTL
- Chord-above-lyrics: chord line on one line, Hebrew lyrics on the next

Note: As of Phase 3.2, consider using the parser registry for automatic
format detection instead of calling parse_format_a directly:

    from caspian.parsing.registry import get_global_registry
    registry = get_global_registry()
    song_input = registry.parse(text)  # Auto-detects format
"""

from __future__ import annotations

import re

from caspian.models.input import ChordInput, ChordLyricsLine, SectionInput, SongInput
from caspian.parsing.rtl_handler import has_hebrew, normalize_chord_order, detect_section_type
from caspian.parsing.section_detector import detect_section
from caspian.parsing.bar_notation_parser import BarNotationParser

# Supports G6, Dm7/9, F7+, Bbdim, Am/G (suffix may include / and digits)
_CHORD_PATTERN = re.compile(r"[A-G][#b]?[a-zA-Z0-9+/]*")

# Invisible Unicode characters that break chord parsing (bidi marks, zero-width chars)
_BIDI_MARKS = re.compile(
    "[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]"
)
_SECTION_HEADER = re.compile(r"^\[(.+?)\]\s*$")
_METADATA_PATTERN = re.compile(r"^(\w+)\s*:\s*(.+)$")
# Match chords with their positions in a line
_CHORD_WITH_POS = re.compile(r"[A-G][#b]?[a-zA-Z0-9+/]*")


def _extract_chords(text: str) -> list[str]:
    """Extract chord symbols from a text string."""
    return _CHORD_PATTERN.findall(text)


def _extract_chords_with_positions(text: str) -> list[tuple[int, str]]:
    """Extract chord symbols with their column positions."""
    return [(m.start(), m.group()) for m in _CHORD_WITH_POS.finditer(text)]


def _is_pure_chord_line(line: str) -> bool:
    """Check if a line contains only chord symbols and whitespace (no Hebrew, no pipe)."""
    if "|" in line or has_hebrew(line):
        return False
    chords = _extract_chords(line)
    if not chords:
        return False
    # Remove all chord matches and see if only whitespace/bar lines remain
    remaining = _CHORD_PATTERN.sub("", line).strip()
    # Allow only whitespace and common separators
    return all(c in " \t|" for c in remaining)


def parse_format_a(text: str) -> SongInput:
    """Parse Format A text into a SongInput model.

    Note: This function expects text to already be in Format A.
    For automatic format detection, use the parser registry instead:

        from caspian.parsing.registry import get_global_registry
        song_input = get_global_registry().parse(text)
    """
    # Strip invisible bidi marks that break chord parsing (e.g. G#\u200em → G#m)
    text = _BIDI_MARKS.sub("", text)
    lines = text.strip().split("\n")

    title = ""
    artist = ""
    key = ""
    key_mode = "natural_minor"
    sections: list[SectionInput] = []
    current_section: SectionInput | None = None

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        # Check for section header — bracket syntax [chorus] or flexible detection
        header_match = _SECTION_HEADER.match(line)
        if header_match:
            header = header_match.group(1)
            section_type = detect_section_type(header)
            current_section = SectionInput(name=header, section_type=section_type)
            sections.append(current_section)
            i += 1
            continue

        # Flexible section detection: "Chorus:", "-- Bridge --", "פזמון", etc.
        detected = detect_section(line)
        if detected is not None:
            section_type = detect_section_type(detected)
            current_section = SectionInput(name=detected, section_type=section_type)
            sections.append(current_section)
            i += 1
            continue

        # Check for metadata (but not section names with inline content like "intro: | Gm7b5 |")
        meta_match = _METADATA_PATTERN.match(line)
        if meta_match:
            field = meta_match.group(1).lower()
            value = meta_match.group(2).strip()

            # Check if the "field" is actually a section name with inline chord content
            section_name = detect_section(field + ":")
            if section_name is not None and _extract_chords(value):
                section_type = detect_section_type(section_name)
                current_section = SectionInput(name=section_name, section_type=section_type)
                sections.append(current_section)
                # Replace line with the chord content for parsing below
                line = value
                # Don't increment i or continue — let the chord parsing logic below handle it
            elif field in ("title", "artist", "key", "mode"):
                if field == "title":
                    title = value
                elif field == "artist":
                    artist = value
                elif field == "key":
                    key = value
                elif field == "mode":
                    key_mode = value
                i += 1
                continue
            else:
                # Unknown metadata field with no chords — skip
                i += 1
                continue

        # Ensure we have a section
        if current_section is None:
            current_section = SectionInput(name="default")
            sections.append(current_section)

        # Check for pipe separator: "chords | lyrics" or "| chord | chord |" bar notation
        if "|" in line:
            # Create bar notation parser instance (lightweight, only used when needed)
            bar_parser = BarNotationParser()

            # Check if this is true bar notation (starts and ends with |)
            if bar_parser.is_bar_notation_line(line):
                # Bar notation: "| Gm7b5 | Fm/Ab |" — parse into Bar objects
                try:
                    bars = bar_parser.parse_bar_line(line)
                    # Add all bars to the section
                    current_section.bars.extend(bars)
                except ValueError as e:
                    # If bar parsing fails, fall back to chord extraction for backward compatibility
                    all_chords_in_line = _extract_chords(line)
                    if current_section.section_type == "instrumental":
                        chords = all_chords_in_line  # LTR
                    elif has_hebrew(line):
                        chords = list(reversed(all_chords_in_line))  # RTL
                    else:
                        chords = all_chords_in_line  # LTR
                    for chord_sym in chords:
                        current_section.chords.append(ChordInput(symbol=chord_sym))
            else:
                # Not bar notation - check for "chords | lyrics" format
                parts = line.split("|", 1)
                chord_part = parts[0].strip()
                lyrics_part = parts[1].strip()

                # Could still be bar notation without proper delimiters
                # If no chord part before first pipe and no Hebrew after, treat as chords
                all_chords_in_line = _extract_chords(line)
                if not chord_part or (not has_hebrew(lyrics_part) and all_chords_in_line):
                    # Ambiguous case - extract chords for backward compatibility
                    if current_section.section_type == "instrumental":
                        chords = all_chords_in_line  # LTR
                    elif has_hebrew(line):
                        chords = list(reversed(all_chords_in_line))  # RTL
                    else:
                        chords = all_chords_in_line  # LTR
                    for chord_sym in chords:
                        current_section.chords.append(ChordInput(symbol=chord_sym))
                else:
                    # True "chords | lyrics" format
                    visual_chords = _extract_chords(chord_part)
                    # Lines with pipe: chords are on left, lyrics on right
                    # If lyrics contain Hebrew, the performance order is RTL
                    chords = normalize_chord_order(visual_chords, lyrics_part)

                    # Associate lyrics with the section's chords
                    for chord_sym in chords:
                        current_section.chords.append(
                            ChordInput(symbol=chord_sym, lyrics=lyrics_part)
                        )
        else:
            # No pipe separator — pure chord line or chord+Hebrew line
            visual_chords = _extract_chords(line)
            if not visual_chords:
                i += 1
                continue

            # Lookahead: check if this is a chord-above-lyrics pair
            if _is_pure_chord_line(line) and i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if next_line and has_hebrew(next_line) and not _extract_chords(next_line):
                    # This is a chord-above-lyrics pair
                    chords_with_pos = _extract_chords_with_positions(lines[i])
                    lyrics_line = lines[i + 1]  # preserve original spacing

                    # Store the paired line for display
                    current_section.lines.append(
                        ChordLyricsLine(chords=chords_with_pos, lyrics=lyrics_line)
                    )

                    # Determine chord order: instrumental sections stay LTR
                    if current_section.section_type == "instrumental":
                        chords = visual_chords
                    else:
                        chords = list(reversed(visual_chords))

                    for chord_sym in chords:
                        current_section.chords.append(
                            ChordInput(symbol=chord_sym, lyrics=next_line.strip())
                        )

                    i += 2  # skip both lines
                    continue

            # Determine reading direction from context
            if current_section.section_type == "instrumental":
                chords = visual_chords  # LTR
            elif has_hebrew(line):
                chords = list(reversed(visual_chords))  # RTL
            else:
                chords = visual_chords  # LTR

            for chord_sym in chords:
                current_section.chords.append(ChordInput(symbol=chord_sym))

        i += 1

    return SongInput(
        title=title,
        artist=artist,
        key=key,
        key_mode=key_mode,
        sections=sections,
    )


def parse_song(text: str) -> SongInput:
    """Parse song input with automatic format detection.

    This is a convenience wrapper around the parser registry.
    Detects the input format and routes to the appropriate parser.

    Supported formats:
    - Format A (native Caspian format)
    - Website paste (chord/lyrics alternating)
    - Ultimate Guitar HTML
    - Tab4u HTML
    - ChordPro (future)
    - Bar notation (future)

    Args:
        text: Raw input text in any supported format

    Returns:
        Validated SongInput model

    Raises:
        ValueError: If format cannot be detected or parsing fails

    Example:
        >>> text = "key: Am\\n[verse]\\nAm G F C"
        >>> song = parse_song(text)
        >>> song.key
        'Am'
    """
    from caspian.parsing.registry import get_global_registry
    registry = get_global_registry()
    return registry.parse(text)
