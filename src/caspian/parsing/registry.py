"""Parser registry for multi-format detection and routing.

Phase 3.2: Multi-Format Parser Registry
Detects input format and routes to the appropriate parser.

Supported formats:
- format_a: Native Caspian format with metadata and sections
- website_paste: Plain text paste from website (chord/lyrics alternating)
- ug_html: Ultimate Guitar HTML paste
- tab4u_html: Tab4u HTML paste
- chordpro: ChordPro format (.cho, .chopro, .crd)
- bar_notation: Bar line notation (| chord | chord |)
"""

from __future__ import annotations

from enum import Enum
from typing import Protocol

from caspian.models.input import SongInput


class InputFormat(str, Enum):
    """Supported input format types."""
    FORMAT_A = "format_a"
    WEBSITE_PASTE = "website_paste"
    UG_HTML = "ug_html"
    TAB4U_HTML = "tab4u_html"
    CHORDPRO = "chordpro"
    BAR_NOTATION = "bar_notation"
    UNKNOWN = "unknown"


class FormatDetector:
    """Detects input format from raw text using heuristics."""

    @staticmethod
    def detect(text: str) -> InputFormat:
        """Detect the input format from raw text.

        Detection priority (checked in order):
        1. UG HTML - strongest indicators
        2. Tab4u HTML - unique Hebrew site markers
        3. ChordPro - distinctive directive syntax
        4. Format A - explicit metadata/structure
        5. Bar notation - pipe-delimited chord patterns
        6. Website paste - fallback for alternating chord/lyrics
        7. Unknown - if no patterns match

        Args:
            text: Raw input text to analyze

        Returns:
            Detected InputFormat enum value
        """
        if not text or not text.strip():
            return InputFormat.UNKNOWN

        stripped = text.strip()

        # 1. Check for Ultimate Guitar HTML
        if FormatDetector._is_ug_html(stripped):
            return InputFormat.UG_HTML

        # 2. Check for Tab4u HTML
        if FormatDetector._is_tab4u_html(stripped):
            return InputFormat.TAB4U_HTML

        # 3. Check for ChordPro format
        if FormatDetector._is_chordpro(stripped):
            return InputFormat.CHORDPRO

        # 4. Check for Format A (explicit structure)
        if FormatDetector._is_format_a(stripped):
            return InputFormat.FORMAT_A

        # 5. Check for bar notation
        if FormatDetector._is_bar_notation(stripped):
            return InputFormat.BAR_NOTATION

        # 6. Default to website paste if contains chords/lyrics
        if FormatDetector._looks_like_chord_sheet(stripped):
            return InputFormat.WEBSITE_PASTE

        return InputFormat.UNKNOWN

    @staticmethod
    def _is_ug_html(text: str) -> bool:
        """Check if text is Ultimate Guitar HTML paste."""
        ug_indicators = [
            '<div class="js-tab-content"',
            'data-content="chord"',
            'ultimate-guitar.com',
            'class="js-store"',
        ]
        return any(indicator in text for indicator in ug_indicators)

    @staticmethod
    def _is_tab4u_html(text: str) -> bool:
        """Check if text is Tab4u HTML paste."""
        tab4u_indicators = [
            'class="song_words"',
            'tab4u.com',
            'class="chords"',
            'class="lyrics"',
        ]
        return any(indicator in text for indicator in tab4u_indicators)

    @staticmethod
    def _is_chordpro(text: str) -> bool:
        """Check if text uses ChordPro format.

        ChordPro uses curly-brace directives like {title:}, {key:}
        and square-bracket inline chords like [Am]lyrics.
        """
        import re

        # ChordPro directives: {title:}, {key:}, {artist:}, {comment:}, etc.
        directive_pattern = re.compile(r'\{(?:title|key|artist|comment|start_of_chorus|end_of_chorus|soc|eoc):', re.IGNORECASE)
        if directive_pattern.search(text):
            return True

        # Inline chord notation: [Am], [G7], [Dmaj7]
        # Must be paired with lyrics content (not just a bracket section header)
        inline_chord_pattern = re.compile(r'\[[A-G][#b]?[a-zA-Z0-9+/]*\]\w')
        if inline_chord_pattern.search(text):
            return True

        return False

    @staticmethod
    def _is_format_a(text: str) -> bool:
        """Check if text uses Format A (native Caspian format).

        Format A indicators:
        - Explicit metadata: "key: Am", "title: ...", "artist: ..."
        - Bracket section headers: [intro], [verse], [chorus]
        - Section header as first non-empty line (intro:, verse:)
        """
        import re

        lines = text.split('\n')

        # Check for explicit key metadata (strong signal)
        if re.search(r'^\s*key\s*:\s*[A-G]', text, re.IGNORECASE | re.MULTILINE):
            return True

        # Check for bracket section headers
        if re.search(r'^\s*\[[a-z]+\]\s*$', text, re.IGNORECASE | re.MULTILINE):
            return True

        # Check if first non-empty line is a section header
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            # Section header at start: "intro:", "verse:", etc.
            if re.match(r'^(intro|verse|chorus|bridge|outro|instrumental):', stripped, re.IGNORECASE):
                return True
            break

        return False

    @staticmethod
    def _is_bar_notation(text: str) -> bool:
        """Check if text uses bar notation (| chord | chord |).

        Bar notation has multiple lines with pipe-delimited chords.
        """
        import re

        # Pattern: | chord(s) | chord(s) |
        bar_pattern = re.compile(r'\|[\s\w#b/+\-]+\|')

        lines = text.split('\n')
        bar_line_count = 0

        for line in lines:
            stripped = line.strip()
            if bar_pattern.search(stripped):
                bar_line_count += 1

        # At least 2 lines with bar notation suggests this format
        return bar_line_count >= 2

    @staticmethod
    def _looks_like_chord_sheet(text: str) -> bool:
        """Check if text contains chord-like content (fallback heuristic).

        Returns True if text has multiple chord symbols that suggest
        it's a chord sheet of some kind.
        """
        import re

        # Count chord-like patterns
        chord_pattern = re.compile(r'\b[A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?[0-9]?\b')
        matches = chord_pattern.findall(text)

        # At least 3 chord-like matches suggests a chord sheet
        return len(matches) >= 3


