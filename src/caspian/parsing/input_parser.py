"""Parse Format A text input into SongInput.

Format A rules:
- Metadata lines: "key: Am", "title: ...", "artist: ..."
- Section headers: [intro], [verse], [chorus], [bridge], [outro]
- Chord lines with lyrics: "Am/E D#dim | יש אולי סיכוי קרוב" (pipe separator)
- Pure chord lines (no pipe, no Hebrew): "Am Am D D" (LTR)
- Pure chord lines with Hebrew (no pipe): RTL
"""

from __future__ import annotations

import re

from caspian.models.input import ChordInput, SectionInput, SongInput
from caspian.parsing.rtl_handler import has_hebrew, normalize_chord_order, detect_section_type

_CHORD_PATTERN = re.compile(r"[A-G][#b]?[a-zA-Z0-9+]*(?:/[A-G][#b]?)?")
_SECTION_HEADER = re.compile(r"^\[(.+?)\]\s*$")
_METADATA_PATTERN = re.compile(r"^(\w+)\s*:\s*(.+)$")


def _extract_chords(text: str) -> list[str]:
    """Extract chord symbols from a text string."""
    return _CHORD_PATTERN.findall(text)


def parse_format_a(text: str) -> SongInput:
    """Parse Format A text into a SongInput model."""
    lines = text.strip().split("\n")

    title = ""
    artist = ""
    key = ""
    key_mode = "natural_minor"
    sections: list[SectionInput] = []
    current_section: SectionInput | None = None

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        # Check for section header
        header_match = _SECTION_HEADER.match(line)
        if header_match:
            header = header_match.group(1)
            section_type = detect_section_type(header)
            current_section = SectionInput(name=header, section_type=section_type)
            sections.append(current_section)
            continue

        # Check for metadata
        meta_match = _METADATA_PATTERN.match(line)
        if meta_match and not has_hebrew(meta_match.group(2).strip()):
            field = meta_match.group(1).lower()
            value = meta_match.group(2).strip()
            if field == "title":
                title = value
            elif field == "artist":
                artist = value
            elif field == "key":
                key = value
            elif field == "mode":
                key_mode = value
            continue
        # Also handle Hebrew metadata (title/artist can be Hebrew)
        if meta_match:
            field = meta_match.group(1).lower()
            value = meta_match.group(2).strip()
            if field == "title":
                title = value
                continue
            elif field == "artist":
                artist = value
                continue
            elif field == "key":
                key = value
                continue
            elif field == "mode":
                key_mode = value
                continue

        # Ensure we have a section
        if current_section is None:
            current_section = SectionInput(name="default")
            sections.append(current_section)

        # Check for pipe separator: "chords | lyrics"
        if "|" in line:
            parts = line.split("|", 1)
            chord_part = parts[0].strip()
            lyrics_part = parts[1].strip()

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

    return SongInput(
        title=title,
        artist=artist,
        key=key,
        key_mode=key_mode,
        sections=sections,
    )
