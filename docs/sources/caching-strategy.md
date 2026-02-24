# Caching Strategy

## Overview

Caspian uses a disk-based caching system to reduce load on external chord sheet sources and improve performance. The cache is transparent, intelligent, and maintainable.

## Architecture

### Components

1. **DiskCache** - Core cache implementation with TTL, statistics, and management
2. **CacheEntry** - Individual cached chord sheets with metadata
3. **CacheStats** - Runtime statistics tracking hits, misses, and hit rates
4. **Cache CLI** - Command-line tools for monitoring and management
5. **Cache Warming** - Utilities for pre-fetching popular content

### File Structure

```
.cache/
  chord_sheets/
    ultimate_guitar/
      {hash}.json           # Cached chord sheets
    tab4u/
      {hash}.json
    user_corrections/
      {hash}.json
    metadata/
      cache_stats.json      # Runtime statistics
      index.json            # Cache index for quick lookups
```

## TTL Strategy

Time-to-live (TTL) values are tuned based on content stability research:

| Source | TTL | Rationale |
|--------|-----|-----------|
| **Ultimate Guitar** | 48 hours | Dynamic content - ratings and comments change frequently |
| **Tab4u** | 7 days (168 hours) | Static Hebrew tabs - rarely updated after initial posting |
| **User Corrections** | No expiration | Valuable manual improvements - persist indefinitely |

### Why These Values?

- **Ultimate Guitar (48h)**: Popular tabs receive new ratings, comments, and corrections daily. 48 hours balances freshness with reduced API load.

- **Tab4u (7 days)**: Israeli songs typically have a single canonical tab version. Hebrew content changes infrequently. Longer TTL reduces load on limited Hebrew resources.

- **User Corrections (∞)**: User-made improvements are gold. Never expire these unless explicitly cleared.

## Cache Operations

### Get Operation

```python
chord_sheet = cache.get(url, source)
```

1. Hash URL with SHA-256
2. Look up cache file
3. Check expiration timestamp
4. If expired: delete, record eviction, return None
5. If valid: increment access count, update last_accessed, return data
6. Record hit/miss statistics

### Set Operation

```python
cache.set(url, source, chord_sheet, ttl_hours=48)
```

1. Create CacheEntry with metadata
2. Serialize to JSON
3. Calculate size in bytes
4. Atomic write (temp file → rename)
5. Update index and statistics

### Clear Operation

```python
# Clear all
cache.clear()

# Clear by source
cache.clear("ultimate_guitar")
```

Removes cache files and rebuilds index.

## Cache Warming

Pre-fetch popular songs during idle time or startup:

### From URLs

```python
from caspian.sources.cache_warming import warm_cache_from_urls

results = await warm_cache_from_urls(
    urls=["https://example.com/tab1", "https://example.com/tab2"],
    source_name="ultimate_guitar",
    source=ug_source,
    rate_limit_seconds=5.0
)
```

### From Search

```python
from caspian.sources.cache_warming import warm_cache_from_search

results = await warm_cache_from_search(
    query="Hotel California",
    source_name="ultimate_guitar",
    source=ug_source,
    limit=10
)
```

### Popular Songs (Curated)

```python
from caspian.sources.cache_warming import warm_cache_from_popular_songs

popular_urls = {
    "ultimate_guitar": [...],
    "tab4u": [...]
}

sources = {
    "ultimate_guitar": ug_source,
    "tab4u": tab4u_source
}

results = await warm_cache_from_popular_songs(popular_urls, sources)
```

## Cache Management

### API Endpoints

```
GET  /api/cache/stats      # Comprehensive statistics
GET  /api/cache/hit-rate   # Hit/miss rates
DELETE /api/cache?source=  # Clear cache
```

### CLI Tools

```bash
# View statistics
python -m caspian.sources.cache_cli stats

# Clear all cache
python -m caspian.sources.cache_cli clear

# Clear specific source
python -m caspian.sources.cache_cli clear ultimate_guitar
```

### Statistics Output

```
OVERVIEW
Total entries:     123
Total size:        4.5 MB
Average size:      36.6 KB

BY SOURCE
ultimate_guitar         89 entries      3.2 MB
tab4u                   34 entries      1.3 MB

RUNTIME STATISTICS
Hits:              456
Misses:            123
Hit rate:          78.7%
Evictions:         12

HIT RATE BY SOURCE
ultimate_guitar     78.9%  (300 hits, 80 misses)
tab4u              78.4%  (156 hits, 43 misses)
```

