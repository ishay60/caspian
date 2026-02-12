"""Diminished chord analysis with multiple interpretations.

Three analysis paths:
1. Rootless dominant 7b9 — the dim chord is a subset of a dom7b9
2. Chromatic approach — bass moves by half step to/from neighbor chord
3. Common-tone diminished — shares 2+ tones with a neighbor chord

Due to the symmetry of diminished chords, every dim triad is a subset of 4 dom7b9
chords. We filter to musically relevant ones only.
"""

from __future__ import annotations

from caspian.models.analysis import AnalysisInterpretation
from caspian.models.chord import Chord, ChordQuality
from caspian.models.key import Key
from caspian.theory.intervals import interval_semitones
from caspian.theory.pitch import note_name
from caspian.theory.scales import degree_of
from caspian.theory.voice_leading import common_tones


def analyze_diminished(
    chord: Chord,
    prev_chord: Chord | None,
    next_chord: Chord | None,
    key: Key,
) -> list[AnalysisInterpretation]:
    """Analyze a diminished chord and return ranked interpretations."""
    if chord.quality not in (ChordQuality.DIMINISHED, ChordQuality.DIMINISHED7):
        return []

    interpretations: list[AnalysisInterpretation] = []

    # 1. Rootless dominant 7b9
    interpretations.extend(_check_rootless_dom7b9(chord, next_chord, key))

    # 2. Chromatic approach from previous
    if prev_chord is not None:
        bass_interval = interval_semitones(prev_chord.bass, chord.bass)
        if abs(bass_interval) == 1:
            direction = "descending" if bass_interval == -1 else "ascending"
            interpretations.append(AnalysisInterpretation(
                type="chromatic_approach_from",
                detail=f"Chromatic {direction} from {prev_chord.symbol} "
                       f"(bass {note_name(prev_chord.bass)}→{note_name(chord.bass)})",
                confidence=0.90,
            ))

    # 3. Chromatic approach to next
    if next_chord is not None:
        bass_interval = interval_semitones(chord.bass, next_chord.bass)
        if abs(bass_interval) == 1:
            direction = "descending" if bass_interval == -1 else "ascending"
            interpretations.append(AnalysisInterpretation(
                type="chromatic_approach_to",
                detail=f"Chromatic {direction} to {next_chord.symbol} "
                       f"(bass {note_name(chord.bass)}→{note_name(next_chord.bass)})",
                confidence=0.85,
            ))

    # 4. Common-tone diminished with next chord
    if next_chord is not None:
        ct = common_tones(chord.pitch_set(), next_chord.pitch_set())
        if len(ct) >= 2:
            ct_names = sorted(note_name(p) for p in ct)
            interpretations.append(AnalysisInterpretation(
                type="common_tone_dim",
                detail=f"Common-tone dim with {next_chord.symbol} "
                       f"(shares {', '.join(ct_names)})",
                confidence=0.80,
            ))

    # 5. Common-tone diminished with previous chord
    if prev_chord is not None:
        ct = common_tones(chord.pitch_set(), prev_chord.pitch_set())
        if len(ct) >= 2:
            ct_names = sorted(note_name(p) for p in ct)
            interpretations.append(AnalysisInterpretation(
                type="common_tone_dim",
                detail=f"Common-tone dim with {prev_chord.symbol} "
                       f"(shares {', '.join(ct_names)})",
                confidence=0.60,
            ))

    return sorted(interpretations, key=lambda x: x.confidence, reverse=True)


def _check_rootless_dom7b9(
    chord: Chord,
    next_chord: Chord | None,
    key: Key,
) -> list[AnalysisInterpretation]:
    """Check all possible rootless dominant 7b9 interpretations.

    A dim triad [X, Y, Z] is a subset of dom7b9 chords rooted on notes
    that are 1 semitone below any chord tone. We filter to musically relevant
    candidates:
    - The implied root's resolution target is diatonic in the key, OR
    - The implied root's resolution target matches the actual next chord
    """
    results: list[AnalysisInterpretation] = []
    chord_pitches = chord.pitch_set()

    for possible_root in range(12):
        # dom7b9 = [root, root+4, root+7, root+10, root+1]
        dom7b9_pitches = frozenset(
            (possible_root + i) % 12 for i in [0, 4, 7, 10, 1]
        )
        if not chord_pitches.issubset(dom7b9_pitches):
            continue
        # Skip if the possible root IS one of the chord tones (it's rootless)
        if possible_root in chord_pitches:
            continue

        # Resolution target: down a 5th from the implied root
        target_root = (possible_root + 5) % 12
        target_name = note_name(target_root)
        root_name = note_name(possible_root)

        # Check musical relevance
        target_is_diatonic = degree_of(target_root, key) is not None
        target_matches_next = next_chord is not None and next_chord.root == target_root

        if not target_is_diatonic and not target_matches_next:
            continue

        confidence = 0.70
        detail_parts = [f"Rootless {root_name}7♭9"]

        if target_matches_next:
            confidence = 0.95
            detail_parts.append(f"→ resolves to {next_chord.symbol}")
        elif target_is_diatonic:
            target_deg = degree_of(target_root, key)
            detail_parts.append(f"(V7♭9 of degree {target_deg})")

        results.append(AnalysisInterpretation(
            type="rootless_dom7b9",
            detail=" ".join(detail_parts),
            confidence=confidence,
        ))

    return results
