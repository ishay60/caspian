"""Tests for SectionInput model updates."""

import pytest
from caspian.models.input import (
    Bar,
    BarChord,
    BarContent,
    BeatPosition,
    SectionInput,
)


class TestSectionInputBackwardCompatibility:
    """Tests for backward compatibility with existing fields."""

    def test_legacy_section_creation(self):
        """Test that legacy sections still work."""
        section = SectionInput(name="verse", section_type="vocal")
        assert section.name == "verse"
        assert section.section_type == "vocal"
        assert section.chords == []
        assert section.lines == []

    def test_legacy_with_chords(self):
        """Test legacy section with chords list."""
        from caspian.models.input import ChordInput

        section = SectionInput(
            name="chorus",
            chords=[
                ChordInput(symbol="Am"),
                ChordInput(symbol="G")
            ]
        )
        assert len(section.chords) == 2
        assert section.chords[0].symbol == "Am"

    def test_empty_bars_by_default(self):
        """Test that bars field defaults to empty list."""
        section = SectionInput(name="verse")
        assert section.bars == []

    def test_no_tempo_by_default(self):
        """Test that tempo_bpm defaults to None."""
        section = SectionInput(name="verse")
        assert section.tempo_bpm is None


class TestSectionInputNewFields:
    """Tests for new bars and tempo_bpm fields."""

    def test_section_with_bars(self):
        """Test creating section with bars."""
        section = SectionInput(
            name="verse",
            bars=[
                Bar(
                    content=BarContent(
                        chords=[
                            BarChord(
                                symbol="Am",
                                beat_position=BeatPosition(beat=1, subdivision=0)
                            )
                        ]
                    )
                ),
                Bar(
                    content=BarContent(
                        chords=[
                            BarChord(
                                symbol="G",
                                beat_position=BeatPosition(beat=1, subdivision=0)
                            )
                        ]
                    )
                )
            ]
        )
        assert len(section.bars) == 2
        assert section.bars[0].content.chords[0].symbol == "Am"
        assert section.bars[1].content.chords[0].symbol == "G"

    def test_section_with_tempo(self):
        """Test section with tempo_bpm."""
        section = SectionInput(name="verse", tempo_bpm=120.0)
        assert section.tempo_bpm == 120.0

    def test_section_with_fractional_tempo(self):
        """Test section with fractional BPM."""
        section = SectionInput(name="intro", tempo_bpm=95.5)
        assert section.tempo_bpm == 95.5

    def test_mixed_legacy_and_bars(self):
        """Test section with both legacy and new fields."""
        from caspian.models.input import ChordInput

        section = SectionInput(
            name="bridge",
            chords=[ChordInput(symbol="C")],
            bars=[
                Bar(
                    content=BarContent(
                        chords=[
                            BarChord(
                                symbol="F",
                                beat_position=BeatPosition(beat=1, subdivision=0)
                            )
                        ]
                    )
                )
            ],
            tempo_bpm=100.0
        )
        # Both fields can coexist during migration
        assert len(section.chords) == 1
        assert len(section.bars) == 1
        assert section.tempo_bpm == 100.0

    def test_complete_section(self):
        """Test section with all fields populated."""
        section = SectionInput(
            name="chorus",
            section_type="vocal",
            bars=[
                Bar(
                    time_signature=(4, 4),
                    content=BarContent(
                        chords=[
                            BarChord(
                                symbol="Am",
                                beat_position=BeatPosition(beat=1, subdivision=0),
                                duration_beats=2.0
                            ),
                            BarChord(
                                symbol="G",
                                beat_position=BeatPosition(beat=3, subdivision=0),
                                duration_beats=2.0
                            )
                        ]
                    ),
                    lyrics_fragment="שלום"
                ),
                Bar(
                    time_signature=(4, 4),
                    content=BarContent(
                        chords=[
                            BarChord(
                                symbol="F",
                                beat_position=BeatPosition(beat=1, subdivision=0),
                                duration_beats=4.0
                            )
                        ]
                    ),
                    lyrics_fragment="עולם"
                )
            ],
            tempo_bpm=110.0
        )
        assert section.name == "chorus"
        assert section.section_type == "vocal"
        assert len(section.bars) == 2
        assert section.bars[0].lyrics_fragment == "שלום"
        assert section.bars[1].lyrics_fragment == "עולם"
        assert section.tempo_bpm == 110.0
