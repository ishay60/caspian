"""Integration tests for dual-path analysis pipeline.

Tests both legacy chord-based and new bar-aware analysis paths.

Tasks 1.2.8, 1.2.9, 1.2.10:
- Legacy path integration tests
- Bar-aware path integration tests
- Ground truth verification
"""

import pytest
from caspian.models.input import (
    Bar, BarChord, BarContent, BeatPosition, SectionInput, SongInput
)
from caspian.models.key import Key
from caspian.analysis.analyzer import analyze_song, analyze_section
from caspian.parsing.input_parser import parse_format_a


class TestLegacyPathIntegration:
    """Task 1.2.8: Legacy Integration Tests

    Verify that existing chord-based input still works correctly.
    """

    def test_legacy_simple_progression(self):
        """Test basic Am → Dm → E → Am progression."""
        text = "key: Am\n[verse]\nAm Dm E Am"
        song = parse_format_a(text)
        result = analyze_song(song)

        assert result.key.root_name == "A"
        assert result.key.mode == "natural_minor"
        assert len(result.sections) == 1

        section = result.sections[0]
        assert section.name == "verse"
        assert len(section.chords) == 4
        assert section.bars == []  # No bars in legacy format

        # Check chord symbols
        symbols = [ca.chord.symbol for ca in section.chords]
        assert symbols == ["Am", "Dm", "E", "Am"]

        # Check roman numerals
        numerals = [ca.roman_numeral for ca in section.chords]
        assert numerals == ["i", "iv", "V", "i"]

    def test_legacy_with_slash_chords(self):
        """Test legacy path with slash chords like Am/E."""
        text = "key: Am\n[verse]\nAm Am/E D#dim F"
        song = parse_format_a(text)
        result = analyze_song(song)

        section = result.sections[0]
        assert len(section.chords) == 4

        symbols = [ca.chord.symbol for ca in section.chords]
        assert symbols == ["Am", "Am/E", "D#dim", "F"]

        # Am/E should have E as bass
        am_slash_e = section.chords[1]
        assert am_slash_e.chord.bass_name == "E"

    def test_legacy_yom_shishi_ground_truth(self):
        """Test ground truth example from yom_shishi still works.

        Task 1.2.10: Ground Truth Tests (Legacy)
        """
        text = """\
key: Am
title: יום שישי חזר
artist: מתי כספי

[bridge]
D#dim Am/E | יש אולי סיכוי קרוב
F F#dim | למצוא גן עדן ברחוב
Dm E Am D | ואולי גם לילה טוב
"""
        song = parse_format_a(text)
        result = analyze_song(song)

        assert result.key.root_name == "A"
        assert result.key.mode == "natural_minor"

        # Check chronological order (RTL reversed)
        section = result.sections[0]
        symbols = [ca.chord.symbol for ca in section.chords]
        assert symbols == [
            "Am/E", "D#dim",
            "F#dim", "F",
            "D", "Am", "E", "Dm",
        ]

        # Check D#dim interpretations
        d_sharp_dim = section.chords[1]
        assert d_sharp_dim.chord.symbol == "D#dim"
        types = [i.type for i in d_sharp_dim.interpretations]
        assert "chromatic_approach_from" in types
        assert "rootless_dom7b9" in types

        # Check F#dim interpretations
        f_sharp_dim = section.chords[2]
        assert f_sharp_dim.chord.symbol == "F#dim"
        types = [i.type for i in f_sharp_dim.interpretations]
        assert "chromatic_approach_to" in types
        assert "common_tone_dim" in types

        # Check D borrowed from Dorian
        d_major = section.chords[4]
        assert d_major.chord.symbol == "D"
        borrowed = [i for i in d_major.interpretations if i.type == "borrowed"]
        assert len(borrowed) >= 1
        assert any("Dorian" in i.detail for i in borrowed)

        # Check E → Dm deceptive resolution
        e_chord = section.chords[6]
        assert e_chord.chord.symbol == "E"
        assert e_chord.deceptive_resolution is not None
        assert "Dm" in e_chord.deceptive_resolution

    def test_legacy_bass_line_analysis(self):
        """Test bass line and chromatic run detection in legacy path."""
        text = "key: Am\n[verse]\nAm Am/E D#dim F F#dim"
        song = parse_format_a(text)
        result = analyze_song(song)

        section = result.sections[0]

        # Bass line should be extracted
        assert len(section.bass_line) == 5
        bass_names = [b.name for b in section.bass_line]
        assert bass_names == ["A", "E", "D#", "F", "F#"]

        # Chromatic runs should be detected
        assert len(section.chromatic_runs) >= 1


