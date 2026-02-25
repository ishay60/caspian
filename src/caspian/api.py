"""FastAPI backend for Caspian harmonic analysis."""

from __future__ import annotations

import asyncio
import json as _json
import os
import urllib.parse
import urllib.request
from pathlib import Path

from fastapi import Depends, FastAPI, Header, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from fastapi import HTTPException

from caspian.sources.base import SearchResult
from caspian.sources.ultimate_guitar import UltimateGuitarSource
from caspian.sources.tab4u import Tab4uSource
from caspian.sources.converter import convert_raw_to_song_input

from datetime import datetime, timedelta

import httpx
import logging

from caspian.analysis.llm_analysis import (
    LLMNotConfiguredError,
    generate_llm_analysis,
)
from caspian.completion.chord_completion import chord_completions
from caspian.substitution.engine import suggest_substitutions
from caspian.parsing.input_parser import parse_format_a
from caspian.parsing.website_normalizer import normalize_website_paste
from caspian.parsing.chord_parser import parse_chord
from caspian.parsing.registry import get_global_registry
from caspian.parsing.lyrics_converter import convert_lyrics_to_song_input
from caspian.analysis.analyzer import analyze_song, analyze_section
from caspian.models.key import Key
from caspian.models.lyrics_input import LyricsInputRequest
from caspian.models.analysis import (
    AnalysisInterpretation,
    BarAnalysis,
    BassNote,
    ChordAnalysis,
    ChromaticRun,
    Pattern,
    SectionAnalysis,
    SongAnalysis,
)
from caspian.theory.pitch import note_name, note_name_in_key
from caspian.sources.cache import DiskCache
from caspian.db import JsonFileSongRepository, SongDocument
from caspian.auth import JsonFileUserRepository
from caspian.auth.middleware import get_current_user
from caspian.auth.service import register as auth_register, login as auth_login

app = FastAPI(title="Caspian", description="Hebrew harmonic analysis API")

# Initialize cache
cache = DiskCache()

# Initialize song repository
song_repo = JsonFileSongRepository()

# Initialize user repository
user_repo = JsonFileUserRepository()

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


class BarAnalysisResponse(BaseModel):
    bar_index: int
    chord_analyses: list[ChordAnalysisResponse]
    harmonic_rhythm: str  # "static" | "half-bar" | "per-beat" | "syncopated"
    has_riff: bool = False
    riff_analysis: str | None = None


class SectionResponse(BaseModel):
    name: str
    chords: list[ChordAnalysisResponse]
    bass_line: list[BassNoteResponse]
    chromatic_runs: list[ChromaticRunResponse]
    patterns: list[PatternResponse]
    lines: list[ChordLyricsLineResponse] = []
    bars: list[BarAnalysisResponse] = []


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


class SearchSongsResponse(BaseModel):
    query: str
    source: str
    results: list[SearchResult]
    total: int


class FetchSheetResponse(BaseModel):
    source_url: str
    fetched_at: str
    analysis: AnalyzeResponse


# --- Rate Limiting ---


class RateLimiter:
    """Simple in-memory rate limiter for API endpoints."""

    def __init__(self, requests_per_minute: int = 20):
        self.requests_per_minute = requests_per_minute
        self.requests: dict[str, list[datetime]] = {}

    async def check_rate_limit(self, request: Request):
        client_ip = request.client.host if request.client else "unknown"
        now = datetime.now()

        if client_ip not in self.requests:
            self.requests[client_ip] = []

        self.requests[client_ip] = [
            ts for ts in self.requests[client_ip]
            if now - ts < timedelta(minutes=1)
        ]

        if len(self.requests[client_ip]) >= self.requests_per_minute:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again later.",
                headers={"Retry-After": "60"}
            )

        self.requests[client_ip].append(now)


