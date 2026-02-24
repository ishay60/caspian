"""Tests for lyrics-based input converter.

Tests the conversion from frontend LyricsChordEditor format to SongInput with bars.
"""

from __future__ import annotations

import pytest

from caspian.models.input import BeatPosition
from caspian.models.lyrics_input import (
    BarMarker,
    BeatPositionInput,
    ChordPlacement,
    ChordWithBeat,
    LyricsInputRequest,
    LyricsLine,
    NoteInput,
    RiffPlacement,
    SectionMarker,
    TabNoteInput,
)
from caspian.parsing.lyrics_converter import convert_lyrics_to_song_input


class TestBasicConversion:
    """Test basic lyrics-to-SongInput conversion."""

    def test_minimal_input(self):
        """Test conversion with minimal valid input."""
        req = LyricsInputRequest(
            title="Test Song",
            artist="Test Artist",
            key_root_name="C",
            key_mode="major",
            lyrics_lines=[
                LyricsLine(
                    text="Hello world",
                    chords=[ChordPlacement(column=0, symbol="C")],
                )
            ],
        )

        result = convert_lyrics_to_song_input(req)

        assert result.title == "Test Song"
        assert result.artist == "Test Artist"
        assert result.key == "C"
        assert result.key_mode == "major"
        assert len(result.sections) == 1
        assert result.sections[0].name == "main"

    def test_empty_lyrics(self):
        """Test conversion with no lyrics lines."""
        req = LyricsInputRequest(
            title="Empty Song",
            lyrics_lines=[],
        )

        result = convert_lyrics_to_song_input(req)

        assert result.title == "Empty Song"
        assert len(result.sections) == 1
        assert result.sections[0].name == "main"
        assert len(result.sections[0].lines) == 0

    def test_lyrics_without_chords(self):
        """Test conversion with lyrics but no chords."""
        req = LyricsInputRequest(
            lyrics_lines=[
                LyricsLine(text="Line without chords", chords=[]),
            ],
        )

        result = convert_lyrics_to_song_input(req)

        assert len(result.sections) == 1
        assert len(result.sections[0].lines) == 1
        assert result.sections[0].lines[0].lyrics == "Line without chords"
        assert len(result.sections[0].lines[0].chords) == 0


class TestChordPlacement:
    """Test chord placement conversion."""

    def test_single_chord_placement(self):
        """Test a single chord placed on lyrics."""
        req = LyricsInputRequest(
            lyrics_lines=[
                LyricsLine(
                    text="Hello world",
                    chords=[ChordPlacement(column=0, symbol="Am")],
                )
            ],
        )

        result = convert_lyrics_to_song_input(req)

        assert len(result.sections[0].lines) == 1
        line = result.sections[0].lines[0]
        assert line.lyrics == "Hello world"
        assert len(line.chords) == 1
        assert line.chords[0] == (0, "Am")

    def test_multiple_chords_on_line(self):
        """Test multiple chords on a single line."""
        req = LyricsInputRequest(
            lyrics_lines=[
                LyricsLine(
                    text="Hello beautiful world",
                    chords=[
                        ChordPlacement(column=0, symbol="C"),
                        ChordPlacement(column=6, symbol="G"),
                        ChordPlacement(column=16, symbol="Am"),
                    ],
                )
            ],
        )

        result = convert_lyrics_to_song_input(req)

        line = result.sections[0].lines[0]
        assert len(line.chords) == 3
        assert line.chords[0] == (0, "C")
        assert line.chords[1] == (6, "G")
        assert line.chords[2] == (16, "Am")

    def test_chord_sorting_by_column(self):
        """Test that chords are sorted by column position."""
        req = LyricsInputRequest(
            lyrics_lines=[
                LyricsLine(
                    text="Test line",
                    chords=[
                        ChordPlacement(column=10, symbol="G"),
                        ChordPlacement(column=0, symbol="C"),
                        ChordPlacement(column=5, symbol="F"),
                    ],
                )
            ],
        )

        result = convert_lyrics_to_song_input(req)

        line = result.sections[0].lines[0]
        assert line.chords[0] == (0, "C")
        assert line.chords[1] == (5, "F")
        assert line.chords[2] == (10, "G")


