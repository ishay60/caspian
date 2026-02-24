"""Pydantic models for lyrics-based input from frontend editor.

These models define the API schema for converting user-edited lyrics with chord
placements into the internal SongInput format with bars.

Frontend workflow:
1. LyricsChordEditor: User places chords on lyrics text
2. BarOverlay: User defines bar divisions and beat positions
3. RiffEditor: User adds riffs/notes within bars
4. Backend converter: Converts to SongInput with bars

The converter maps:
- Lyrics lines + chord placements → ChordLyricsLine
- Bar markers + beat positions → Bar objects with BarChord entries
- Riff data → BarNote or TabNote entries in Bar.content
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ChordPlacement(BaseModel):
    """A chord placed at a specific column position in a lyrics line.

    Attributes:
        column: Character position in the lyrics line (0-based)
        symbol: Chord symbol (e.g., "Am", "G7", "Dmaj7")
    """
    column: int
    symbol: str


class BeatPositionInput(BaseModel):
    """Beat position for timing within a bar.

    Attributes:
        beat: 1-based beat number (1, 2, 3, 4 for 4/4 time)
        subdivision: 16th-note subdivision (0-3)
    """
    beat: int
    subdivision: int = 0


class NoteInput(BaseModel):
    """A note in a riff or instrumental section.

    Attributes:
        pitch: Note name (e.g., "A", "C#", "Bb")
        octave: Octave number (default: 4)
        beat_position: When the note is played
        duration_beats: Note duration in beats (default: 0.5 = eighth note)
        technique: Optional technique (e.g., "bend", "slide", "hammer-on")
    """
    pitch: str
    octave: int = 4
    beat_position: BeatPositionInput
    duration_beats: float = 0.5
    technique: str | None = None


class TabNoteInput(BaseModel):
    """A guitar tablature note (string and fret).

    Attributes:
        string: String number (1-6, where 1 = high E, 6 = low E)
        fret: Fret number (0-24)
        beat_position: When the note is played
        duration_beats: Note duration in beats (default: 0.5 = eighth note)
        technique: Optional technique (e.g., "bend", "slide")
    """
    string: int
    fret: int
    beat_position: BeatPositionInput
    duration_beats: float = 0.5
    technique: str | None = None


class RiffPlacement(BaseModel):
    """A riff or instrumental section within a bar.

    Attributes:
        label: Optional label (e.g., "intro riff", "solo")
        notes: Standard notation notes (empty if using tab)
        tab_notes: Guitar tablature notes (empty if using notation)
    """
    label: str | None = None
    notes: list[NoteInput] = Field(default_factory=list)
    tab_notes: list[TabNoteInput] = Field(default_factory=list)


class BarMarker(BaseModel):
    """Marks a bar division in the chord sequence.

    Attributes:
        chord_index: Index in the flattened chord sequence where bar starts
        time_signature: Time signature as [numerator, denominator] (default: [4, 4])
        riff: Optional riff content for this bar
    """
    chord_index: int
    time_signature: tuple[int, int] = (4, 4)
    riff: RiffPlacement | None = None


class ChordWithBeat(BaseModel):
    """A chord with its beat position assignment.

    Attributes:
        symbol: Chord symbol
        column: Original column position from lyrics (for alignment)
        beat_position: Assigned beat position within the bar
    """
    symbol: str
    column: int
    beat_position: BeatPositionInput


class LyricsLine(BaseModel):
    """A single line of lyrics with chord placements.

    Attributes:
        text: The lyrics text
        chords: Chords placed at specific column positions
    """
    text: str
    chords: list[ChordPlacement] = Field(default_factory=list)


class SectionMarker(BaseModel):
    """Marks a section boundary in the lyrics.

    Attributes:
        line_index: Index of the line where section starts (0-based)
        name: Section name (e.g., "verse", "chorus", "bridge")
        section_type: "vocal" or "instrumental"
    """
    line_index: int
    name: str
    section_type: str = "vocal"


class LyricsInputRequest(BaseModel):
    """Request model for converting lyrics-based input to SongInput.

    This model represents the complete user-edited song from the frontend,
    including lyrics, chord placements, bar divisions, and riff data.

    Attributes:
        title: Song title
        artist: Artist name
        key_root_name: Key root (e.g., "A", "Bb", "C#")
        key_mode: Key mode (e.g., "major", "natural_minor", "dorian")
        lyrics_lines: All lyrics lines with chord placements
        section_markers: Section boundaries
        bar_markers: Bar division markers with time signatures
        chords_with_beats: Chord-to-beat position assignments (from BarOverlay)
        tempo_bpm: Optional global tempo in beats per minute
    """
    title: str = ""
    artist: str = ""
    key_root_name: str = ""
    key_mode: str = "natural_minor"
    lyrics_lines: list[LyricsLine] = Field(default_factory=list)
    section_markers: list[SectionMarker] = Field(default_factory=list)
    bar_markers: list[BarMarker] = Field(default_factory=list)
    chords_with_beats: list[ChordWithBeat] = Field(default_factory=list)
    tempo_bpm: float | None = None
