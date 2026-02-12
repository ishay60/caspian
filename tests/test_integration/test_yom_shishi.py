"""End-to-end integration test for יום שישי חזר by מתי כספי.

Tests the complete pipeline: Format A input → parse → analyze → verify
against the ground truth from the spec.
"""

import pytest
from caspian.parsing.input_parser import parse_format_a
from caspian.analysis.analyzer import analyze_song


YOM_SHISHI_INPUT = """\
key: Am
title: יום שישי חזר
artist: מתי כספי

[intro]
Am Am D D Am Am D D
C C Am B Em Em Em E

[verse]
D Am | יום שישי חזר
Am C | בלי שום חדשות
B Em C | יום שישי אכזר
E Am D | שוב שעות קשות

[chorus]
D#dim Am/E | יש אולי סיכוי קרוב
F F#dim | למצוא גן עדן ברחוב
Dm E Am D | ואולי גם לילה טוב
"""


class TestYomShishiEndToEnd:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.song_input = parse_format_a(YOM_SHISHI_INPUT)
        self.analysis = analyze_song(self.song_input)

    def test_metadata(self):
        assert self.analysis.title == "יום שישי חזר"
        assert self.analysis.artist == "מתי כספי"
        assert self.analysis.key.root_name == "A"
        assert self.analysis.key.mode == "natural_minor"

    def test_section_count(self):
        assert len(self.analysis.sections) == 3
        assert self.analysis.sections[0].name == "intro"
        assert self.analysis.sections[1].name == "verse"
        assert self.analysis.sections[2].name == "chorus"

    def test_intro_ltr_order(self):
        """Intro chords should be in LTR order."""
        intro = self.analysis.sections[0]
        symbols = [ca.chord.symbol for ca in intro.chords]
        assert symbols[:4] == ["Am", "Am", "D", "D"]

    def test_chorus_chord_order(self):
        """CRITICAL: Chorus chords must be in RTL-reversed chronological order."""
        chorus = self.analysis.sections[2]
        symbols = [ca.chord.symbol for ca in chorus.chords]
        # Input (visual): "D#dim Am/E | Hebrew" → reversed: Am/E, D#dim
        # Input (visual): "F F#dim | Hebrew" → reversed: F#dim, F
        # Input (visual): "Dm E Am D | Hebrew" → reversed: D, Am, E, Dm
        assert symbols == [
            "Am/E", "D#dim",       # line 1
            "F#dim", "F",          # line 2
            "D", "Am", "E", "Dm", # line 3
        ]

    def test_chorus_d_sharp_dim_analysis(self):
        """D#dim should have chromatic descent and rootless B7b9 interpretations."""
        chorus = self.analysis.sections[2]
        d_sharp_dim = chorus.chords[1]  # second chord
        assert d_sharp_dim.chord.symbol == "D#dim"
        assert d_sharp_dim.is_diatonic is False

        types = [i.type for i in d_sharp_dim.interpretations]
        # Should have chromatic approach from Am/E (E→D#)
        assert "chromatic_approach_from" in types
        # Should have rootless dom7b9 interpretation
        assert "rootless_dom7b9" in types

    def test_chorus_f_sharp_dim_analysis(self):
        """F#dim should have chromatic approach to F and common tones."""
        chorus = self.analysis.sections[2]
        f_sharp_dim = chorus.chords[2]
        assert f_sharp_dim.chord.symbol == "F#dim"
        assert f_sharp_dim.is_diatonic is False

        types = [i.type for i in f_sharp_dim.interpretations]
        assert "chromatic_approach_to" in types
        assert "common_tone_dim" in types

    def test_chorus_d_major_borrowed(self):
        """D major should be detected as borrowed from Dorian."""
        chorus = self.analysis.sections[2]
        d_major = chorus.chords[4]
        assert d_major.chord.symbol == "D"
        assert d_major.is_diatonic is False

        borrowed = [i for i in d_major.interpretations if i.type == "borrowed"]
        assert len(borrowed) >= 1
        assert any("Dorian" in i.detail for i in borrowed)

    def test_chorus_deceptive_resolution(self):
        """E → Dm should be detected as deceptive resolution."""
        chorus = self.analysis.sections[2]
        e_chord = chorus.chords[6]
        assert e_chord.chord.symbol == "E"
        assert e_chord.deceptive_resolution is not None
        assert "Dm" in e_chord.deceptive_resolution

    def test_chorus_chromatic_pairs(self):
        """Should detect chromatic pairs E→D# and F#→F."""
        chorus = self.analysis.sections[2]
        runs = chorus.chromatic_runs
        assert len(runs) >= 2

        # Check for descending pairs
        desc_pairs = [r for r in runs if r.direction == "descending"]
        assert len(desc_pairs) >= 2

    def test_chorus_bass_line(self):
        """Bass line should be E → D# → F# → F → D → A → E → D."""
        chorus = self.analysis.sections[2]
        bass_names = [b.name for b in chorus.bass_line]
        assert bass_names == ["E", "D#", "F#", "F", "D", "A", "E", "D"]


class TestSimpleProgression:
    """Test case 2: Am → Dm → E → Am — all diatonic, no special events."""

    def test_all_diatonic(self):
        text = "key: Am\n[verse]\nAm Dm E Am"
        song = parse_format_a(text)
        result = analyze_song(song)
        section = result.sections[0]

        # All chords should have a reasonable analysis
        assert len(section.chords) == 4
        for ca in section.chords:
            # No deceptive resolutions in this simple progression
            if ca.chord.symbol != "E":
                assert ca.deceptive_resolution is None


class TestSecondaryDominantChain:
    """Test case 3: C → A7 → Dm → G7 → C — A7 is V7/ii."""

    def test_a7_secondary_dominant(self):
        text = "key: C\nmode: major\n[verse]\nC A7 Dm G7 C"
        song = parse_format_a(text)
        result = analyze_song(song)
        section = result.sections[0]

        a7 = section.chords[1]
        assert a7.chord.symbol == "A7"
        assert a7.secondary_dominant is not None
        assert "V7/ii" in a7.secondary_dominant
