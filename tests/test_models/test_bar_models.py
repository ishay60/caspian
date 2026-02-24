"""Tests for bar-related input models."""

import pytest
from pydantic import ValidationError

from caspian.models.input import (
    Bar,
    BarChord,
    BarContent,
    BarNote,
    BeatPosition,
    TabNote,
)


class TestBeatPosition:
    """Tests for BeatPosition model."""

    def test_valid_downbeat(self):
        """Test creating a downbeat position."""
        pos = BeatPosition(beat=1, subdivision=0)
        assert pos.beat == 1
        assert pos.subdivision == 0

    def test_valid_eighth_note(self):
        """Test creating an 'and' position."""
        pos = BeatPosition(beat=2, subdivision=1)
        assert pos.beat == 2
        assert pos.subdivision == 1

    def test_valid_sixteenth_note(self):
        """Test creating 16th note positions."""
        pos_e = BeatPosition(beat=3, subdivision=2)
        assert pos_e.beat == 3
        assert pos_e.subdivision == 2

        pos_a = BeatPosition(beat=4, subdivision=3)
        assert pos_a.beat == 4
        assert pos_a.subdivision == 3

    def test_beat_must_be_positive(self):
        """Test that beat must be >= 1."""
        with pytest.raises(ValidationError, match="beat must be >= 1"):
            BeatPosition(beat=0, subdivision=0)

        with pytest.raises(ValidationError, match="beat must be >= 1"):
            BeatPosition(beat=-1, subdivision=0)

    def test_subdivision_must_be_non_negative(self):
        """Test that subdivision must be >= 0."""
        with pytest.raises(ValidationError, match="subdivision must be >= 0"):
            BeatPosition(beat=1, subdivision=-1)

    def test_subdivision_max_three(self):
        """Test that subdivision must be <= 3 (16th-note grid)."""
        with pytest.raises(ValidationError, match="subdivision must be <= 3"):
            BeatPosition(beat=1, subdivision=4)

        with pytest.raises(ValidationError, match="subdivision must be <= 3"):
            BeatPosition(beat=1, subdivision=10)

    def test_default_subdivision(self):
        """Test that subdivision defaults to 0."""
        pos = BeatPosition(beat=1)
        assert pos.subdivision == 0


class TestBarChord:
    """Tests for BarChord model."""

    def test_valid_bar_chord(self):
        """Test creating a basic bar chord."""
        chord = BarChord(
            symbol="Am",
            beat_position=BeatPosition(beat=1, subdivision=0)
        )
        assert chord.symbol == "Am"
        assert chord.beat_position.beat == 1
        assert chord.beat_position.subdivision == 0
        assert chord.duration_beats is None

    def test_with_duration(self):
        """Test chord with explicit duration."""
        chord = BarChord(
            symbol="G7",
            beat_position=BeatPosition(beat=3, subdivision=0),
            duration_beats=2.0
        )
        assert chord.symbol == "G7"
        assert chord.duration_beats == 2.0

    def test_complex_chord_symbols(self):
        """Test various chord symbols."""
        symbols = ["Cmaj7", "Dm7b5", "F#dim", "Baug", "Gsus4"]
        for symbol in symbols:
            chord = BarChord(
                symbol=symbol,
                beat_position=BeatPosition(beat=1, subdivision=0)
            )
            assert chord.symbol == symbol


class TestBarNote:
    """Tests for BarNote model."""

    def test_valid_bar_note(self):
        """Test creating a basic bar note."""
        note = BarNote(
            pitch="A",
            beat_position=BeatPosition(beat=1, subdivision=0)
        )
        assert note.pitch == "A"
        assert note.octave == 4  # default
        assert note.duration_beats == 0.5  # default
        assert note.technique is None

    def test_with_all_fields(self):
        """Test note with all fields specified."""
        note = BarNote(
            pitch="C#",
            octave=5,
            beat_position=BeatPosition(beat=2, subdivision=1),
            duration_beats=0.25,
            technique="bend"
        )
        assert note.pitch == "C#"
        assert note.octave == 5
        assert note.duration_beats == 0.25
        assert note.technique == "bend"

    def test_various_techniques(self):
        """Test different playing techniques."""
        techniques = ["bend", "slide", "hammer-on", "pull-off", "vibrato"]
        for tech in techniques:
            note = BarNote(
                pitch="G",
                beat_position=BeatPosition(beat=1, subdivision=0),
                technique=tech
            )
            assert note.technique == tech


