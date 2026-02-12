"""tab4u chord symbol normalization.

Handles tab4u-specific conventions like sus7 meaning 7sus4.
"""

from __future__ import annotations

import re

# Suffix normalizations applied before parsing.
# Order matters: longer patterns first.
_SUFFIX_NORMALIZATIONS: list[tuple[str, str]] = [
    ("sus7", "7sus4"),  # tab4u writes Bsus7 meaning B7sus4
]


def normalize_chord_symbol(symbol: str) -> str:
    """Normalize a tab4u chord symbol to standard notation."""
    symbol = symbol.strip()
    if not symbol:
        return symbol

    # Split off bass note if present
    if "/" in symbol:
        main, bass = symbol.rsplit("/", 1)
    else:
        main, bass = symbol, None

    # Extract root (1-2 chars)
    root_match = re.match(r"[A-G][#b]?", main)
    if not root_match:
        return symbol
    root = root_match.group()
    suffix = main[len(root):]

    # Apply suffix normalizations
    for old, new in _SUFFIX_NORMALIZATIONS:
        if suffix == old:
            suffix = new
            break

    result = root + suffix
    if bass:
        result += "/" + bass
    return result
