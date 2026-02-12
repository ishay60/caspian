"""Pydantic models for validated user input."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ChordInput(BaseModel):
    """A single chord with optional aligned lyrics."""
    symbol: str
    lyrics: str | None = None


class SectionInput(BaseModel):
    """A section of a song (verse, chorus, etc.)."""
    name: str
    section_type: str = "vocal"  # "instrumental" or "vocal"
    chords: list[ChordInput] = Field(default_factory=list)


class SongInput(BaseModel):
    """Complete song input with metadata and sections."""
    title: str = ""
    artist: str = ""
    key: str = ""  # e.g. "Am"
    key_mode: str = "natural_minor"
    sections: list[SectionInput] = Field(default_factory=list)
