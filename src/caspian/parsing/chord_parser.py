"""Multi-step priority chord parser.

Parses chord symbols like "Am/E", "D#dim", "Bm7b5" into Chord objects.
Uses a priority-ordered suffix list to resolve ambiguity (e.g. Am7 = minor7, not A + m7).
"""

from __future__ import annotations

from caspian.models.chord import Chord, ChordQuality, QUALITY_INTERVALS
from caspian.parsing.tab4u_normalize import normalize_chord_symbol
from caspian.theory.pitch import parse_note_name

# Priority-ordered suffix → ChordQuality mapping.
# Longer/more specific patterns first to avoid ambiguous matches.
_SUFFIX_PRIORITY: list[tuple[str, ChordQuality]] = [
    ("m7b5", ChordQuality.HALF_DIMINISHED),
    ("maj7", ChordQuality.MAJOR7),
    ("dim7", ChordQuality.DIMINISHED7),
    ("dim", ChordQuality.DIMINISHED),
    ("aug", ChordQuality.AUGMENTED),
    ("7sus4", ChordQuality.DOMINANT7SUS4),
    ("sus4", ChordQuality.SUSPENDED4),
    ("sus2", ChordQuality.SUSPENDED2),
    ("m7", ChordQuality.MINOR7),
    ("m6", ChordQuality.MINOR6),
    ("m", ChordQuality.MINOR),
    ("7", ChordQuality.DOMINANT7),
    ("6", ChordQuality.MAJOR6),
    ("+", ChordQuality.AUGMENTED),
    ("M7", ChordQuality.MAJOR7),
]


def parse_chord(symbol: str) -> Chord:
    """Parse a chord symbol string into a Chord object.

    Raises ValueError if the symbol cannot be parsed.
    """
    original = symbol.strip()
    if not original:
        raise ValueError("Empty chord symbol")

    # Step 0: tab4u normalization
    normalized = normalize_chord_symbol(original)

    # Step 1: Split off /bass if present
    bass_name_override: str | None = None
    bass_pitch_override: int | None = None
    main = normalized
    if "/" in normalized:
        parts = normalized.rsplit("/", 1)
        main = parts[0]
        bass_str = parts[1]
        bass_name_override, bass_pitch_override = parse_note_name(bass_str)

    # Step 2: Extract root note
    root_name, root_pitch = parse_note_name(main)
    suffix = main[len(root_name):]

    # Step 3: Match quality from priority-ordered suffix list
    quality = ChordQuality.MAJOR  # default
    for sfx, q in _SUFFIX_PRIORITY:
        if suffix == sfx:
            quality = q
            break

    # Step 4: Compute pitches
    intervals = QUALITY_INTERVALS[quality]
    pitches = tuple(sorted(set((root_pitch + i) % 12 for i in intervals)))

    # Step 5: Determine bass
    bass_pitch = bass_pitch_override if bass_pitch_override is not None else root_pitch
    bass_name = bass_name_override if bass_name_override is not None else root_name

    return Chord(
        symbol=original,
        root=root_pitch,
        root_name=root_name,
        quality=quality,
        bass=bass_pitch,
        bass_name=bass_name,
        pitches=pitches,
    )
