"""Augmented chord analysis with multiple interpretations.

Three analysis paths:
1. V+ (dominant with raised 5th) — the aug chord is on the 5th degree, the
   raised 5th acts as a leading tone to the 3rd of the tonic.
2. III+ from harmonic minor — in minor keys the III chord is naturally
   augmented when built from harmonic-minor scale tones.
3. Chromatic voice leading — the augmented 5th moves by half step to a note
   in a neighboring chord, creating smooth chromatic motion.
"""

from __future__ import annotations

from caspian.models.analysis import AnalysisInterpretation
from caspian.models.chord import Chord, ChordQuality
from caspian.models.key import Key
from caspian.theory.intervals import interval_semitones
from caspian.theory.pitch import note_name
from caspian.theory.scales import degree_of
from caspian.theory.voice_leading import common_tones


def analyze_augmented(
    chord: Chord,
    prev_chord: Chord | None,
    next_chord: Chord | None,
    key: Key,
) -> list[AnalysisInterpretation]:
    """Analyze an augmented chord and return ranked interpretations."""
    if chord.quality != ChordQuality.AUGMENTED:
        return []

    interpretations: list[AnalysisInterpretation] = []

    # 1. V+ — dominant function with raised 5th
    interpretations.extend(_check_dominant_aug(chord, next_chord, key))

    # 2. III+ from harmonic minor
    interpretations.extend(_check_harmonic_minor_III(chord, key))

    # 3. Chromatic voice leading to next chord
    if next_chord is not None:
        interpretations.extend(_check_chromatic_voice_leading(chord, next_chord))

    # 4. Chromatic voice leading from previous chord
    if prev_chord is not None:
        interpretations.extend(
            _check_chromatic_voice_leading_from(chord, prev_chord)
        )

    # 5. Common tones with neighbors
    if next_chord is not None:
        ct = common_tones(chord.pitch_set(), next_chord.pitch_set())
        if len(ct) >= 2:
            ct_names = sorted(note_name(p) for p in ct)
            interpretations.append(AnalysisInterpretation(
                type="common_tone_aug",
                detail=f"Common tones with {next_chord.symbol} "
                       f"(shares {', '.join(ct_names)})",
                confidence=0.60,
            ))

    return sorted(interpretations, key=lambda x: x.confidence, reverse=True)


def _check_dominant_aug(
    chord: Chord,
    next_chord: Chord | None,
    key: Key,
) -> list[AnalysisInterpretation]:
    """Check if the augmented chord functions as V+ (dominant with raised 5th).

    The raised 5th of V+ acts as a chromatic leading tone to the 3rd of
    the tonic chord.  For example, in key of Bb: Faug (F A C#) → Bb,
    where C# → D (enharmonic approach to the 3rd of Bb).
    """
    results: list[AnalysisInterpretation] = []
    deg = degree_of(chord.root, key)

    if deg == 5:
        # The raised 5th: root + 8 semitones
        raised_5th = (chord.root + 8) % 12
        target_3rd = (key.root + 4) % 12 if key.mode == "major" else (key.root + 3) % 12
        resolves_by_half = abs(interval_semitones(raised_5th, target_3rd)) == 1

        confidence = 0.90
        detail = f"V+ — dominant with raised 5th"

        if next_chord is not None and next_chord.root == key.root:
            confidence = 0.95
            detail += f" → resolves to {next_chord.symbol}"
        elif resolves_by_half:
            detail += (
                f" ({note_name(raised_5th)} → {note_name(target_3rd)}, "
                f"chromatic leading tone to tonic 3rd)"
            )

        results.append(AnalysisInterpretation(
            type="dominant_augmented",
            detail=detail,
            confidence=confidence,
        ))

    # Also check secondary dominant function: V+/X
    # The augmented chord could be a secondary dominant resolving to the next chord
    if next_chord is not None and deg != 5:
        target_root = next_chord.root
        # V of target is a 5th above (or 7 semitones)
        expected_dom_root = (target_root + 7) % 12
        if chord.root == expected_dom_root:
            target_deg = degree_of(target_root, key)
            if target_deg is not None:
                target_name = note_name(target_root)
                results.append(AnalysisInterpretation(
                    type="secondary_dominant_aug",
                    detail=f"V+/{target_name} — augmented secondary dominant "
                           f"resolving to {next_chord.symbol}",
                    confidence=0.85,
                ))

    return results


def _check_harmonic_minor_III(
    chord: Chord,
    key: Key,
) -> list[AnalysisInterpretation]:
    """Check if this is III+ from harmonic minor.

    In harmonic minor, the raised 7th degree makes the III chord augmented.
    For example, in Am harmonic minor: C E G# → Caug (III+).
    """
    if "minor" not in key.mode and key.mode not in ("dorian", "phrygian"):
        return []

    # III degree in minor = 3rd scale degree (3 semitones above root)
    iii_root = (key.root + 3) % 12
    if chord.root != iii_root:
        return []

    return [AnalysisInterpretation(
        type="harmonic_minor_III",
        detail=f"III+ from {key.root_name} harmonic minor "
               f"(raised 7th degree creates augmented triad)",
        confidence=0.85,
    )]


def _check_chromatic_voice_leading(
    chord: Chord,
    next_chord: Chord | None,
) -> list[AnalysisInterpretation]:
    """Check if the augmented 5th resolves by half step into the next chord.

    The raised 5th (root + 8) is the distinctive note of an augmented chord.
    When it moves by semitone to a note in the next chord, it creates smooth
    chromatic voice leading.
    """
    if next_chord is None:
        return []

    raised_5th = (chord.root + 8) % 12
    next_pitches = next_chord.pitch_set()

    # Check if the raised 5th resolves up or down by semitone
    up = (raised_5th + 1) % 12
    down = (raised_5th - 1) % 12

    results: list[AnalysisInterpretation] = []
    if up in next_pitches:
        results.append(AnalysisInterpretation(
            type="chromatic_voice_leading",
            detail=f"Raised 5th ({note_name(raised_5th)}) resolves up "
                   f"by half step to {note_name(up)} in {next_chord.symbol}",
            confidence=0.80,
        ))
    if down in next_pitches:
        results.append(AnalysisInterpretation(
            type="chromatic_voice_leading",
            detail=f"Raised 5th ({note_name(raised_5th)}) resolves down "
                   f"by half step to {note_name(down)} in {next_chord.symbol}",
            confidence=0.75,
        ))

    return results


def _check_chromatic_voice_leading_from(
    chord: Chord,
    prev_chord: Chord,
) -> list[AnalysisInterpretation]:
    """Check if the augmented 5th arrived by half step from the previous chord.

    The note that became the raised 5th may have been approached chromatically
    from the previous chord (ascending chromatic motion).
    """
    raised_5th = (chord.root + 8) % 12
    prev_pitches = prev_chord.pitch_set()

    up = (raised_5th + 1) % 12
    down = (raised_5th - 1) % 12

    results: list[AnalysisInterpretation] = []
    if down in prev_pitches:
        results.append(AnalysisInterpretation(
            type="chromatic_approach",
            detail=f"Raised 5th ({note_name(raised_5th)}) approached "
                   f"chromatically from {note_name(down)} in {prev_chord.symbol}",
            confidence=0.70,
        ))
    if up in prev_pitches:
        results.append(AnalysisInterpretation(
            type="chromatic_approach",
            detail=f"Raised 5th ({note_name(raised_5th)}) approached "
                   f"chromatically from {note_name(up)} in {prev_chord.symbol}",
            confidence=0.65,
        ))

    return results
