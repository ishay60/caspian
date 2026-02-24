"""Analysis result dataclasses."""

from __future__ import annotations

from dataclasses import dataclass, field

from caspian.models.chord import Chord
from caspian.models.input import ChordLyricsLine
from caspian.models.key import Key


@dataclass(frozen=True)
class AnalysisInterpretation:
    """A single interpretation of a chord's function."""
    type: str           # "chromatic_approach", "rootless_dom7b9", "borrowed", etc.
    detail: str         # Human-readable explanation
    confidence: float   # 0.0 to 1.0


@dataclass
class ChordAnalysis:
    """Complete analysis of a single chord in context."""
    chord: Chord
    roman_numeral: str = ""
    is_diatonic: bool = False
    diatonic_in_scales: list[str] = field(default_factory=list)
    interpretations: list[AnalysisInterpretation] = field(default_factory=list)
    bass_motion_from_previous: str | None = None
    common_tones_with_previous: list[int] = field(default_factory=list)
    common_tones_with_next: list[int] = field(default_factory=list)
    deceptive_resolution: str | None = None
    secondary_dominant: str | None = None


@dataclass
class BassNote:
    """A single note in the bass line."""
    pitch: int
    name: str
    chord_symbol: str
    position: int
    motion_from_previous: str | None = None


@dataclass
class ChromaticRun:
    """A sequence of chromatic bass motion."""
    notes: list[BassNote]
    direction: str = ""  # "ascending" or "descending"
    start_position: int = 0
    length: int = 0


@dataclass
class Pattern:
    """A detected harmonic pattern."""
    type: str       # "repeated_progression", "pedal_point", etc.
    detail: str
    positions: list[int] = field(default_factory=list)


@dataclass
class BarAnalysis:
    """Analysis of a single bar.

    Contains harmonic analysis and rhythmic information for one bar.
    Links to the individual chord analyses within the bar.

    Attributes:
        bar_index: 0-based index of this bar in the section
        chord_analyses: List of chord analyses for chords in this bar
        harmonic_rhythm: Description of chord change frequency
            - "static": One chord for entire bar
            - "half-bar": Chord changes at half-bar (beat 3 in 4/4)
            - "per-beat": Chord changes on each beat
            - "syncopated": Chord changes on off-beats or irregular timing
        has_riff: Whether this bar contains a riff or melodic fill
        riff_analysis: Optional description of the riff if present
    """
    bar_index: int
    chord_analyses: list[ChordAnalysis] = field(default_factory=list)
    harmonic_rhythm: str = "static"  # "static", "half-bar", "per-beat", "syncopated"
    has_riff: bool = False
    riff_analysis: str | None = None


@dataclass
class SectionAnalysis:
    """Analysis of a song section.

    Contains both legacy chord-based analysis and new bar-based analysis.

    Attributes:
        name: Section name (e.g., "verse", "chorus")
        chords: Legacy flat list of chord analyses (for backward compatibility)
        bass_line: Bass line analysis
        chromatic_runs: Detected chromatic motion
        patterns: Detected harmonic patterns
        lines: Legacy chord-lyrics line analysis (for backward compatibility)
        bars: New bar-based analysis list
    """
    name: str
    chords: list[ChordAnalysis] = field(default_factory=list)
    bass_line: list[BassNote] = field(default_factory=list)
    chromatic_runs: list[ChromaticRun] = field(default_factory=list)
    patterns: list[Pattern] = field(default_factory=list)
    lines: list[ChordLyricsLine] = field(default_factory=list)
    bars: list[BarAnalysis] = field(default_factory=list)


@dataclass
class SongAnalysis:
    """Complete analysis of a song."""
    title: str
    artist: str
    key: Key
    sections: list[SectionAnalysis] = field(default_factory=list)
