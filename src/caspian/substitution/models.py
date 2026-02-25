"""Pydantic models for chord substitution suggestions."""

from __future__ import annotations

from pydantic import BaseModel


class ChordSubstitution(BaseModel):
    """A suggested chord substitution."""

    symbol: str
    sub_type: str  # e.g., "tritone", "relative", "parallel", "diatonic", "modal_interchange", "dominant_chain"
    reasoning: str  # human-readable explanation
    confidence: float  # 0.0-1.0
    voice_leading_distance: int
    common_tone_count: int
