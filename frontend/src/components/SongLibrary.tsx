import { useState, useEffect, useCallback } from 'react';
import type { AnalysisResult } from '../types';
import { useSettings } from '../lib/settingsContext';
import {
  getSongs,
  saveSong,
  deleteSong,
  touchSong,
  findExisting,
  extractMetadata,
  type SavedSong,
  type SongAnalysisMetadata,
} from '../lib/songLibrary';
import { searchSongs, emptyFilters, type FeatureFilters } from '../lib/songSearch';
import {
  listCloudSongs,
  createCloudSong,
  deleteCloudSong,
  touchCloudSong,
  type CloudSong,
  type SaveSongPayload,
} from '../api';

interface Props {
  onLoadSong: (inputText: string) => void;
  currentTitle?: string;
  currentArtist?: string;
  currentInputText?: string;
  /** Current analysis result — used to save richer metadata. */
  currentAnalysis?: AnalysisResult | null;
}

/** Map a CloudSong (snake_case API response) to SavedSong (camelCase frontend type). */
function cloudToSaved(cs: CloudSong): SavedSong {
  const am = cs.analysis_metadata;
  let analysisMetadata: SongAnalysisMetadata | undefined;
  if (am) {
    analysisMetadata = {
      chordSymbols: (am.chord_symbols as string[]) ?? [],
      romanNumerals: (am.roman_numerals as string[]) ?? [],
      sectionNames: (am.section_names as string[]) ?? [],
      progressions: (am.progressions as string[]) ?? [],
      hasSecondaryDominants: (am.has_secondary_dominants as boolean) ?? false,
      hasBorrowedChords: (am.has_borrowed_chords as boolean) ?? false,
      hasDeceptiveResolution: (am.has_deceptive_resolution as boolean) ?? false,
      hasDiminished: (am.has_diminished as boolean) ?? false,
    };
  }
  return {
    id: cs.id,
    title: cs.title,
    artist: cs.artist,
    keyRoot: cs.key_root,
    keyMode: cs.key_mode,
    inputText: cs.input_text,
    savedAt: new Date(cs.created_at).getTime(),
    lastOpenedAt: new Date(cs.last_opened_at).getTime(),
    analysisMetadata,
  };
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function SongLibrary({
  onLoadSong,
  currentTitle,
  currentArtist,
  currentInputText,
  currentAnalysis,
}: Props) {
  const { t } = useSettings();
  const [open, setOpen] = useState(false);
  const [songs, setSongs] = useState<SavedSong[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FeatureFilters>(emptyFilters);

  const refresh = useCallback(async () => {
    try {
      const cloud = await listCloudSongs();
      setSongs(cloud.map(cloudToSaved));
    } catch {
      // Cloud unavailable — fall back to localStorage
      setSongs(getSongs());
    }
  }, []);

  // Refresh the song list whenever the panel is opened
  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const hasCurrentSong =
    currentTitle && currentArtist && currentInputText;

  async function handleSave() {
    if (!currentTitle || !currentArtist || !currentInputText) return;

    // Parse key from the input text (look for "key: Xm" or "key: X" line)
    let keyRoot = '';
    let keyMode = '';
    const keyMatch = currentInputText.match(
      /^key:\s*([A-Ga-g][#b]?)\s*(.*)/m,
    );
    if (keyMatch) {
      keyRoot = keyMatch[1];
      const modeRaw = keyMatch[2].trim().toLowerCase();
      if (
        modeRaw === 'm' ||
        modeRaw === 'minor' ||
        modeRaw === 'natural_minor' ||
        modeRaw === ''
      ) {
        const fullKeyMatch = currentInputText.match(
          /^key:\s*([A-Ga-g][#b]?m?)/m,
        );
        if (fullKeyMatch && fullKeyMatch[1].endsWith('m')) {
          keyMode = 'natural_minor';
        } else if (modeRaw) {
          keyMode = modeRaw;
        } else {
          keyMode = 'major';
        }
      } else {
        keyMode = modeRaw || 'major';
      }
    }

    // Extract analysis metadata if we have a current analysis result
    const meta = currentAnalysis
      ? extractMetadata(currentAnalysis)
      : undefined;

    const payload: SaveSongPayload = {
      title: currentTitle,
      artist: currentArtist,
      key_root: keyRoot,
      key_mode: keyMode,
      input_text: currentInputText,
      analysis_metadata: meta
        ? {
            chord_symbols: meta.chordSymbols,
            roman_numerals: meta.romanNumerals,
            section_names: meta.sectionNames,
            progressions: meta.progressions,
            has_secondary_dominants: meta.hasSecondaryDominants,
            has_borrowed_chords: meta.hasBorrowedChords,
            has_deceptive_resolution: meta.hasDeceptiveResolution,
            has_diminished: meta.hasDiminished,
          }
        : undefined,
    };

    try {
      await createCloudSong(payload);
    } catch {
      // Cloud unavailable — save to localStorage as fallback
      const existing = findExisting(currentTitle, currentArtist);
      if (existing) deleteSong(existing.id);
      saveSong({
        title: currentTitle,
        artist: currentArtist,
        keyRoot,
        keyMode,
        inputText: currentInputText,
        analysisMetadata: meta,
      });
    }

    refresh();
  }

  function handleLoad(song: SavedSong) {
    // Touch cloud (fire-and-forget), fall back to local
    touchCloudSong(song.id).catch(() => touchSong(song.id));
    onLoadSong(song.inputText);
    setOpen(false);
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId === id) {
      try {
        await deleteCloudSong(id);
      } catch {
        // Cloud unavailable — delete locally
        deleteSong(id);
      }
      setConfirmDeleteId(null);
      refresh();
    } else {
      setConfirmDeleteId(id);
    }
  }

  function toggleFilter(key: keyof FeatureFilters) {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const hasActiveFilters = query.trim() !== '' ||
    filters.secondaryDominants || filters.borrowedChords ||
    filters.deceptiveResolution || filters.diminished;

  const displaySongs = hasActiveFilters
    ? searchSongs(songs, query, filters)
    : songs;

  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs px-3.5 py-2 rounded-xl border font-medium transition-all cursor-pointer flex items-center gap-2"
        style={{
          backgroundColor: open
            ? 'var(--color-accent)'
            : 'var(--color-surface-2)',
          borderColor: open ? 'var(--color-accent)' : 'var(--color-border)',
          color: open ? '#fff' : 'var(--color-neutral)',
        }}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 19V5a2 2 0 012-2h10a2 2 0 012 2v14l-7-3.5L5 19z"
          />
        </svg>
        {t.library}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-96 rounded-2xl border z-50 overflow-hidden"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {/* Panel header */}
          <div
            className="px-4 py-3.5 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: 'var(--color-text)' }}
            >
              {t.savedSongs}
            </span>
            {hasCurrentSong && (
              <button
                type="button"
                onClick={handleSave}
                className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: '#fff',
                }}
              >
                {t.saveCurrent}
              </button>
            )}
          </div>

          {/* Search & filters */}
          {songs.length > 0 && (
            <div className="px-4 py-2.5 border-b space-y-2" style={{ borderColor: 'var(--color-border)' }}>
              {/* Search input */}
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  style={{ color: 'var(--color-neutral)' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border outline-none transition-colors"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                />
              </div>

              {/* Feature filter chips */}
              <div className="flex flex-wrap gap-1.5">
                {([
                  ['secondaryDominants', t.filterSecDom, '--color-secondary-dom'],
                  ['borrowedChords', t.filterBorrowed, '--color-borrowed'],
                  ['deceptiveResolution', t.filterDeceptive, '--color-deceptive'],
                  ['diminished', t.filterDim, '--color-diminished'],
                ] as [keyof FeatureFilters, string, string][]).map(([key, label, colorVar]) => {
                  const active = filters[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleFilter(key)}
                      className="text-[10px] px-2 py-0.5 rounded-full border cursor-pointer transition-all"
                      style={{
                        borderColor: active ? `var(${colorVar})` : 'var(--color-border)',
                        backgroundColor: active
                          ? `color-mix(in srgb, var(${colorVar}) 20%, transparent)`
                          : 'transparent',
                        color: active ? `var(${colorVar})` : 'var(--color-neutral)',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Song list */}
          <div className="max-h-80 overflow-y-auto">
            {songs.length === 0 ? (
              <div
                className="px-4 py-8 text-center text-sm"
                style={{ color: 'var(--color-neutral)' }}
              >
                <svg
                  className="w-8 h-8 mx-auto mb-2 opacity-40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
                {t.noSavedSongs}
                <br />
                {t.analyzeSave}
              </div>
            ) : displaySongs.length === 0 ? (
              <div
                className="px-4 py-6 text-center text-xs"
                style={{ color: 'var(--color-neutral)' }}
              >
                {t.noResults}
              </div>
            ) : (
              displaySongs.map((song) => (
                <div
                  key={song.id}
                  className="group border-b last:border-b-0 transition-colors"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div
                    className="flex items-start gap-2 px-4 py-2.5 cursor-pointer hover:brightness-125 transition-all"
                    style={{ backgroundColor: 'var(--color-surface)' }}
                    onClick={() => handleLoad(song)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleLoad(song);
                    }}
                  >
                    {/* Song info */}
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm font-medium truncate"
                        dir="auto"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {song.title}
                      </div>
                      <div
                        className="text-xs truncate"
                        dir="auto"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {song.artist}
                      </div>
                      <div
                        className="text-xs mt-0.5 flex items-center gap-2"
                        style={{ color: 'var(--color-neutral)' }}
                      >
                        {song.keyRoot && (
                          <span>
                            {song.keyRoot}
                            {song.keyMode === 'natural_minor' ? 'm' : ''}
                          </span>
                        )}
                        <span>{timeAgo(song.savedAt)}</span>
                      </div>
                      {/* Chord & feature tags */}
                      {song.analysisMetadata && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {song.analysisMetadata.chordSymbols.slice(0, 6).map(cs => (
                            <span
                              key={cs}
                              className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                              style={{
                                backgroundColor: 'var(--color-surface-2)',
                                color: 'var(--color-text-secondary)',
                              }}
                            >
                              {cs}
                            </span>
                          ))}
                          {song.analysisMetadata.chordSymbols.length > 6 && (
                            <span
                              className="text-[9px] px-1 py-0.5"
                              style={{ color: 'var(--color-neutral)' }}
                            >
                              +{song.analysisMetadata.chordSymbols.length - 6}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(song.id);
                      }}
                      className="shrink-0 mt-1 p-1 rounded transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                      style={{
                        color:
                          confirmDeleteId === song.id
                            ? '#ef4444'
                            : 'var(--color-neutral)',
                      }}
                      title={
                        confirmDeleteId === song.id
                          ? 'Click again to confirm'
                          : 'Delete song'
                      }
                    >
                      {confirmDeleteId === song.id ? (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
