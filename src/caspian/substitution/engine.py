"""Chord substitution suggestion engine.

Generates substitution suggestions for a given chord in a musical key context,
using tritone substitution, relative major/minor, parallel major/minor,
diatonic functional exchange, modal interchange, and secondary dominants.
"""

from __future__ import annotations

from caspian.models.chord import Chord, ChordQuality, QUALITY_INTERVALS
from caspian.models.key import Key, SCALES
from caspian.parsing.chord_parser import parse_chord
from caspian.substitution.models import ChordSubstitution
from caspian.theory.pitch import is_flat_key, note_name
from caspian.theory.scales import build_diatonic_triads, degree_of
from caspian.theory.voice_leading import common_tones, voice_leading_distance


# Mapping from ChordQuality to the suffix used in chord symbols.
_QUALITY_TO_SUFFIX: dict[ChordQuality, str] = {
    ChordQuality.MAJOR: "",
    ChordQuality.MINOR: "m",
    ChordQuality.DIMINISHED: "dim",
    ChordQuality.AUGMENTED: "aug",
    ChordQuality.DOMINANT7: "7",
    ChordQuality.MINOR7: "m7",
    ChordQuality.MAJOR7: "maj7",
    ChordQuality.HALF_DIMINISHED: "m7b5",
    ChordQuality.DIMINISHED7: "dim7",
    ChordQuality.SUSPENDED2: "sus2",
    ChordQuality.SUSPENDED4: "sus4",
    ChordQuality.DOMINANT7SUS4: "7sus4",
    ChordQuality.MINOR6: "m6",
    ChordQuality.MAJOR6: "6",
}

# Functional groups for diatonic exchange (degree -> function name)
_TONIC_DEGREES = {1, 3, 6}
_SUBDOMINANT_DEGREES = {2, 4}
_DOMINANT_DEGREES = {5, 7}

# Roman numeral labels for human-readable reasoning
_DEGREE_LABELS: dict[int, dict[str, str]] = {
    1: {"major": "I", "minor": "i"},
    2: {"major": "ii", "minor": "ii\u00b0"},
    3: {"major": "iii", "minor": "III"},
    4: {"major": "IV", "minor": "iv"},
    5: {"major": "V", "minor": "v"},
    6: {"major": "vi", "minor": "VI"},
    7: {"major": "vii\u00b0", "minor": "VII"},
}


def _prefer_sharp(key_root_name: str) -> bool:
    """Return True if the key prefers sharp spelling."""
    return not is_flat_key(key_root_name)


def _spell_root(pitch: int, key_root_name: str) -> str:
    """Spell a pitch class as a note name appropriate for the key."""
    return note_name(pitch, prefer_sharp=_prefer_sharp(key_root_name))


def _build_chord_symbol(root_pitch: int, quality: ChordQuality, key_root_name: str) -> str:
    """Build a chord symbol string from root pitch and quality."""
    root = _spell_root(root_pitch, key_root_name)
    suffix = _QUALITY_TO_SUFFIX[quality]
    return root + suffix


def _build_chord(root_pitch: int, quality: ChordQuality) -> Chord:
    """Build a Chord object from root pitch and quality (for voice leading calculations)."""
    intervals = QUALITY_INTERVALS[quality]
    pitches = tuple(sorted(set((root_pitch + i) % 12 for i in intervals)))
    root_name = note_name(root_pitch, prefer_sharp=True)
    return Chord(
        symbol=root_name + _QUALITY_TO_SUFFIX[quality],
        root=root_pitch,
        root_name=root_name,
        quality=quality,
        bass=root_pitch,
        bass_name=root_name,
        pitches=pitches,
    )


def _compute_voice_leading(original: Chord, sub: Chord) -> tuple[int, int]:
    """Compute voice leading distance and common tone count between two chords."""
    ct = common_tones(frozenset(original.pitches), frozenset(sub.pitches))
    vld = voice_leading_distance(list(original.pitches), list(sub.pitches))
    return vld, len(ct)


def _degree_label(degree: int, mode: str) -> str:
    """Get a roman numeral label for a scale degree."""
    mode_class = "minor" if "minor" in mode else "major"
    labels = _DEGREE_LABELS.get(degree, {})
    return labels.get(mode_class, str(degree))


