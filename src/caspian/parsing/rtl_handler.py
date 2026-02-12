"""RTL/LTR handling for Hebrew chord charts.

Critical rule:
- Lines WITH Hebrew lyrics: chords read RIGHT to LEFT (RTL)
- Lines WITHOUT Hebrew (intros, instrumentals): chords read LEFT to RIGHT (LTR)
"""

from __future__ import annotations

import re

HEBREW_PATTERN = re.compile(r"[\u0590-\u05FF]")

_INSTRUMENTAL_KEYWORDS = frozenset([
    "intro", "outro", "instrumental", "solo",
    "פתיחה", "סיום", "סולו",
])


def has_hebrew(text: str) -> bool:
    """Check if text contains Hebrew characters."""
    return bool(HEBREW_PATTERN.search(text))


def normalize_chord_order(chords: list[str], context: str) -> list[str]:
    """Return chords in chronological performance order.

    Given chords as they appear visually (left to right on screen)
    and context text:
    - If context contains Hebrew → visual order is RTL → reverse for chronological
    - If context is ASCII only → visual order is already LTR/chronological
    """
    if has_hebrew(context):
        return list(reversed(chords))
    return list(chords)


def detect_section_type(header: str) -> str:
    """Detect if a section header implies instrumental (LTR) or vocal (RTL).

    Returns 'instrumental' or 'vocal'.
    """
    header_lower = header.lower().strip("[] ")
    for kw in _INSTRUMENTAL_KEYWORDS:
        if kw in header_lower:
            return "instrumental"
    return "vocal"