class TestSectionMarkers:
    """Test section marker handling."""

    def test_single_section_marker(self):
        """Test a single section marker."""
        req = LyricsInputRequest(
            lyrics_lines=[
                LyricsLine(text="Line 1", chords=[]),
                LyricsLine(text="Line 2", chords=[]),
            ],
            section_markers=[
                SectionMarker(line_index=0, name="verse", section_type="vocal"),
            ],
        )

        result = convert_lyrics_to_song_input(req)

        assert len(result.sections) == 1
        assert result.sections[0].name == "verse"
        assert result.sections[0].section_type == "vocal"
        assert len(result.sections[0].lines) == 2

    def test_multiple_section_markers(self):
        """Test multiple sections."""
        req = LyricsInputRequest(
            lyrics_lines=[
                LyricsLine(text="Verse line", chords=[]),
                LyricsLine(text="Chorus line", chords=[]),
            ],
            section_markers=[
                SectionMarker(line_index=0, name="verse"),
                SectionMarker(line_index=1, name="chorus"),
            ],
        )

        result = convert_lyrics_to_song_input(req)

        assert len(result.sections) == 2
        assert result.sections[0].name == "verse"
        assert len(result.sections[0].lines) == 1
        assert result.sections[0].lines[0].lyrics == "Verse line"
        assert result.sections[1].name == "chorus"
        assert len(result.sections[1].lines) == 1
        assert result.sections[1].lines[0].lyrics == "Chorus line"

    def test_instrumental_section(self):
        """Test instrumental section type."""
        req = LyricsInputRequest(
            lyrics_lines=[LyricsLine(text="", chords=[])],
            section_markers=[
                SectionMarker(line_index=0, name="solo", section_type="instrumental"),
            ],
        )

        result = convert_lyrics_to_song_input(req)

        assert result.sections[0].section_type == "instrumental"


class TestBarMarkers:
    """Test bar marker conversion."""

    def test_single_bar_marker(self):
        """Test a single bar with chords."""
        req = LyricsInputRequest(
            lyrics_lines=[
                LyricsLine(
                    text="Hello world",
                    chords=[ChordPlacement(column=0, symbol="Am")],
                )
            ],
            bar_markers=[BarMarker(chord_index=0, time_signature=(4, 4))],
            chords_with_beats=[
                ChordWithBeat(
                    symbol="Am",
                    column=0,
                    beat_position=BeatPositionInput(beat=1, subdivision=0),
                )
            ],
        )

        result = convert_lyrics_to_song_input(req)

        assert len(result.sections[0].bars) == 1
        bar = result.sections[0].bars[0]
        assert bar.time_signature == (4, 4)
        assert len(bar.content.chords) == 1
        assert bar.content.chords[0].symbol == "Am"
        assert bar.content.chords[0].beat_position.beat == 1
        assert bar.content.chords[0].beat_position.subdivision == 0

    def test_multiple_bars(self):
        """Test multiple bars with different time signatures."""
        req = LyricsInputRequest(
            lyrics_lines=[
                LyricsLine(
                    text="One two three",
                    chords=[
                        ChordPlacement(column=0, symbol="C"),
                        ChordPlacement(column=4, symbol="G"),
                    ],
                )
            ],
            bar_markers=[
                BarMarker(chord_index=0, time_signature=(4, 4)),
                BarMarker(chord_index=1, time_signature=(3, 4)),
            ],
            chords_with_beats=[
                ChordWithBeat(
                    symbol="C",
                    column=0,
                    beat_position=BeatPositionInput(beat=1, subdivision=0),
                ),
                ChordWithBeat(
                    symbol="G",
                    column=4,
                    beat_position=BeatPositionInput(beat=1, subdivision=0),
                ),
            ],
        )

        result = convert_lyrics_to_song_input(req)

        assert len(result.sections[0].bars) == 2
        assert result.sections[0].bars[0].time_signature == (4, 4)
        assert result.sections[0].bars[1].time_signature == (3, 4)

    def test_multiple_chords_per_bar(self):
        """Test bar with multiple chords at different beat positions."""
        req = LyricsInputRequest(
            lyrics_lines=[
                LyricsLine(
                    text="Test line",
                    chords=[
                        ChordPlacement(column=0, symbol="C"),
                        ChordPlacement(column=5, symbol="G"),
                    ],
                )
            ],
            bar_markers=[BarMarker(chord_index=0)],
            chords_with_beats=[
                ChordWithBeat(
                    symbol="C",
                    column=0,
                    beat_position=BeatPositionInput(beat=1, subdivision=0),
                ),
                ChordWithBeat(
                    symbol="G",
                    column=5,
                    beat_position=BeatPositionInput(beat=3, subdivision=0),
                ),
            ],
        )

        result = convert_lyrics_to_song_input(req)

        bar = result.sections[0].bars[0]
        assert len(bar.content.chords) == 2
        assert bar.content.chords[0].symbol == "C"
        assert bar.content.chords[0].beat_position.beat == 1
        assert bar.content.chords[1].symbol == "G"
        assert bar.content.chords[1].beat_position.beat == 3


