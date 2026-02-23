"""Tests for enharmonic key detection — no vote-splitting between Bb and A#."""

from caspian.analysis.key_detector import detect_key, _preferred_name
from caspian.parsing.chord_parser import parse_chord


class TestPreferredName:
    def test_bb_from_bbm_chords(self):
        chords = [parse_chord("Bbm"), parse_chord("Ebm"), parse_chord("Dbmaj7")]
        assert _preferred_name(10, chords) == "Bb"

    def test_fallback_to_sharp(self):
        chords = [parse_chord("Am"), parse_chord("Dm")]
        # pitch 10 not in any chord root — falls back to sharp
        assert _preferred_name(10, chords) == "A#"

    def test_ab_from_ab_chord(self):
        chords = [parse_chord("Ab"), parse_chord("Bbm")]
        assert _preferred_name(8, chords) == "Ab"


class TestEnharmonicKeyDetection:
    def test_bb_minor_not_asharp(self):
        """Chords spelled with flats should detect Bb minor, not A# minor."""
        chords = [parse_chord(s) for s in [
            "Bbm", "Ebm", "Fm", "Bbm", "Gb", "Ab", "Bbm",
        ]]
        key = detect_key(chords)
        assert key.root_name == "Bb"
        assert "minor" in key.mode

    def test_eb_minor(self):
        """Chords with Eb spelling should detect Eb, not D#."""
        chords = [parse_chord(s) for s in [
            "Ebm", "Ab", "Bb", "Ebm",
        ]]
        key = detect_key(chords)
        assert key.root_name == "Eb"

    def test_am_still_works(self):
        """Existing Am detection should still work (no enharmonic ambiguity)."""
        chords = [parse_chord(s) for s in ["Am", "Dm", "E", "Am"]]
        key = detect_key(chords)
        assert key.root_name == "A"
        assert "minor" in key.mode

    def test_c_major_still_works(self):
        chords = [parse_chord(s) for s in ["C", "F", "G", "C"]]
        key = detect_key(chords)
        assert key.root_name == "C"
        assert key.mode == "major"
