"""Tests for voice leading analysis."""

from caspian.theory.voice_leading import common_tones, voice_leading_distance


class TestCommonTones:
    def test_f_sharp_dim_and_f_major(self):
        """F#dim [F#, A, C] and F [F, A, C] share A and C."""
        f_sharp_dim = frozenset({6, 9, 0})  # F#, A, C
        f_major = frozenset({5, 9, 0})      # F, A, C
        ct = common_tones(f_sharp_dim, f_major)
        assert ct == frozenset({9, 0})  # A, C

    def test_am_and_dm(self):
        """Am [A, C, E] and Dm [D, F, A] share A."""
        am = frozenset({9, 0, 4})
        dm = frozenset({2, 5, 9})
        ct = common_tones(am, dm)
        assert ct == frozenset({9})

    def test_no_common(self):
        c = frozenset({0, 4, 7})   # C major
        fsharp = frozenset({6, 10, 1})  # F# major
        assert common_tones(c, fsharp) == frozenset()


class TestVoiceLeadingDistance:
    def test_f_sharp_dim_to_f(self):
        """F#dim → F: only root moves F#→F (1 semitone)."""
        dist = voice_leading_distance([6, 9, 0], [5, 9, 0])
        assert dist == 1

    def test_same_chord(self):
        assert voice_leading_distance([0, 4, 7], [0, 4, 7]) == 0

    def test_empty(self):
        assert voice_leading_distance([], [0, 4, 7]) == 0