_rate_limiter = RateLimiter(requests_per_minute=20)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Apply rate limiting to search/fetch API endpoints."""
    if request.url.path.startswith("/api/search") or request.url.path.startswith("/api/fetch"):
        await _rate_limiter.check_rate_limit(request)
    response = await call_next(request)
    return response


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
        bars=[_serialize_bar(bar, key) for bar in section.bars],
    )


def _serialize_bar(bar: BarAnalysis, key: Key) -> BarAnalysisResponse:
    return BarAnalysisResponse(
        bar_index=bar.bar_index,
        chord_analyses=[_serialize_chord(ca, key) for ca in bar.chord_analyses],
        harmonic_rhythm=bar.harmonic_rhythm,
        has_riff=bar.has_riff,
        riff_analysis=bar.riff_analysis,
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


@app.get("/api/chord-substitutions")
def chord_substitutions_endpoint(
    chord: str = Query(..., description="Chord symbol to find substitutions for"),
    key_root_name: str = Query(...),
    key_mode: str = Query(...),
    prev_chord: str | None = Query(default=None),
    next_chord: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
):
    """Return suggested chord substitutions ordered by confidence and voice leading distance."""
    try:
        subs = suggest_substitutions(chord, key_root_name, key_mode, prev_chord, next_chord, limit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"chord": chord, "substitutions": [s.model_dump() for s in subs]}


logger = logging.getLogger(__name__)


@app.post("/api/llm-analyze", response_model=LlmAnalyzeResponse)
async def llm_analyze(
    req: AnalyzeResponse,
    x_anthropic_api_key: str | None = Header(default=None),
    x_openai_api_key: str | None = Header(default=None),
    current_user: dict | None = Depends(get_current_user),
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


# --- Lyrics Converter API ---


@app.post("/api/convert-lyrics", response_model=AnalyzeResponse)
def convert_lyrics(req: LyricsInputRequest):
    """
    Convert lyrics-based input from frontend editor to SongInput with analysis.

    This endpoint accepts lyrics with chord placements, bar markers, and riff data
    from the frontend LyricsChordEditor, BarOverlay, and RiffEditor components,
    converts it to SongInput format, and returns the full harmonic analysis.

    Args:
        req: LyricsInputRequest with lyrics, chords, bars, and riffs

    Returns:
        AnalyzeResponse with complete harmonic analysis

    Raises:
        HTTPException: 400 if input is invalid or cannot be converted
        HTTPException: 500 if conversion or analysis fails

    Example frontend usage:
        ```javascript
        const response = await fetch('/api/convert-lyrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: "My Song",
                artist: "Artist Name",
                key_root_name: "Am",
                key_mode: "natural_minor",
                lyrics_lines: [
                    { text: "Hello world", chords: [{ column: 0, symbol: "Am" }] }
                ],
                section_markers: [{ line_index: 0, name: "verse" }],
                bar_markers: [{ chord_index: 0, time_signature: [4, 4] }],
                chords_with_beats: [
                    { symbol: "Am", column: 0, beat_position: { beat: 1, subdivision: 0 } }
                ]
            })
        });
        ```
    """
    try:
        # Convert lyrics input to SongInput
        song_input = convert_lyrics_to_song_input(req)

        # Validate that we have at least one section with content
        if not song_input.sections:
            raise HTTPException(
                status_code=400,
                detail="No sections found in input. Please add lyrics and chords."
            )

        # Check if any section has chords or bars
        has_content = any(
            section.chords or section.bars or section.lines
            for section in song_input.sections
        )
        if not has_content:
            raise HTTPException(
                status_code=400,
                detail="No chords or bars found. Please add chord placements to your lyrics."
            )

        # Analyze the song
        analysis = analyze_song(song_input)

        # Serialize and return
        return _serialize_analysis(analysis)

    except ValueError as e:
        # Pydantic validation errors or chord parsing errors
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Unexpected errors
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)


# --- Search & Fetch endpoints ---


@app.get("/api/search-songs", response_model=SearchSongsResponse)
async def search_songs(
    q: str = Query(..., description="Search query", min_length=1),
    source: str = Query("all", description="Source: all, ug, or tab4u", pattern="^(all|ug|tab4u)$"),
    limit: int = Query(10, description="Max results", ge=1, le=50),
) -> SearchSongsResponse:
    """Search for chord sheets across sources."""
    results: list[SearchResult] = []

    try:
        if source in ["all", "ug"]:
            ug_source = UltimateGuitarSource()
            try:
                ug_results = await ug_source.search(q, limit=limit)
                results.extend(ug_results)
            except Exception as e:
                logger.warning(f"Ultimate Guitar search failed: {e}")

        if source in ["all", "tab4u"]:
            tab4u_source = Tab4uSource()
            try:
                tab4u_results = await tab4u_source.search(q, limit=limit)
                results.extend(tab4u_results)
            except Exception as e:
                logger.warning(f"Tab4u search failed: {e}")

        results.sort(key=lambda r: r.quality_score(), reverse=True)
        results = results[:limit]

        return SearchSongsResponse(
            query=q,
            source=source,
            results=results,
            total=len(results),
        )
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@app.get("/api/fetch-sheet", response_model=FetchSheetResponse)
async def fetch_sheet(
    url: str = Query(..., description="URL to the chord sheet"),
) -> FetchSheetResponse:
    """Fetch a chord sheet from external source and analyze it."""
    try:
        url_lower = url.lower()
        if "ultimate-guitar" in url_lower or "tabs.ultimate-guitar" in url_lower:
            source = UltimateGuitarSource()
        elif "tab4u" in url_lower:
            source = Tab4uSource()
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported source. Only Ultimate Guitar and Tab4u are supported.",
            )

        try:
            raw = await source.fetch(url)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise HTTPException(status_code=404, detail="Chord sheet not found")
            raise HTTPException(
                status_code=500, detail=f"Failed to fetch: HTTP {e.response.status_code}"
            )
        except Exception as e:
            logger.error(f"Fetch failed for URL {url}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch: {str(e)}")

        try:
            song_input = convert_raw_to_song_input(raw)
        except Exception as e:
            logger.error(f"Conversion failed for URL {url}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to convert: {str(e)}")

        try:
            analysis = analyze_song(song_input)
            analysis_response = _serialize_analysis(analysis)
        except Exception as e:
            logger.error(f"Analysis failed for URL {url}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to analyze: {str(e)}")

        return FetchSheetResponse(
            source_url=url,
            fetched_at=datetime.now().isoformat(),
            analysis=analysis_response,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error fetching sheet from {url}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# --- Auth endpoints ---


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    tier: str
    created_at: str


@app.post("/api/auth/register", response_model=AuthResponse, status_code=201)
async def register(req: RegisterRequest):
    """Register a new user account."""
    try:
        user = await auth_register(
            email=req.email,
            password=req.password,
            display_name=req.display_name,
            repo=user_repo,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    from caspian.auth.service import create_token
    token = create_token(user.id, user.email, user.tier)
    return AuthResponse(
        token=token,
        user={
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "tier": user.tier,
            "created_at": user.created_at,
        },
    )


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    """Login with email and password."""
    try:
        user, token = await auth_login(
            email=req.email,
            password=req.password,
            repo=user_repo,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return AuthResponse(
        token=token,
        user={
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "tier": user.tier,
            "created_at": user.created_at,
        },
    )


@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get the current authenticated user's profile."""
    if current_user is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    user = await user_repo.get(current_user["user_id"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return UserResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        tier=user.tier,
        created_at=user.created_at,
    )


def _resolve_user_id(current_user: dict | None, header_user_id: str) -> str:
    """Resolve the effective user_id: prefer auth token, fall back to header."""
    if current_user is not None:
        return current_user["user_id"]
    return header_user_id


# --- Song CRUD endpoints ---


class SaveSongRequest(BaseModel):
    """Request body for creating/updating a song."""

    title: str = ""
    artist: str = ""
    key_root: str = ""
    key_mode: str = ""
    input_text: str = ""
    metadata: dict = {}
    analysis_metadata: dict | None = None


class SongDocumentResponse(BaseModel):
    id: str
    user_id: str
    title: str
    artist: str
    key_root: str
    key_mode: str
    input_text: str
    created_at: str
    updated_at: str
    last_opened_at: str
    metadata: dict
    analysis_metadata: dict | None


def _song_to_response(song: SongDocument) -> SongDocumentResponse:
    return SongDocumentResponse(
        id=song.id,
        user_id=song.user_id,
        title=song.title,
        artist=song.artist,
        key_root=song.key_root,
        key_mode=song.key_mode,
        input_text=song.input_text,
        created_at=song.created_at,
        updated_at=song.updated_at,
        last_opened_at=song.last_opened_at,
        metadata=song.metadata.model_dump(),
        analysis_metadata=song.analysis_metadata.model_dump() if song.analysis_metadata else None,
    )


@app.get("/api/songs", response_model=list[SongDocumentResponse])
async def list_songs(
    user_id: str = Header(default="local", alias="x-user-id"),
    q: str | None = Query(default=None, description="Search query"),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: dict | None = Depends(get_current_user),
):
    """List saved songs for a user."""
    uid = _resolve_user_id(current_user, user_id)
    songs = await song_repo.list(user_id=uid, query=q, limit=limit)
    return [_song_to_response(s) for s in songs]


@app.post("/api/songs", response_model=SongDocumentResponse, status_code=201)
async def create_song(
    req: SaveSongRequest,
    user_id: str = Header(default="local", alias="x-user-id"),
    current_user: dict | None = Depends(get_current_user),
):
    """Save a new song."""
    from caspian.db.models import SongMetadata, AnalysisMetadata

    uid = _resolve_user_id(current_user, user_id)
    song = SongDocument(
        id=song_repo.generate_id(),
        user_id=uid,
        title=req.title,
        artist=req.artist,
        key_root=req.key_root,
        key_mode=req.key_mode,
        input_text=req.input_text,
        metadata=SongMetadata(**req.metadata) if req.metadata else SongMetadata(),
        analysis_metadata=AnalysisMetadata(**req.analysis_metadata) if req.analysis_metadata else None,
    )
    saved = await song_repo.save(song)
    return _song_to_response(saved)


@app.get("/api/songs/{song_id}", response_model=SongDocumentResponse)
async def get_song(
    song_id: str,
    user_id: str = Header(default="local", alias="x-user-id"),
    current_user: dict | None = Depends(get_current_user),
):
    """Get a single song by ID."""
    uid = _resolve_user_id(current_user, user_id)
    song = await song_repo.get(song_id, user_id=uid)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return _song_to_response(song)


@app.put("/api/songs/{song_id}", response_model=SongDocumentResponse)
async def update_song(
    song_id: str,
    req: SaveSongRequest,
    user_id: str = Header(default="local", alias="x-user-id"),
    current_user: dict | None = Depends(get_current_user),
):
    """Update an existing song (full replace)."""
    from caspian.db.models import SongMetadata, AnalysisMetadata

    uid = _resolve_user_id(current_user, user_id)
    existing = await song_repo.get(song_id, user_id=uid)
    if not existing:
        raise HTTPException(status_code=404, detail="Song not found")

    updated = existing.model_copy(update={
        "title": req.title,
        "artist": req.artist,
        "key_root": req.key_root,
        "key_mode": req.key_mode,
        "input_text": req.input_text,
        "metadata": SongMetadata(**req.metadata) if req.metadata else existing.metadata,
        "analysis_metadata": AnalysisMetadata(**req.analysis_metadata) if req.analysis_metadata else existing.analysis_metadata,
    })
    saved = await song_repo.save(updated)
    return _song_to_response(saved)


@app.post("/api/songs/{song_id}/touch")
async def touch_song(
    song_id: str,
    user_id: str = Header(default="local", alias="x-user-id"),
    current_user: dict | None = Depends(get_current_user),
):
    """Update a song's last_opened_at timestamp."""
    from datetime import datetime, timezone

    uid = _resolve_user_id(current_user, user_id)
    song = await song_repo.get(song_id, user_id=uid)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    updated = song.model_copy(update={
        "last_opened_at": datetime.now(timezone.utc).isoformat(),
    })
    await song_repo.save(updated)
    return {"ok": True}


@app.delete("/api/songs/{song_id}")
async def delete_song(
    song_id: str,
    user_id: str = Header(default="local", alias="x-user-id"),
    current_user: dict | None = Depends(get_current_user),
):
    """Delete a song."""
    uid = _resolve_user_id(current_user, user_id)
    deleted = await song_repo.delete(song_id, user_id=uid)
    if not deleted:
        raise HTTPException(status_code=404, detail="Song not found")
    return {"ok": True}


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