class ChordSheetParser(Protocol):
    """Protocol for chord sheet parsers.

    All parsers must implement a `parse` method that takes
    raw text and returns a validated SongInput model.
    """

    def parse(self, text: str) -> SongInput:
        """Parse raw text into a SongInput model.

        Args:
            text: Raw input text in the parser's format

        Returns:
            Validated SongInput model

        Raises:
            ValueError: If text cannot be parsed
        """
        ...


class ParserRegistry:
    """Central registry for format detection and parser routing."""

    def __init__(self) -> None:
        """Initialize empty registry."""
        self._parsers: dict[InputFormat, ChordSheetParser] = {}

    def register(self, format_type: InputFormat, parser: ChordSheetParser) -> None:
        """Register a parser for a specific format.

        Args:
            format_type: The format this parser handles
            parser: Parser instance implementing ChordSheetParser protocol
        """
        self._parsers[format_type] = parser

    def parse(self, text: str, format_hint: InputFormat | None = None) -> SongInput:
        """Parse text using auto-detection or explicit format hint.

        Args:
            text: Raw input text to parse
            format_hint: Optional explicit format (overrides auto-detection)

        Returns:
            Validated SongInput model

        Raises:
            ValueError: If format is unsupported or parsing fails
        """
        # Use explicit hint or auto-detect
        format_type = format_hint if format_hint else FormatDetector.detect(text)

        if format_type == InputFormat.UNKNOWN:
            raise ValueError("Could not detect input format. Please specify format explicitly.")

        if format_type not in self._parsers:
            raise ValueError(f"No parser registered for format: {format_type}")

        parser = self._parsers[format_type]
        return parser.parse(text)

    def get_parser(self, format_type: InputFormat) -> ChordSheetParser | None:
        """Get registered parser for a specific format.

        Args:
            format_type: The format type to look up

        Returns:
            Parser instance or None if not registered
        """
        return self._parsers.get(format_type)


# Global singleton registry instance
_global_registry: ParserRegistry | None = None


def get_global_registry() -> ParserRegistry:
    """Get or create the global parser registry.

    Returns:
        The global ParserRegistry singleton
    """
    global _global_registry
    if _global_registry is None:
        _global_registry = ParserRegistry()
    return _global_registry