class TestBarAwarePathIntegration:
    """Task 1.2.9: Bar-Aware Integration Tests

    Verify new bar-based analysis with timing context.
    """

    def test_bar_aware_single_bar_static(self):
        """Test single bar with one chord (static harmonic rhythm)."""
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
                )
            ]
        )
        key = Key.from_name("A", "natural_minor")
        result = analyze_section(section, key)

        # Should route to bar-aware path
        assert len(result.bars) == 1
        assert result.bars[0].bar_index == 0
        assert result.bars[0].harmonic_rhythm == "static"

        # Should have chord analysis
        assert len(result.bars[0].chord_analyses) == 1
        assert result.bars[0].chord_analyses[0].chord.symbol == "Am"
        assert result.bars[0].chord_analyses[0].roman_numeral == "i"

        # Legacy field should also be populated
        assert len(result.chords) == 1
        assert result.chords[0].chord.symbol == "Am"

    def test_bar_aware_half_bar_changes(self):
        """Test bar with chord changes at half-bar (beat 3 in 4/4)."""
        section = SectionInput(
            name="verse",
            bars=[
                Bar(
                    time_signature=(4, 4),
                    content=BarContent(
                        chords=[
                            BarChord(
                                symbol="Am",
                                beat_position=BeatPosition(beat=1, subdivision=0)
                            ),
                            BarChord(
                                symbol="Dm",
                                beat_position=BeatPosition(beat=3, subdivision=0)
                            )
                        ]
                    )
                )
            ]
        )
        key = Key.from_name("A", "natural_minor")
        result = analyze_section(section, key)

        assert len(result.bars) == 1
        assert result.bars[0].harmonic_rhythm == "half-bar"
        assert len(result.bars[0].chord_analyses) == 2

        # Check chord order
        symbols = [ca.chord.symbol for ca in result.bars[0].chord_analyses]
        assert symbols == ["Am", "Dm"]

    def test_bar_aware_per_beat_changes(self):
        """Test bar with chord changes on every beat."""
        section = SectionInput(
            name="chorus",
            bars=[
                Bar(
                    time_signature=(4, 4),
                    content=BarContent(
                        chords=[
                            BarChord(symbol="Am", beat_position=BeatPosition(beat=1, subdivision=0)),
                            BarChord(symbol="F", beat_position=BeatPosition(beat=2, subdivision=0)),
                            BarChord(symbol="C", beat_position=BeatPosition(beat=3, subdivision=0)),
                            BarChord(symbol="G", beat_position=BeatPosition(beat=4, subdivision=0)),
                        ]
                    )
                )
            ]
        )
        key = Key.from_name("A", "natural_minor")
        result = analyze_section(section, key)

        assert len(result.bars) == 1
        assert result.bars[0].harmonic_rhythm == "per-beat"
        assert len(result.bars[0].chord_analyses) == 4

    def test_bar_aware_syncopated(self):
        """Test bar with syncopated chord changes (off-beat)."""
        section = SectionInput(
            name="verse",
            bars=[
                Bar(
                    content=BarContent(
                        chords=[
                            BarChord(symbol="Am", beat_position=BeatPosition(beat=1, subdivision=0)),
                            BarChord(symbol="Dm", beat_position=BeatPosition(beat=2, subdivision=1)),  # "and of 2"
                        ]
                    )
                )
            ]
        )
        key = Key.from_name("A", "natural_minor")
        result = analyze_section(section, key)

        assert len(result.bars) == 1
        assert result.bars[0].harmonic_rhythm == "syncopated"

    def test_bar_aware_multiple_bars(self):
        """Test multiple bars with different harmonic rhythms."""
        section = SectionInput(
            name="verse",
            bars=[
                # Bar 1: static
                Bar(
                    content=BarContent(
                        chords=[
                            BarChord(symbol="Am", beat_position=BeatPosition(beat=1, subdivision=0))
                        ]
                    )
                ),
                # Bar 2: half-bar change
                Bar(
                    content=BarContent(
                        chords=[
                            BarChord(symbol="Dm", beat_position=BeatPosition(beat=1, subdivision=0)),
                            BarChord(symbol="E", beat_position=BeatPosition(beat=3, subdivision=0))
                        ]
                    )
                ),
                # Bar 3: back to Am
                Bar(
                    content=BarContent(
                        chords=[
                            BarChord(symbol="Am", beat_position=BeatPosition(beat=1, subdivision=0))
                        ]
                    )
                ),
            ]
        )
        key = Key.from_name("A", "natural_minor")
        result = analyze_section(section, key)

        assert len(result.bars) == 3
        assert result.bars[0].harmonic_rhythm == "static"
        assert result.bars[1].harmonic_rhythm == "half-bar"
        assert result.bars[2].harmonic_rhythm == "static"

        # Check chronological chord order across bars
        assert len(result.chords) == 4
        symbols = [ca.chord.symbol for ca in result.chords]
        assert symbols == ["Am", "Dm", "E", "Am"]

        # Check bass line across bars
        bass_names = [b.name for b in result.bass_line]
        assert bass_names == ["A", "D", "E", "A"]

    def test_bar_aware_with_riff(self):
        """Test bar with riff/melodic content."""
        from caspian.models.input import BarNote

        section = SectionInput(
            name="intro",
            bars=[
                Bar(
                    content=BarContent(
                        chords=[
                            BarChord(symbol="Am", beat_position=BeatPosition(beat=1, subdivision=0))
                        ],
                        notes=[
                            BarNote(pitch="A", octave=4, beat_position=BeatPosition(beat=1, subdivision=0)),
                            BarNote(pitch="C", octave=5, beat_position=BeatPosition(beat=2, subdivision=0)),
                            BarNote(pitch="E", octave=5, beat_position=BeatPosition(beat=3, subdivision=0)),
                        ],
                        label="intro riff"
                    )
                )
            ]
        )
        key = Key.from_name("A", "natural_minor")
        result = analyze_section(section, key)

        assert len(result.bars) == 1
        assert result.bars[0].has_riff is True
        assert result.bars[0].riff_analysis == "intro riff"

    def test_bar_aware_empty_bar(self):
        """Test bar with no chords (rest)."""
        section = SectionInput(
            name="verse",
            bars=[
                Bar(content=BarContent(chords=[]))
            ]
        )
        key = Key.from_name("A", "natural_minor")
        result = analyze_section(section, key)

        assert len(result.bars) == 1
        assert result.bars[0].harmonic_rhythm == "static"
        assert len(result.bars[0].chord_analyses) == 0


