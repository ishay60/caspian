"""Analysis result dataclasses."""

from __future__ import annotations

from dataclasses import dataclass, field

from caspian.models.chord import Chord
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
class SectionAnalysis:
    """Analysis of a song section."""
    name: str
    chords: list[ChordAnalysis] = field(default_factory=list)
    bass_line: list[BassNote] = field(default_factory=list)
    chromatic_runs: list[ChromaticRun] = field(default_factory=list)
    patterns: list[Pattern] = field(default_factory=list)


@dataclass
class SongAnalysis:
    """Complete analysis of a song."""
    title: str
    artist: str
    key: Key
    sections: list[SectionAnalysis] = field(default_factory=list)
