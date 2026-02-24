"""FastAPI backend for Caspian harmonic analysis."""

from __future__ import annotations

import asyncio
import json as _json
import os
import urllib.parse
import urllib.request
from pathlib import Path

from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from fastapi import HTTPException

import logging

from caspian.analysis.llm_analysis import (
    LLMNotConfiguredError,
    generate_llm_analysis,
)
from caspian.completion.chord_completion import chord_completions
from caspian.parsing.input_parser import parse_format_a
from caspian.parsing.website_normalizer import normalize_website_paste
from caspian.parsing.chord_parser import parse_chord
from caspian.parsing.registry import get_global_registry
from caspian.analysis.analyzer import analyze_song, analyze_section
from caspian.models.key import Key
from caspian.models.analysis import (
    AnalysisInterpretation,
    BassNote,
    ChordAnalysis,
    ChromaticRun,
    Pattern,
    SectionAnalysis,
    SongAnalysis,
)
from caspian.theory.pitch import note_name, note_name_in_key
from caspian.sources.cache import DiskCache

app = FastAPI(title="Caspian", description="Hebrew harmonic analysis API")

# Initialize cache
cache = DiskCache()

_allowed_origins = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Request / Response models ---


class AnalyzeRequest(BaseModel):
    text: str


class AnalyzeSectionRequest(BaseModel):
    section_name: str
    chord_symbols: list[str]
    key_root_name: str
    key_mode: str


class InterpretationResponse(BaseModel):
    type: str
    detail: str
    confidence: float


class ChordAnalysisResponse(BaseModel):
    symbol: str
    root_name: str
    root: int
    quality: str
    bass_name: str
    bass: int
    pitches: list[int]
    is_inverted: bool
    roman_numeral: str
    is_diatonic: bool
    diatonic_in_scales: list[str]
    interpretations: list[InterpretationResponse]
    bass_motion_from_previous: str | None
    common_tones_with_previous: list[str]
    common_tones_with_next: list[str]
    deceptive_resolution: str | None
    secondary_dominant: str | None


class BassNoteResponse(BaseModel):
    pitch: int
    name: str
    chord_symbol: str
    position: int
    motion_from_previous: str | None


class ChromaticRunResponse(BaseModel):
    notes: list[str]
    direction: str
    start_position: int
    length: int


class PatternResponse(BaseModel):
    type: str
    detail: str
    positions: list[int]


class ChordLyricsLineResponse(BaseModel):
    chords: list[tuple[int, str]]  # (column_position, chord_symbol)
    lyrics: str


class SectionResponse(BaseModel):
    name: str
    chords: list[ChordAnalysisResponse]
    bass_line: list[BassNoteResponse]
    chromatic_runs: list[ChromaticRunResponse]
    patterns: list[PatternResponse]
    lines: list[ChordLyricsLineResponse] = []


class KeyResponse(BaseModel):
    root_name: str
    root: int
    mode: str
    scale_pitches: list[int]


class ChordLyricPairResponse(BaseModel):
    chords: str
    lyrics: str


class AnalyzeResponse(BaseModel):
    title: str
    artist: str
    key: KeyResponse
    sections: list[SectionResponse]
    segmentation_suggested: bool = False
    pairs: list[ChordLyricPairResponse] = []


class LlmSectionNarrative(BaseModel):
    name: str
    narrative: str


class LlmAnalyzeResponse(BaseModel):
    sections: list[LlmSectionNarrative]
    overall_summary: str


class DetectFormatRequest(BaseModel):
    text: str
    format_hint: str | None = None


class PreviewSection(BaseModel):
    name: str
    chord_count: int
    first_chords: list[str]


class FormatPreview(BaseModel):
    key: str | None = None
    title: str | None = None
    artist: str | None = None
    sections: list[PreviewSection]


class DetectFormatResponse(BaseModel):
    format: str
    confidence: str  # 'high', 'medium', or 'low'
    preview: FormatPreview | None = None
    error: str | None = None


# --- Serialization ---