class TestBarAwareGroundTruth:
    """Task 1.2.10: Ground Truth Tests (Bar-Aware)

    Create bar-based version of yom_shishi and verify correct analysis.
    """

    def test_yom_shishi_bridge_as_bars(self):
        """Test yom_shishi bridge using bar notation."""
        # Create bar-based version of the bridge section
        section = SectionInput(
            name="bridge",
            bars=[
                # Bar 1: Am/E → D#dim (half-bar)
                Bar(
                    content=BarContent(
                        chords=[
                            BarChord(symbol="Am/E", beat_position=BeatPosition(beat=1, subdivision=0)),
                            BarChord(symbol="D#dim", beat_position=BeatPosition(beat=3, subdivision=0)),
                        ]
                    ),
                    lyrics_fragment="יש אולי סיכוי קרוב"
                ),
                # Bar 2: F#dim → F (half-bar)
                Bar(
                    content=BarContent(
                        chords=[
                            BarChord(symbol="F#dim", beat_position=BeatPosition(beat=1, subdivision=0)),
                            BarChord(symbol="F", beat_position=BeatPosition(beat=3, subdivision=0)),
                        ]
                    ),
                    lyrics_fragment="למצוא גן עדן ברחוב"
                ),
                # Bar 3: Dm → E (half-bar)
                Bar(
                    content=BarContent(
                        chords=[
                            BarChord(symbol="Dm", beat_position=BeatPosition(beat=1, subdivision=0)),
                            BarChord(symbol="E", beat_position=BeatPosition(beat=3, subdivision=0)),
                        ]
                    ),
                    lyrics_fragment="ואולי גם לילה"
                ),
                # Bar 4: Am → D (half-bar)
                Bar(
                    content=BarContent(
                        chords=[
                            BarChord(symbol="Am", beat_position=BeatPosition(beat=1, subdivision=0)),
                            BarChord(symbol="D", beat_position=BeatPosition(beat=3, subdivision=0)),
                        ]
                    ),
                    lyrics_fragment="טוב"
                ),
            ]
        )
        key = Key.from_name("A", "natural_minor")
        result = analyze_section(section, key)

        # Check bar-level analysis
        assert len(result.bars) == 4
        assert all(ba.harmonic_rhythm == "half-bar" for ba in result.bars)

        # Check chronological chord order
        symbols = [ca.chord.symbol for ca in result.chords]
        assert symbols == [
            "Am/E", "D#dim",
            "F#dim", "F",
            "Dm", "E",
            "Am", "D"
        ]

        # Note: This is DIFFERENT from legacy RTL order!
        # In bar notation, chords are stored in chronological order,
        # not reversed for RTL lines.

        # Check D#dim analysis (bar 0, chord 1)
        d_sharp_dim_analysis = result.bars[0].chord_analyses[1]
        assert d_sharp_dim_analysis.chord.symbol == "D#dim"
        types = [i.type for i in d_sharp_dim_analysis.interpretations]
        assert "chromatic_approach_from" in types
        assert "rootless_dom7b9" in types

        # Check F#dim analysis (bar 1, chord 0)
        f_sharp_dim_analysis = result.bars[1].chord_analyses[0]
        assert f_sharp_dim_analysis.chord.symbol == "F#dim"
        types = [i.type for i in f_sharp_dim_analysis.interpretations]
        assert "chromatic_approach_to" in types  # F#dim → F
        assert "common_tone_dim" in types

        # Check D borrowed from Dorian (bar 3, chord 1)
        d_major_analysis = result.bars[3].chord_analyses[1]
        assert d_major_analysis.chord.symbol == "D"
        borrowed = [i for i in d_major_analysis.interpretations if i.type == "borrowed"]
        assert len(borrowed) >= 1
        assert any("Dorian" in i.detail for i in borrowed)

        # Check E → Am resolution (bar 2 ends with E, bar 3 starts with Am)
        # This is the EXPECTED resolution in A minor, not deceptive
        e_chord_analysis = result.bars[2].chord_analyses[1]
        assert e_chord_analysis.chord.symbol == "E"
        # E → Am is NOT deceptive (it's the expected resolution in A minor)
        # Note: In the original RTL version, the order was different
        # and created E → Dm which WAS deceptive

    def test_bar_aware_bass_line(self):
        """Test bass line extraction from bar-based input."""
        section = SectionInput(
            name="verse",
            bars=[
                Bar(
                    content=BarContent(
                        chords=[
                            BarChord(symbol="Am/E", beat_position=BeatPosition(beat=1, subdivision=0)),
                            BarChord(symbol="D#dim", beat_position=BeatPosition(beat=3, subdivision=0)),
                        ]
                    )
                ),
                Bar(
                    content=BarContent(
                        chords=[
                            BarChord(symbol="F#dim", beat_position=BeatPosition(beat=1, subdivision=0)),
                            BarChord(symbol="F", beat_position=BeatPosition(beat=3, subdivision=0)),
                        ]
                    )
                ),
            ]
        )
        key = Key.from_name("A", "natural_minor")
        result = analyze_section(section, key)

        # Bass line: E (from Am/E), D# (from D#dim), F# (from F#dim), F (from F)
        bass_names = [b.name for b in result.bass_line]
        assert bass_names == ["E", "D#", "F#", "F"]

        # Should detect chromatic runs
        assert len(result.chromatic_runs) >= 1


