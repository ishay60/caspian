import { useState, useEffect, useMemo, useRef } from 'react';
import type { SearchResult, AnalysisResult } from '../types';
import { searchSongs, fetchSheet } from '../api';
import './SongSearch.css';

interface SongSearchProps {
  onSongSelected?: (analysis: AnalysisResult) => void;
}

export function SongSearch({ onSongSelected }: SongSearchProps) {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<'all' | 'ug' | 'tab4u'>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingSheet, setFetchingSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'quality' | 'recent'>('quality');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await searchSongs(query, source);
      setResults(response.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    if (value.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch();
      }, 500);
    } else {
      setResults([]);
    }
  };

  const handleSelectResult = async (result: SearchResult) => {
    setFetchingSheet(true);
    setError(null);

    try {
      const analysis = await fetchSheet(result.url);

      if (onSongSelected) {
        onSongSelected(analysis);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chord sheet. Please try again.');
    } finally {
      setFetchingSheet(false);
    }
  };

  const sortedResults = useMemo(() => {
    const sorted = [...results];

    if (sortBy === 'quality') {
      sorted.sort((a, b) => {
        const scoreA = a.rating * Math.log(a.rating_count + 1);
        const scoreB = b.rating * Math.log(b.rating_count + 1);
        return scoreB - scoreA;
      });
    }

    return sorted;
  }, [results, sortBy]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="song-search">
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search for songs..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          disabled={fetchingSheet}
        />

        <select
          value={source}
          onChange={(e) => setSource(e.target.value as 'all' | 'ug' | 'tab4u')}
          disabled={fetchingSheet}
        >
          <option value="all">All Sources</option>
          <option value="ug">Ultimate Guitar</option>
          <option value="tab4u">Tab4u (Hebrew)</option>
        </select>

        <button onClick={handleSearch} disabled={loading || fetchingSheet || !query.trim()}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠</span>
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {loading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Searching chord sheets...</p>
        </div>
      )}

      {fetchingSheet && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Fetching and analyzing chord sheet...</p>
        </div>
      )}

      {!loading && sortedResults.length > 0 && (
        <>
          <div className="results-header">
            <p className="results-count">
              Found {sortedResults.length} result{sortedResults.length !== 1 ? 's' : ''}
            </p>
            <div className="sort-controls">
              <label>Sort by:</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'quality' | 'recent')}>
                <option value="quality">Quality Score</option>
                <option value="recent">Recent</option>
              </select>
            </div>
          </div>

          <div className="search-results">
            {sortedResults.map((result, index) => (
              <SearchResultItem
                key={`${result.source}-${result.url}-${index}`}
                result={result}
                onSelect={handleSelectResult}
                loading={fetchingSheet}
              />
            ))}
          </div>
        </>
      )}

      {!loading && !error && query && sortedResults.length === 0 && (
        <div className="no-results">
          <p>No results found for "{query}"</p>
          <p className="no-results-hint">Try a different search term or source</p>
        </div>
      )}
    </div>
  );
}

interface SearchResultItemProps {
  result: SearchResult;
  onSelect: (result: SearchResult) => void;
  loading: boolean;
}

function SearchResultItem({ result, onSelect, loading }: SearchResultItemProps) {
  const sourceBadge = result.source === 'ultimate_guitar' ? 'UG' : 'T4U';
  const sourceBadgeColor = result.source === 'ultimate_guitar' ? 'blue' : 'green';

  return (
    <div
      className="search-result-item"
      onClick={() => !loading && onSelect(result)}
      style={{ cursor: loading ? 'wait' : 'pointer' }}
    >
      <div className="result-header">
        <h3>{result.title}</h3>
        <span className={`source-badge ${sourceBadgeColor}`}>
          {sourceBadge}
        </span>
      </div>

      <p className="artist">{result.artist}</p>

      {result.rating > 0 && (
        <div className="rating">
          <span className="stars">{'★'.repeat(Math.round(result.rating))}</span>
          <span className="rating-value">
            {result.rating.toFixed(1)} ({result.rating_count} votes)
          </span>
        </div>
      )}
    </div>
  );
}
