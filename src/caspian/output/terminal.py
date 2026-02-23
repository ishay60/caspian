"""ANSI color-coded terminal output for song analysis."""

from __future__ import annotations

import sys

from caspian.models.analysis import (
    ChordAnalysis, ChromaticRun, SectionAnalysis, SongAnalysis,
)
from caspian.models.input import ChordLyricsLine
from caspian.theory.pitch import note_name

# ANSI color codes
_RESET = "\033[0m"
_BOLD = "\033[1m"
_DIM = "\033[2m"
_GREEN = "\033[32m"      # diatonic
_MAGENTA = "\033[35m"    # secondary dominant
_YELLOW = "\033[33m"     # borrowed
_RED = "\033[31m"        # diminished
_CYAN = "\033[36m"       # deceptive resolution
_BLUE = "\033[34m"       # info
_WHITE = "\033[37m"


def _chord_color(ca: ChordAnalysis) -> str:
    """Return the ANSI color code for a chord based on its analysis."""
    if ca.deceptive_resolution:
        return _CYAN
    elif any(i.type == "secondary_dominant" for i in ca.interpretations):
        return _MAGENTA
    elif any(i.type in ("chromatic_approach_from", "chromatic_approach_to",
                         "rootless_dom7b9", "common_tone_dim")
             for i in ca.interpretations):
        return _RED
    elif any(i.type == "borrowed" for i in ca.interpretations):
        return _YELLOW
    elif ca.is_diatonic:
        return _GREEN
    else:
        return _WHITE


def _color_chord(ca: ChordAnalysis) -> str:
    """Color a chord symbol based on its analysis."""
    symbol = ca.chord.symbol
    numeral = ca.roman_numeral
    color = _chord_color(ca)
    return f"{color}{_BOLD}{symbol}{_RESET}{_DIM} ({numeral}){_RESET}"


def _build_analysis_lookup(section: SectionAnalysis) -> dict[str, ChordAnalysis]:
    """Build a lookup from chord symbol to its analysis (last wins for dupes)."""
    lookup: dict[str, ChordAnalysis] = {}
    for ca in section.chords:
        lookup[ca.chord.symbol] = ca
    return lookup


def _render_chord_lyrics_lines(out, section: SectionAnalysis) -> None:
    """Render chord-above-lyrics display with ANSI colors on chord symbols."""
    lookup = _build_analysis_lookup(section)

    for cl in section.lines:
        # Build the colored chord line preserving column positions
        chord_parts: list[tuple[int, str, str]] = []  # (col, raw_symbol, colored)
        for col, sym in cl.chords:
            ca = lookup.get(sym)
            if ca:
                color = _chord_color(ca)
                colored = f"{color}{_BOLD}{sym}{_RESET}"
            else:
                colored = f"{_BOLD}{sym}{_RESET}"
            chord_parts.append((col, sym, colored))

        # Build chord line: place each colored chord at its original column
        # Account for ANSI codes adding invisible characters
        chord_line = ""
        visible_pos = 0
        for col, sym, colored in chord_parts:
            if col > visible_pos:
                chord_line += " " * (col - visible_pos)
                visible_pos = col
            chord_line += colored
            visible_pos += len(sym)

        _print(out, f"  {chord_line}")
        if cl.lyrics.strip():
            _print(out, f"  {cl.lyrics}")


def print_analysis(analysis: SongAnalysis, file=None) -> None:
    """Print formatted analysis to terminal."""
    out = file or sys.stdout

    # Header
    _print(out, f"\n{_BOLD}{'═' * 60}{_RESET}")
    title = analysis.title or "Untitled"
    artist = analysis.artist or "Unknown"
    _print(out, f"{_BOLD}  {title} — {artist}{_RESET}")
    _print(out, f"{_BLUE}  Key: {analysis.key.root_name} {analysis.key.mode}{_RESET}")
    _print(out, f"{_BOLD}{'═' * 60}{_RESET}\n")

    # Legend
    _print(out, f"  {_GREEN}■{_RESET} Diatonic  "
                f"{_MAGENTA}■{_RESET} Secondary Dom  "
                f"{_YELLOW}■{_RESET} Borrowed  "
                f"{_RED}■{_RESET} Diminished  "
                f"{_CYAN}■{_RESET} Deceptive\n")

    for section in analysis.sections:
        _print_section(out, section)

    _print(out, "")


def _print_section(out, section: SectionAnalysis) -> None:
    """Print a single section analysis."""
    _print(out, f"{_BOLD}[{section.name}]{_RESET}")

    # Chord-above-lyrics display (if available)
    if section.lines:
        _render_chord_lyrics_lines(out, section)
        _print(out, "")

    # Chord progression with arrows (always show for analysis)
    colored = [_color_chord(ca) for ca in section.chords]
    _print(out, f"  {' → '.join(colored)}\n")

    # Non-diatonic events
    non_diatonic = [ca for ca in section.chords if not ca.is_diatonic]
    if non_diatonic:
        _print(out, f"  {_BOLD}Non-diatonic events:{_RESET}")
        for ca in non_diatonic:
            _print(out, f"    {ca.chord.symbol}:")
            for interp in ca.interpretations:
                conf_bar = "●" * int(interp.confidence * 5) + "○" * (5 - int(interp.confidence * 5))
                _print(out, f"      [{conf_bar}] {interp.detail}")
        _print(out, "")

    # Deceptive resolutions
    deceptive = [ca for ca in section.chords if ca.deceptive_resolution]
    if deceptive:
        _print(out, f"  {_CYAN}{_BOLD}Deceptive resolutions:{_RESET}")
        for ca in deceptive:
            _print(out, f"    {ca.deceptive_resolution}")
        _print(out, "")

    # Bass line
    if section.bass_line:
        bass_names = [f"{b.name}" for b in section.bass_line]
        _print(out, f"  {_BOLD}Bass line:{_RESET} {' → '.join(bass_names)}")

    # Chromatic runs
    if section.chromatic_runs:
        _print(out, f"  {_BOLD}Chromatic motion:{_RESET}")
        for run in section.chromatic_runs:
            names = [n.name for n in run.notes]
            label = "pair" if run.length == 2 else "run"
            _print(out, f"    {run.direction} {label}: {' → '.join(names)}")
        _print(out, "")

    # Patterns
    if section.patterns:
        _print(out, f"  {_BOLD}Patterns:{_RESET}")
        for p in section.patterns:
            _print(out, f"    {p.detail}")
        _print(out, "")


def _print(out, text: str) -> None:
    print(text, file=out)
