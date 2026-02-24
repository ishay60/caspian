"""Bar line notation parser.

Parses bar notation like: | Am | F | C | G |
Converts to Bar data model with proper beat positions.

Supported patterns:
- Single bar: | Am |
- Multiple bars: | Am | F | C | G |
- Multiple chords per bar: | Am F | C G |
- Repeat markers: |: Am | F :|
- Mixed densities: | Am7 | Fmaj7 C/E | Dm7 G7 |

Phase 3.3: Bar Line Detection
"""

from __future__ import annotations

import re
from typing import List

from caspian.models.input import (
    Bar,
    BarChord,
    BarContent,
    BeatPosition,
    SectionInput,
    SongInput,
)
from caspian.parsing.chord_parser import parse_chord


class BarNotationParser:
    """Parser for bar line notation format."""

    # Pattern to detect bar notation lines
    # Matches: | chord(s) | chord(s) |
    # Supports: repeat markers (|:, :|), chord symbols with #, b, /, +, numbers
    BAR_LINE_PATTERN = re.compile(
        r'^\s*\|:?\s*[A-G][#b]?[\w#b/+\-\s]*(?:\|:?\s*[A-G][#b]?[\w#b/+\-\s]*)*\|:?\s*$'
    )

    # Pattern to extract individual bars from a line
    # Captures content between pipes, handling repeat markers
    BAR_CONTENT_PATTERN = re.compile(r'\|:?\s*([^|]+?)\s*(?=\||$)')

    # Pattern to detect section headers
    SECTION_HEADER_PATTERN = re.compile(
        r'^\s*\[?([a-z]+)\]?:?\s*$', re.IGNORECASE
    )

    # Pattern to validate chord symbols
    CHORD_PATTERN = re.compile(r'^[A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?[0-9]?(?:/[A-G][#b]?)?$')

    def parse(self, text: str) -> SongInput:
        """Parse bar notation text into a SongInput model.

        Args:
            text: Raw input text in bar notation format

        Returns:
            Validated SongInput model

        Raises:
            ValueError: If text cannot be parsed
        """
        if not text or not text.strip():
            raise ValueError("Empty input text")

        lines = text.strip().split('\n')
        sections: List[SectionInput] = []
        current_section: SectionInput | None = None
        current_section_name = "section_1"
        section_counter = 1

        for line in lines:
            stripped = line.strip()

            # Skip empty lines
            if not stripped:
                continue

            # Check if it's a section header
            section_match = self.SECTION_HEADER_PATTERN.match(stripped)
            if section_match:
                # Save previous section if exists
                if current_section is not None:
                    sections.append(current_section)

                # Start new section
                current_section_name = section_match.group(1).lower()
                current_section = SectionInput(
                    name=current_section_name,
                    section_type="vocal" if current_section_name not in ["intro", "outro", "solo"] else "instrumental",
                )
                continue

            # Check if it's a bar line
            if self.is_bar_notation_line(stripped):
                # Create section if none exists
                if current_section is None:
                    current_section = SectionInput(
                        name=current_section_name,
                        section_type="vocal",
                    )

                # Parse the bar line and add bars to section
                bars = self.parse_bar_line(stripped)
                current_section.bars.extend(bars)

        # Add final section
        if current_section is not None:
            sections.append(current_section)

        return SongInput(sections=sections)

    def is_bar_notation_line(self, line: str) -> bool:
        """Check if a line contains bar notation.

        Detection rules:
        - Line must contain at least one pipe character |
        - Must have chord-like content between pipes
        - Chord symbols must start with A-G note names
        - Supports repeat markers |: and :|

        Args:
            line: Line to check

        Returns:
            True if line contains bar notation pattern
        """
        line = line.strip()

        # Must contain at least one pipe
        if '|' not in line:
            return False

        # Must start and end with pipes (with optional repeat markers)
        if not (line.startswith('|') or line.startswith('|:')):
            return False
        if not (line.endswith('|') or line.endswith(':|')):
            return False

        # Check that content between pipes looks like chords
        # Extract all segments between pipes
        segments = [s.strip() for s in line.split('|') if s.strip() and s.strip() != ':']

        if not segments:
            return False

        # At least one segment must contain a valid chord
        has_valid_chord = False
        for segment in segments:
            # Skip repeat markers
            if segment == ':':
                continue

            # Check if segment contains chord-like content
            tokens = segment.split()
            for token in tokens:
                if self.CHORD_PATTERN.match(token):
                    has_valid_chord = True
                    break

            if has_valid_chord:
                break

        return has_valid_chord

    def parse_bar_line(self, line: str) -> List[Bar]:
        """Parse a single line of bar notation into Bar objects.

        Args:
            line: Bar notation line (e.g., "| Am | F | C | G |")

        Returns:
            List of Bar objects

        Raises:
            ValueError: If line cannot be parsed
        """
        # Remove leading/trailing whitespace
        line = line.strip()

        # Remove repeat markers for now (will handle in future)
        line = line.replace('|:', '|').replace(':|', '|')

        # Split by pipes and filter empty segments
        segments = [s.strip() for s in line.split('|') if s.strip()]

        bars: List[Bar] = []

        for segment in segments:
            # Parse chords in this bar segment
            # Multiple chords can be space-separated: "Am F"
            chord_symbols = segment.split()

            if not chord_symbols:
                continue

            # Create BarChord objects with beat positions
            bar_chords = self._map_chords_to_beats(chord_symbols)

            # Create Bar object
            bar = Bar(
                time_signature=(4, 4),
                content=BarContent(chords=bar_chords),
            )
            bars.append(bar)

        return bars

    def _map_chords_to_beats(
        self, chord_symbols: List[str], time_signature: tuple[int, int] = (4, 4)
    ) -> List[BarChord]:
        """Map chord symbols to beat positions within a bar.

        Beat position mapping rules for 4/4 time:
        - 1 chord: beat 1 (whole bar)
        - 2 chords: beats 1, 3 (half notes)
        - 3 chords: beats 1, 2, 3 (uneven - common in practice)
        - 4 chords: beats 1, 2, 3, 4 (quarter notes)
        - 5-8 chords: use subdivisions (eighth notes, 16th notes)

        For other time signatures:
        - Distributes chords evenly across available beats

        Args:
            chord_symbols: List of chord symbols in order
            time_signature: Time signature (numerator, denominator), default (4, 4)

        Returns:
            List of BarChord objects with beat positions
        """
        num_chords = len(chord_symbols)
        bar_chords: List[BarChord] = []

        if num_chords == 0:
            return bar_chords

        beats_per_bar = time_signature[0]

        # Define beat/subdivision mappings for common cases in 4/4
        if time_signature == (4, 4):
            if num_chords == 1:
                positions = [(1, 0)]
            elif num_chords == 2:
                positions = [(1, 0), (3, 0)]
            elif num_chords == 3:
                positions = [(1, 0), (2, 0), (3, 0)]
            elif num_chords == 4:
                positions = [(1, 0), (2, 0), (3, 0), (4, 0)]
            elif num_chords == 5:
                # 5 chords: 1, 1&, 2, 3, 4 (example distribution)
                positions = [(1, 0), (1, 2), (2, 0), (3, 0), (4, 0)]
            elif num_chords == 6:
                # 6 chords: 1, 1&, 2, 2&, 3, 4 (example distribution)
                positions = [(1, 0), (1, 2), (2, 0), (2, 2), (3, 0), (4, 0)]
            elif num_chords == 7:
                # 7 chords: 1, 1&, 2, 2&, 3, 3&, 4
                positions = [(1, 0), (1, 2), (2, 0), (2, 2), (3, 0), (3, 2), (4, 0)]
            elif num_chords == 8:
                # 8 chords: eighth notes on all beats and subdivisions
                positions = [(1, 0), (1, 2), (2, 0), (2, 2), (3, 0), (3, 2), (4, 0), (4, 2)]
            else:
                # More than 8: use 16th note grid
                positions = []
                for i in range(num_chords):
                    beat = (i // 4) + 1
                    subdivision = (i % 4)
                    if beat <= beats_per_bar:
                        positions.append((beat, subdivision))
                    else:
                        # Overflow - just append to end
                        positions.append((beats_per_bar, subdivision))
        else:
            # For non-4/4 time signatures, distribute evenly across beats
            positions = []
            for i in range(num_chords):
                beat = (i % beats_per_bar) + 1
                subdivision = 0
                positions.append((beat, subdivision))

        # Create BarChord objects
        for i, symbol in enumerate(chord_symbols):
            if i < len(positions):
                beat, subdivision = positions[i]
            else:
                # Fallback for unexpected cases
                beat = (i % beats_per_bar) + 1
                subdivision = 0

            bar_chord = BarChord(
                symbol=symbol,
                beat_position=BeatPosition(beat=beat, subdivision=subdivision),
            )
            bar_chords.append(bar_chord)

        return bar_chords