class TestRiffPlacement:
    """Test riff and note placement in bars."""

    def test_riff_with_standard_notation(self):
        """Test riff with standard notation notes."""
        req = LyricsInputRequest(
            lyrics_lines=[LyricsLine(text="", chords=[])],
            bar_markers=[
                BarMarker(
                    chord_index=0,
                    riff=RiffPlacement(
                        label="intro riff",
                        notes=[
                            NoteInput(
                                pitch="A",
                                octave=4,
                                beat_position=BeatPositionInput(beat=1, subdivision=0),
                                duration_beats=0.5,
                            ),
                            NoteInput(
                                pitch="C",
                                octave=5,
                                beat_position=BeatPositionInput(beat=2, subdivision=0),
                                duration_beats=0.5,
                            ),
                        ],
                    ),
                )
            ],
        )

        result = convert_lyrics_to_song_input(req)

        bar = result.sections[0].bars[0]
        assert bar.content.label == "intro riff"
        assert len(bar.content.notes) == 2
        assert bar.content.notes[0].pitch == "A"
        assert bar.content.notes[0].octave == 4
        assert bar.content.notes[0].beat_position.beat == 1
        assert bar.content.notes[1].pitch == "C"
        assert bar.content.notes[1].octave == 5

    def test_riff_with_tab_notation(self):
        """Test riff with guitar tablature."""
        req = LyricsInputRequest(
            lyrics_lines=[LyricsLine(text="", chords=[])],
            bar_markers=[
                BarMarker(
                    chord_index=0,
                    riff=RiffPlacement(
                        label="guitar riff",
                        tab_notes=[
                            TabNoteInput(
                                string=1,
                                fret=0,
                                beat_position=BeatPositionInput(beat=1, subdivision=0),
                            ),
                            TabNoteInput(
                                string=2,
                                fret=3,
                                beat_position=BeatPositionInput(beat=2, subdivision=0),
                            ),
                        ],
                    ),
                )
            ],
        )

        result = convert_lyrics_to_song_input(req)

        bar = result.sections[0].bars[0]
        assert bar.content.label == "guitar riff"
        assert len(bar.content.tab) == 2
        assert bar.content.tab[0].string == 1
        assert bar.content.tab[0].fret == 0
        assert bar.content.tab[1].string == 2
        assert bar.content.tab[1].fret == 3

    def test_note_with_technique(self):
        """Test note with playing technique."""
        req = LyricsInputRequest(
            lyrics_lines=[LyricsLine(text="", chords=[])],
            bar_markers=[
                BarMarker(
                    chord_index=0,
                    riff=RiffPlacement(
                        notes=[
                            NoteInput(
                                pitch="D",
                                octave=4,
                                beat_position=BeatPositionInput(beat=1, subdivision=0),
                                technique="bend",
                            )
                        ]
                    ),
                )
            ],
        )

        result = convert_lyrics_to_song_input(req)

        bar = result.sections[0].bars[0]
        assert bar.content.notes[0].technique == "bend"

    def test_bar_expandable_with_riff(self):
        """Test that bars with riffs are marked as expandable."""
        req = LyricsInputRequest(
            lyrics_lines=[LyricsLine(text="", chords=[])],
            bar_markers=[
                BarMarker(
                    chord_index=0,
                    riff=RiffPlacement(
                        label="test",
                        notes=[
                            NoteInput(
                                pitch="A",
                                octave=4,
                                beat_position=BeatPositionInput(beat=1, subdivision=0),
                            )
                        ],
                    ),
                )
            ],
        )

        result = convert_lyrics_to_song_input(req)

        bar = result.sections[0].bars[0]
        assert bar.is_expandable is True


