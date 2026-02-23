"""On-demand LLM harmonic narrative generation."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

# Load .env from project root if present
_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"
if _ENV_FILE.exists():
    for line in _ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


class LLMNotConfiguredError(Exception):
    """Raised when no LLM provider is configured."""


SYSTEM_PROMPT = """\
You are a music theory expert specializing in Western tonal harmony and Israeli popular music.

You will receive the output of an algorithmic harmonic analysis of a song, in JSON format. \
The analysis includes roman numeral analysis, borrowed chords, secondary dominants, \
diminished chord interpretations, chromatic bass runs, deceptive resolutions, and patterns.

Your task is to synthesize this data into a readable musicological narrative. For each section, \
describe the harmonic language, notable progressions, and any emotional or stylistic implications. \
Then provide an overall summary covering the song's harmonic character, genre conventions, \
and songwriter style.

Respond in the same language as the song title and artist name. \
For Israeli songs, respond in Hebrew.

Respond with valid JSON only (no markdown fences, no extra text) in this exact format:
{
  "sections": [
    {"name": "<section name>", "narrative": "<narrative for this section>"}
  ],
  "overall_summary": "<overall harmonic narrative>"
}
"""


def get_llm_config() -> tuple[str, str] | None:
    """Read LLM provider config from environment.

    Returns (provider, api_key) or None if not configured.
    """
    provider = os.environ.get("CASPIAN_LLM_PROVIDER", "").lower().strip()
    if not provider:
        return None

    if provider == "claude":
        api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    elif provider == "openai":
        api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    else:
        return None

    if not api_key:
        return None

    return (provider, api_key)


def build_user_prompt(analysis_json: dict[str, Any]) -> str:
    """Build the user message from the analysis JSON."""
    title = analysis_json.get("title", "Unknown")
    artist = analysis_json.get("artist", "Unknown")
    return (
        f"Song: {title} by {artist}\n\n"
        f"Analysis:\n{json.dumps(analysis_json, ensure_ascii=False, indent=2)}"
    )


def _parse_response(text: str) -> dict[str, Any]:
    """Extract structured JSON from LLM output.

    Handles: raw JSON, markdown-fenced JSON, or plain text fallback.
    """
    stripped = text.strip()

    # Try raw JSON first
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # Try extracting from markdown code fence
    if "```" in stripped:
        # Find content between first ``` and last ```
        start = stripped.find("```")
        end = stripped.rfind("```")
        if start != end:
            inner = stripped[start + 3 : end]
            # Remove optional language tag (e.g., ```json)
            if inner.startswith("json"):
                inner = inner[4:]
            inner = inner.strip()
            try:
                return json.loads(inner)
            except json.JSONDecodeError:
                pass

    # Fallback: return plain text as overall summary
    return {
        "sections": [],
        "overall_summary": stripped,
    }


async def _call_claude(api_key: str, user_prompt: str) -> str:
    """Call Claude API and return the text response."""
    from anthropic import AsyncAnthropic

    client = AsyncAnthropic(api_key=api_key)
    message = await client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return message.content[0].text


async def _call_openai(api_key: str, user_prompt: str) -> str:
    """Call OpenAI API and return the text response."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)
    response = await client.chat.completions.create(
        model="gpt-4o",
        max_tokens=4096,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )
    return response.choices[0].message.content


async def generate_llm_analysis(
    analysis_json: dict[str, Any],
    *,
    user_api_key: str | None = None,
    user_provider: str | None = None,
) -> dict[str, Any]:
    """Generate a harmonic narrative using the configured LLM provider.

    Priority: user-supplied key (from request header) > server env vars.
    Raises LLMNotConfiguredError if no provider is configured.
    Raises RuntimeError on LLM API errors.
    """
    if user_api_key and user_provider:
        provider, api_key = user_provider, user_api_key
    else:
        config = get_llm_config()
        if config is None:
            raise LLMNotConfiguredError("No LLM provider configured")
        provider, api_key = config

    user_prompt = build_user_prompt(analysis_json)

    try:
        if provider == "claude":
            raw = await _call_claude(api_key, user_prompt)
        else:
            raw = await _call_openai(api_key, user_prompt)
    except Exception as exc:
        raise RuntimeError(f"LLM API call failed: {exc}") from exc

    return _parse_response(raw)