def _serialize_analysis(analysis: SongAnalysis) -> AnalyzeResponse:
    key = analysis.key
    return AnalyzeResponse(
        title=analysis.title,
        artist=analysis.artist,
        key=KeyResponse(
            root_name=key.root_name,
            root=key.root,
            mode=key.mode,
            scale_pitches=list(key.scale_pitches),
        ),
        sections=[_serialize_section(s, key) for s in analysis.sections],
    )


def _serialize_section(section: SectionAnalysis, key: Key) -> SectionResponse:
    return SectionResponse(
        name=section.name,
        chords=[_serialize_chord(ca, key) for ca in section.chords],
        bass_line=[_serialize_bass_note(bn, key) for bn in section.bass_line],
        chromatic_runs=[_serialize_chromatic_run(cr, key) for cr in section.chromatic_runs],
        patterns=[PatternResponse(type=p.type, detail=p.detail, positions=p.positions)
                  for p in section.patterns],
        lines=[ChordLyricsLineResponse(chords=cl.chords, lyrics=cl.lyrics)
               for cl in section.lines],
    )


def _serialize_chord(ca: ChordAnalysis, key: Key) -> ChordAnalysisResponse:
    scale_pitches = key.scale_pitches
    mode = key.mode
    krn = key.root_name
    chord = ca.chord
    # Use key-appropriate spelling for diatonic chords (e.g. Bb not A# in Bb minor)
    if ca.is_diatonic:
        root_name = note_name_in_key(chord.root, scale_pitches, mode, key_root_name=krn)
        bass_name = note_name_in_key(chord.bass, scale_pitches, mode, key_root_name=krn)
        suffix = chord.symbol[len(chord.root_name):]
        if "/" in suffix:
            quality_part = suffix.split("/", 1)[0]
            symbol = root_name + quality_part + "/" + bass_name
        else:
            symbol = root_name + suffix
    else:
        root_name = chord.root_name
        bass_name = chord.bass_name
        symbol = chord.symbol
    return ChordAnalysisResponse(
        symbol=symbol,
        root_name=root_name,
        root=chord.root,
        quality=chord.quality.value,
        bass_name=bass_name,
        bass=chord.bass,
        pitches=list(chord.pitches),
        is_inverted=chord.is_inverted,
        roman_numeral=ca.roman_numeral,
        is_diatonic=ca.is_diatonic,
        diatonic_in_scales=ca.diatonic_in_scales,
        interpretations=[
            InterpretationResponse(type=i.type, detail=i.detail, confidence=i.confidence)
            for i in ca.interpretations
        ],
        bass_motion_from_previous=ca.bass_motion_from_previous,
        common_tones_with_previous=[note_name_in_key(p, scale_pitches, mode, key_root_name=krn) for p in ca.common_tones_with_previous],
        common_tones_with_next=[note_name_in_key(p, scale_pitches, mode, key_root_name=krn) for p in ca.common_tones_with_next],
        deceptive_resolution=ca.deceptive_resolution,
        secondary_dominant=ca.secondary_dominant,
    )


def _serialize_bass_note(bn: BassNote, key: Key) -> BassNoteResponse:
    name = note_name_in_key(bn.pitch, key.scale_pitches, key.mode, key_root_name=key.root_name)
    return BassNoteResponse(
        pitch=bn.pitch,
        name=name,
        chord_symbol=bn.chord_symbol,
        position=bn.position,
        motion_from_previous=bn.motion_from_previous,
    )


def _serialize_chromatic_run(cr: ChromaticRun, key: Key) -> ChromaticRunResponse:
    notes = [note_name_in_key(n.pitch, key.scale_pitches, key.mode, key_root_name=key.root_name) for n in cr.notes]
    return ChromaticRunResponse(
        notes=notes,
        direction=cr.direction,
        start_position=cr.start_position,
        length=cr.length,
    )


# --- Routes ---


def _extract_pairs(format_a_text: str) -> list[ChordLyricPairResponse]:
    """Extract chord-lyric pairs from Format A text for the segmentation UI."""
    pairs: list[ChordLyricPairResponse] = []
    for line in format_a_text.split("\n"):
        line = line.strip()
        if not line:
            continue
        # Skip headers and metadata
        if line.startswith("[") or line.startswith("title:") or line.startswith("artist:") or line.startswith("key:") or line.startswith("mode:"):
            continue
        if "|" in line:
            parts = line.split("|", 1)
            pairs.append(ChordLyricPairResponse(
                chords=parts[0].strip(), lyrics=parts[1].strip(),
            ))
        else:
            pairs.append(ChordLyricPairResponse(chords=line, lyrics=""))
    return pairs


