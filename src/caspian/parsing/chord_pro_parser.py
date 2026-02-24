"""ChordPro format parser.

Parses ChordPro format files with directives like {title: Song Name}
and inline chord notation like [Am]lyrics here.

Phase 3.4: ChordPro Format Support

Supported features:
- Metadata directives: {title:}, {artist:}, {key:}, {tempo:}, {time:}, {capo:}
- Section markers: {start_of_chorus}, {soc}, {start_of_verse}, {sov}, etc.
- Inline chord notation: [Am]lyrics
- Comments: # and {comment:}

File extensions: .cho, .crd, .chopro, .chord, .pro
"""

from __future__ import annotations

import re
from typing import List, Tuple

from caspian.models.input import (
    ChordLyricsLine,
    SectionInput,
    SongInput,
)


class ChordProParser:
    """Parser for ChordPro format chord sheets."""

    # Pattern to match metadata directives: {title: Song Name}
    # Supports short forms: {t: ...}, {st: ...}, {a: ...}
    DIRECTIVE_PATTERN = re.compile(
        r'^\s*\{\s*(?P<directive>[\w_]+)\s*(?::\s*(?P<value>.*?))?\s*\}\s*$',
        re.IGNORECASE
    )

    # Pattern to match inline chords: [Am]lyrics
    # Captures chord symbol and optional lyrics that follow
    INLINE_CHORD_PATTERN = re.compile(
        r'\[([A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?[0-9]*(?:[b#][0-9]+)?(?:/[A-G][#b]?)?)\]'
    )

    # Pattern to match comment lines: # comment
    COMMENT_PATTERN = re.compile(r'^\s*#')

    # Section marker mappings (directive -> section name)
    SECTION_MARKERS = {
        'start_of_chorus': ('chorus', 'start'),
        'soc': ('chorus', 'start'),
        'end_of_chorus': ('chorus', 'end'),
        'eoc': ('chorus', 'end'),
        'start_of_verse': ('verse', 'start'),
        'sov': ('verse', 'start'),
        'end_of_verse': ('verse', 'end'),
        'eov': ('verse', 'end'),
        'start_of_bridge': ('bridge', 'start'),
        'sob': ('bridge', 'start'),
        'end_of_bridge': ('bridge', 'end'),
        'eob': ('bridge', 'end'),
        'start_of_tab': ('instrumental', 'start'),
        'sot': ('instrumental', 'start'),
        'end_of_tab': ('instrumental', 'end'),
        'eot': ('instrumental', 'end'),
    }

    # Metadata directive mappings (short form -> full form)
    METADATA_DIRECTIVES = {
        # Title
        't': 'title',
        'title': 'title',
        # Subtitle
        'st': 'subtitle',
        'subtitle': 'subtitle',
        # Artist
        'a': 'artist',
        'artist': 'artist',
        # Composer
        'c': 'composer',
        'composer': 'composer',
        # Key
        'key': 'key',
        # Tempo
        'tempo': 'tempo',
        # Time signature
        'time': 'time',
        # Capo
        'capo': 'capo',
        # Comment (to be ignored)
        'comment': 'comment',
        'c': 'comment',
    }

    def parse(self, text: str) -> SongInput:
        """Parse ChordPro format text into a SongInput model.

        Args:
            text: Raw ChordPro format text

        Returns:
            Validated SongInput model

        Raises:
            ValueError: If text cannot be parsed
        """
        if not text or not text.strip():
            raise ValueError("Empty input text")

        lines = text.split('\n')

        # Initialize song metadata
        metadata = {
            'title': '',
            'artist': '',
            'key': '',
            'tempo': None,
            'time': None,
            'capo': None,
        }

        sections: List[SectionInput] = []
        current_section: SectionInput | None = None
        current_section_name = 'section_1'
        section_counter = 1
        in_explicit_section = False  # Track if we're inside an explicit section

        for line in lines:
            # Skip empty lines
            if not line.strip():
                continue

            # Skip comments
            if self.COMMENT_PATTERN.match(line):
                continue

            # Check for directives
            directive_match = self.DIRECTIVE_PATTERN.match(line)
            if directive_match:
                directive = directive_match.group('directive').lower()
                value = directive_match.group('value')

                # Handle metadata directives
                if directive in self.METADATA_DIRECTIVES:
                    meta_key = self.METADATA_DIRECTIVES[directive]
                    if meta_key == 'comment':
                        # Ignore comments
                        continue
                    elif meta_key in ['title', 'artist', 'key']:
                        metadata[meta_key] = value
                    elif meta_key == 'tempo':
                        try:
                            metadata['tempo'] = float(value)
                        except ValueError:
                            pass  # Ignore invalid tempo
                    elif meta_key == 'time':
                        metadata['time'] = value
                    elif meta_key == 'capo':
                        try:
                            metadata['capo'] = int(value)
                        except ValueError:
                            pass  # Ignore invalid capo
                    continue

                # Handle section markers
                if directive in self.SECTION_MARKERS:
                    section_name, marker_type = self.SECTION_MARKERS[directive]

                    if marker_type == 'start':
                        # Check if directive has a value (e.g., {start_of_verse: 2})
                        if value:
                            section_name = f"{section_name} {value}"

                        # Save previous section if exists
                        if current_section is not None:
                            sections.append(current_section)

                        # Determine section type
                        section_type = "instrumental" if section_name == "instrumental" else "vocal"

                        # Start new section
                        current_section = SectionInput(
                            name=section_name,
                            section_type=section_type,
                        )
                        in_explicit_section = True

                    elif marker_type == 'end':
                        # End current section
                        if current_section is not None:
                            sections.append(current_section)
                            current_section = None
                        in_explicit_section = False

                    continue

                # Ignore unknown directives (including x_directives)
                continue

            # If we have content but no section, create a default one
            if current_section is None:
                current_section = SectionInput(
                    name=current_section_name,
                    section_type="vocal",
                )

            # Parse line with inline chords
            if self._contains_chords(line):
                chord_lyrics_line = self._parse_chord_lyrics_line(line)
                current_section.lines.append(chord_lyrics_line)

        # Add final section if not already added by end marker
        if current_section is not None:
            sections.append(current_section)

        return SongInput(
            title=metadata['title'],
            artist=metadata['artist'],
            key=metadata['key'],
            sections=sections,
        )

    def _contains_chords(self, line: str) -> bool:
        """Check if a line contains inline chord notation.

        Args:
            line: Line to check

        Returns:
            True if line contains [chord] notation
        """
        return bool(self.INLINE_CHORD_PATTERN.search(line))

    def _parse_chord_lyrics_line(self, line: str) -> ChordLyricsLine:
        """Parse a line with inline chord notation into ChordLyricsLine model.

        Extracts chords and their column positions, then removes chords from lyrics.

        Example:
            Input:  "[Am]When I find my[F]self in [C]times of [G]trouble"
            Output: ChordLyricsLine(
                        chords=[(0, "Am"), (14, "F"), (22, "C"), (31, "G")],
                        lyrics="When I find myself in times of trouble"
                    )

        Args:
            line: Line with inline chord notation

        Returns:
            ChordLyricsLine with extracted chords and lyrics
        """
        chords: List[Tuple[int, str]] = []
        lyrics_parts: List[str] = []

        # Split on chord pattern but keep the chord info
        last_end = 0
        for match in self.INLINE_CHORD_PATTERN.finditer(line):
            chord_symbol = match.group(1)
            match_start = match.start()
            match_end = match.end()

            # Get lyrics before this chord
            lyrics_before = line[last_end:match_start]
            lyrics_parts.append(lyrics_before)

            # Calculate chord position in final lyrics string
            chord_position = sum(len(part) for part in lyrics_parts)
            chords.append((chord_position, chord_symbol))

            last_end = match_end

        # Add remaining lyrics after last chord
        lyrics_parts.append(line[last_end:])
        lyrics = ''.join(lyrics_parts)

        return ChordLyricsLine(chords=chords, lyrics=lyrics)
