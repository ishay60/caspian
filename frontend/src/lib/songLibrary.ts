export interface SavedSong {
  id: string;
  title: string;
  artist: string;
  keyRoot: string;
  keyMode: string;
  inputText: string;
  savedAt: number;
  lastOpenedAt: number;
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
