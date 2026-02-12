"""Bass line extraction and chromatic run detection."""

from __future__ import annotations

from caspian.models.analysis import BassNote, ChromaticRun
from caspian.models.chord import Chord
from caspian.theory.intervals import interval_semitones, classify_bass_motion
from caspian.theory.pitch import note_name


def extract_bass_line(chords: list[Chord]) -> list[BassNote]:
    """Extract the bass note sequence from a list of chords."""
    bass_line: list[BassNote] = []
    for i, chord in enumerate(chords):
        bn = BassNote(
            pitch=chord.bass,
            name=chord.bass_name,
            chord_symbol=chord.symbol,
            position=i,
        )
        if i > 0:
            interval = interval_semitones(bass_line[-1].pitch, bn.pitch)
            bn.motion_from_previous = classify_bass_motion(interval)
        bass_line.append(bn)
    return bass_line


def detect_chromatic_runs(bass_line: list[BassNote], min_length: int = 2) -> list[ChromaticRun]:
    """Find consecutive chromatic (half-step) motions in the bass.

    min_length=2 catches pairs (E→D#), min_length=3 catches runs (B→C→C#→D).
    Returns both pairs and longer runs.
    """
    if len(bass_line) < 2:
        return []

    runs: list[ChromaticRun] = []
    current_run: list[BassNote] = [bass_line[0]]
    current_direction: int | None = None

    for i in range(1, len(bass_line)):
        interval = interval_semitones(bass_line[i - 1].pitch, bass_line[i].pitch)
        if abs(interval) == 1:
            if current_direction is None or interval == current_direction:
                current_run.append(bass_line[i])
                current_direction = interval
            else:
                # Direction changed — flush and start new
                if len(current_run) >= min_length:
                    runs.append(_make_run(current_run, current_direction))
                current_run = [bass_line[i - 1], bass_line[i]]
                current_direction = interval
        else:
            if len(current_run) >= min_length:
                runs.append(_make_run(current_run, current_direction))
            current_run = [bass_line[i]]
            current_direction = None

    if len(current_run) >= min_length and current_direction is not None:
        runs.append(_make_run(current_run, current_direction))

    return runs


def _make_run(notes: list[BassNote], direction: int | None) -> ChromaticRun:
    dir_str = "ascending" if (direction is not None and direction > 0) else "descending"
    return ChromaticRun(
        notes=list(notes),
        direction=dir_str,
        start_position=notes[0].position,
        length=len(notes),
    )
