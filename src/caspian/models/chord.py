"""Chord dataclass and quality definitions."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class ChordQuality(Enum):
    MAJOR = "major"
    MINOR = "minor"
    DIMINISHED = "diminished"
    AUGMENTED = "augmented"
    DOMINANT7 = "dominant7"
    MINOR7 = "minor7"
    MAJOR7 = "major7"
    HALF_DIMINISHED = "half_diminished"
    DIMINISHED7 = "diminished7"
    SUSPENDED2 = "suspended2"
    SUSPENDED4 = "suspended4"
    DOMINANT7SUS4 = "dominant7sus4"
    MINOR6 = "minor6"
    MAJOR6 = "major6"


# Intervals from root for each quality (semitones)
QUALITY_INTERVALS: dict[ChordQuality, list[int]] = {
    ChordQuality.MAJOR: [0, 4, 7],
    ChordQuality.MINOR: [0, 3, 7],
    ChordQuality.DIMINISHED: [0, 3, 6],
    ChordQuality.AUGMENTED: [0, 4, 8],
    ChordQuality.DOMINANT7: [0, 4, 7, 10],
    ChordQuality.MINOR7: [0, 3, 7, 10],
    ChordQuality.MAJOR7: [0, 4, 7, 11],
    ChordQuality.HALF_DIMINISHED: [0, 3, 6, 10],
    ChordQuality.DIMINISHED7: [0, 3, 6, 9],
    ChordQuality.SUSPENDED2: [0, 2, 7],
    ChordQuality.SUSPENDED4: [0, 5, 7],
    ChordQuality.DOMINANT7SUS4: [0, 5, 7, 10],
    ChordQuality.MINOR6: [0, 3, 7, 9],
    ChordQuality.MAJOR6: [0, 4, 7, 9],
}


@dataclass(frozen=True)
class Chord:
    """An analyzed chord with root, quality, bass, and pitch set."""

    symbol: str
    root: int  # pitch class 0-11
    root_name: str
    quality: ChordQuality
    bass: int  # pitch class 0-11
    bass_name: str
    pitches: tuple[int, ...]  # sorted pitch classes

    @property
    def is_inverted(self) -> bool:
        return self.bass != self.root

    def pitch_set(self) -> frozenset[int]:
        return frozenset(self.pitches)
