"""Tab4u chord sheet source adapter."""

from __future__ import annotations

import asyncio
import re

import httpx
from bs4 import BeautifulSoup

from ..parsing.tab4u_normalize import normalize_chord_symbol
from .base import ChordSheetSource, RawChordSheet, RawSection, SearchResult


# Hebrew section markers
_SECTION_MARKERS = {
    "פזמון": "Chorus",
    "בית": "Verse",
    "גשר": "Bridge",
    "אינטרו": "Intro",
    "סולו": "Solo",
    "אאוטרו": "Outro",
}


class Tab4uSource(ChordSheetSource):
    """Tab4u.com chord sheet source."""

    def __init__(self):
        self.base_url = "https://www.tab4u.com"
        self.client = httpx.AsyncClient(
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; Caspian/1.0)",
            },
            timeout=30.0,
            follow_redirects=True,
        )
        self.rate_limit_delay = 2.5
        self._last_request_time = 0.0

    async def _rate_limit(self):
        now = asyncio.get_event_loop().time()
        elapsed = now - self._last_request_time
        if elapsed < self.rate_limit_delay:
            await asyncio.sleep(self.rate_limit_delay - elapsed)
        self._last_request_time = asyncio.get_event_loop().time()

    async def search(self, query: str, limit: int = 10) -> list[SearchResult]:
        if not query or not query.strip():
            raise ValueError("Search query cannot be empty")

        await self._rate_limit()

        search_url = f"{self.base_url}/tabs/search"
        params = {"q": query.strip()}

        try:
            response = await self.client.get(search_url, params=params)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "lxml")
            results: list[SearchResult] = []

            result_items = soup.select(".search-result, .song-item, .result-item")

            for item in result_items[:limit]:
                title_elem = item.select_one(".title, .song-title, h3, a")
                artist_elem = item.select_one(".artist, .artist-name, .subtitle")
                link_elem = item.select_one("a")

                if not title_elem or not link_elem:
                    continue

                title = title_elem.get_text(strip=True)
                artist = artist_elem.get_text(strip=True) if artist_elem else "Unknown"
                href = link_elem.get("href", "")

                if href.startswith("/"):
                    url = self.base_url + href
                else:
                    url = href

                results.append(
                    SearchResult(
                        source="tab4u",
                        title=title,
                        artist=artist,
                        url=url,
                        rating=0.0,
                        rating_count=0,
                        has_bars=True,
                    )
                )

            return results

        except httpx.HTTPError as e:
            raise httpx.HTTPError(f"Tab4u search failed: {e}") from e

    async def fetch(self, url: str) -> RawChordSheet:
        if not url or not url.strip():
            raise ValueError("URL cannot be empty")

        await self._rate_limit()

        try:
            response = await self.client.get(url)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "lxml")
            title = _extract_title(soup)
            artist = _extract_artist(soup)
            key = _extract_key(soup)
            content = _extract_content(soup)
            sections = _parse_content(content)

            return RawChordSheet(
                title=title,
                artist=artist,
                key=key,
                sections=sections,
                source_url=url,
                raw_text=content,
            )

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ValueError(f"Song not found: {url}") from e
            raise
        except Exception as e:
            raise ValueError(f"Failed to parse Tab4u page: {e}") from e

    async def close(self):
        await self.client.aclose()


def _extract_title(soup: BeautifulSoup) -> str:
    for selector in ["h1.song-title", "h1.title", ".song-header h1", "h1",
                     'meta[property="og:title"]']:
        elem = soup.select_one(selector)
        if elem:
            if elem.name == "meta":
                return elem.get("content", "Unknown")
            text = elem.get_text(strip=True)
            if text:
                return text
    return "Unknown"


def _extract_artist(soup: BeautifulSoup) -> str:
    for selector in [".artist-name", ".artist", "h2.artist",
                     ".song-header .artist", 'meta[property="music:musician"]']:
        elem = soup.select_one(selector)
        if elem:
            if elem.name == "meta":
                return elem.get("content", "Unknown")
            text = elem.get_text(strip=True)
            if text:
                return text
    return "Unknown"


def _extract_key(soup: BeautifulSoup) -> str | None:
    for selector in [".song-key", ".key", ".tonality", ".song-info"]:
        elem = soup.select_one(selector)
        if elem:
            text = elem.get_text(strip=True)
            key_match = re.search(
                r"(?:Key:?|סולם:?)\s*([A-G][#b]?m?)", text, re.IGNORECASE
            )
            if key_match:
                return key_match.group(1)
    return None


def _extract_content(soup: BeautifulSoup) -> str:
    for selector in [".song-content", ".tab-content", ".chord-sheet",
                     "pre.tab", "#song-content"]:
        elem = soup.select_one(selector)
        if elem:
            return elem.get_text("\n", strip=False)

    pre_tags = soup.find_all("pre")
    if pre_tags:
        return "\n\n".join(pre.get_text(strip=False) for pre in pre_tags)
    return ""


def _detect_section_marker(line: str) -> str | None:
    line = line.strip()

    english_match = re.match(r"^\[([^\]]+)\]$", line)
    if english_match:
        return english_match.group(1)

    for hebrew, english in _SECTION_MARKERS.items():
        if line.startswith(hebrew):
            number_match = re.search(r"\d+", line)
            if number_match:
                return f"{english} {number_match.group()}"
            return english
    return None


def _normalize_line(line: str) -> str:
    chord_pattern = r"\b[A-G][#b]?(?:m|maj|min|dim|aug|sus)?(?:\d+|add\d+)*(?:/[A-G][#b]?)?\b"

    def normalize_match(match):
        return normalize_chord_symbol(match.group(0))

    return re.sub(chord_pattern, normalize_match, line)


def _parse_content(content: str) -> list[RawSection]:
    sections: list[RawSection] = []
    current_section: RawSection | None = None
    current_lines: list[str] = []

    for line in content.split("\n"):
        section_name = _detect_section_marker(line)
        if section_name:
            if current_section and current_lines:
                current_section.lines.extend(current_lines)
                sections.append(current_section)
                current_lines = []
            current_section = RawSection(name=section_name)
        else:
            if line.strip():
                current_lines.append(_normalize_line(line))

    if current_section and current_lines:
        current_section.lines.extend(current_lines)
        sections.append(current_section)

    if not sections and current_lines:
        sections.append(RawSection(name="Song", lines=current_lines))

    return sections
