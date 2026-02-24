"""Tests for bar-related analysis models."""

import pytest
from caspian.models.analysis import BarAnalysis, ChordAnalysis, SectionAnalysis
from caspian.parsing.chord_parser import parse_chord


class TestBarAnalysis:
    """Tests for BarAnalysis model."""

    def test_empty_bar_analysis(self):
        """Test creating empty bar analysis."""
        bar_analysis = BarAnalysis(bar_index=0)
        assert bar_analysis.bar_index == 0
        assert bar_analysis.chord_analyses == []
        assert bar_analysis.harmonic_rhythm == "static"
        assert bar_analysis.has_riff is False
        assert bar_analysis.riff_analysis is None

    def test_with_chord_analyses(self):
        """Test bar analysis with chord analyses."""
        chord1 = ChordAnalysis(
            chord=parse_chord("Am"),
            roman_numeral="i"
        )
        chord2 = ChordAnalysis(
            chord=parse_chord("G"),
            roman_numeral="VII"
        )
        bar_analysis = BarAnalysis(
            bar_index=0,
            chord_analyses=[chord1, chord2]
        )
        assert len(bar_analysis.chord_analyses) == 2
        assert bar_analysis.chord_analyses[0].roman_numeral == "i"
        assert bar_analysis.chord_analyses[1].roman_numeral == "VII"

    def test_harmonic_rhythm_static(self):
        """Test static harmonic rhythm."""
        bar_analysis = BarAnalysis(
            bar_index=0,
            harmonic_rhythm="static"
        )
        assert bar_analysis.harmonic_rhythm == "static"

    def test_harmonic_rhythm_half_bar(self):
        """Test half-bar harmonic rhythm."""
        bar_analysis = BarAnalysis(
            bar_index=0,
            harmonic_rhythm="half-bar"
        )
        assert bar_analysis.harmonic_rhythm == "half-bar"

    def test_harmonic_rhythm_per_beat(self):
        """Test per-beat harmonic rhythm."""
        bar_analysis = BarAnalysis(
            bar_index=0,
            harmonic_rhythm="per-beat"
        )
        assert bar_analysis.harmonic_rhythm == "per-beat"

    def test_harmonic_rhythm_syncopated(self):
        """Test syncopated harmonic rhythm."""
        bar_analysis = BarAnalysis(
            bar_index=1,
            harmonic_rhythm="syncopated"
        )
        assert bar_analysis.harmonic_rhythm == "syncopated"

    def test_with_riff(self):
        """Test bar analysis with riff."""
        bar_analysis = BarAnalysis(
            bar_index=2,
            has_riff=True,
            riff_analysis="Chromatic descent from A to E"
        )
        assert bar_analysis.has_riff is True
        assert bar_analysis.riff_analysis == "Chromatic descent from A to E"

    def test_complete_bar_analysis(self):
        """Test complete bar analysis with all fields."""
        chord1 = ChordAnalysis(
            chord=parse_chord("Am"),
            roman_numeral="i",
            is_diatonic=True
        )
        chord2 = ChordAnalysis(
            chord=parse_chord("E7"),
            roman_numeral="V7"
        )
        bar_analysis = BarAnalysis(
            bar_index=3,
            chord_analyses=[chord1, chord2],
            harmonic_rhythm="half-bar",
            has_riff=True,
            riff_analysis="Dominant resolution with approach notes"
        )
        assert bar_analysis.bar_index == 3
        assert len(bar_analysis.chord_analyses) == 2
        assert bar_analysis.harmonic_rhythm == "half-bar"
        assert bar_analysis.has_riff is True
        assert "approach notes" in bar_analysis.riff_analysis


