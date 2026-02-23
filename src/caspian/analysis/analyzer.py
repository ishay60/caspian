"""Pipeline orchestrator: parse key → analyze chords → assemble results.

This is the main analysis entry point. It coordinates all analysis modules.
"""

from __future__ import annotations

from caspian.models.analysis import (
    AnalysisInterpretation, ChordAnalysis, SectionAnalysis, SongAnalysis,
)
from caspian.models.chord import Chord, ChordQuality
from caspian.models.input import ChordLyricsLine, SongInput
from caspian.models.key import Key
from caspian.parsing.chord_parser import parse_chord
from caspian.analysis.key_detector import detect_key
from caspian.analysis.roman_numerals import assign_roman_numeral
from caspian.analysis.secondary_dominants import detect_secondary_dominant
from caspian.analysis.borrowed_chords import detect_borrowed_chord
from caspian.analysis.augmented import analyze_augmented
from caspian.analysis.diminished import analyze_diminished
from caspian.analysis.deceptive import detect_deceptive_resolution
from caspian.analysis.bass_line import extract_bass_line, detect_chromatic_runs
from caspian.analysis.patterns import detect_patterns
from caspian.theory.scales import is_diatonic
from caspian.theory.intervals import interval_semitones, classify_bass_motion
from caspian.theory.voice_leading import common_tones


def analyze_song(song_input: SongInput) -> SongAnalysis:
    """Run the full analysis pipeline on a song input."""
    # Step 1: Parse all chords
    sections_chords: list[tuple[str, list[Chord], list[ChordLyricsLine]]] = []
    for section in song_input.sections:
        parsed = []
        for chord_input in section.chords:
            try:
                parsed.append(parse_chord(chord_input.symbol))
            except ValueError:
                continue
        sections_chords.append((section.name, parsed, section.lines))

    # Step 2: Detect key
    all_chords = [c for _, chords, _ in sections_chords for c in chords]
    key = detect_key(all_chords, user_key=song_input.key or None, user_mode=song_input.key_mode)

    # Step 3: Analyze each section
    analyzed_sections: list[SectionAnalysis] = []
    for section_name, chords, lines in sections_chords:
        section_analysis = analyze_section(section_name, chords, key)
        section_analysis.lines = lines
        analyzed_sections.append(section_analysis)

    return SongAnalysis(
        title=song_input.title,
        artist=song_input.artist,
        key=key,
        sections=analyzed_sections,
    )


def analyze_section(name: str, chords: list[Chord], key: Key) -> SectionAnalysis:
    """Analyze a single section."""
    if not chords:
        return SectionAnalysis(name=name)

    # Analyze each chord
    chord_analyses: list[ChordAnalysis] = []
    for i, chord in enumerate(chords):
        prev = chords[i - 1] if i > 0 else None
        next_c = chords[i + 1] if i < len(chords) - 1 else None

        analysis = _analyze_chord(chord, prev, next_c, key)
        chord_analyses.append(analysis)

    # Bass line analysis
    bass_line = extract_bass_line(chords)
    chromatic_runs = detect_chromatic_runs(bass_line, min_length=2)

    # Pattern detection
    patterns = detect_patterns(chords)

    return SectionAnalysis(
        name=name,
        chords=chord_analyses,
        bass_line=bass_line,
        chromatic_runs=chromatic_runs,
        patterns=patterns,
    )


def _analyze_chord(
    chord: Chord,
    prev: Chord | None,
    next_c: Chord | None,
    key: Key,
) -> ChordAnalysis:
    """Analyze a single chord in context."""
    analysis = ChordAnalysis(chord=chord)

    # Roman numeral
    analysis.roman_numeral = assign_roman_numeral(chord, key)

    # Diatonic check
    analysis.is_diatonic = is_diatonic(chord, key)

    # If not diatonic, check which parallel scales it belongs to
    if not analysis.is_diatonic:
        from caspian.models.key import SCALES
        for mode_name in SCALES:
            if mode_name == key.mode:
                continue
            parallel = Key.from_name(key.root_name, mode_name)
            if is_diatonic(chord, parallel):
                analysis.diatonic_in_scales.append(mode_name)

    # Bass motion from previous chord
    if prev is not None:
        interval = interval_semitones(prev.bass, chord.bass)
        analysis.bass_motion_from_previous = classify_bass_motion(interval)

    # Common tones
    if prev is not None:
        ct = common_tones(chord.pitch_set(), prev.pitch_set())
        analysis.common_tones_with_previous = sorted(ct)
    if next_c is not None:
        ct = common_tones(chord.pitch_set(), next_c.pitch_set())
        analysis.common_tones_with_next = sorted(ct)

    # Secondary dominant
    sec_dom = detect_secondary_dominant(chord, next_c, key)
    if sec_dom:
        analysis.secondary_dominant = sec_dom
        analysis.interpretations.append(AnalysisInterpretation(
            type="secondary_dominant",
            detail=sec_dom,
            confidence=0.90,
        ))

    # Borrowed chord
    if not analysis.is_diatonic:
        borrowed = detect_borrowed_chord(chord, key)
        if borrowed:
            for source in borrowed:
                analysis.interpretations.append(AnalysisInterpretation(
                    type="borrowed",
                    detail=f"Borrowed from {key.root_name} {source}",
                    confidence=0.95,
                ))

    # Diminished analysis
    if chord.quality in (ChordQuality.DIMINISHED, ChordQuality.DIMINISHED7):
        dim_interps = analyze_diminished(chord, prev, next_c, key)
        analysis.interpretations.extend(dim_interps)

    # Augmented analysis
    if chord.quality == ChordQuality.AUGMENTED:
        aug_interps = analyze_augmented(chord, prev, next_c, key)
        analysis.interpretations.extend(aug_interps)

    # Deceptive resolution
    deceptive = detect_deceptive_resolution(chord, next_c, key)
    if deceptive:
        analysis.deceptive_resolution = deceptive

    return analysis
