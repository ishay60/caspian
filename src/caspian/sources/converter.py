"""Convert RawChordSheet (from external sources) to SongInput (Caspian format)."""

from __future__ import annotations

import re

from ..models.input import (
    Bar,
    BarChord,
    BarContent,
    BeatPosition,
    ChordInput,
    ChordLyricsLine,
    SectionInput,
    SongInput,
)
from ..parsing.rtl_handler import detect_section_type, has_hebrew
from ..parsing.tab4u_normalize import normalize_chord_symbol
from .base import RawChordSheet, RawSection

_CHORD_PATTERN = re.compile(r"[A-G][#b]?[a-zA-Z0-9+/]*")
_BAR_LINE_PATTERN = re.compile(r"\|[\s\w#b/+\-]+\|")
_BAR_SPLIT_PATTERN = re.compile(r"\|")


class ConversionError(Exception):
    pass


def convert_raw_to_song_input(raw: RawChordSheet) -> SongInput:
    """Convert RawChordSheet to SongInput."""
    try:
        is_tab4u = "tab4u" in raw.source_url.lower()
        sections = [
            _convert_section(s, raw.source_url, is_tab4u)
            for s in raw.sections
        ]
        return SongInput(
            title=raw.title,
            artist=raw.artist,
            key=raw.key or "",
            sections=sections,
        )
    except Exception as e:
        raise ConversionError(
            f"Failed to convert chord sheet from {raw.source_url}: {e}"
        ) from e


def _convert_section(
    raw_section: RawSection, source_url: str, is_tab4u: bool
) -> SectionInput:
    section_type = detect_section_type(raw_section.name)
    has_bar_lines = _detect_bar_lines(raw_section.lines)

    if has_bar_lines:
        bars = _parse_bars_from_lines(raw_section.lines, section_type, is_tab4u)
        return SectionInput(
            name=raw_section.name,
            section_type=section_type,
            bars=bars,
        )
    else:
        chords, lines = _parse_legacy_chords(raw_section.lines, section_type, is_tab4u)
        return SectionInput(
            name=raw_section.name,
            section_type=section_type,
            chords=chords,
            lines=lines,
        )


def _detect_bar_lines(lines: list[str]) -> bool:
    for line in lines:
        if _BAR_LINE_PATTERN.search(line):
            return True
        if line.count("|") >= 2:
            between_bars = _BAR_SPLIT_PATTERN.split(line)
            for segment in between_bars:
                segment = segment.strip()
                if segment and _CHORD_PATTERN.search(segment):
                    return True
    return False


def _parse_bars_from_lines(
    lines: list[str], section_type: str, is_tab4u: bool
) -> list[Bar]:
    bars: list[Bar] = []
    i = 0

    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        if "|" in line and _CHORD_PATTERN.search(line):
            bar_texts = _split_into_bars(line)

            lyrics_line = ""
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if next_line and (
                    has_hebrew(next_line) or not _CHORD_PATTERN.search(next_line)
                ):
                    lyrics_line = next_line
                    i += 1

            for j, bar_text in enumerate(bar_texts):
                bar_lyrics = lyrics_line if j == 0 else ""
                bar = _parse_single_bar(bar_text, bar_lyrics, is_tab4u)
                bars.append(bar)

        elif has_hebrew(line) or not _CHORD_PATTERN.search(line):
            if bars and not bars[-1].lyrics_fragment:
                bars[-1].lyrics_fragment = line

        i += 1

    return bars


def _split_into_bars(line: str) -> list[str]:
    segments = _BAR_SPLIT_PATTERN.split(line)
    return [seg.strip() for seg in segments if seg.strip()]


def _parse_single_bar(bar_text: str, lyrics: str, is_tab4u: bool) -> Bar:
    chord_symbols = _CHORD_PATTERN.findall(bar_text)
    if is_tab4u:
        chord_symbols = [normalize_chord_symbol(sym) for sym in chord_symbols]

    chords: list[BarChord] = []

    if len(chord_symbols) == 1:
        chords.append(BarChord(
            symbol=chord_symbols[0],
            beat_position=BeatPosition(beat=1, subdivision=0),
        ))
    elif len(chord_symbols) == 2:
        chords.append(BarChord(
            symbol=chord_symbols[0],
            beat_position=BeatPosition(beat=1, subdivision=0),
        ))
        chords.append(BarChord(
            symbol=chord_symbols[1],
            beat_position=BeatPosition(beat=3, subdivision=0),
        ))
    elif len(chord_symbols) <= 4:
        for i, symbol in enumerate(chord_symbols):
            chords.append(BarChord(
                symbol=symbol,
                beat_position=BeatPosition(beat=i + 1, subdivision=0),
            ))
    elif chord_symbols:
        beats_per_chord = 4.0 / len(chord_symbols)
        for i, symbol in enumerate(chord_symbols):
            beat = min(int(1 + i * beats_per_chord), 4)
            chords.append(BarChord(
                symbol=symbol,
                beat_position=BeatPosition(beat=beat, subdivision=0),
            ))

    return Bar(
        time_signature=(4, 4),
        content=BarContent(chords=chords),
        lyrics_fragment=lyrics,
        is_expandable=False,
    )


def _parse_legacy_chords(
    lines: list[str], section_type: str, is_tab4u: bool
) -> tuple[list[ChordInput], list[ChordLyricsLine]]:
    chords: list[ChordInput] = []
    chord_lyrics_lines: list[ChordLyricsLine] = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        if "|" in line:
            parts = line.split("|", 1)
            chord_part = parts[0].strip()
            lyrics_part = parts[1].strip() if len(parts) > 1 else ""

            chord_symbols = _CHORD_PATTERN.findall(chord_part)
            if is_tab4u:
                chord_symbols = [normalize_chord_symbol(sym) for sym in chord_symbols]

            if section_type != "instrumental" and has_hebrew(lyrics_part):
                chord_symbols = list(reversed(chord_symbols))

            for symbol in chord_symbols:
                chords.append(ChordInput(symbol=symbol, lyrics=lyrics_part))
        else:
            chord_symbols = _CHORD_PATTERN.findall(line)
            if not chord_symbols:
                i += 1
                continue

            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if next_line and has_hebrew(next_line):
                    chords_with_pos = [
                        (m.start(), m.group())
                        for m in _CHORD_PATTERN.finditer(lines[i])
                    ]
                    if is_tab4u:
                        chords_with_pos = [
                            (pos, normalize_chord_symbol(sym))
                            for pos, sym in chords_with_pos
                        ]

                    chord_lyrics_lines.append(
                        ChordLyricsLine(chords=chords_with_pos, lyrics=next_line)
                    )

                    if section_type != "instrumental":
                        chord_symbols = list(reversed(chord_symbols))
                    elif is_tab4u:
                        chord_symbols = [
                            normalize_chord_symbol(sym) for sym in chord_symbols
                        ]

                    for symbol in chord_symbols:
                        chords.append(ChordInput(symbol=symbol, lyrics=next_line))

                    i += 2
                    continue

            if is_tab4u:
                chord_symbols = [normalize_chord_symbol(sym) for sym in chord_symbols]

            if section_type != "instrumental" and has_hebrew(line):
                chord_symbols = list(reversed(chord_symbols))

            for symbol in chord_symbols:
                chords.append(ChordInput(symbol=symbol))

        i += 1

    return chords, chord_lyrics_lines