def _needs_segmentation(song_input) -> bool:
    """True if the song has no explicit sections and enough content to segment."""
    non_outro = [s for s in song_input.sections if s.name not in ("outro",)]
    if len(non_outro) != 1:
        return False
    # Only suggest if the single section has enough chords
    return len(non_outro[0].chords) > 8


@app.post("/api/detect-format", response_model=DetectFormatResponse)
def detect_format(req: DetectFormatRequest):
    """Detect input format and return preview without full analysis.

    This is lighter weight than full analysis - just detection + basic parsing.
    """
    from caspian.parsing.registry import FormatDetector, InputFormat

    try:
        # Detect format (or use hint)
        if req.format_hint:
            try:
                format_type = InputFormat(req.format_hint)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid format hint: {req.format_hint}",
                )
        else:
            format_type = FormatDetector.detect(req.text)

        # Determine confidence based on format detection
        # High confidence for explicit formats, lower for fallbacks
        if format_type == InputFormat.UNKNOWN:
            confidence = "low"
        elif format_type in (InputFormat.FORMAT_A, InputFormat.UG_HTML, InputFormat.TAB4U_HTML):
            confidence = "high"
        elif format_type in (InputFormat.CHORDPRO, InputFormat.BAR_NOTATION):
            confidence = "high"
        else:  # WEBSITE_PASTE
            confidence = "medium"

        # Try to parse and extract preview
        registry = get_global_registry()
        try:
            song_input = registry.parse(req.text, format_hint=format_type)

            # Build preview
            sections = []
            for section in song_input.sections:
                first_chords = []
                if section.chords:
                    first_chords = section.chords[:5]  # First 5 chords
                elif section.bars:
                    # Extract chords from bars
                    for bar in section.bars[:3]:  # First 3 bars
                        if bar.content.chords:
                            for bc in bar.content.chords[:2]:  # First 2 chords per bar
                                first_chords.append(bc.symbol)
                                if len(first_chords) >= 5:
                                    break
                        if len(first_chords) >= 5:
                            break

                chord_count = len(section.chords) if section.chords else sum(
                    len(bar.content.chords) for bar in section.bars if bar.content.chords
                )

                sections.append(PreviewSection(
                    name=section.name,
                    chord_count=chord_count,
                    first_chords=first_chords,
                ))

            preview = FormatPreview(
                key=f"{song_input.key.root_name}{song_input.key.mode}" if song_input.key else None,
                title=song_input.title or None,
                artist=song_input.artist or None,
                sections=sections,
            )

            return DetectFormatResponse(
                format=format_type.value,
                confidence=confidence,
                preview=preview,
            )

        except Exception as e:
            # Parse failed, return format detection with error
            return DetectFormatResponse(
                format=format_type.value,
                confidence="low",
                error=str(e),
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    # Use registry for auto-detection and parsing
    registry = get_global_registry()
    song_input = registry.parse(req.text)

    analysis = analyze_song(song_input)
    resp = _serialize_analysis(analysis)

    if _needs_segmentation(song_input):
        resp.segmentation_suggested = True
        resp.pairs = _extract_pairs(req.text)  # Use original text for pair extraction

    return resp


@app.post("/api/analyze-section", response_model=SectionResponse)
def analyze_section_endpoint(req: AnalyzeSectionRequest):
    key = Key.from_name(req.key_root_name, req.key_mode)
    chords = []
    for symbol in req.chord_symbols:
        try:
            chords.append(parse_chord(symbol))
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid chord symbol: {symbol}",
            )
    section_analysis = analyze_section(req.section_name, chords, key)
    return _serialize_section(section_analysis, key)


