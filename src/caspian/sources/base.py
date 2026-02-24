"""Base models for external chord sheet sources."""

from __future__ import annotations

from pydantic import BaseModel


class RawSection(BaseModel):
    """A section from an external chord sheet source."""

    name: str
    content: str  # Raw text content (chords, lyrics, bars, etc.)


class RawChordSheet(BaseModel):
    """Raw chord sheet data from an external source."""

    title: str
    artist: str
    source_url: str
    raw_text: str
    sections: list[RawSection] = []
    key: str | None = None

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
            lines.append(section.content)
            lines.append("")

        return "\n".join(lines)
