"""Tests for tab4u normalization."""

import pytest
from caspian.parsing.tab4u_normalize import normalize_chord_symbol


@pytest.mark.parametrize("input_sym,expected", [
    ("Bsus7", "B7sus4"),
    ("Asus7", "A7sus4"),
    ("Am", "Am"),
    ("D#dim", "D#dim"),
    ("Am/E", "Am/E"),
    ("C", "C"),
    ("Fmaj7", "Fmaj7"),
])
def test_normalize(input_sym, expected):
    assert normalize_chord_symbol(input_sym) == expected
