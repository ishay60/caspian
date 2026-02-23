"""Chord symbol completion ordered by musical anticipation (musicgraphic).

Returns chord symbols matching a prefix, ordered: diatonic in key first,
then by quality priority (e.g. Am before A), then lexicographic.
"""

from __future__ import annotations

from caspian.models.key import Key
from caspian.parsing.chord_parser import parse_chord
from caspian.theory.pitch import NOTE_TO_PITCH, parse_note_name
from caspian.theory.scales import is_diatonic

# Parser suffixes (for generating all symbols). Order does not affect completion sort.
_PARSER_SUFFIXES: list[str] = [
    "m7b5",
    "maj7",
    "dim7",
    "dim",
    "aug",
    "7sus4",
    "sus4",
    "sus2",
    "m7",
    "m6",
    "m",
    "7",
    "6",
    "+",
    "M7",
]

# Anticipation order: most anticipated first when same root (e.g. Am before A before Am7).
# Triads (m, major) first, then common 7ths, then rest.
_ANTICIPATION_ORDER: list[str] = [
    "m",      # minor triad
    "",       # major triad
    "m7",
    "7",
    "maj7",
    "M7",
    "dim",
    "m7b5",
    "dim7",
    "6",
    "m6",
    "sus4",
    "7sus4",
    "sus2",
    "aug",
    "+",
]

# All chord symbols the parser accepts: root + suffix for each (root, suffix).
def _all_chord_symbols() -> list[str]:
    symbols: list[str] = []
    for root in NOTE_TO_PITCH:
        symbols.append(root)  # major
        for suffix in _PARSER_SUFFIXES:
            symbols.append(root + suffix)
    return symbols


_ALL_SYMBOLS: list[str] = _all_chord_symbols()


def _anticipation_index(symbol: str) -> int:
    """Lower index = higher anticipation (e.g. m then major then m7)."""
    try:
        root_name, _ = parse_note_name(symbol)
    except ValueError:
        return 999
    suffix = symbol[len(root_name):]
    if suffix in _ANTICIPATION_ORDER:
        return _ANTICIPATION_ORDER.index(suffix)
    return 500


def chord_completions(
    prefix: str,
    key_root_name: str,
    key_mode: str,
    prev_chord_symbol: str | None = None,
    next_chord_symbol: str | None = None,
    limit: int = 30,
) -> list[str]:
    """Return chord symbols that start with prefix, ordered by musical anticipation.

    Order: diatonic in key first, then by quality priority (e.g. Am before A),
    then by suffix priority index, then lexicographic. prev_chord_symbol and
    next_chord_symbol are reserved for future context-aware ranking.

    Raises ValueError if key_root_name or key_mode is invalid.
    """
    prefix = prefix.strip()
    if not prefix:
        return []

    try:
        key = Key.from_name(key_root_name, key_mode)
    except ValueError:
        raise

    # Filter by prefix (case-insensitive so "a" matches "Am", "A", "Ab")
    pre_lower = prefix.lower()
    candidates = [s for s in _ALL_SYMBOLS if s.lower().startswith(pre_lower)]

    # Parse each and compute (is_diatonic, anticipation_index) for sort key
    def sort_key(symbol: str) -> tuple[bool, int, str]:
        is_diatonic_bool = False
        try:
            chord = parse_chord(symbol)
            is_diatonic_bool = is_diatonic(chord, key)
        except ValueError:
            pass
        # Diatonic first, then by anticipation (Am before A before Am7), then lexicographic
        return (not is_diatonic_bool, _anticipation_index(symbol), symbol)

    candidates.sort(key=sort_key)
    return candidates[:limit]