class TestHebrewLyrics:
    """Test Hebrew lyrics handling."""

    def test_hebrew_lyrics_with_chords(self):
        """Test Hebrew lyrics text is preserved."""
        req = LyricsInputRequest(
            lyrics_lines=[
                LyricsLine(
                    text="שלום עולם",
                    chords=[ChordPlacement(column=0, symbol="Am")],
                )
            ],
        )

        result = convert_lyrics_to_song_input(req)

        assert result.sections[0].lines[0].lyrics == "שלום עולם"

    def test_hebrew_in_lyrics_fragment(self):
        """Test Hebrew text in bar lyrics fragments."""
        req = LyricsInputRequest(
            lyrics_lines=[
                LyricsLine(
                    text="יום שישי",
                    chords=[ChordPlacement(column=0, symbol="Am")],
                )
            ],
            bar_markers=[BarMarker(chord_index=0)],
            chords_with_beats=[
                ChordWithBeat(
                    symbol="Am",
                    column=0,
                    beat_position=BeatPositionInput(beat=1, subdivision=0),
                )
            ],
        )

        result = convert_lyrics_to_song_input(req)

        bar = result.sections[0].bars[0]
        assert "יום שישי" in bar.lyrics_fragment


class TestComplexScenarios:
    """Test complex real-world scenarios."""

    def test_full_song_structure(self):
        """Test a complete song with verse, chorus, and bridge."""
        req = LyricsInputRequest(
            title="Complete Song",
            artist="Test Artist",
            key_root_name="Am",
            key_mode="natural_minor",
            lyrics_lines=[
                LyricsLine(text="Verse line 1", chords=[ChordPlacement(column=0, symbol="Am")]),
                LyricsLine(text="Verse line 2", chords=[ChordPlacement(column=0, symbol="G")]),
                LyricsLine(text="Chorus line 1", chords=[ChordPlacement(column=0, symbol="F")]),
                LyricsLine(text="Chorus line 2", chords=[ChordPlacement(column=0, symbol="C")]),
            ],
            section_markers=[
                SectionMarker(line_index=0, name="verse"),
                SectionMarker(line_index=2, name="chorus"),
            ],
        )

        result = convert_lyrics_to_song_input(req)

        assert len(result.sections) == 2
        assert result.sections[0].name == "verse"
        assert len(result.sections[0].lines) == 2
        assert result.sections[1].name == "chorus"
        assert len(result.sections[1].lines) == 2

    def test_tempo_bpm(self):
        """Test tempo BPM is preserved."""
        req = LyricsInputRequest(
            lyrics_lines=[LyricsLine(text="Test", chords=[])],
            tempo_bpm=120.0,
        )

        result = convert_lyrics_to_song_input(req)

        assert result.sections[0].tempo_bpm == 120.0

    def test_bars_and_chords_coexist(self):
        """Test that both bars and legacy chord-lyrics coexist."""
        req = LyricsInputRequest(
            lyrics_lines=[
                LyricsLine(
                    text="Test line",
                    chords=[ChordPlacement(column=0, symbol="C")],
                )
            ],
            bar_markers=[BarMarker(chord_index=0)],
            chords_with_beats=[
                ChordWithBeat(
                    symbol="C",
                    column=0,
                    beat_position=BeatPositionInput(beat=1, subdivision=0),
                )
            ],
        )

        result = convert_lyrics_to_song_input(req)

        # Both legacy lines and bars should exist
        assert len(result.sections[0].lines) == 1
        assert len(result.sections[0].bars) == 1
        # Bar contains the chord
        assert result.sections[0].bars[0].content.chords[0].symbol == "C"
        # Legacy line also contains the chord
        assert result.sections[0].lines[0].chords[0][1] == "C"
