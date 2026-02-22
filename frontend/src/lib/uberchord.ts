/**
 * Uberchord API client for fetching real guitar chord voicings.
 * Uses the backend proxy at /api/uberchord/ to avoid CORS issues.
 */

export interface UberchordVoicing {
  /** Fret per string: null = muted, 0 = open, 1+ = fret number */
  frets: (number | null)[];
  /** Finger per string: null = not played, 0 = open */
  fingering: (number | null)[];
  /** Chord name as returned by Uberchord */
  chordName: string;
  /** Tones in the chord (e.g. "C,E,G") */
  tones: string;
}

/** In-memory cache keyed by normalized chord symbol. */
const cache = new Map<string, UberchordVoicing[]>();

/** Pending fetches to deduplicate concurrent requests. */
const pending = new Map<string, Promise<UberchordVoicing[]>>();

/** Strip bass note from slash chord: "Am/G" → "Am" */
function baseChordName(symbol: string): string {
  const slashIdx = symbol.indexOf('/');
  if (slashIdx < 0) return symbol;
  // Make sure it's a bass note slash (after the chord), not part of the name
  const after = symbol.slice(slashIdx + 1);
  if (/^[A-G][#b]?$/.test(after)) {
    return symbol.slice(0, slashIdx);
  }
  return symbol;
}

/** Parse Uberchord "strings" field: "X 0 2 2 1 0" → [null, 0, 2, 2, 1, 0] */
function parseStrings(s: string): (number | null)[] {
  return s.split(' ').map(v => v === 'X' ? null : parseInt(v, 10));
}

/** Parse Uberchord "fingering" field: "X X 2 3 1 X" → [null, null, 2, 3, 1, null] */
function parseFingering(s: string): (number | null)[] {
  return s.split(' ').map(v => v === 'X' ? null : parseInt(v, 10));
}

/**
 * Fetch guitar voicings for a chord symbol from the Uberchord API.
 * Returns an array of voicings (may be empty if the chord is not found).
 * Results are cached in memory.
 */
export async function fetchUberchordVoicings(symbol: string): Promise<UberchordVoicing[]> {
  const name = baseChordName(symbol);
  if (!name) return [];

  // Check cache
  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  // Deduplicate concurrent requests
  const inflight = pending.get(name);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const resp = await fetch(`/api/uberchord/${encodeURIComponent(name)}`);
      if (!resp.ok) return [];

      const data = await resp.json();
      if (!Array.isArray(data) || data.length === 0) {
        cache.set(name, []);
        return [];
      }

      const voicings: UberchordVoicing[] = data
        .filter((item: Record<string, string>) => item.strings && item.strings !== 'X X X X X X')
        .map((item: Record<string, string>) => ({
          frets: parseStrings(item.strings),
          fingering: item.fingering ? parseFingering(item.fingering) : parseStrings(item.strings),
          chordName: item.chordName || name,
          tones: item.tones || '',
        }));

      cache.set(name, voicings);
      return voicings;
    } catch {
      cache.set(name, []);
      return [];
    } finally {
      pending.delete(name);
    }
  })();

  pending.set(name, promise);
  return promise;
}