@app.get("/api/chord-completions")
def chord_completions_endpoint(
    prefix: str,
    key_root_name: str,
    key_mode: str,
    prev_chord: str | None = None,
    next_chord: str | None = None,
    limit: int = 30,
):
    """Return chord symbols matching prefix, ordered by musical anticipation."""
    try:
        completions = chord_completions(
            prefix=prefix,
            key_root_name=key_root_name,
            key_mode=key_mode,
            prev_chord_symbol=prev_chord,
            next_chord_symbol=next_chord,
            limit=limit,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"completions": completions}


logger = logging.getLogger(__name__)


@app.post("/api/llm-analyze", response_model=LlmAnalyzeResponse)
async def llm_analyze(
    req: AnalyzeResponse,
    x_anthropic_api_key: str | None = Header(default=None),
    x_openai_api_key: str | None = Header(default=None),
):
    # Resolve user-supplied key; Anthropic takes priority over OpenAI
    user_api_key: str | None = None
    user_provider: str | None = None
    if x_anthropic_api_key:
        user_api_key = x_anthropic_api_key
        user_provider = "claude"
    elif x_openai_api_key:
        user_api_key = x_openai_api_key
        user_provider = "openai"

    try:
        raw = await generate_llm_analysis(
            req.model_dump(),
            user_api_key=user_api_key,
            user_provider=user_provider,
        )
    except LLMNotConfiguredError:
        raise HTTPException(
            status_code=503,
            detail="No API key configured. Enter your Anthropic or OpenAI key in settings.",
        )
    except RuntimeError as exc:
        logger.exception("LLM analysis failed")
        raise HTTPException(status_code=502, detail=str(exc))
    sections = [
        LlmSectionNarrative(name=s["name"], narrative=s["narrative"])
        for s in raw.get("sections", [])
    ]
    return LlmAnalyzeResponse(
        sections=sections,
        overall_summary=raw.get("overall_summary", ""),
    )


# --- Uberchord API proxy ---

_uberchord_cache: dict[str, list] = {}


@app.get("/api/uberchord/{chord_name:path}")
async def uberchord_proxy(chord_name: str):
    """Proxy requests to the Uberchord API to avoid CORS issues."""
    if chord_name in _uberchord_cache:
        return _uberchord_cache[chord_name]

    encoded = urllib.parse.quote(chord_name, safe="")
    url = f"https://api.uberchord.com/v1/chords/{encoded}"

    def _fetch():
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                return _json.loads(resp.read())
        except Exception:
            return []

    data = await asyncio.to_thread(_fetch)
    _uberchord_cache[chord_name] = data
    return data


# --- Cache Management API ---


class CacheStatsResponse(BaseModel):
    """Cache statistics response."""

    total_entries: int
    by_source: dict[str, dict]
    total_size_bytes: int
    average_size_bytes: int
    oldest_entry: str | None
    newest_entry: str | None
    runtime_stats: dict


class CacheClearResponse(BaseModel):
    """Cache clear response."""

    cleared: int
    source: str


@app.get("/api/cache/stats", response_model=CacheStatsResponse)
async def get_cache_stats():
    """
    Get comprehensive cache statistics.

    Returns:
        - Total entries and entries by source
        - Total size and average size
        - Oldest and newest entries
        - Runtime hit/miss statistics
    """
    stats = cache.get_stats()
    return CacheStatsResponse(**stats)


@app.delete("/api/cache", response_model=CacheClearResponse)
async def clear_cache(source: str | None = None):
    """
    Clear cache entries.

    Args:
        source: Optional source to clear (ultimate_guitar/tab4u).
                If not provided, clears all sources.

    Returns:
        Number of entries cleared and source name
    """
    count = cache.clear(source)
    return CacheClearResponse(cleared=count, source=source or "all")


@app.get("/api/cache/hit-rate")
async def get_cache_hit_rate():
    """
    Get cache hit rate statistics.

    Returns:
        - Overall hit rate
        - Hit rate by source
        - Total hits and misses
    """
    return cache.get_hit_rate()


# Serve React static files in production
_FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"
if _FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=_FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def serve_spa(path: str):
        file = _FRONTEND_DIST / path
        if file.exists() and file.is_file():
            return FileResponse(file)
        return FileResponse(_FRONTEND_DIST / "index.html")