class TestDualPathRouting:
    """Test that routing logic correctly chooses between paths."""

    def test_prefers_bars_when_present(self):
        """When both chords and bars present, should use bars."""
        from caspian.models.input import ChordInput

        section = SectionInput(
            name="verse",
            chords=[ChordInput(symbol="C")],  # Legacy format
            bars=[  # Bar format (should take precedence)
                Bar(
                    content=BarContent(
                        chords=[
                            BarChord(symbol="Am", beat_position=BeatPosition(beat=1, subdivision=0))
                        ]
                    )
                )
            ]
        )
        key = Key.from_name("A", "natural_minor")
        result = analyze_section(section, key)

        # Should use bar-aware path (bars field populated)
        assert len(result.bars) == 1

        # Should analyze Am from bars, not C from chords
        assert result.chords[0].chord.symbol == "Am"

    def test_falls_back_to_legacy_when_no_bars(self):
        """When only chords present, should use legacy path."""
        from caspian.models.input import ChordInput

        section = SectionInput(
            name="verse",
            chords=[ChordInput(symbol="Am"), ChordInput(symbol="Dm")]
        )
        key = Key.from_name("A", "natural_minor")
        result = analyze_section(section, key)

        # Should use legacy path (bars field empty)
        assert len(result.bars) == 0
        assert len(result.chords) == 2

        symbols = [ca.chord.symbol for ca in result.chords]
        assert symbols == ["Am", "Dm"]

    def test_empty_section_both_paths(self):
        """Empty section should work in both paths."""
        # Empty legacy
        section1 = SectionInput(name="verse", chords=[])
        key = Key.from_name("A", "natural_minor")
        result1 = analyze_section(section1, key)
        assert len(result1.chords) == 0
        assert len(result1.bars) == 0

        # Empty bar-aware
        section2 = SectionInput(name="verse", bars=[])
        result2 = analyze_section(section2, key)
        assert len(result2.chords) == 0
        assert len(result2.bars) == 0
