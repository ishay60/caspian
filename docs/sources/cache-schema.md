# Cache Schema Design

## Cache Entry Structure

### File Format: JSON

```json
{
  "url": "https://www.ultimate-guitar.com/tab/...",
  "source": "ultimate_guitar",
  "cached_at": "2026-02-24T12:00:00Z",
  "expires_at": "2026-02-26T12:00:00Z",
  "ttl_hours": 48,
  "chord_sheet": {
    "title": "Song Title",
    "artist": "Artist Name",
    "key": "Am",
    "sections": [],
    "source_url": "...",
    "raw_text": "..."
  },
  "metadata": {
    "fetch_time_ms": 1234,
    "size_bytes": 5678,
    "quality_score": 85,
    "access_count": 0,
    "last_accessed": "2026-02-24T12:00:00Z"
  }
}
```

### Cache Key Format

- **Format**: `{source}_{hash}`
- **Example**: `ultimate_guitar_a3f8b2c1...`
- **Hash**: SHA-256 of full URL (64 hex characters)
- **Total length**: 64 characters

### TTL Strategy (Based on Research)

| Source | TTL | Rationale |
|--------|-----|-----------|
| **Ultimate Guitar** | 48 hours | Dynamic content, ratings/votes change frequently |
| **Tab4u** | 7 days (168 hours) | More stable, Hebrew content rarely updated |
| **User-corrected** | No expiration | User data should persist until manually cleared |

### Rationale

1. **Ultimate Guitar**: Popular tabs get new ratings, comments, and corrections frequently. 48 hours balances freshness with reduced API load.

2. **Tab4u**: Hebrew tabs are more stable. Most Israeli songs have a single canonical version. Longer TTL reduces load on limited Hebrew resources.

3. **User corrections**: These are valuable manual improvements that should never expire automatically.

## Directory Structure

```
.cache/
  chord_sheets/
    ultimate_guitar/
      a3f8b2c1....json
      b4e9c3d2....json
    tab4u/
      c5d4e3f1....json
    user_corrections/
      d6e5f4g3....json
    metadata/
      cache_stats.json
      index.json
```

### Organization

- **Source-based directories**: Each source gets its own directory for easy management
- **Metadata directory**: Centralized stats and index files
- **Flat structure within sources**: No deep nesting, files named by hash

## Index File

The index file (`metadata/index.json`) provides quick cache overview without scanning all files:

```json
{
  "last_updated": "2026-02-24T14:30:00Z",
  "total_entries": 123,
  "by_source": {
    "ultimate_guitar": 89,
    "tab4u": 34
  },
  "total_size_bytes": 1234567,
  "oldest_entry": "2026-01-15T10:00:00Z",
  "newest_entry": "2026-02-24T14:30:00Z"
}
```

## Cache Statistics File

The stats file (`metadata/cache_stats.json`) tracks runtime metrics:

```json
{
  "since": "2026-02-20T00:00:00Z",
  "hits": 456,
  "misses": 123,
  "hit_rate": 0.787,
  "evictions": 12,
  "total_fetch_time_saved_ms": 567890,
  "by_source": {
    "ultimate_guitar": {
      "hits": 300,
      "misses": 80,
      "hit_rate": 0.789
    },
    "tab4u": {
      "hits": 156,
      "misses": 43,
      "hit_rate": 0.784
    }
  }
}
```

## Cache Operations

### Set Operation

1. Hash the URL with SHA-256
2. Create source directory if needed
3. Build cache entry with metadata
4. Write JSON file atomically
5. Update index and stats

### Get Operation

1. Hash the URL to find cache file
2. Read and parse JSON
3. Check expiration timestamp
4. If expired: delete file, update stats, return None
5. If valid: increment access count, update last_accessed, return data
6. Update hit/miss stats

### Clear Operation

1. Optional source filter
2. Delete matching files
3. Rebuild index and stats

### Warming Operation

1. Pre-fetch popular URLs
2. Cache with appropriate TTL
3. Respect rate limits
4. Log progress

## Error Handling

### Corrupted Cache Files

- If JSON parse fails: delete file, treat as cache miss
- If schema validation fails: delete file, treat as cache miss
- Log corruption for monitoring

### Disk Full

- Catch write errors
- Optionally implement LRU eviction
- Log warning
- Continue without caching (graceful degradation)

### Race Conditions

- Use atomic writes (write to temp file, then rename)
- Accept potential redundant fetches from concurrent requests
- Last-write-wins for updates

## Future Enhancements (Phase 3+)

1. **LRU Eviction**: Implement max cache size with least-recently-used eviction
2. **Compression**: gzip large chord sheets
3. **Tiered Storage**: Hot cache in memory, cold cache on disk
4. **Cache Warming**: Scheduled background jobs for popular songs
5. **Analytics**: Track which songs are most popular for better cache strategy
