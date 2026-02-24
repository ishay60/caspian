"""Pydantic models for validated user input."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class BeatPosition(BaseModel):
    """Position within a bar.

    Represents a specific moment in musical time using beat number and subdivision.
    Uses 16th-note grid for precise timing.

    Attributes:
        beat: 1-based beat number (1, 2, 3, 4 for 4/4 time)
        subdivision: 16th-note subdivision within the beat
            0 = on the beat
            1 = "and" (eighth note)
            2 = "e" (third 16th)
            3 = "a" (fourth 16th)

    Example:
        >>> BeatPosition(beat=1, subdivision=0)  # downbeat
        >>> BeatPosition(beat=2, subdivision=1)  # "two and"
        >>> BeatPosition(beat=3, subdivision=2)  # "three e"
    """
    beat: int
    subdivision: int = 0

    @field_validator('beat')
    @classmethod
    def validate_beat(cls, v: int) -> int:
        if v < 1:
            raise ValueError(f"beat must be >= 1, got {v}")
        return v

    @field_validator('subdivision')
    @classmethod
    def validate_subdivision(cls, v: int) -> int:
        if v < 0:
            raise ValueError(f"subdivision must be >= 0, got {v}")
        if v > 3:
            raise ValueError(f"subdivision must be <= 3 (16th-note grid), got {v}")
        return v


class BarChord(BaseModel):
    """A chord at a specific beat position within a bar.

    Represents when a chord starts and optionally how long it sustains.
    Used for rhythm-aware chord analysis.

    Attributes:
        symbol: Chord symbol (e.g., "Am", "G7", "Dmaj7")
        beat_position: When the chord is played
        duration_beats: How long the chord rings (None = until next chord or end of bar)

    Example:
        >>> BarChord(symbol="Am", beat_position=BeatPosition(beat=1, subdivision=0))
        >>> BarChord(symbol="G7", beat_position=BeatPosition(beat=3, subdivision=0), duration_beats=2.0)
    """
    symbol: str
    beat_position: BeatPosition
    duration_beats: float | None = None


class BarNote(BaseModel):
    """A single note for riffs, fills, or melodic lines.

    Represents pitched notes within a bar for transcribing riffs,
    melodic fills, or single-note passages.

    Attributes:
        pitch: Note name (e.g., "A", "B", "C#", "Db")
        octave: Octave number (default: 4)
        beat_position: When the note is played
        duration_beats: How long the note sustains (default: 0.5 = eighth note)
        technique: Optional playing technique (e.g., "bend", "slide", "hammer-on", "pull-off")

    Example:
        >>> BarNote(pitch="A", octave=4, beat_position=BeatPosition(beat=1, subdivision=0))
        >>> BarNote(pitch="C#", octave=5, beat_position=BeatPosition(beat=2, subdivision=1),
        ...         duration_beats=0.25, technique="bend")
    """
    pitch: str
    octave: int = 4
    beat_position: BeatPosition
    duration_beats: float = 0.5
    technique: str | None = None


class TabNote(BaseModel):
    """A guitar tablature note (string and fret position).

    Represents a note in guitar tablature format, specifying
    physical position on the fretboard.

    Attributes:
        string: String number (1-6, where 1 = high E, 6 = low E)
        fret: Fret number (0 = open string, 1-24)
        beat_position: When the note is played
        duration_beats: How long the note sustains (default: 0.5 = eighth note)
        technique: Optional playing technique (e.g., "bend", "slide", "hammer-on", "pull-off")

    Example:
        >>> TabNote(string=1, fret=0, beat_position=BeatPosition(beat=1, subdivision=0))  # high E open
        >>> TabNote(string=3, fret=5, beat_position=BeatPosition(beat=2, subdivision=0),
        ...         technique="bend")
    """
    string: int
    fret: int
    beat_position: BeatPosition
    duration_beats: float = 0.5
    technique: str | None = None

    @field_validator('string')
    @classmethod
    def validate_string(cls, v: int) -> int:
        if v < 1 or v > 6:
            raise ValueError(f"string must be 1-6 (1=high E, 6=low E), got {v}")
        return v

    @field_validator('fret')
    @classmethod
    def validate_fret(cls, v: int) -> int:
        if v < 0 or v > 24:
            raise ValueError(f"fret must be 0-24, got {v}")
        return v


class BarContent(BaseModel):
    """All musical content within a single bar.

    Container for all types of musical notation that can appear
    in a bar: chords, melodic notes, and tablature.

    Attributes:
        chords: List of chords with their timing
        notes: List of pitched notes (for riffs/fills)
        tab: List of tablature notes (for guitar-specific notation)
        label: Optional text label for the bar (e.g., "intro riff", "solo", "fill")

    Example:
        >>> BarContent(
        ...     chords=[BarChord(symbol="Am", beat_position=BeatPosition(beat=1, subdivision=0))],
        ...     label="verse pattern"
        ... )
        >>> BarContent(
        ...     notes=[BarNote(pitch="A", octave=4, beat_position=BeatPosition(beat=1, subdivision=0))],
        ...     label="riff"
        ... )
    """
    chords: list[BarChord] = Field(default_factory=list)
    notes: list[BarNote] = Field(default_factory=list)
    tab: list[TabNote] = Field(default_factory=list)
    label: str | None = None


class Bar(BaseModel):
    """The universal content container - a single bar/measure.

    Bars are the fundamental unit of musical time in Caspian.
    Everything happens within bars: chords, notes, lyrics fragments.

    Attributes:
        time_signature: Tuple of (numerator, denominator), default (4, 4)
        content: All musical content in this bar
        lyrics_fragment: Hebrew lyrics syllables aligned to this bar
        is_expandable: Whether this bar can be expanded/collapsed in UI

    Example:
        >>> Bar(
        ...     time_signature=(4, 4),
        ...     content=BarContent(chords=[
        ...         BarChord(symbol="Am", beat_position=BeatPosition(beat=1, subdivision=0))
        ...     ]),
        ...     lyrics_fragment="יום"
        ... )
        >>> Bar(
        ...     time_signature=(3, 4),
        ...     content=BarContent(label="waltz pattern")
        ... )
    """
    time_signature: tuple[int, int] = (4, 4)
    content: BarContent = Field(default_factory=BarContent)
    lyrics_fragment: str = ""
    is_expandable: bool = False


class ChordInput(BaseModel):
    """A single chord with optional aligned lyrics."""
    symbol: str
    lyrics: str | None = None
    position: int | None = None  # column offset in original chord line


class ChordLyricsLine(BaseModel):
    """A paired chord-line + lyrics-line from tab format."""
    chords: list[tuple[int, str]]  # (column_position, chord_symbol)
    lyrics: str = ""


class SectionInput(BaseModel):
    """A section of a song (verse, chorus, etc.).

    Supports both legacy chord-based input and new bar-based input.

    Attributes:
        name: Section name (e.g., "verse", "chorus", "bridge")
        section_type: "vocal" or "instrumental"
        chords: Legacy chord list (for backward compatibility)
        lines: Legacy chord-lyrics pairs (for backward compatibility)
        bars: New bar-based content containers
        tempo_bpm: Optional tempo in beats per minute for this section
    """
    name: str
    section_type: str = "vocal"  # "instrumental" or "vocal"
    chords: list[ChordInput] = Field(default_factory=list)
    lines: list[ChordLyricsLine] = Field(default_factory=list)
    bars: list[Bar] = Field(default_factory=list)
    tempo_bpm: float | None = None


class SongInput(BaseModel):
    """Complete song input with metadata and sections."""
    title: str = ""
    artist: str = ""
    key: str = ""  # e.g. "Am"
    key_mode: str = "natural_minor"
    sections: list[SectionInput] = Field(default_factory=list)
