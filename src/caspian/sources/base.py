"""Base classes and models for chord sheet sources."""

from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel, Field


class SearchResult(BaseModel):
    """A chord sheet search result from any source.

    Attributes:
        source: Source identifier (e.g., "ultimate_guitar", "tab4u")
        title: Song title
        artist: Artist/band name
        url: Direct URL to the chord sheet
        rating: Quality rating on 0-5 scale (0 if not available)
        rating_count: Number of ratings/votes (0 if not available)
        has_bars: Whether this source includes bar lines in notation
    """

    source: str
    title: str
    artist: str
    url: str
    rating: float = 0.0
    rating_count: int = 0
    has_bars: bool = False

    def quality_score(self) -> float:
        """Calculate a quality score for this result.

        Returns:
            Score from 0-100 based on rating and vote count.
            Higher scores indicate better quality/confidence.
        """
        if self.rating == 0 and self.rating_count == 0:
            return 65.0

        if self.rating_count < 5:
            return max(0.0, self.rating * 10.0)

        vote_confidence = min(1.0, self.rating_count / 100.0)
        base_score = (self.rating / 5.0) * 100.0
        return base_score * (0.7 + 0.3 * vote_confidence)


class RawSection(BaseModel):
    """A section in a raw chord sheet."""

    name: str
    lines: list[str] = Field(default_factory=list)


class RawChordSheet(BaseModel):
    """Raw chord sheet before conversion to SongInput."""

    title: str
    artist: str
    key: str | None = None
    sections: list[RawSection] = Field(default_factory=list)
    source_url: str
    raw_text: str | None = None

    def to_format_a(self) -> str:
        """Convert to Caspian's Format A input format."""
        lines = []

        lines.append(f"title: {self.title}")
        lines.append(f"artist: {self.artist}")

        if self.key:
            lines.append(f"key: {self.key}")

        lines.append("")

        for section in self.sections:
            lines.append(f"[{section.name}]")
            for line in section.lines:
                lines.append(line)
            lines.append("")

        return "\n".join(lines)


class ChordSheetSource(ABC):
    """Abstract base class for chord sheet sources."""

    @abstractmethod
    async def search(self, query: str, limit: int = 10) -> list[SearchResult]:
        """Search for chord sheets matching the query."""
        pass

    @abstractmethod
    async def fetch(self, url_or_id: str) -> RawChordSheet:
        """Fetch a specific chord sheet."""
        pass
