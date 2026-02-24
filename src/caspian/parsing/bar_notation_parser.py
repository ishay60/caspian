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
    BAR_LINE_PATTERN = re.compile(
        r'^\s*\|:?\s*[\w#b/+\-\s]+\s*(?:\|:?\s*[\w#b/+\-\s]*)*\|:?\s*$'
    )

    # Pattern to split bars
    # Splits on | but preserves repeat markers |: and :|
    BAR_SPLIT_PATTERN = re.compile(r'\|:?')

    # Pattern to detect section headers
    SECTION_HEADER_PATTERN = re.compile(
        r'^\s*\[?([a-z]+)\]?:?\s*$', re.IGNORECASE
    )

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

        Args:
            line: Line to check

        Returns:
            True if line contains bar notation pattern
        """
        return bool(self.BAR_LINE_PATTERN.match(line))

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

    def _map_chords_to_beats(self, chord_symbols: List[str]) -> List[BarChord]:
        """Map chord symbols to beat positions within a bar.

        Beat position mapping rules:
        - 1 chord: beat 1
        - 2 chords: beats 1, 3
        - 3 chords: beats 1, 2, 3
        - 4 chords: beats 1, 2, 3, 4
        - More than 4: evenly distributed

        Args:
            chord_symbols: List of chord symbols in order

        Returns:
            List of BarChord objects with beat positions
        """
        num_chords = len(chord_symbols)
        bar_chords: List[BarChord] = []

        if num_chords == 0:
            return bar_chords

        # Define beat position mappings
        if num_chords == 1:
            beat_positions = [1]
        elif num_chords == 2:
            beat_positions = [1, 3]
        elif num_chords == 3:
            beat_positions = [1, 2, 3]
        elif num_chords == 4:
            beat_positions = [1, 2, 3, 4]
        else:
            # More than 4: distribute evenly (simplified for now)
            # This is a placeholder - real implementation would handle subdivisions
            beat_positions = list(range(1, num_chords + 1))

        for i, symbol in enumerate(chord_symbols):
            beat = beat_positions[i] if i < len(beat_positions) else i + 1

            bar_chord = BarChord(
                symbol=symbol,
                beat_position=BeatPosition(beat=beat, subdivision=0),
            )
            bar_chords.append(bar_chord)

        return bar_chords
