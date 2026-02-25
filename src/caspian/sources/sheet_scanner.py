"""Music sheet scanning -- extract chords from images using Claude Vision API."""

from __future__ import annotations

import base64
import json
import logging
import os

import httpx

logger = logging.getLogger(__name__)

SCAN_PROMPT = """Analyze this music sheet image. Extract the following information as structured JSON:

1. "title": Song title if visible (string or null)
2. "artist": Artist/composer if visible (string or null)
3. "key": Key signature if detectable (e.g., "Am", "C", "Bb" -- string or null)
4. "time_signature": Time signature if visible (e.g., "4/4" -- string or null)
5. "sections": Array of sections, each with:
   - "name": Section name if labeled (e.g., "Verse", "Chorus") or "section_1", "section_2", etc.
   - "bars": Array of bars, each with:
     - "chords": Array of chord symbols in order (e.g., ["Am", "F", "C", "G"])

Focus on chord symbols written above the staff or lyrics. If you see a lead sheet with chord symbols, extract those directly. If you see a full score, try to identify the harmony from the notes.

Return ONLY valid JSON, no markdown formatting.
"""


class SheetScanError(Exception):
    """Raised when sheet scanning fails."""

    pass


async def scan_sheet_image(
    image_data: bytes,
    media_type: str = "image/jpeg",
    api_key: str | None = None,
) -> dict:
    """Scan a music sheet image and extract chord information.

    Uses Claude Vision API to analyze the image.
    Returns parsed JSON with title, artist, key, sections, and chord data.

    Raises SheetScanError on failure.
    """
    key = api_key or os.getenv("ANTHROPIC_API_KEY")
    if not key:
        raise SheetScanError(
            "No Anthropic API key configured. Set ANTHROPIC_API_KEY or pass api_key."
        )

    b64_image = base64.standard_b64encode(image_data).decode("utf-8")

    payload = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 4096,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": b64_image,
                        },
                    },
                    {
                        "type": "text",
                        "text": SCAN_PROMPT,
                    },
                ],
            }
        ],
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            json=payload,
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )

    if resp.status_code != 200:
        raise SheetScanError(f"Claude API error: {resp.status_code} -- {resp.text[:200]}")

    result = resp.json()

    # Extract text from response
    text_content = ""
    for block in result.get("content", []):
        if block.get("type") == "text":
            text_content += block["text"]

    if not text_content:
        raise SheetScanError("No text response from Claude Vision API")

    # Parse JSON from response (handle potential markdown code blocks)
    text_content = text_content.strip()
    if text_content.startswith("```"):
        # Remove markdown code block wrapper
        lines = text_content.split("\n")
        text_content = (
            "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
        )

    try:
        return json.loads(text_content)
    except json.JSONDecodeError as e:
        raise SheetScanError(f"Failed to parse Claude response as JSON: {e}")


def scan_result_to_input_text(scan_result: dict) -> str:
    """Convert a scan result dict into Caspian Format A input text.

    This produces a text string that can be fed to the existing parse_format_a() pipeline.
    """
    lines: list[str] = []

    title = scan_result.get("title")
    artist = scan_result.get("artist")
    key = scan_result.get("key")

    if title:
        lines.append(f"title: {title}")
    if artist:
        lines.append(f"artist: {artist}")
    if key:
        lines.append(f"key: {key}")

    if lines:
        lines.append("")

    for section in scan_result.get("sections", []):
        name = section.get("name", "section")
        lines.append(f"{name}:")

        bars = section.get("bars", [])
        if bars:
            # Format as bar notation: | chord1 chord2 | chord3 chord4 |
            bar_strs = []
            for bar in bars:
                chords = bar.get("chords", [])
                if chords:
                    bar_strs.append(" ".join(chords))
            if bar_strs:
                lines.append("| " + " | ".join(bar_strs) + " |")

        lines.append("")

    return "\n".join(lines)
