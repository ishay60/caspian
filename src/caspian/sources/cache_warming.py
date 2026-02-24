"""Cache warming utilities for pre-fetching popular chord sheets."""

from __future__ import annotations

import asyncio
from typing import Protocol

from .base import RawChordSheet
from .cache import DiskCache


class ChordSheetSource(Protocol):
    """Protocol for chord sheet sources that can be cached."""

    async def fetch(self, url: str) -> RawChordSheet:
        """Fetch a chord sheet from URL."""
        ...

    async def search(
        self, query: str, limit: int = 10
    ) -> list[dict[str, str]]:
        """Search for chord sheets. Returns list of {"url": ..., "title": ...}."""
        ...


async def warm_cache_from_urls(
    urls: list[str],
    source_name: str,
    source: ChordSheetSource,
    cache: DiskCache | None = None,
    rate_limit_seconds: float = 5.0,
) -> dict[str, int]:
    """
    Warm cache by pre-fetching URLs.

    Args:
        urls: List of URLs to fetch
        source_name: Source identifier (e.g., "ultimate_guitar")
        source: Source implementation with fetch() method
        cache: Cache instance (creates new if None)
        rate_limit_seconds: Delay between fetches

    Returns:
        {"success": count, "failed": count}
    """
    if cache is None:
        cache = DiskCache()

    results = {"success": 0, "failed": 0}

    for url in urls:
        try:
            print(f"Warming cache: {url}")
            chord_sheet = await source.fetch(url)
            cache.set(url, source_name, chord_sheet)
            results["success"] += 1
            print(f"  ✓ Cached: {chord_sheet.title}")
        except Exception as e:
            print(f"  ✗ Failed: {e}")
            results["failed"] += 1

        # Rate limiting
        if rate_limit_seconds > 0:
            await asyncio.sleep(rate_limit_seconds)

    return results


async def warm_cache_from_search(
    query: str,
    source_name: str,
    source: ChordSheetSource,
    limit: int = 10,
    cache: DiskCache | None = None,
    rate_limit_seconds: float = 5.0,
) -> dict[str, int]:
    """
    Warm cache by searching and fetching top results.

    Args:
        query: Search query
        source_name: Source identifier
        source: Source implementation with search() and fetch()
        limit: Maximum number of results to cache
        cache: Cache instance (creates new if None)
        rate_limit_seconds: Delay between fetches

    Returns:
        {"success": count, "failed": count}
    """
    if cache is None:
        cache = DiskCache()

    print(f"Searching for: {query}")
    results_data = {"success": 0, "failed": 0}

    try:
        search_results = await source.search(query, limit=limit)
        print(f"Found {len(search_results)} results")

        urls = [result["url"] for result in search_results]
        results_data = await warm_cache_from_urls(
            urls, source_name, source, cache, rate_limit_seconds
        )

    except Exception as e:
        print(f"Search failed: {e}")
        results_data["failed"] = limit

    return results_data


async def warm_cache_from_popular_songs(
    popular_urls: dict[str, list[str]],
    sources: dict[str, ChordSheetSource],
    cache: DiskCache | None = None,
    rate_limit_seconds: float = 5.0,
) -> dict[str, dict[str, int]]:
    """
    Warm cache from curated list of popular songs.

    Args:
        popular_urls: Dict mapping source name to list of URLs
                     {"ultimate_guitar": ["url1", "url2"], ...}
        sources: Dict mapping source name to source implementation
        cache: Cache instance (creates new if None)
        rate_limit_seconds: Delay between fetches

    Returns:
        Dict mapping source name to {"success": count, "failed": count}
    """
    if cache is None:
        cache = DiskCache()

    results = {}

    for source_name, urls in popular_urls.items():
        if source_name not in sources:
            print(f"Warning: No source implementation for {source_name}")
            continue

        print(f"\n=== Warming {source_name} cache ===")
        source = sources[source_name]
        results[source_name] = await warm_cache_from_urls(
            urls, source_name, source, cache, rate_limit_seconds
        )

    return results


# Example popular Israeli songs for Tab4u (placeholder for future use)
POPULAR_ISRAELI_SONGS = [
    # Format: (url, title, artist)
    # Will be populated once Tab4u source is implemented
    # ("https://www.tab4u.com/tabs/...", "יום שישי חזר", "מתי כספי"),
]

# Example popular songs for Ultimate Guitar (placeholder for future use)
POPULAR_SONGS = [
    # Format: (url, title, artist)
    # Will be populated once Ultimate Guitar source is implemented
    # ("https://www.ultimate-guitar.com/tab/...", "Hotel California", "Eagles"),
]


def get_popular_urls(source: str, limit: int = 50) -> list[str]:
    """
    Get URLs of popular songs for a source.

    Args:
        source: Source name ("ultimate_guitar" or "tab4u")
        limit: Maximum number of URLs to return

    Returns:
        List of URLs
    """
    if source == "tab4u":
        return [url for url, _, _ in POPULAR_ISRAELI_SONGS[:limit]]
    elif source == "ultimate_guitar":
        return [url for url, _, _ in POPULAR_SONGS[:limit]]
    else:
        return []
