"""Tests for LLM analysis module (no real API calls)."""

from __future__ import annotations

import json

import pytest

from caspian.analysis.llm_analysis import (
    _parse_response,
    build_user_prompt,
    get_llm_config,
)


# --- get_llm_config ---


class TestGetLlmConfig:
    def test_no_provider(self, monkeypatch):
        monkeypatch.delenv("CASPIAN_LLM_PROVIDER", raising=False)
        assert get_llm_config() is None

    def test_empty_provider(self, monkeypatch):
        monkeypatch.setenv("CASPIAN_LLM_PROVIDER", "")
        assert get_llm_config() is None

    def test_unknown_provider(self, monkeypatch):
        monkeypatch.setenv("CASPIAN_LLM_PROVIDER", "gemini")
        assert get_llm_config() is None

    def test_claude_no_key(self, monkeypatch):
        monkeypatch.setenv("CASPIAN_LLM_PROVIDER", "claude")
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        assert get_llm_config() is None

    def test_claude_empty_key(self, monkeypatch):
        monkeypatch.setenv("CASPIAN_LLM_PROVIDER", "claude")
        monkeypatch.setenv("ANTHROPIC_API_KEY", "  ")
        assert get_llm_config() is None

    def test_claude_configured(self, monkeypatch):
        monkeypatch.setenv("CASPIAN_LLM_PROVIDER", "claude")
        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-123")
        result = get_llm_config()
        assert result == ("claude", "sk-test-123")

    def test_openai_configured(self, monkeypatch):
        monkeypatch.setenv("CASPIAN_LLM_PROVIDER", "openai")
        monkeypatch.setenv("OPENAI_API_KEY", "sk-openai-456")
        result = get_llm_config()
        assert result == ("openai", "sk-openai-456")

    def test_openai_no_key(self, monkeypatch):
        monkeypatch.setenv("CASPIAN_LLM_PROVIDER", "openai")
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        assert get_llm_config() is None

    def test_provider_case_insensitive(self, monkeypatch):
        monkeypatch.setenv("CASPIAN_LLM_PROVIDER", "Claude")
        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
        result = get_llm_config()
        assert result == ("claude", "sk-test")

    def test_provider_whitespace_stripped(self, monkeypatch):
        monkeypatch.setenv("CASPIAN_LLM_PROVIDER", "  openai  ")
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        result = get_llm_config()
        assert result == ("openai", "sk-test")


# --- build_user_prompt ---


class TestBuildUserPrompt:
    def test_contains_title_and_artist(self):
        analysis = {"title": "יום שישי חזר", "artist": "מתי כספי", "sections": []}
        prompt = build_user_prompt(analysis)
        assert "יום שישי חזר" in prompt
        assert "מתי כספי" in prompt

    def test_contains_json(self):
        analysis = {"title": "Test", "artist": "Artist", "key": {"root_name": "A"}}
        prompt = build_user_prompt(analysis)
        assert '"root_name": "A"' in prompt

    def test_unknown_defaults(self):
        prompt = build_user_prompt({})
        assert "Unknown" in prompt


# --- _parse_response ---


class TestParseResponse:
    def test_valid_json(self):
        data = {
            "sections": [{"name": "Chorus", "narrative": "A dramatic section"}],
            "overall_summary": "Great song",
        }
        result = _parse_response(json.dumps(data))
        assert result == data

    def test_markdown_fenced_json(self):
        data = {
            "sections": [{"name": "Verse", "narrative": "Gentle opening"}],
            "overall_summary": "Nice",
        }
        text = f"```json\n{json.dumps(data)}\n```"
        result = _parse_response(text)
        assert result == data

    def test_markdown_fenced_no_language_tag(self):
        data = {"sections": [], "overall_summary": "Summary"}
        text = f"```\n{json.dumps(data)}\n```"
        result = _parse_response(text)
        assert result == data

    def test_plain_text_fallback(self):
        text = "This is a plain text narrative about the song."
        result = _parse_response(text)
        assert result["sections"] == []
        assert result["overall_summary"] == text

    def test_whitespace_handling(self):
        data = {"sections": [], "overall_summary": "ok"}
        result = _parse_response(f"  \n{json.dumps(data)}\n  ")
        assert result == data
