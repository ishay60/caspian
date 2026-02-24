"""Ultimate Guitar chord sheet source adapter."""

from __future__ import annotations

import asyncio
import json
import re

import httpx

from .base import ChordSheetSource, RawChordSheet, RawSection, SearchResult


class UltimateGuitarSource(ChordSheetSource):
    """Ultimate Guitar chord sheet source.

    Fetches chord sheets from ultimate-guitar.com using HTML scraping.
    """

    def __init__(self):
        self.base_url = "https://www.ultimate-guitar.com"
        self.client = httpx.AsyncClient(
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; Caspian/1.0)",
            },
            timeout=30.0,
            follow_redirects=True,
        )
        self.rate_limit_delay = 5.0
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

        search_url = f"{self.base_url}/search.php"
        params = {
            "search_type": "title",
            "value": query.strip(),
            "type": "300",  # chords
        }

        try:
            response = await self.client.get(search_url, params=params)
            response.raise_for_status()

            results: list[SearchResult] = []
            html = response.text

            store_match = re.search(
                r'<div\s+class="js-store"\s+data-content="([^"]+)"', html
            )
            if store_match:
                import html as html_module

                data_content = html_module.unescape(store_match.group(1))
                try:
                    data = json.loads(data_content)
                    if "store" in data and "page" in data["store"]:
                        page_data = data["store"]["page"]
                        if "data" in page_data and "results" in page_data["data"]:
                            for item in page_data["data"]["results"][:limit]:
                                tab_url = item.get("tab_url", "")
                                if not tab_url:
                                    continue

                                results.append(
                                    SearchResult(
                                        source="ultimate_guitar",
                                        title=item.get("song_name", "Unknown"),
                                        artist=item.get("artist_name", "Unknown"),
                                        url=tab_url,
                                        rating=float(item.get("rating", 0.0)),
                                        rating_count=int(item.get("votes", 0)),
                                        has_bars=True,
                                    )
                                )
                except json.JSONDecodeError:
                    pass

            return results

        except httpx.HTTPError as e:
            raise httpx.HTTPError(f"UG search failed: {e}") from e

    async def fetch(self, url_or_id: str) -> RawChordSheet:
        await self._rate_limit()

        url = url_or_id
        if not url:
            raise ValueError("Invalid URL or tab ID")

        try:
            response = await self.client.get(url)
            response.raise_for_status()

            html = response.text

            store_match = re.search(
                r'<div\s+class="js-store"\s+data-content="([^"]+)"', html
            )
            if not store_match:
                raise ValueError("Could not find tab data in page")

            import html as html_module

            data_content = html_module.unescape(store_match.group(1))
            data = json.loads(data_content)

            if "store" not in data or "page" not in data["store"]:
                raise ValueError("Invalid tab data structure")

            page_data = data["store"]["page"]
            if "data" not in page_data or "tab_view" not in page_data["data"]:
                raise ValueError("Tab view data not found")

            tab_data = page_data["data"]["tab_view"]
            title = tab_data.get("song_name", "Unknown")
            artist = tab_data.get("artist_name", "Unknown")
            key = tab_data.get("tonality_name")
            content = tab_data.get("wiki_tab", {}).get("content", "")

            sections = self._parse_ug_content(content)

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
                raise ValueError(f"Tab not found: {url}") from e
            raise
        except (json.JSONDecodeError, KeyError) as e:
            raise ValueError(f"Failed to parse tab data: {e}") from e

    def _parse_ug_content(self, content: str) -> list[RawSection]:
        sections: list[RawSection] = []
        current_section: RawSection | None = None

        for line in content.split("\n"):
            section_match = re.match(r"^\[([^\]]+)\]", line.strip())
            if section_match:
                if current_section:
                    sections.append(current_section)
                current_section = RawSection(name=section_match.group(1))
            elif current_section is not None:
                if line.strip():
                    current_section.lines.append(line.rstrip())
            else:
                if line.strip():
                    if not current_section:
                        current_section = RawSection(name="Tab")
                    current_section.lines.append(line.rstrip())

        if current_section:
            sections.append(current_section)

        return sections

    async def close(self):
        await self.client.aclose()
