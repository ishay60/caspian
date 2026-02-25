"""Song document model for persistence."""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field


class SongMetadata(BaseModel):
    """Extra metadata stored alongside a song."""

    tags: list[str] = Field(default_factory=list)
    source: str | None = None  # "ultimate_guitar", "tab4u", "manual", "lyrics_editor"
    source_url: str | None = None


class AnalysisMetadata(BaseModel):
    """Indexed analysis data for search/filter (mirrors frontend SongAnalysisMetadata)."""

    chord_symbols: list[str] = Field(default_factory=list)
    roman_numerals: list[str] = Field(default_factory=list)
    section_names: list[str] = Field(default_factory=list)
    progressions: list[str] = Field(default_factory=list)
    has_secondary_dominants: bool = False
    has_borrowed_chords: bool = False
    has_deceptive_resolution: bool = False
    has_diminished: bool = False


class SongDocument(BaseModel):
    """A persisted song document.

    This is the shape written to the database (JSON file, Firestore, etc.).
    Contains the input text, detected key, and optional cached analysis.
    """

    id: str
    user_id: str = "local"
    title: str = ""
    artist: str = ""
    key_root: str = ""
    key_mode: str = ""
    input_text: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_opened_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: SongMetadata = Field(default_factory=SongMetadata)
    analysis_metadata: AnalysisMetadata | None = None
