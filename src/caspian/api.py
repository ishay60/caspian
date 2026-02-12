"""FastAPI backend for Caspian harmonic analysis."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
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
from caspian.parsing.input_parser import parse_format_a
from caspian.parsing.website_normalizer import normalize_website_paste
from caspian.parsing.chord_parser import parse_chord
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
from caspian.theory.pitch import note_name

app = FastAPI(title="Caspian", description="Hebrew harmonic analysis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
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


class SectionResponse(BaseModel):
    name: str
    chords: list[ChordAnalysisResponse]
    bass_line: list[BassNoteResponse]
    chromatic_runs: list[ChromaticRunResponse]
    patterns: list[PatternResponse]


class KeyResponse(BaseModel):
    root_name: str
    root: int
    mode: str
    scale_pitches: list[int]


class AnalyzeResponse(BaseModel):
    title: str
    artist: str
    key: KeyResponse
    sections: list[SectionResponse]


class LlmSectionNarrative(BaseModel):
    name: str
    narrative: str


class LlmAnalyzeResponse(BaseModel):
    sections: list[LlmSectionNarrative]
    overall_summary: str


# --- Serialization ---


def _serialize_analysis(analysis: SongAnalysis) -> AnalyzeResponse:
    return AnalyzeResponse(
        title=analysis.title,
        artist=analysis.artist,
        key=KeyResponse(
            root_name=analysis.key.root_name,
            root=analysis.key.root,
            mode=analysis.key.mode,
            scale_pitches=list(analysis.key.scale_pitches),
        ),
        sections=[_serialize_section(s) for s in analysis.sections],
    )


def _serialize_section(section: SectionAnalysis) -> SectionResponse:
    return SectionResponse(
        name=section.name,
        chords=[_serialize_chord(ca) for ca in section.chords],
        bass_line=[_serialize_bass_note(bn) for bn in section.bass_line],
        chromatic_runs=[_serialize_chromatic_run(cr) for cr in section.chromatic_runs],
        patterns=[PatternResponse(type=p.type, detail=p.detail, positions=p.positions)
                  for p in section.patterns],
    )


def _serialize_chord(ca: ChordAnalysis) -> ChordAnalysisResponse:
    return ChordAnalysisResponse(
        symbol=ca.chord.symbol,
        root_name=ca.chord.root_name,
        root=ca.chord.root,
        quality=ca.chord.quality.value,
        bass_name=ca.chord.bass_name,
        bass=ca.chord.bass,
        pitches=list(ca.chord.pitches),
        is_inverted=ca.chord.is_inverted,
        roman_numeral=ca.roman_numeral,
        is_diatonic=ca.is_diatonic,
        diatonic_in_scales=ca.diatonic_in_scales,
        interpretations=[
            InterpretationResponse(type=i.type, detail=i.detail, confidence=i.confidence)
            for i in ca.interpretations
        ],
        bass_motion_from_previous=ca.bass_motion_from_previous,
        common_tones_with_previous=[note_name(p) for p in ca.common_tones_with_previous],
        common_tones_with_next=[note_name(p) for p in ca.common_tones_with_next],
        deceptive_resolution=ca.deceptive_resolution,
        secondary_dominant=ca.secondary_dominant,
    )


def _serialize_bass_note(bn: BassNote) -> BassNoteResponse:
    return BassNoteResponse(
        pitch=bn.pitch,
        name=bn.name,
        chord_symbol=bn.chord_symbol,
        position=bn.position,
        motion_from_previous=bn.motion_from_previous,
    )


def _serialize_chromatic_run(cr: ChromaticRun) -> ChromaticRunResponse:
    return ChromaticRunResponse(
        notes=[n.name for n in cr.notes],
        direction=cr.direction,
        start_position=cr.start_position,
        length=cr.length,
    )


# --- Routes ---


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    text = normalize_website_paste(req.text)
    song_input = parse_format_a(text)
    analysis = analyze_song(song_input)
    return _serialize_analysis(analysis)


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
    return _serialize_section(section_analysis)


logger = logging.getLogger(__name__)


@app.post("/api/llm-analyze", response_model=LlmAnalyzeResponse)
async def llm_analyze(req: AnalyzeResponse):
    try:
        raw = await generate_llm_analysis(req.model_dump())
    except LLMNotConfiguredError:
        raise HTTPException(status_code=503, detail="LLM analysis is not available")
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