def _function_name(degree: int) -> str:
    """Get the functional name for a scale degree."""
    if degree in _TONIC_DEGREES:
        return "tonic"
    if degree in _SUBDOMINANT_DEGREES:
        return "subdominant"
    if degree in _DOMINANT_DEGREES:
        return "dominant"
    return "unknown"


def _tritone_substitutions(
    chord: Chord, key: Key, key_root_name: str
) -> list[ChordSubstitution]:
    """Tritone substitution: V7 -> bII7. Only for dominant-type chords."""
    results: list[ChordSubstitution] = []

    # Only apply to dominant7 and dominant7sus4 qualities
    if chord.quality not in (ChordQuality.DOMINANT7, ChordQuality.DOMINANT7SUS4):
        return results

    # Tritone sub root is 6 semitones away
    sub_root = (chord.root + 6) % 12
    sub_quality = ChordQuality.DOMINANT7
    sub_symbol = _build_chord_symbol(sub_root, sub_quality, key_root_name)
    sub_chord = _build_chord(sub_root, sub_quality)

    vld, ct_count = _compute_voice_leading(chord, sub_chord)

    orig_name = _spell_root(chord.root, key_root_name)
    sub_name = _spell_root(sub_root, key_root_name)
    reasoning = (
        f"Tritone substitution: {sub_symbol} replaces {orig_name}7 "
        f"(roots are a tritone apart, share the same tritone interval between 3rd and 7th)"
    )

    results.append(ChordSubstitution(
        symbol=sub_symbol,
        sub_type="tritone",
        reasoning=reasoning,
        confidence=0.85,
        voice_leading_distance=vld,
        common_tone_count=ct_count,
    ))
    return results


def _relative_substitutions(
    chord: Chord, key: Key, key_root_name: str
) -> list[ChordSubstitution]:
    """Relative major/minor substitution."""
    results: list[ChordSubstitution] = []

    if chord.quality == ChordQuality.MINOR:
        # Minor -> relative major (root + 3 semitones)
        sub_root = (chord.root + 3) % 12
        sub_quality = ChordQuality.MAJOR
        sub_symbol = _build_chord_symbol(sub_root, sub_quality, key_root_name)
        sub_chord = _build_chord(sub_root, sub_quality)
        vld, ct_count = _compute_voice_leading(chord, sub_chord)

        orig_name = _spell_root(chord.root, key_root_name)
        sub_name = _spell_root(sub_root, key_root_name)
        reasoning = (
            f"Relative major: {sub_symbol} is the relative major of {orig_name}m "
            f"(shares 2 of 3 tones)"
        )
        results.append(ChordSubstitution(
            symbol=sub_symbol,
            sub_type="relative",
            reasoning=reasoning,
            confidence=0.80,
            voice_leading_distance=vld,
            common_tone_count=ct_count,
        ))

    elif chord.quality == ChordQuality.MAJOR:
        # Major -> relative minor (root - 3 semitones)
        sub_root = (chord.root - 3) % 12
        sub_quality = ChordQuality.MINOR
        sub_symbol = _build_chord_symbol(sub_root, sub_quality, key_root_name)
        sub_chord = _build_chord(sub_root, sub_quality)
        vld, ct_count = _compute_voice_leading(chord, sub_chord)

        orig_name = _spell_root(chord.root, key_root_name)
        sub_name = _spell_root(sub_root, key_root_name)
        reasoning = (
            f"Relative minor: {sub_symbol} is the relative minor of {orig_name} "
            f"(shares 2 of 3 tones)"
        )
        results.append(ChordSubstitution(
            symbol=sub_symbol,
            sub_type="relative",
            reasoning=reasoning,
            confidence=0.80,
            voice_leading_distance=vld,
            common_tone_count=ct_count,
        ))

    return results


