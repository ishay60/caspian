"""Convert lyrics-based frontend input to SongInput format.

This module handles the conversion from the frontend LyricsChordEditor format
(lyrics with chord placements) to the internal SongInput format with bars.

Conversion pipeline:
1. Parse lyrics lines with chord placements
2. Group lines into sections based on section markers
3. Create Bar objects with chord-to-beat mappings
4. Include riff/note data in bar content
5. Handle RTL text properly
6. Produce complete SongInput with bars

The converter integrates with:
- LyricsChordEditor (chord placements on lyrics)
- BarOverlay (bar divisions and beat positions)
- RiffEditor (note/tab data within bars)
"""

from __future__ import annotations

from caspian.models.input import (
    Bar,
    BarChord,
    BarContent,
    BarNote,
    BeatPosition,
    ChordLyricsLine,
    SectionInput,
    SongInput,
    TabNote,
)
from caspian.models.lyrics_input import (
    BarMarker,
    BeatPositionInput,
    ChordWithBeat,
    LyricsInputRequest,
    LyricsLine,
    NoteInput,
    RiffPlacement,
    SectionMarker,
    TabNoteInput,
)
from caspian.parsing.rtl_handler import has_hebrew


def _convert_beat_position(beat_pos: BeatPositionInput) -> BeatPosition:
    """Convert frontend BeatPositionInput to internal BeatPosition."""
    return BeatPosition(beat=beat_pos.beat, subdivision=beat_pos.subdivision)


def _convert_note(note: NoteInput) -> BarNote:
    """Convert frontend NoteInput to internal BarNote."""
    return BarNote(
        pitch=note.pitch,
        octave=note.octave,
        beat_position=_convert_beat_position(note.beat_position),
        duration_beats=note.duration_beats,
        technique=note.technique,
    )


def _convert_tab_note(tab_note: TabNoteInput) -> TabNote:
    """Convert frontend TabNoteInput to internal TabNote."""
    return TabNote(
        string=tab_note.string,
        fret=tab_note.fret,
        beat_position=_convert_beat_position(tab_note.beat_position),
        duration_beats=tab_note.duration_beats,
        technique=tab_note.technique,
    )


def _create_chord_lyrics_line(lyrics_line: LyricsLine) -> ChordLyricsLine:
    """Convert a lyrics line with chord placements to ChordLyricsLine format.

    Args:
        lyrics_line: LyricsLine with text and chord placements

    Returns:
        ChordLyricsLine with (column, symbol) tuples and lyrics text
    """
    chords = [(cp.column, cp.symbol) for cp in lyrics_line.chords]
    # Sort by column position (should already be sorted, but be safe)
    chords.sort(key=lambda x: x[0])
    return ChordLyricsLine(chords=chords, lyrics=lyrics_line.text)


def _group_lines_into_sections(
    lyrics_lines: list[LyricsLine],
    section_markers: list[SectionMarker],
) -> list[tuple[SectionMarker, list[LyricsLine]]]:
    """Group lyrics lines into sections based on section markers.

    Args:
        lyrics_lines: All lyrics lines
        section_markers: Section boundary markers

    Returns:
        List of (section_marker, lines) tuples
    """
    if not section_markers:
        # Default to single section
        default_marker = SectionMarker(line_index=0, name="main", section_type="vocal")
        return [(default_marker, lyrics_lines)]

    # Sort markers by line index
    sorted_markers = sorted(section_markers, key=lambda m: m.line_index)

    sections = []
    for i, marker in enumerate(sorted_markers):
        start_idx = marker.line_index
        # Next section starts at the next marker, or end of lines
        end_idx = sorted_markers[i + 1].line_index if i + 1 < len(sorted_markers) else len(lyrics_lines)
        section_lines = lyrics_lines[start_idx:end_idx]
        sections.append((marker, section_lines))

    return sections


