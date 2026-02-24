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
    """A section of a song (verse, chorus, etc.)."""
    name: str
    section_type: str = "vocal"  # "instrumental" or "vocal"
    chords: list[ChordInput] = Field(default_factory=list)
    lines: list[ChordLyricsLine] = Field(default_factory=list)


class SongInput(BaseModel):
    """Complete song input with metadata and sections."""
    title: str = ""
    artist: str = ""
    key: str = ""  # e.g. "Am"
    key_mode: str = "natural_minor"
    sections: list[SectionInput] = Field(default_factory=list)