class TestSectionAnalysisWithBars:
    """Tests for SectionAnalysis with new bars field."""

    def test_legacy_section_analysis(self):
        """Test that legacy section analysis still works."""
        section = SectionAnalysis(name="verse")
        assert section.name == "verse"
        assert section.chords == []
        assert section.bass_line == []
        assert section.chromatic_runs == []
        assert section.patterns == []
        assert section.lines == []

    def test_empty_bars_by_default(self):
        """Test that bars field defaults to empty list."""
        section = SectionAnalysis(name="chorus")
        assert section.bars == []

    def test_section_with_bars(self):
        """Test section analysis with bar analyses."""
        bar1 = BarAnalysis(bar_index=0, harmonic_rhythm="static")
        bar2 = BarAnalysis(bar_index=1, harmonic_rhythm="half-bar")
        section = SectionAnalysis(
            name="verse",
            bars=[bar1, bar2]
        )
        assert len(section.bars) == 2
        assert section.bars[0].bar_index == 0
        assert section.bars[1].bar_index == 1

    def test_mixed_legacy_and_bars(self):
        """Test section with both legacy and bar analysis."""
        chord = ChordAnalysis(
            chord=parse_chord("Am"),
            roman_numeral="i"
        )
        bar = BarAnalysis(
            bar_index=0,
            chord_analyses=[chord],
            harmonic_rhythm="static"
        )
        section = SectionAnalysis(
            name="verse",
            chords=[chord],  # legacy
            bars=[bar]       # new
        )
        # Both fields can coexist during migration
        assert len(section.chords) == 1
        assert len(section.bars) == 1

    def test_complete_section_with_bars(self):
        """Test complete section analysis with all bar features."""
        # Create chord analyses
        chord1 = ChordAnalysis(
            chord=parse_chord("Am"),
            roman_numeral="i",
            is_diatonic=True
        )
        chord2 = ChordAnalysis(
            chord=parse_chord("G"),
            roman_numeral="VII"
        )
        chord3 = ChordAnalysis(
            chord=parse_chord("F"),
            roman_numeral="VI"
        )

        # Create bar analyses
        bar1 = BarAnalysis(
            bar_index=0,
            chord_analyses=[chord1],
            harmonic_rhythm="static"
        )
        bar2 = BarAnalysis(
            bar_index=1,
            chord_analyses=[chord2, chord3],
            harmonic_rhythm="half-bar",
            has_riff=False
        )
        bar3 = BarAnalysis(
            bar_index=2,
            chord_analyses=[chord1],
            harmonic_rhythm="static",
            has_riff=True,
            riff_analysis="Returns to tonic with melodic fill"
        )

        section = SectionAnalysis(
            name="verse",
            bars=[bar1, bar2, bar3]
        )

        assert section.name == "verse"
        assert len(section.bars) == 3
        assert section.bars[0].harmonic_rhythm == "static"
        assert section.bars[1].harmonic_rhythm == "half-bar"
        assert section.bars[2].has_riff is True
        assert len(section.bars[1].chord_analyses) == 2

    def test_bar_indices_sequential(self):
        """Test that bar indices are properly sequential."""
        bars = [
            BarAnalysis(bar_index=0),
            BarAnalysis(bar_index=1),
            BarAnalysis(bar_index=2),
            BarAnalysis(bar_index=3)
        ]
        section = SectionAnalysis(name="chorus", bars=bars)
        for i, bar in enumerate(section.bars):
            assert bar.bar_index == i

    def test_different_harmonic_rhythms_per_bar(self):
        """Test section with varying harmonic rhythms across bars."""
        section = SectionAnalysis(
            name="bridge",
            bars=[
                BarAnalysis(bar_index=0, harmonic_rhythm="static"),
                BarAnalysis(bar_index=1, harmonic_rhythm="half-bar"),
                BarAnalysis(bar_index=2, harmonic_rhythm="per-beat"),
                BarAnalysis(bar_index=3, harmonic_rhythm="syncopated")
            ]
        )
        rhythms = [bar.harmonic_rhythm for bar in section.bars]
        assert rhythms == ["static", "half-bar", "per-beat", "syncopated"]
