import type { SavedSong } from './songLibrary';

/** Active filter flags for harmonic features. */
export interface FeatureFilters {
  secondaryDominants: boolean;
  borrowedChords: boolean;
  deceptiveResolution: boolean;
  diminished: boolean;
}

export const emptyFilters: FeatureFilters = {
  secondaryDominants: false,
  borrowedChords: false,
  deceptiveResolution: false,
  diminished: false,
};

/**
 * Search and filter saved songs.
 *
 * @param songs - All saved songs
 * @param query - Free-text search (matches title, artist, chord symbols, roman numerals)
 * @param filters - Feature filter toggles (only active filters are applied)
 * @returns Filtered and ranked song list
 */
export function searchSongs(
  songs: SavedSong[],
  query: string,
  filters: FeatureFilters,
): SavedSong[] {
  const hasAnyFilter =
    filters.secondaryDominants ||
    filters.borrowedChords ||
    filters.deceptiveResolution ||
    filters.diminished;

  const q = query.trim().toLowerCase();

  return songs.filter((song) => {
    // Text search
    if (q) {
      const meta = song.analysisMetadata;
      const haystack = [
        song.title,
        song.artist,
        song.keyRoot,
        song.keyMode,
        ...(meta?.chordSymbols ?? []),
        ...(meta?.romanNumerals ?? []),
        ...(meta?.progressions ?? []),
      ]
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(q)) return false;
    }

    // Feature filters — all active filters must match (AND logic)
    if (hasAnyFilter) {
      const meta = song.analysisMetadata;
      if (!meta) return false;

      if (filters.secondaryDominants && !meta.hasSecondaryDominants) return false;
      if (filters.borrowedChords && !meta.hasBorrowedChords) return false;
      if (filters.deceptiveResolution && !meta.hasDeceptiveResolution) return false;
      if (filters.diminished && !meta.hasDiminished) return false;
    }

    return true;
  });
}