def _parallel_substitutions(
    chord: Chord, key: Key, key_root_name: str
) -> list[ChordSubstitution]:
    """Parallel major/minor substitution (same root, opposite quality)."""
    results: list[ChordSubstitution] = []

    if chord.quality == ChordQuality.MINOR:
        sub_quality = ChordQuality.MAJOR
        label = "major"
    elif chord.quality == ChordQuality.MAJOR:
        sub_quality = ChordQuality.MINOR
        label = "minor"
    else:
        return results

    sub_root = chord.root
    sub_symbol = _build_chord_symbol(sub_root, sub_quality, key_root_name)
    sub_chord = _build_chord(sub_root, sub_quality)
    vld, ct_count = _compute_voice_leading(chord, sub_chord)

    orig_name = _spell_root(chord.root, key_root_name)
    reasoning = (
        f"Parallel {label}: {sub_symbol} shares the same root as "
        f"{orig_name}{_QUALITY_TO_SUFFIX[chord.quality]} but with {label} quality"
    )

    results.append(ChordSubstitution(
        symbol=sub_symbol,
        sub_type="parallel",
        reasoning=reasoning,
        confidence=0.70,
        voice_leading_distance=vld,
        common_tone_count=ct_count,
    ))
    return results


def _diatonic_exchange_substitutions(
    chord: Chord, key: Key, key_root_name: str
) -> list[ChordSubstitution]:
    """Diatonic functional exchange: substitute with another diatonic chord of the same function."""
    results: list[ChordSubstitution] = []

    degree = degree_of(chord.root, key)
    if degree is None:
        return results

    # Determine the functional group
    if degree in _TONIC_DEGREES:
        group = _TONIC_DEGREES
        function = "tonic"
    elif degree in _SUBDOMINANT_DEGREES:
        group = _SUBDOMINANT_DEGREES
        function = "subdominant"
    elif degree in _DOMINANT_DEGREES:
        group = _DOMINANT_DEGREES
        function = "dominant"
    else:
        return results

    diatonic_triads = build_diatonic_triads(key)

    for other_degree in sorted(group):
        if other_degree == degree:
            continue
        sub_root, sub_quality = diatonic_triads[other_degree]
        sub_symbol = _build_chord_symbol(sub_root, sub_quality, key_root_name)
        sub_chord = _build_chord(sub_root, sub_quality)
        vld, ct_count = _compute_voice_leading(chord, sub_chord)

        orig_label = _degree_label(degree, key.mode)
        sub_label = _degree_label(other_degree, key.mode)
        reasoning = (
            f"Diatonic {function} exchange: {sub_label} ({sub_symbol}) "
            f"can substitute for {orig_label} (both have {function} function)"
        )

        results.append(ChordSubstitution(
            symbol=sub_symbol,
            sub_type="diatonic",
            reasoning=reasoning,
            confidence=0.75,
            voice_leading_distance=vld,
            common_tone_count=ct_count,
        ))

    return results


def _modal_interchange_substitutions(
    chord: Chord, key: Key, key_root_name: str
) -> list[ChordSubstitution]:
    """Modal interchange: borrow chords from the parallel mode."""
    results: list[ChordSubstitution] = []

    # Determine parallel mode
    if key.mode in ("major", "mixolydian"):
        parallel_mode = "natural_minor"
    elif key.mode in ("natural_minor", "harmonic_minor", "melodic_minor", "dorian", "phrygian", "phrygian_dominant"):
        parallel_mode = "major"
    else:
        return results

    parallel_key = Key.from_name(key_root_name, parallel_mode)

    original_triads = build_diatonic_triads(key)
    parallel_triads = build_diatonic_triads(parallel_key)

    # Collect original triads as (root, quality) pairs for comparison
    original_set = {(root, quality) for root, quality in original_triads.values()}

    for degree, (sub_root, sub_quality) in parallel_triads.items():
        # Only suggest chords that differ from the original key's diatonic set
        if (sub_root, sub_quality) in original_set:
            continue

        sub_symbol = _build_chord_symbol(sub_root, sub_quality, key_root_name)
        sub_chord = _build_chord(sub_root, sub_quality)
        vld, ct_count = _compute_voice_leading(chord, sub_chord)

        sub_label = _degree_label(degree, parallel_mode)
        reasoning = (
            f"Modal interchange: {sub_symbol} ({sub_label}) borrowed from "
            f"parallel {parallel_mode.replace('_', ' ')}"
        )

        results.append(ChordSubstitution(
            symbol=sub_symbol,
            sub_type="modal_interchange",
            reasoning=reasoning,
            confidence=0.65,
            voice_leading_distance=vld,
            common_tone_count=ct_count,
        ))

    return results


