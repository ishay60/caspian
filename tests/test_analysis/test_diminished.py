"""Tests for diminished chord analysis — the most complex module."""

import pytest
from caspian.analysis.diminished import analyze_diminished
from caspian.models.key import Key
from caspian.parsing.chord_parser import parse_chord


class TestD_SharpDim:
    """D#dim in the chorus of יום שישי חזר.

    Context: Am/E → D#dim → F#dim
    Expected:
    - Chromatic descent from Am/E (bass E→D#), confidence ~0.90
    - Rootless B7♭9 (V7♭9/v), confidence ~0.70
    """

    def test_chromatic_from_am_e(self):
        key = Key.from_name("A", "natural_minor")
        prev = parse_chord("Am/E")   # bass = E (4)
        chord = parse_chord("D#dim")  # bass = D# (3)
        next_c = parse_chord("F#dim")
        results = analyze_diminished(chord, prev, next_c, key)

        types = [r.type for r in results]
        assert "chromatic_approach_from" in types

        # Find the chromatic approach interpretation
        chrom = next(r for r in results if r.type == "chromatic_approach_from")
        assert "descending" in chrom.detail
        assert chrom.confidence >= 0.85

    def test_rootless_b7b9(self):
        key = Key.from_name("A", "natural_minor")
        prev = parse_chord("Am/E")
        chord = parse_chord("D#dim")  # D#, F#, A → subset of B7b9 (B, D#, F#, A, C)
        next_c = parse_chord("F#dim")
        results = analyze_diminished(chord, prev, next_c, key)

        rootless = [r for r in results if r.type == "rootless_dom7b9"]
        assert len(rootless) >= 1
        # Should find B7b9 interpretation
        b_interp = [r for r in rootless if "B" in r.detail]
        assert len(b_interp) >= 1


class TestF_SharpDim:
    """F#dim in the chorus of יום שישי חזר.

    Context: D#dim → F#dim → F
    Expected:
    - Chromatic approach to F (bass F#→F), confidence ~0.85
    - Common-tone dim with F (shares A, C), confidence ~0.80
    """

    def test_chromatic_to_f(self):
        key = Key.from_name("A", "natural_minor")
        prev = parse_chord("D#dim")
        chord = parse_chord("F#dim")   # bass = F# (6)
        next_c = parse_chord("F")      # bass = F (5)
        results = analyze_diminished(chord, prev, next_c, key)

        types = [r.type for r in results]
        assert "chromatic_approach_to" in types

        chrom = next(r for r in results if r.type == "chromatic_approach_to")
        assert "descending" in chrom.detail
        assert chrom.confidence >= 0.80

    def test_common_tone_with_f(self):
        key = Key.from_name("A", "natural_minor")
        prev = parse_chord("D#dim")
        chord = parse_chord("F#dim")  # F#, A, C = pitches 6, 9, 0
        next_c = parse_chord("F")     # F, A, C = pitches 5, 9, 0
        results = analyze_diminished(chord, prev, next_c, key)

        ct = [r for r in results if r.type == "common_tone_dim" and next_c.symbol in r.detail]
        assert len(ct) >= 1
        assert ct[0].confidence >= 0.70
