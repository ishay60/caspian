"""CLI utilities for cache management and monitoring."""

from __future__ import annotations

import sys
from pathlib import Path

from .cache import DiskCache


def format_size(bytes_val: int) -> str:
    """Format bytes as human-readable size."""
    for unit in ["B", "KB", "MB", "GB"]:
        if bytes_val < 1024:
            return f"{bytes_val:.1f} {unit}"
        bytes_val /= 1024
    return f"{bytes_val:.1f} TB"


def print_cache_stats(cache_dir: Path | str = ".cache/chord_sheets") -> None:
    """Print comprehensive cache statistics."""
    cache = DiskCache(cache_dir)
    stats = cache.get_stats()

    print("=" * 60)
    print("CACHE STATISTICS")
    print("=" * 60)
    print()

    # Overview
    print("OVERVIEW")
    print("-" * 60)
    print(f"Total entries:     {stats['total_entries']}")
    print(f"Total size:        {format_size(stats['total_size_bytes'])}")
    print(f"Average size:      {format_size(stats['average_size_bytes'])}")
    print()

    # By source
    if stats["by_source"]:
        print("BY SOURCE")
        print("-" * 60)
        for source, source_stats in stats["by_source"].items():
            count = source_stats.get("count", 0)
            size = source_stats.get("size_bytes", 0)
            print(f"{source:20} {count:6} entries  {format_size(size):>12}")
        print()

    # Age
    if stats["oldest_entry"] and stats["newest_entry"]:
        print("AGE")
        print("-" * 60)
        print(f"Oldest entry:      {stats['oldest_entry'][:19]}")
        print(f"Newest entry:      {stats['newest_entry'][:19]}")
        print()

    # Runtime stats
    runtime = stats["runtime_stats"]
    print("RUNTIME STATISTICS")
    print("-" * 60)
    print(f"Since:             {runtime['since'][:19]}")
    print(f"Hits:              {runtime['hits']}")
    print(f"Misses:            {runtime['misses']}")
    print(f"Hit rate:          {runtime['hit_rate']:.1%}")
    print(f"Evictions:         {runtime['evictions']}")
    print()

    # Hit rate by source
    if runtime.get("by_source"):
        print("HIT RATE BY SOURCE")
        print("-" * 60)
        for source, source_stats in runtime["by_source"].items():
            hit_rate = source_stats.get("hit_rate", 0)
            hits = source_stats.get("hits", 0)
            misses = source_stats.get("misses", 0)
            print(f"{source:20} {hit_rate:6.1%}  ({hits} hits, {misses} misses)")
        print()

    print("=" * 60)


def clear_cache(
    source: str | None = None, cache_dir: Path | str = ".cache/chord_sheets"
) -> None:
    """Clear cache entries."""
    cache = DiskCache(cache_dir)

    if source:
        print(f"Clearing cache for source: {source}")
    else:
        print("Clearing all cache entries")

    count = cache.clear(source)
    print(f"Cleared {count} entries")


def main() -> None:
    """Main CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage: python -m caspian.sources.cache_cli <command>")
        print()
        print("Commands:")
        print("  stats              Show cache statistics")
        print("  clear [source]     Clear cache (optionally by source)")
        print()
        sys.exit(1)

    command = sys.argv[1]

    if command == "stats":
        print_cache_stats()
    elif command == "clear":
        source = sys.argv[2] if len(sys.argv) > 2 else None
        clear_cache(source)
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
