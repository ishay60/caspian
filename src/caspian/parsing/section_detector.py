"""Detect and normalize song section headers from varied input formats.

Handles many common ways sections appear in chord sheets and lyrics:
- Bracketed:    [Chorus], [verse 1], [BRIDGE]
- Braced:       {Chorus}, {verse}
- Parenthesized:(Chorus), (Verse 1)
- Colon suffix: Chorus:, VERSE:, פזמון:
- Decorated:    -- Chorus --, ** Bridge **, === Intro ===
- Bare:         Chorus, Verse, Bridge (standalone on a line)
- Numbered:     Chorus 1, Verse 2, Chorus (x2)
- Hebrew:       פזמון, בית, הקדמה, סיום, גשר, סולו, אינטרומנטל
"""

from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Canonical section names (English)
# ---------------------------------------------------------------------------
# Maps lowercase aliases to the canonical Format-A name used throughout Caspian.
_ENGLISH_ALIASES: dict[str, str] = {
    # chorus
    "chorus": "chorus",
    "refrain": "chorus",
    "hook": "chorus",
    # verse
    "verse": "verse",
    # bridge
    "bridge": "bridge",
    # pre-chorus
    "pre-chorus": "pre-chorus",
    "prechorus": "pre-chorus",
    "pre chorus": "pre-chorus",
    # post-chorus
    "post-chorus": "post-chorus",
    "postchorus": "post-chorus",
    "post chorus": "post-chorus",
    # intro
    "intro": "intro",
    "introduction": "intro",
    # outro
    "outro": "outro",
    "ending": "outro",
    "coda": "outro",
    # instrumental
    "instrumental": "instrumental",
    "interlude": "interlude",
    # solo
    "solo": "solo",
    # tag / breakdown / misc
    "tag": "tag",
    "breakdown": "breakdown",
    "vamp": "vamp",
}

# ---------------------------------------------------------------------------
# Hebrew section names
# ---------------------------------------------------------------------------
_HEBREW_ALIASES: dict[str, str] = {
    "פזמון": "chorus",
    "בית": "verse",
    "הקדמה": "intro",
    "פתיחה": "intro",
    "סיום": "outro",
    "גשר": "bridge",
    "סולו": "solo",
    "אינטרומנטל": "instrumental",
    "אינטרלוד": "interlude",
}

# ---------------------------------------------------------------------------
# Regex building blocks
# ---------------------------------------------------------------------------
# Build alternation of all known English aliases (longest first to avoid partial matches)
_sorted_en = sorted(_ENGLISH_ALIASES.keys(), key=len, reverse=True)
_EN_NAMES = "|".join(re.escape(a) for a in _sorted_en)

# Hebrew section words
_sorted_heb = sorted(_HEBREW_ALIASES.keys(), key=len, reverse=True)
_HEB_NAMES = "|".join(re.escape(h) for h in _sorted_heb)

# Optional numbering / repeat suffix:  "1", "2", "(x2)", "#3", etc.
_NUM_SUFFIX = r"(?:\s*(?:#?\d+|\(x\d+\)))?"

# Core pattern: an English or Hebrew section name with optional number
_CORE = rf"(?P<en>{_EN_NAMES})|(?P<heb>{_HEB_NAMES})"
_CORE_WITH_NUM = rf"(?:(?P<en>{_EN_NAMES})|(?P<heb>{_HEB_NAMES})){_NUM_SUFFIX}"

# ---------------------------------------------------------------------------
# Full-line patterns (order matters — first match wins)
# ---------------------------------------------------------------------------
_PATTERNS: list[re.Pattern[str]] = [
    # [Section], [Section 1], [Chorus (x2)]
    re.compile(
        rf"^\s*\[\s*(?:{_CORE_WITH_NUM})\s*\]\s*$",
        re.IGNORECASE,
    ),
    # {Section}, {Section 1}
    re.compile(
        rf"^\s*\{{\s*(?:{_CORE_WITH_NUM})\s*\}}\s*$",
        re.IGNORECASE,
    ),
    # (Section), (Section 1)
    re.compile(
        rf"^\s*\(\s*(?:{_CORE_WITH_NUM})\s*\)\s*$",
        re.IGNORECASE,
    ),
    # -- Section --, --- Chorus ---, == Bridge ==
    re.compile(
        rf"^\s*[-=*]{{2,}}\s*(?:{_CORE_WITH_NUM})\s*[-=*]{{2,}}\s*$",
        re.IGNORECASE,
    ),
    # Section: or Section :  (colon suffix, English or Hebrew)
    re.compile(
        rf"^\s*(?:{_CORE_WITH_NUM})\s*:\s*$",
        re.IGNORECASE,
    ),
    # Bare section name on its own line: "Chorus", "Verse 2", "פזמון"
    # Must be the whole line (stripped) to avoid false positives.
    re.compile(
        rf"^\s*(?:{_CORE_WITH_NUM})\s*$",
        re.IGNORECASE,
    ),
]


def detect_section(line: str) -> str | None:
    """Try to detect a section header from *line*.

    Returns the canonical section name (e.g. ``"chorus"``, ``"verse"``) or
    ``None`` if the line is not a section header.
    """
    for pat in _PATTERNS:
        m = pat.match(line)
        if m:
            en = m.group("en")
            heb = m.group("heb")
            if en:
                return _ENGLISH_ALIASES[en.lower()]
            if heb:
                return _HEBREW_ALIASES[heb]
    return None


def detect_section_bracket(line: str) -> str | None:
    """Format the detected section as a ``[name]`` string, or ``None``.

    Convenience wrapper: returns e.g. ``"[chorus]"`` ready for Format A.
    """
    name = detect_section(line)
    if name is not None:
        return f"[{name}]"
    return None
