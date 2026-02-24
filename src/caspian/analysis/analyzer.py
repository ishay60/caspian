"""Pipeline orchestrator: parse key → analyze chords → assemble results.

This is the main analysis entry point. It coordinates all analysis modules.
"""

from __future__ import annotations

from caspian.models.analysis import (
    AnalysisInterpretation, BarAnalysis, ChordAnalysis, SectionAnalysis, SongAnalysis,
)
from caspian.models.chord import Chord, ChordQuality
from caspian.models.input import Bar, ChordLyricsLine, SectionInput, SongInput
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
    # Step 1: Parse all chords from all sections (for key detection)
    all_chords: list[Chord] = []
    for section in song_input.sections:
        # Extract chords from legacy format
        for chord_input in section.chords:
            try:
                all_chords.append(parse_chord(chord_input.symbol))
            except ValueError:
                continue
        # Extract chords from bar-based format
        for bar in section.bars:
            for bar_chord in bar.content.chords:
                try:
                    all_chords.append(parse_chord(bar_chord.symbol))
                except ValueError:
                    continue

    # Step 2: Detect key
    key = detect_key(all_chords, user_key=song_input.key or None, user_mode=song_input.key_mode)

    # Step 3: Analyze each section using dual-path routing
    analyzed_sections: list[SectionAnalysis] = []
    for section in song_input.sections:
        section_analysis = analyze_section(section, key)
        analyzed_sections.append(section_analysis)

    return SongAnalysis(
        title=song_input.title,
        artist=song_input.artist,
        key=key,
        sections=analyzed_sections,
    )


def analyze_section(section: SectionInput, key: Key) -> SectionAnalysis:
    """Analyze a single section with dual-path routing.

    Routes to bar-aware analysis if section.bars is present,
    otherwise uses legacy chord-based analysis.
    """
    if _should_use_bar_analysis(section):
        return _analyze_section_bars(section, key)
    else:
        return _analyze_section_legacy(section, key)


def _should_use_bar_analysis(section: SectionInput) -> bool:
    """Detect if section should use bar-aware analysis.

    Task 1.2.1: Detection Logic
    """
    # Prefer bars if present and non-empty
    if section.bars:
        return True
    # Fall back to legacy if only chords present
    return False


def _analyze_section_legacy(section: SectionInput, key: Key) -> SectionAnalysis:
    """Analyze section using legacy flat chord list.

    Task 1.2.2: Legacy Path Handler
    This preserves the original analyze_section logic for backward compatibility.
    """
    # Parse chords from legacy format
    chords: list[Chord] = []
    for chord_input in section.chords:
        try:
            chords.append(parse_chord(chord_input.symbol))
        except ValueError:
            continue

    if not chords:
        return SectionAnalysis(name=section.name, lines=section.lines)

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
        name=section.name,
        chords=chord_analyses,
        bass_line=bass_line,
        chromatic_runs=chromatic_runs,
        patterns=patterns,
        lines=section.lines,
    )


def _analyze_section_bars(section: SectionInput, key: Key) -> SectionAnalysis:
    """Analyze section using bar-aware approach.

    Task 1.2.3: Bar-Aware Path Handler
    Analyzes each bar individually with timing context.
    """
    if not section.bars:
        return SectionAnalysis(name=section.name)

    # Analyze each bar
    bar_analyses: list[BarAnalysis] = []
    all_chords: list[Chord] = []  # For bass line and pattern detection

    for bar_index, bar in enumerate(section.bars):
        bar_analysis = _analyze_bar(bar, bar_index, key, all_chords)
        bar_analyses.append(bar_analysis)

    # Bass line analysis across all chords
    bass_line = extract_bass_line(all_chords) if all_chords else []
    chromatic_runs = detect_chromatic_runs(bass_line, min_length=2)

    # Pattern detection across all chords
    patterns = detect_patterns(all_chords)

    # Collect all chord analyses for legacy compatibility
    all_chord_analyses: list[ChordAnalysis] = []
    for bar_analysis in bar_analyses:
        all_chord_analyses.extend(bar_analysis.chord_analyses)

    return SectionAnalysis(
        name=section.name,
        chords=all_chord_analyses,  # Maintain legacy field
        bass_line=bass_line,
        chromatic_runs=chromatic_runs,
        patterns=patterns,
        bars=bar_analyses,  # New bar-based field
    )


def _analyze_bar(bar: Bar, bar_index: int, key: Key, all_chords: list[Chord]) -> BarAnalysis:
    """Analyze a single bar with timing context.

    Task 1.2.4: Analyze Individual Bar
    Extracts chords, analyzes each one, detects harmonic rhythm and riffs.
    """
    # Parse chords from bar
    chords: list[Chord] = []
    for bar_chord in bar.content.chords:
        try:
            chord = parse_chord(bar_chord.symbol)
            chords.append(chord)
        except ValueError:
            continue

    # Add to global chord list for bass line/pattern analysis
    all_chords.extend(chords)

    # Analyze each chord in context
    chord_analyses: list[ChordAnalysis] = []
    for i, chord in enumerate(chords):
        # Context within this bar
        prev = chords[i - 1] if i > 0 else None
        next_c = chords[i + 1] if i < len(chords) - 1 else None

        # If first chord in bar, check previous bar's last chord
        if i == 0 and len(all_chords) > len(chords):
            prev = all_chords[-(len(chords) + 1)]

        analysis = _analyze_chord(chord, prev, next_c, key)
        chord_analyses.append(analysis)

    # Detect harmonic rhythm for this bar
    harmonic_rhythm = _detect_harmonic_rhythm(bar)

    # Check for riff content
    has_riff = len(bar.content.notes) > 0 or len(bar.content.tab) > 0
    riff_analysis = None
    if has_riff:
        if bar.content.label:
            riff_analysis = bar.content.label
        else:
            note_count = len(bar.content.notes) + len(bar.content.tab)
            riff_analysis = f"{note_count} notes"

    return BarAnalysis(
        bar_index=bar_index,
        chord_analyses=chord_analyses,
        harmonic_rhythm=harmonic_rhythm,
        has_riff=has_riff,
        riff_analysis=riff_analysis,
    )


def _detect_harmonic_rhythm(bar: Bar) -> str:
    """Classify harmonic rhythm within a bar.

    Task 1.2.5: Harmonic Rhythm Detection

    Returns:
        - "static": one chord for whole bar
        - "half-bar": chord changes at halfway point
        - "per-beat": chord changes every beat
        - "syncopated": chords on off-beats
    """
    chords = bar.content.chords
    if len(chords) == 0:
        return "static"
    if len(chords) == 1:
        return "static"

    # Check if any chord is on off-beat (subdivision > 0)
    if any(c.beat_position.subdivision > 0 for c in chords):
        return "syncopated"

    # Check beat positions
    beats = [c.beat_position.beat for c in chords]
    if len(set(beats)) == len(chords):  # each chord on different beat
        return "per-beat"

    # Check for halfway change (beat 3 in 4/4, beat 2 in 3/4, etc.)
    time_sig = bar.time_signature
    halfway = (time_sig[0] // 2) + 1
    if any(c.beat_position.beat == halfway for c in chords):
        return "half-bar"

    return "static"


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
