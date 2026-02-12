"""Key dataclass for representing musical keys."""

from __future__ import annotations

from dataclasses import dataclass

from caspian.theory.pitch import NOTE_TO_PITCH, note_name


SCALES: dict[str, list[int]] = {
    "natural_minor": [0, 2, 3, 5, 7, 8, 10],
    "harmonic_minor": [0, 2, 3, 5, 7, 8, 11],
    "melodic_minor": [0, 2, 3, 5, 7, 9, 11],
    "dorian": [0, 2, 3, 5, 7, 9, 10],
    "phrygian": [0, 1, 3, 5, 7, 8, 10],
    "phrygian_dominant": [0, 1, 4, 5, 7, 8, 10],
    "major": [0, 2, 4, 5, 7, 9, 11],
    "mixolydian": [0, 2, 4, 5, 7, 9, 10],
}


@dataclass(frozen=True)
class Key:
    """A musical key with root and mode."""

    root: int  # pitch class 0-11
    root_name: str
    mode: str  # key into SCALES
    scale_pitches: tuple[int, ...]  # absolute pitch classes of the scale

    @staticmethod
    def from_name(root_name: str, mode: str) -> Key:
        """Create a Key from a root note name and mode string.

        Example: Key.from_name("A", "natural_minor")
        """
        if root_name not in NOTE_TO_PITCH:
            raise ValueError(f"Unknown root note: {root_name}")
        if mode not in SCALES:
            raise ValueError(f"Unknown mode: {mode}. Valid: {list(SCALES.keys())}")
        root = NOTE_TO_PITCH[root_name]
        intervals = SCALES[mode]
        scale_pitches = tuple((root + i) % 12 for i in intervals)
        return Key(root=root, root_name=root_name, mode=mode, scale_pitches=scale_pitches)
