"""Tests for Roman numeral assignment."""

import pytest
from caspian.analysis.roman_numerals import assign_roman_numeral
from caspian.models.key import Key
from caspian.parsing.chord_parser import parse_chord


class TestRomanNumeralsAmNaturalMinor:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.key = Key.from_name("A", "natural_minor")

    @pytest.mark.parametrize("symbol,expected", [
        ("Am", "i"),
        ("C", "III"),
        ("Dm", "iv"),
        ("Em", "v"),
        ("F", "VI"),
        ("G", "VII"),
        ("E", "V"),         # E major — root is degree 5, major = uppercase
        ("E7", "V7"),
        ("D", "IV"),        # D major in Am: D is degree 4, uppercase = major (non-diatonic quality)
        ("Am/E", "i"),      # Slash chord keeps root's numeral
    ])
    def test_numeral(self, symbol, expected):
        chord = parse_chord(symbol)
        result = assign_roman_numeral(chord, self.key)
        assert result == expected


class TestRomanNumeralsCMajor:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.key = Key.from_name("C", "major")

    @pytest.mark.parametrize("symbol,expected", [
        ("C", "I"),
        ("Dm", "ii"),
        ("Em", "iii"),
        ("F", "IV"),
        ("G", "V"),
        ("Am", "vi"),
        ("G7", "V7"),
    ])
    def test_numeral(self, symbol, expected):
        chord = parse_chord(symbol)
        result = assign_roman_numeral(chord, self.key)
        assert result == expected