def _dominant_chain_substitutions(
    chord: Chord, key: Key, key_root_name: str
) -> list[ChordSubstitution]:
    """Secondary dominants: for each diatonic chord, suggest V7/x."""
    results: list[ChordSubstitution] = []

    diatonic_triads = build_diatonic_triads(key)

    for degree, (target_root, target_quality) in diatonic_triads.items():
        # Skip diminished targets -- secondary dominants don't typically target dim chords
        if target_quality == ChordQuality.DIMINISHED:
            continue

        # The dominant of this target: root is 7 semitones above target (= perfect 5th)
        dom_root = (target_root + 7) % 12
        dom_quality = ChordQuality.DOMINANT7
        dom_symbol = _build_chord_symbol(dom_root, dom_quality, key_root_name)
        dom_chord = _build_chord(dom_root, dom_quality)

        # Don't suggest if it's the same as the original chord
        if dom_root == chord.root and dom_quality == chord.quality:
            continue

        # Don't suggest the plain V7 -- that's already diatonic, not a secondary dominant
        if degree == 1:
            continue

        vld, ct_count = _compute_voice_leading(chord, dom_chord)

        target_symbol = _build_chord_symbol(target_root, target_quality, key_root_name)
        deg_label = _degree_label(degree, key.mode)
        reasoning = (
            f"Secondary dominant: {dom_symbol} is V7/{deg_label} "
            f"(dominant of {target_symbol})"
        )

        results.append(ChordSubstitution(
            symbol=dom_symbol,
            sub_type="dominant_chain",
            reasoning=reasoning,
            confidence=0.60,
            voice_leading_distance=vld,
            common_tone_count=ct_count,
        ))

    return results


def suggest_substitutions(
    chord_symbol: str,
    key_root_name: str,
    key_mode: str,
    prev_chord: str | None = None,
    next_chord: str | None = None,
    limit: int = 10,
) -> list[ChordSubstitution]:
    """Suggest chord substitutions for a given chord in a musical key context.

    Args:
        chord_symbol: The chord to find substitutions for (e.g. "G7", "Am").
        key_root_name: Root note of the key (e.g. "C", "A").
        key_mode: Mode of the key (e.g. "major", "natural_minor").
        prev_chord: Optional preceding chord symbol (reserved for future context-aware ranking).
        next_chord: Optional following chord symbol (reserved for future context-aware ranking).
        limit: Maximum number of suggestions to return.

    Returns:
        List of ChordSubstitution objects, sorted by confidence desc then
        voice_leading_distance asc, deduplicated by symbol.

    Raises:
        ValueError: If chord_symbol, key_root_name, or key_mode is invalid.
    """
    # Parse the original chord
    chord = parse_chord(chord_symbol)

    # Build the key
    key = Key.from_name(key_root_name, key_mode)

    # Gather all substitution suggestions
    all_subs: list[ChordSubstitution] = []
    all_subs.extend(_tritone_substitutions(chord, key, key_root_name))
    all_subs.extend(_relative_substitutions(chord, key, key_root_name))
    all_subs.extend(_parallel_substitutions(chord, key, key_root_name))
    all_subs.extend(_diatonic_exchange_substitutions(chord, key, key_root_name))
    all_subs.extend(_modal_interchange_substitutions(chord, key, key_root_name))
    all_subs.extend(_dominant_chain_substitutions(chord, key, key_root_name))

    # Filter out the original chord itself
    orig_symbol_normalized = _build_chord_symbol(chord.root, chord.quality, key_root_name)
    filtered: list[ChordSubstitution] = []
    for sub in all_subs:
        # Check both the generated symbol and the original input symbol
        if sub.symbol == orig_symbol_normalized or sub.symbol == chord_symbol:
            continue
        filtered.append(sub)

    # Deduplicate by symbol, keeping highest confidence
    seen: dict[str, ChordSubstitution] = {}
    for sub in filtered:
        if sub.symbol not in seen or sub.confidence > seen[sub.symbol].confidence:
            seen[sub.symbol] = sub
    deduped = list(seen.values())

    # Sort by confidence desc, then voice_leading_distance asc
    deduped.sort(key=lambda s: (-s.confidence, s.voice_leading_distance))

    return deduped[:limit]