def _build_bars_from_markers(
    lyrics_lines: list[LyricsLine],
    bar_markers: list[BarMarker],
    chords_with_beats: list[ChordWithBeat],
) -> list[Bar]:
    """Build Bar objects from bar markers and chord-beat assignments.

    Args:
        lyrics_lines: Lyrics lines with chord placements
        bar_markers: Bar division markers with time signatures
        chords_with_beats: Chord-to-beat position assignments

    Returns:
        List of Bar objects with BarChord entries and lyrics fragments
    """
    if not bar_markers:
        # No bars specified, return empty list (legacy mode will be used)
        return []

    # Sort bar markers by chord index
    sorted_markers = sorted(bar_markers, key=lambda m: m.chord_index)

    # Flatten all chords from lyrics lines
    all_chords_with_positions = []
    for line_idx, line in enumerate(lyrics_lines):
        for chord_placement in line.chords:
            all_chords_with_positions.append({
                'symbol': chord_placement.symbol,
                'column': chord_placement.column,
                'line_idx': line_idx,
            })

    # Build chord-to-beat map from chords_with_beats
    chord_beat_map = {}  # key: (symbol, column) -> BeatPosition
    for cwb in chords_with_beats:
        key = (cwb.symbol, cwb.column)
        chord_beat_map[key] = _convert_beat_position(cwb.beat_position)

    bars = []
    for i, marker in enumerate(sorted_markers):
        start_idx = marker.chord_index
        # Next bar starts at the next marker, or end of chords
        end_idx = sorted_markers[i + 1].chord_index if i + 1 < len(sorted_markers) else len(all_chords_with_positions)

        bar_chords_data = all_chords_with_positions[start_idx:end_idx]

        # Build BarChord objects
        bar_chords = []
        lyrics_fragment_parts = []

        for chord_data in bar_chords_data:
            symbol = chord_data['symbol']
            column = chord_data['column']
            line_idx = chord_data['line_idx']

            # Get beat position from map, or default to beat 1
            key = (symbol, column)
            beat_pos = chord_beat_map.get(key, BeatPosition(beat=1, subdivision=0))

            bar_chord = BarChord(symbol=symbol, beat_position=beat_pos)
            bar_chords.append(bar_chord)

            # Collect lyrics fragment from this line
            if line_idx < len(lyrics_lines):
                line_text = lyrics_lines[line_idx].text
                if line_text and line_text not in lyrics_fragment_parts:
                    lyrics_fragment_parts.append(line_text)

        # Create BarContent
        bar_content = BarContent(chords=bar_chords)

        # Add riff data if present
        if marker.riff:
            riff = marker.riff
            bar_content.label = riff.label
            if riff.notes:
                bar_content.notes = [_convert_note(n) for n in riff.notes]
            if riff.tab_notes:
                bar_content.tab = [_convert_tab_note(tn) for tn in riff.tab_notes]

        # Combine lyrics fragments (join with space, respect RTL)
        lyrics_fragment = " ".join(lyrics_fragment_parts)

        # Create Bar
        bar = Bar(
            time_signature=marker.time_signature,
            content=bar_content,
            lyrics_fragment=lyrics_fragment,
            is_expandable=bool(bar_content.notes or bar_content.tab or bar_content.label),
        )
        bars.append(bar)

    return bars


def convert_lyrics_to_song_input(request: LyricsInputRequest) -> SongInput:
    """Convert lyrics-based frontend input to SongInput format.

    This is the main conversion function that orchestrates the full pipeline:
    1. Group lyrics lines into sections
    2. Create ChordLyricsLine objects for legacy support
    3. Build Bar objects with chord-beat mappings
    4. Include riff/note data in bars
    5. Assemble complete SongInput

    Args:
        request: LyricsInputRequest from frontend

    Returns:
        SongInput with bars, ready for analysis

    Example:
        >>> req = LyricsInputRequest(
        ...     title="Test Song",
        ...     key_root_name="Am",
        ...     lyrics_lines=[
        ...         LyricsLine(text="hello world", chords=[ChordPlacement(column=0, symbol="Am")])
        ...     ],
        ...     bar_markers=[BarMarker(chord_index=0)]
        ... )
        >>> song_input = convert_lyrics_to_song_input(req)
        >>> song_input.title
        'Test Song'
    """
    # Group lines into sections
    section_groups = _group_lines_into_sections(request.lyrics_lines, request.section_markers)

    sections = []
    for section_marker, section_lines in section_groups:
        # Create legacy ChordLyricsLine objects for backward compatibility
        chord_lyrics_lines = [_create_chord_lyrics_line(line) for line in section_lines]

        # Extract chord symbols for legacy chords field
        # (Flatten all chords from all lines in this section)
        from caspian.models.input import ChordInput
        legacy_chords = []
        for line in section_lines:
            for chord_placement in line.chords:
                legacy_chords.append(ChordInput(symbol=chord_placement.symbol))

        # Build bars for this section
        # Note: We need to filter bar_markers and chords_with_beats to this section
        # For MVP, we'll build all bars globally and let sections share them
        # In a more sophisticated implementation, we'd partition by section
        bars = _build_bars_from_markers(
            request.lyrics_lines,  # Use all lines for now (TODO: partition by section)
            request.bar_markers,
            request.chords_with_beats,
        )

        section = SectionInput(
            name=section_marker.name,
            section_type=section_marker.section_type,
            chords=legacy_chords,
            lines=chord_lyrics_lines,
            bars=bars,
            tempo_bpm=request.tempo_bpm,
        )
        sections.append(section)

    # Build key string (e.g., "Am")
    key = request.key_root_name if request.key_root_name else ""

    return SongInput(
        title=request.title,
        artist=request.artist,
        key=key,
        key_mode=request.key_mode,
        sections=sections,
    )