## Cache Invalidation

### Automatic

1. **TTL Expiration** - Entries expire based on source-specific TTL
2. **Corrupted Files** - Malformed JSON is automatically removed
3. **Eviction** - Expired entries deleted on access

### Manual

1. **User Refresh** - UI "Refresh" button bypasses cache
2. **Admin Clear** - API endpoint or CLI tool
3. **Source Updates** - Rare, but can manually clear

## Monitoring

### Key Metrics

- **Hit Rate** - Percentage of requests served from cache
- **Entry Count** - Total cached entries by source
- **Total Size** - Disk space usage
- **Access Patterns** - Most frequently accessed entries
- **Eviction Rate** - How often entries expire

### Target Metrics

- **Hit Rate**: >75% (good cache effectiveness)
- **Average Size**: 30-50 KB per entry (Hebrew + English chord sheets)
- **Eviction Rate**: <5% (most entries accessed before expiration)

## Error Handling

### Corrupted Cache Files

- **Detection**: JSON parse failure or schema validation error
- **Action**: Delete file, treat as cache miss
- **Logging**: Log corruption event for monitoring
- **Impact**: Graceful degradation - fetch from source

### Disk Full

- **Detection**: Write error during cache.set()
- **Action**: Log warning, continue without caching
- **Fallback**: All requests go directly to source
- **Impact**: Performance degradation but no failures

### Race Conditions

- **Atomic Writes**: Write to temp file, then rename
- **Concurrency**: Accept potential redundant fetches
- **Consistency**: Last-write-wins for updates
- **Impact**: Minimal - cache remains consistent

## Best Practices

### For Developers

1. **Always check cache first** before fetching from source
2. **Respect rate limits** even when cache hits
3. **Handle cache misses gracefully** - never fail on cache error
4. **Log cache statistics** periodically for monitoring
5. **Clear cache judiciously** - it saves API quota

### For Users

1. **Refresh sparingly** - cache is there for a reason
2. **Clear cache if stale** - but usually automatic expiration works
3. **User corrections persist** - your edits won't disappear

### For System Admins

1. **Monitor disk usage** - cache can grow large
2. **Check hit rates** - low rates indicate cache issues
3. **Review eviction rates** - high rates suggest TTL too short
4. **Clear cache on upgrades** if schema changes

## Performance Impact

### Benefits

- **Reduced API calls**: 75%+ reduction in external requests
- **Faster response**: ~100ms cache hit vs ~1-2s source fetch
- **Quota preservation**: Stay within API rate limits
- **Offline capability**: Cached content accessible without internet

### Costs

- **Disk space**: ~30-50 KB per entry, ~5 MB per 100 entries
- **Staleness**: Content may be slightly outdated (within TTL window)
- **Complexity**: Additional code to maintain

### Trade-offs

The cache dramatically improves performance and reduces API load at the cost of minimal disk space and occasional stale content. The TTL strategy balances freshness with efficiency.

## Future Enhancements (Phase 3+)

1. **LRU Eviction** - Implement max cache size with least-recently-used eviction
2. **Compression** - gzip large chord sheets to save disk space
3. **Tiered Storage** - Hot cache in memory, cold cache on disk
4. **Scheduled Warming** - Background jobs for popular songs
5. **Analytics** - Track popularity for smarter caching
6. **Distributed Cache** - Redis for multi-instance deployments
7. **Versioning** - Cache schema versioning for safe upgrades

## Testing

Comprehensive test coverage (27 tests):

- ✓ CacheEntry creation and serialization
- ✓ TTL and expiration handling
- ✓ Access tracking and statistics
- ✓ Multi-source support
- ✓ Corrupted cache handling
- ✓ Hit/miss rate calculation
- ✓ Index updates
- ✓ Size calculations

All tests pass consistently.

## Summary

Caspian's caching layer provides:

1. **Intelligent TTLs** tuned per source
2. **Comprehensive statistics** for monitoring
3. **Management tools** (API + CLI)
4. **Cache warming** for popular content
5. **Graceful degradation** on errors
6. **Atomic operations** for consistency
7. **Extensive testing** for reliability

The cache is production-ready and forms a solid foundation for Phase 2's source integration work.