class TestTabNote:
    """Tests for TabNote model."""

    def test_valid_tab_note(self):
        """Test creating a basic tab note."""
        note = TabNote(
            string=1,
            fret=0,
            beat_position=BeatPosition(beat=1, subdivision=0)
        )
        assert note.string == 1
        assert note.fret == 0
        assert note.duration_beats == 0.5  # default

    def test_all_strings(self):
        """Test all valid string numbers."""
        for string_num in range(1, 7):
            note = TabNote(
                string=string_num,
                fret=5,
                beat_position=BeatPosition(beat=1, subdivision=0)
            )
            assert note.string == string_num

    def test_various_frets(self):
        """Test various fret positions."""
        frets = [0, 5, 12, 24]
        for fret in frets:
            note = TabNote(
                string=3,
                fret=fret,
                beat_position=BeatPosition(beat=1, subdivision=0)
            )
            assert note.fret == fret

    def test_string_validation_low(self):
        """Test that string must be >= 1."""
        with pytest.raises(ValidationError, match="string must be 1-6"):
            TabNote(
                string=0,
                fret=5,
                beat_position=BeatPosition(beat=1, subdivision=0)
            )

    def test_string_validation_high(self):
        """Test that string must be <= 6."""
        with pytest.raises(ValidationError, match="string must be 1-6"):
            TabNote(
                string=7,
                fret=5,
                beat_position=BeatPosition(beat=1, subdivision=0)
            )

    def test_fret_validation_low(self):
        """Test that fret must be >= 0."""
        with pytest.raises(ValidationError, match="fret must be 0-24"):
            TabNote(
                string=3,
                fret=-1,
                beat_position=BeatPosition(beat=1, subdivision=0)
            )

    def test_fret_validation_high(self):
        """Test that fret must be <= 24."""
        with pytest.raises(ValidationError, match="fret must be 0-24"):
            TabNote(
                string=3,
                fret=25,
                beat_position=BeatPosition(beat=1, subdivision=0)
            )

    def test_with_technique(self):
        """Test tab note with technique."""
        note = TabNote(
            string=2,
            fret=7,
            beat_position=BeatPosition(beat=1, subdivision=0),
            technique="slide"
        )
        assert note.technique == "slide"


class TestBarContent:
    """Tests for BarContent model."""

    def test_empty_bar_content(self):
        """Test creating empty bar content."""
        content = BarContent()
        assert content.chords == []
        assert content.notes == []
        assert content.tab == []
        assert content.label is None

    def test_with_chords(self):
        """Test bar content with chords."""
        content = BarContent(
            chords=[
                BarChord(symbol="Am", beat_position=BeatPosition(beat=1, subdivision=0)),
                BarChord(symbol="G", beat_position=BeatPosition(beat=3, subdivision=0))
            ]
        )
        assert len(content.chords) == 2
        assert content.chords[0].symbol == "Am"
        assert content.chords[1].symbol == "G"

    def test_with_notes(self):
        """Test bar content with notes."""
        content = BarContent(
            notes=[
                BarNote(pitch="A", beat_position=BeatPosition(beat=1, subdivision=0)),
                BarNote(pitch="C", beat_position=BeatPosition(beat=2, subdivision=0))
            ]
        )
        assert len(content.notes) == 2
        assert content.notes[0].pitch == "A"
        assert content.notes[1].pitch == "C"

    def test_with_tab(self):
        """Test bar content with tablature."""
        content = BarContent(
            tab=[
                TabNote(string=1, fret=0, beat_position=BeatPosition(beat=1, subdivision=0)),
                TabNote(string=2, fret=3, beat_position=BeatPosition(beat=2, subdivision=0))
            ]
        )
        assert len(content.tab) == 2
        assert content.tab[0].string == 1
        assert content.tab[1].fret == 3

    def test_with_label(self):
        """Test bar content with label."""
        content = BarContent(label="intro riff")
        assert content.label == "intro riff"

    def test_mixed_content(self):
        """Test bar content with multiple types."""
        content = BarContent(
            chords=[
                BarChord(symbol="Am", beat_position=BeatPosition(beat=1, subdivision=0))
            ],
            notes=[
                BarNote(pitch="E", beat_position=BeatPosition(beat=3, subdivision=0))
            ],
            label="verse with fill"
        )
        assert len(content.chords) == 1
        assert len(content.notes) == 1
        assert content.label == "verse with fill"


class TestBar:
    """Tests for Bar model."""

    def test_empty_bar(self):
        """Test creating an empty bar with defaults."""
        bar = Bar()
        assert bar.time_signature == (4, 4)
        assert bar.content.chords == []
        assert bar.lyrics_fragment == ""
        assert bar.is_expandable is False

    def test_with_time_signature(self):
        """Test bar with different time signatures."""
        bar_3_4 = Bar(time_signature=(3, 4))
        assert bar_3_4.time_signature == (3, 4)

        bar_6_8 = Bar(time_signature=(6, 8))
        assert bar_6_8.time_signature == (6, 8)

    def test_with_content(self):
        """Test bar with musical content."""
        content = BarContent(
            chords=[
                BarChord(symbol="Am", beat_position=BeatPosition(beat=1, subdivision=0))
            ]
        )
        bar = Bar(content=content)
        assert len(bar.content.chords) == 1
        assert bar.content.chords[0].symbol == "Am"

    def test_with_lyrics(self):
        """Test bar with lyrics fragment."""
        bar = Bar(lyrics_fragment="יום")
        assert bar.lyrics_fragment == "יום"

    def test_expandable_bar(self):
        """Test expandable bar flag."""
        bar = Bar(is_expandable=True)
        assert bar.is_expandable is True

    def test_complete_bar(self):
        """Test bar with all fields."""
        bar = Bar(
            time_signature=(4, 4),
            content=BarContent(
                chords=[
                    BarChord(symbol="Am", beat_position=BeatPosition(beat=1, subdivision=0)),
                    BarChord(symbol="F", beat_position=BeatPosition(beat=3, subdivision=0))
                ],
                label="verse pattern"
            ),
            lyrics_fragment="שלום",
            is_expandable=False
        )
        assert bar.time_signature == (4, 4)
        assert len(bar.content.chords) == 2
        assert bar.content.label == "verse pattern"
        assert bar.lyrics_fragment == "שלום"
        assert bar.is_expandable is False
