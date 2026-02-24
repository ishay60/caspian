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
