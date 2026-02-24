"""Comprehensive tests for disk cache implementation."""

from __future__ import annotations

import json
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from caspian.sources.base import RawChordSheet, RawSection
from caspian.sources.cache import CacheEntry, CacheStats, DiskCache


@pytest.fixture
def temp_cache_dir():
    """Create temporary cache directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def cache(temp_cache_dir):
    """Create cache instance with temp directory."""
    return DiskCache(temp_cache_dir)


@pytest.fixture
def sample_chord_sheet():
    """Create sample chord sheet for testing."""
    return RawChordSheet(
        title="Test Song",
        artist="Test Artist",
        source_url="https://example.com/test",
        raw_text="Am F C G",
        sections=[
            RawSection(name="verse", content="Am F | C G"),
            RawSection(name="chorus", content="F G | Am"),
        ],
        key="Am",
    )


class TestCacheEntry:
    """Tests for CacheEntry class."""

    def test_cache_entry_creation(self, sample_chord_sheet):
        """Test creating a cache entry."""
        entry = CacheEntry(
            url="https://example.com/test",
            source="test_source",
            chord_sheet=sample_chord_sheet,
            ttl_hours=48,
            fetch_time_ms=1234,
        )

        assert entry.url == "https://example.com/test"
        assert entry.source == "test_source"
        assert entry.chord_sheet.title == "Test Song"
        assert entry.ttl_hours == 48
        assert entry.fetch_time_ms == 1234
        assert entry.access_count == 0
        assert isinstance(entry.cached_at, datetime)
        assert isinstance(entry.expires_at, datetime)

    def test_cache_entry_expiration_time(self, sample_chord_sheet):
        """Test that expiration is calculated correctly."""
        entry = CacheEntry(
            url="https://example.com/test",
            source="test_source",
            chord_sheet=sample_chord_sheet,
            ttl_hours=24,
        )

        expected_expires = entry.cached_at + timedelta(hours=24)
        assert entry.expires_at == expected_expires

    def test_cache_entry_serialization(self, sample_chord_sheet):
        """Test serializing entry to dictionary."""
        entry = CacheEntry(
            url="https://example.com/test",
            source="test_source",
            chord_sheet=sample_chord_sheet,
            ttl_hours=48,
        )

        data = entry.to_dict()

        assert data["url"] == "https://example.com/test"
        assert data["source"] == "test_source"
        assert data["ttl_hours"] == 48
        assert "chord_sheet" in data
        assert "metadata" in data
        assert data["metadata"]["access_count"] == 0

    def test_cache_entry_deserialization(self, sample_chord_sheet):
        """Test deserializing entry from dictionary."""
        entry = CacheEntry(
            url="https://example.com/test",
            source="test_source",
            chord_sheet=sample_chord_sheet,
            ttl_hours=48,
        )

        data = entry.to_dict()
        restored = CacheEntry.from_dict(data)

        assert restored.url == entry.url
        assert restored.source == entry.source
        assert restored.chord_sheet.title == entry.chord_sheet.title
        assert restored.ttl_hours == entry.ttl_hours


class TestCacheStats:
    """Tests for CacheStats class."""

    def test_stats_initialization(self):
        """Test creating new stats object."""
        stats = CacheStats()

        assert stats.hits == 0
        assert stats.misses == 0
        assert stats.evictions == 0
        assert stats.by_source == {}
        assert isinstance(stats.since, datetime)

    def test_record_hit(self):
        """Test recording cache hits."""
        stats = CacheStats()

        stats.record_hit("test_source")
        stats.record_hit("test_source")
        stats.record_hit("other_source")

        assert stats.hits == 3
        assert stats.by_source["test_source"]["hits"] == 2
        assert stats.by_source["other_source"]["hits"] == 1

    def test_record_miss(self):
        """Test recording cache misses."""
        stats = CacheStats()

        stats.record_miss("test_source")
        stats.record_miss("test_source")

        assert stats.misses == 2
        assert stats.by_source["test_source"]["misses"] == 2

    def test_hit_rate_calculation(self):
        """Test hit rate calculation."""
        stats = CacheStats()

        # 100% hit rate
        stats.record_hit("test")
        stats.record_hit("test")
        assert stats.get_hit_rate() == 1.0

        # 50% hit rate
        stats.record_miss("test")
        stats.record_miss("test")
        assert stats.get_hit_rate() == 0.5

        # 0% hit rate (all misses)
        stats2 = CacheStats()
        stats2.record_miss("test")
        assert stats2.get_hit_rate() == 0.0

    def test_stats_serialization(self):
        """Test serializing stats to dictionary."""
        stats = CacheStats()
        stats.record_hit("source1")
        stats.record_hit("source1")
        stats.record_miss("source1")
        stats.record_eviction()

        data = stats.to_dict()

        assert data["hits"] == 2
        assert data["misses"] == 1
        assert data["evictions"] == 1
        assert data["hit_rate"] == pytest.approx(2 / 3)
        assert "source1" in data["by_source"]
        assert data["by_source"]["source1"]["hit_rate"] == pytest.approx(2 / 3)


class TestDiskCache:
    """Tests for DiskCache class."""

    def test_cache_initialization(self, temp_cache_dir):
        """Test creating cache creates directory structure."""
        cache = DiskCache(temp_cache_dir)

        assert cache.cache_dir.exists()
        assert cache.metadata_dir.exists()
        assert (cache.cache_dir / "metadata").exists()

    def test_cache_set_and_get(self, cache, sample_chord_sheet):
        """Test basic cache set and get."""
        url = "https://example.com/test"
        source = "test_source"

        cache.set(url, source, sample_chord_sheet, ttl_hours=48)

        result = cache.get(url, source)

        assert result is not None
        assert result.title == "Test Song"
        assert result.artist == "Test Artist"
        assert result.key == "Am"

    def test_cache_miss_returns_none(self, cache):
        """Test that cache miss returns None."""
        result = cache.get("https://nonexistent.com", "test_source")
        assert result is None

    def test_cache_creates_source_directory(self, cache, sample_chord_sheet):
        """Test that caching creates source-specific directory."""
        cache.set(
            "https://example.com/test",
            "ultimate_guitar",
            sample_chord_sheet,
        )

        source_dir = cache.cache_dir / "ultimate_guitar"
        assert source_dir.exists()
        assert source_dir.is_dir()

    def test_cache_file_naming(self, cache, sample_chord_sheet):
        """Test that cache files are named by URL hash."""
        import hashlib

        url = "https://example.com/test"
        source = "test_source"

        cache.set(url, source, sample_chord_sheet)

        expected_hash = hashlib.sha256(url.encode()).hexdigest()
        cache_file = cache.cache_dir / source / f"{expected_hash}.json"

        assert cache_file.exists()

    def test_cache_expiration(self, cache, sample_chord_sheet):
        """Test that expired entries are removed on get."""
        url = "https://example.com/test"
        source = "test_source"

        # Cache with negative TTL (already expired)
        cache.set(url, source, sample_chord_sheet, ttl_hours=-1)

        # Should return None and remove file
        result = cache.get(url, source)
        assert result is None

        # File should be deleted
        cache_file = cache._get_cache_path(url, source)
        assert not cache_file.exists()

    def test_cache_access_tracking(self, cache, sample_chord_sheet):
        """Test that access counts are tracked."""
        url = "https://example.com/test"
        source = "test_source"

        cache.set(url, source, sample_chord_sheet)

        # Access multiple times
        cache.get(url, source)
        cache.get(url, source)
        cache.get(url, source)

        # Read cache file and check access count
        cache_file = cache._get_cache_path(url, source)
        data = json.loads(cache_file.read_text())

        assert data["metadata"]["access_count"] == 3

    def test_cache_default_ttl_ultimate_guitar(self, cache, sample_chord_sheet):
        """Test default TTL for Ultimate Guitar."""
        cache.set("https://example.com/test", "ultimate_guitar", sample_chord_sheet)

        cache_file = cache._get_cache_path(
            "https://example.com/test", "ultimate_guitar"
        )
        data = json.loads(cache_file.read_text())

        assert data["ttl_hours"] == 48

    def test_cache_default_ttl_tab4u(self, cache, sample_chord_sheet):
        """Test default TTL for Tab4u."""
        cache.set("https://example.com/test", "tab4u", sample_chord_sheet)

        cache_file = cache._get_cache_path("https://example.com/test", "tab4u")
        data = json.loads(cache_file.read_text())

        assert data["ttl_hours"] == 168  # 7 days

    def test_cache_clear_all(self, cache, sample_chord_sheet):
        """Test clearing all cache entries."""
        # Add entries from multiple sources
        cache.set("https://example.com/1", "source1", sample_chord_sheet)
        cache.set("https://example.com/2", "source1", sample_chord_sheet)
        cache.set("https://example.com/3", "source2", sample_chord_sheet)

        count = cache.clear()

        assert count == 3
        assert cache.get("https://example.com/1", "source1") is None
        assert cache.get("https://example.com/2", "source1") is None
        assert cache.get("https://example.com/3", "source2") is None

    def test_cache_clear_by_source(self, cache, sample_chord_sheet):
        """Test clearing cache for specific source."""
        cache.set("https://example.com/1", "source1", sample_chord_sheet)
        cache.set("https://example.com/2", "source1", sample_chord_sheet)
        cache.set("https://example.com/3", "source2", sample_chord_sheet)

        count = cache.clear("source1")

        assert count == 2
        assert cache.get("https://example.com/1", "source1") is None
        assert cache.get("https://example.com/2", "source1") is None
        assert cache.get("https://example.com/3", "source2") is not None

    def test_cache_statistics(self, cache, sample_chord_sheet):
        """Test cache statistics calculation."""
        # Add several entries
        for i in range(5):
            cache.set(f"https://example.com/{i}", "test_source", sample_chord_sheet)

        stats = cache.get_stats()

        assert stats["total_entries"] == 5
        assert "test_source" in stats["by_source"]
        assert stats["by_source"]["test_source"]["count"] == 5
        assert stats["total_size_bytes"] > 0
        assert stats["average_size_bytes"] > 0

    def test_cache_hit_miss_tracking(self, cache, sample_chord_sheet):
        """Test that hits and misses are tracked."""
        cache.set("https://example.com/test", "test_source", sample_chord_sheet)

        # Hit
        cache.get("https://example.com/test", "test_source")

        # Miss
        cache.get("https://example.com/nonexistent", "test_source")

        hit_rate = cache.get_hit_rate()

        assert hit_rate["hits"] == 1
        assert hit_rate["misses"] == 1
        assert hit_rate["overall"] == 0.5

    def test_corrupted_cache_handled_gracefully(self, cache, temp_cache_dir):
        """Test that corrupted cache files are removed."""
        url = "https://example.com/test"
        source = "test_source"

        # Create corrupted cache file
        cache_file = cache._get_cache_path(url, source)
        cache_file.parent.mkdir(exist_ok=True)
        cache_file.write_text("invalid json{{{")

        # Should return None and handle gracefully
        result = cache.get(url, source)
        assert result is None

    def test_cache_index_update(self, cache, sample_chord_sheet):
        """Test that cache index is updated."""
        cache.set("https://example.com/1", "source1", sample_chord_sheet)
        cache.set("https://example.com/2", "source2", sample_chord_sheet)

        cache._update_index()

        assert cache.index_file.exists()
        index = json.loads(cache.index_file.read_text())

        assert index["total_entries"] == 2
        assert "source1" in index["by_source"]
        assert "source2" in index["by_source"]

    def test_multiple_sources(self, cache, sample_chord_sheet):
        """Test caching from multiple sources."""
        cache.set("https://example.com/1", "ultimate_guitar", sample_chord_sheet)
        cache.set("https://example.com/2", "tab4u", sample_chord_sheet)

        ug_result = cache.get("https://example.com/1", "ultimate_guitar")
        tab4u_result = cache.get("https://example.com/2", "tab4u")

        assert ug_result is not None
        assert tab4u_result is not None

        stats = cache.get_stats()
        assert "ultimate_guitar" in stats["by_source"]
        assert "tab4u" in stats["by_source"]

    def test_cache_size_calculation(self, cache, sample_chord_sheet):
        """Test that cache size is calculated correctly."""
        cache.set("https://example.com/test", "test_source", sample_chord_sheet)

        cache_file = cache._get_cache_path(
            "https://example.com/test", "test_source"
        )
        data = json.loads(cache_file.read_text())

        size_bytes = data["metadata"]["size_bytes"]
        actual_size = len(cache_file.read_bytes())

        # Should be very close (within a few bytes due to JSON formatting)
        assert abs(size_bytes - actual_size) < 10

    def test_last_accessed_timestamp(self, cache, sample_chord_sheet):
        """Test that last_accessed timestamp is updated."""
        url = "https://example.com/test"
        source = "test_source"

        cache.set(url, source, sample_chord_sheet)

        # Small delay
        time.sleep(0.1)

        cache.get(url, source)

        cache_file = cache._get_cache_path(url, source)
        data = json.loads(cache_file.read_text())

        cached_at = datetime.fromisoformat(data["cached_at"])
        last_accessed = datetime.fromisoformat(data["metadata"]["last_accessed"])

        # Last accessed should be after cached_at
        assert last_accessed > cached_at
