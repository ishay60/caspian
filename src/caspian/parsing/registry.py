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

        # TODO: Implement detection heuristics (Task 3.2.3)
        return InputFormat.UNKNOWN


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
