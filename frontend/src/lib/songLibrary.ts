import type { AnalysisResult } from '../types';

/** Indexed analysis metadata stored alongside each saved song for search/filtering. */
export interface SongAnalysisMetadata {
  /** All unique chord symbols used across all sections. */
  chordSymbols: string[];
  /** All unique Roman numerals used across all sections. */
  romanNumerals: string[];
  /** Section names (e.g., "intro", "verse", "chorus"). */
  sectionNames: string[];
  /** Chord progressions per section as space-separated symbol strings. */
  progressions: string[];
  /** Whether any chord has a secondary dominant interpretation. */
  hasSecondaryDominants: boolean;
  /** Whether any chord is borrowed from a parallel mode. */
  hasBorrowedChords: boolean;
  /** Whether any chord triggers a deceptive resolution. */
  hasDeceptiveResolution: boolean;
  /** Whether any diminished chord appears. */
  hasDiminished: boolean;
}

export interface SavedSong {
  id: string;
  title: string;
  artist: string;
  keyRoot: string;
  keyMode: string;
  inputText: string;
  savedAt: number;
  lastOpenedAt: number;
  /** Analysis metadata for search/filter — absent on legacy entries. */
  analysisMetadata?: SongAnalysisMetadata;
}

const STORAGE_KEY = 'caspian-songs';

function readAll(): SavedSong[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedSong[];
  } catch {
    return [];
  }
}

function writeAll(songs: SavedSong[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Extract searchable metadata from an AnalysisResult. */
export function extractMetadata(result: AnalysisResult): SongAnalysisMetadata {
  const chordSymbols = new Set<string>();
  const romanNumerals = new Set<string>();
  const sectionNames: string[] = [];
  const progressions: string[] = [];
  let hasSecondaryDominants = false;
  let hasBorrowedChords = false;
  let hasDeceptiveResolution = false;
  let hasDiminished = false;

  for (const section of result.sections) {
    sectionNames.push(section.name);
    const sectionChords: string[] = [];

    for (const chord of section.chords) {
      chordSymbols.add(chord.symbol);
      romanNumerals.add(chord.roman_numeral);
      sectionChords.push(chord.symbol);

      if (chord.secondary_dominant) hasSecondaryDominants = true;
      if (chord.deceptive_resolution) hasDeceptiveResolution = true;

      const q = chord.quality.toLowerCase();
      if (q.includes('diminished') || q.includes('half_diminished')) hasDiminished = true;

      // Check for borrowed chord interpretation
      for (const interp of chord.interpretations) {
        if (interp.type === 'borrowed') hasBorrowedChords = true;
      }
      // Also: non-diatonic + has diatonic_in_scales entries → borrowed
      if (!chord.is_diatonic && chord.diatonic_in_scales.length > 0) {
        hasBorrowedChords = true;
      }
    }

    if (sectionChords.length > 0) {
      progressions.push(sectionChords.join(' '));
    }
  }

  return {
    chordSymbols: [...chordSymbols],
    romanNumerals: [...romanNumerals],
    sectionNames,
    progressions,
    hasSecondaryDominants,
    hasBorrowedChords,
    hasDeceptiveResolution,
    hasDiminished,
  };
}

/** Save a song to the library. Returns the newly created SavedSong. */
export function saveSong(
  song: Omit<SavedSong, 'id' | 'savedAt' | 'lastOpenedAt'>,
): SavedSong {
  const songs = readAll();
  const now = Date.now();
  const newSong: SavedSong = {
    ...song,
    id: generateId(),
    savedAt: now,
    lastOpenedAt: now,
  };
  songs.push(newSong);
  writeAll(songs);
  return newSong;
}

/** Get all saved songs, sorted by lastOpenedAt descending (most recent first). */
export function getSongs(): SavedSong[] {
  const songs = readAll();
  return songs.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

/** Get a single song by ID, or null if not found. */
export function getSong(id: string): SavedSong | null {
  const songs = readAll();
  return songs.find((s) => s.id === id) ?? null;
}

/** Delete a song from the library by ID. */
export function deleteSong(id: string): void {
  const songs = readAll();
  writeAll(songs.filter((s) => s.id !== id));
}

/** Update a song's lastOpenedAt timestamp to now. */
export function touchSong(id: string): void {
  const songs = readAll();
  const song = songs.find((s) => s.id === id);
  if (song) {
    song.lastOpenedAt = Date.now();
    writeAll(songs);
  }
}

/** Check if a song with the same title+artist already exists. */
export function findExisting(title: string, artist: string): SavedSong | null {
  const songs = readAll();
  return (
    songs.find(
      (s) =>
        s.title.trim().toLowerCase() === title.trim().toLowerCase() &&
        s.artist.trim().toLowerCase() === artist.trim().toLowerCase(),
    ) ?? null
  );
}
