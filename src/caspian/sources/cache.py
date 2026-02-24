"""Disk-based cache for chord sheets with TTL and statistics."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from .base import RawChordSheet


class CacheEntry:
    """Metadata for a cached chord sheet entry."""

    def __init__(
        self,
        url: str,
        source: str,
        chord_sheet: RawChordSheet,
        ttl_hours: int,
        fetch_time_ms: int = 0,
    ):
        self.url = url
        self.source = source
        self.chord_sheet = chord_sheet
        self.cached_at = datetime.now()
        self.expires_at = self.cached_at + timedelta(hours=ttl_hours)
        self.ttl_hours = ttl_hours
        self.access_count = 0
        self.last_accessed = self.cached_at
        self.fetch_time_ms = fetch_time_ms
        self.size_bytes = 0

    def to_dict(self) -> dict:
        """Serialize to dictionary for JSON storage."""
        return {
            "url": self.url,
            "source": self.source,
            "cached_at": self.cached_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "ttl_hours": self.ttl_hours,
            "chord_sheet": self.chord_sheet.model_dump(),
            "metadata": {
                "fetch_time_ms": self.fetch_time_ms,
                "size_bytes": self.size_bytes,
                "access_count": self.access_count,
                "last_accessed": self.last_accessed.isoformat(),
            },
        }

    @classmethod
    def from_dict(cls, data: dict) -> CacheEntry:
        """Deserialize from dictionary."""
        entry = cls(
            url=data["url"],
            source=data["source"],
            chord_sheet=RawChordSheet(**data["chord_sheet"]),
            ttl_hours=data["ttl_hours"],
            fetch_time_ms=data["metadata"]["fetch_time_ms"],
        )
        entry.cached_at = datetime.fromisoformat(data["cached_at"])
        entry.expires_at = datetime.fromisoformat(data["expires_at"])
        entry.access_count = data["metadata"]["access_count"]
        entry.last_accessed = datetime.fromisoformat(data["metadata"]["last_accessed"])
        entry.size_bytes = data["metadata"]["size_bytes"]
        return entry


class CacheStats:
    """Cache statistics and metrics."""

    def __init__(self):
        self.since = datetime.now()
        self.hits = 0
        self.misses = 0
        self.evictions = 0
        self.by_source: dict[str, dict[str, int]] = {}

    def record_hit(self, source: str) -> None:
        """Record a cache hit."""
        self.hits += 1
        if source not in self.by_source:
            self.by_source[source] = {"hits": 0, "misses": 0}
        self.by_source[source]["hits"] += 1

    def record_miss(self, source: str) -> None:
        """Record a cache miss."""
        self.misses += 1
        if source not in self.by_source:
            self.by_source[source] = {"hits": 0, "misses": 0}
        self.by_source[source]["misses"] += 1

    def record_eviction(self) -> None:
        """Record a cache eviction."""
        self.evictions += 1

    def get_hit_rate(self) -> float:
        """Calculate overall hit rate."""
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0

    def to_dict(self) -> dict:
        """Serialize to dictionary."""
        result = {
            "since": self.since.isoformat(),
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": self.get_hit_rate(),
            "evictions": self.evictions,
            "by_source": {},
        }

        for source, stats in self.by_source.items():
            total = stats["hits"] + stats["misses"]
            hit_rate = stats["hits"] / total if total > 0 else 0.0
            result["by_source"][source] = {
                "hits": stats["hits"],
                "misses": stats["misses"],
                "hit_rate": hit_rate,
            }

        return result

    @classmethod
    def from_dict(cls, data: dict) -> CacheStats:
        """Deserialize from dictionary."""
        stats = cls()
        stats.since = datetime.fromisoformat(data["since"])
        stats.hits = data["hits"]
        stats.misses = data["misses"]
        stats.evictions = data.get("evictions", 0)
        stats.by_source = {}

        for source, source_stats in data.get("by_source", {}).items():
            stats.by_source[source] = {
                "hits": source_stats["hits"],
                "misses": source_stats["misses"],
            }

        return stats


class DiskCache:
    """Disk-based cache with TTL, statistics, and management."""

    def __init__(self, cache_dir: Path | str = ".cache/chord_sheets"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.metadata_dir = self.cache_dir / "metadata"
        self.metadata_dir.mkdir(exist_ok=True)
        self.stats_file = self.metadata_dir / "cache_stats.json"
        self.index_file = self.metadata_dir / "index.json"

        # Load or initialize stats
        self.stats = self._load_stats()

    def _load_stats(self) -> CacheStats:
        """Load statistics from disk."""
        if self.stats_file.exists():
            try:
                data = json.loads(self.stats_file.read_text(encoding="utf-8"))
                return CacheStats.from_dict(data)
            except Exception:
                pass
        return CacheStats()

    def _save_stats(self) -> None:
        """Save statistics to disk."""
        try:
            self.stats_file.write_text(
                json.dumps(self.stats.to_dict(), indent=2), encoding="utf-8"
            )
        except Exception:
            pass  # Graceful degradation if stats can't be saved

    def _get_cache_path(self, url: str, source: str) -> Path:
        """Get file path for cached entry."""
        cache_key = hashlib.sha256(url.encode()).hexdigest()
        source_dir = self.cache_dir / source
        source_dir.mkdir(exist_ok=True)
        return source_dir / f"{cache_key}.json"

    def get(self, url: str, source: str) -> Optional[RawChordSheet]:
        """
        Get cached chord sheet if not expired.

        Returns None if not cached or expired.
        """
        cache_file = self._get_cache_path(url, source)

        if not cache_file.exists():
            self.stats.record_miss(source)
            self._save_stats()
            return None

        try:
            data = json.loads(cache_file.read_text(encoding="utf-8"))
            entry = CacheEntry.from_dict(data)

            # Check expiration
            if datetime.now() > entry.expires_at:
                cache_file.unlink()
                self.stats.record_eviction()
                self.stats.record_miss(source)
                self._save_stats()
                self._update_index()
                return None

            # Update access stats
            entry.access_count += 1
            entry.last_accessed = datetime.now()

            # Write back with updated stats
            cache_file.write_text(
                json.dumps(entry.to_dict(), indent=2, ensure_ascii=False),
                encoding="utf-8",
            )

            self.stats.record_hit(source)
            self._save_stats()

            return entry.chord_sheet

        except Exception:
            # Corrupted cache - remove it
            try:
                cache_file.unlink()
            except Exception:
                pass
            self.stats.record_miss(source)
            self._save_stats()
            return None

    def set(
        self,
        url: str,
        source: str,
        chord_sheet: RawChordSheet,
        ttl_hours: int | None = None,
        fetch_time_ms: int = 0,
    ) -> None:
        """
        Cache a chord sheet with TTL.

        Args:
            url: Original URL
            source: Source identifier (e.g., "ultimate_guitar", "tab4u")
            chord_sheet: Chord sheet to cache
            ttl_hours: Time to live in hours (defaults based on source)
            fetch_time_ms: Time taken to fetch (for stats)
        """
        if ttl_hours is None:
            # Default TTLs based on source
            ttl_hours = self._get_default_ttl(source)

        cache_file = self._get_cache_path(url, source)

        entry = CacheEntry(url, source, chord_sheet, ttl_hours, fetch_time_ms)

        # Serialize and calculate size
        json_str = json.dumps(entry.to_dict(), indent=2, ensure_ascii=False)
        entry.size_bytes = len(json_str.encode("utf-8"))

        # Re-serialize with the correct size
        json_str = json.dumps(entry.to_dict(), indent=2, ensure_ascii=False)

        try:
            # Atomic write: write to temp file, then rename
            temp_file = cache_file.with_suffix(".tmp")
            temp_file.write_text(json_str, encoding="utf-8")
            temp_file.rename(cache_file)

            self._update_index()
        except Exception:
            pass  # Graceful degradation if cache write fails

    def _get_default_ttl(self, source: str) -> int:
        """Get default TTL hours for a source."""
        ttls = {
            "ultimate_guitar": 48,  # 2 days
            "tab4u": 168,  # 7 days
            "user_corrections": 0,  # Never expire
        }
        return ttls.get(source, 48)  # Default to 48 hours

    def clear(self, source: Optional[str] = None) -> int:
        """
        Clear cache entries.

        Args:
            source: Optional source to clear. If None, clears all.

        Returns:
            Number of entries cleared
        """
        count = 0

        if source:
            source_dir = self.cache_dir / source
            if source_dir.exists() and source_dir.is_dir():
                for cache_file in source_dir.glob("*.json"):
                    try:
                        cache_file.unlink()
                        count += 1
                    except Exception:
                        pass
        else:
            for source_dir in self.cache_dir.iterdir():
                if source_dir.is_dir() and source_dir.name != "metadata":
                    for cache_file in source_dir.glob("*.json"):
                        try:
                            cache_file.unlink()
                            count += 1
                        except Exception:
                            pass

        self._update_index()
        return count

    def _update_index(self) -> None:
        """Rebuild the cache index."""
        index = {
            "last_updated": datetime.now().isoformat(),
            "total_entries": 0,
            "by_source": {},
            "total_size_bytes": 0,
            "oldest_entry": None,
            "newest_entry": None,
        }

        for source_dir in self.cache_dir.iterdir():
            if not source_dir.is_dir() or source_dir.name == "metadata":
                continue

            source = source_dir.name
            count = 0
            source_size = 0

            for cache_file in source_dir.glob("*.json"):
                try:
                    data = json.loads(cache_file.read_text(encoding="utf-8"))
                    count += 1
                    size = data["metadata"]["size_bytes"]
                    source_size += size

                    cached_at = datetime.fromisoformat(data["cached_at"])
                    if (
                        index["oldest_entry"] is None
                        or cached_at < datetime.fromisoformat(index["oldest_entry"])
                    ):
                        index["oldest_entry"] = data["cached_at"]
                    if (
                        index["newest_entry"] is None
                        or cached_at > datetime.fromisoformat(index["newest_entry"])
                    ):
                        index["newest_entry"] = data["cached_at"]

                except Exception:
                    pass

            if count > 0:
                index["by_source"][source] = {"count": count, "size_bytes": source_size}
                index["total_entries"] += count
                index["total_size_bytes"] += source_size

        try:
            self.index_file.write_text(
                json.dumps(index, indent=2), encoding="utf-8"
            )
        except Exception:
            pass

    def get_stats(self) -> dict:
        """Get comprehensive cache statistics."""
        # Rebuild index to get current state
        self._update_index()

        # Load index
        if self.index_file.exists():
            try:
                index = json.loads(self.index_file.read_text(encoding="utf-8"))
            except Exception:
                index = {}
        else:
            index = {}

        # Combine index info with runtime stats
        result = {
            "total_entries": index.get("total_entries", 0),
            "by_source": index.get("by_source", {}),
            "total_size_bytes": index.get("total_size_bytes", 0),
            "oldest_entry": index.get("oldest_entry"),
            "newest_entry": index.get("newest_entry"),
            "runtime_stats": self.stats.to_dict(),
        }

        # Calculate average size
        if result["total_entries"] > 0:
            result["average_size_bytes"] = (
                result["total_size_bytes"] // result["total_entries"]
            )
        else:
            result["average_size_bytes"] = 0

        return result

    def get_hit_rate(self) -> dict:
        """Get cache hit rate statistics."""
        return {
            "overall": self.stats.get_hit_rate(),
            "by_source": {
                source: (
                    source_stats["hits"]
                    / (source_stats["hits"] + source_stats["misses"])
                    if (source_stats["hits"] + source_stats["misses"]) > 0
                    else 0.0
                )
                for source, source_stats in self.stats.by_source.items()
            },
            "hits": self.stats.hits,
            "misses": self.stats.misses,
        }
