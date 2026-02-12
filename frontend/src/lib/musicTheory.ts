/** Music theory utilities for pitch conversion and guitar voicing. */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Convert pitch class (0-11) to note name. */
export function pitchToNoteName(pitch: number): string {
  return NOTE_NAMES[((pitch % 12) + 12) % 12];
}

/** Convert pitch class to VexFlow key string (e.g. 0 → "c/4", 7 → "g/4"). */
export function pitchToVexFlowKey(pitch: number, octave = 4): string {
  const name = pitchToNoteName(pitch).toLowerCase().replace('#', '#');
  return `${name}/${octave}`;
}

/** Convert pitch class to MIDI note number. */
export function pitchToMidiNote(pitch: number, octave = 4): number {
  return 12 * (octave + 1) + ((pitch % 12) + 12) % 12;
}

/** Standard guitar tuning as MIDI note numbers: E2, A2, D3, G3, B3, E4. */
export const GUITAR_STANDARD_TUNING = [40, 45, 50, 55, 59, 64];

/**
 * Compute a basic guitar voicing for a set of pitch classes.
 * Returns an array of 6 fret numbers (one per string), or null for muted strings.
 * Prefers open/low-position voicings with root on lowest sounding string.
 */
export function getGuitarVoicing(pitches: number[], root: number): (number | null)[] {
  const pitchSet = new Set(pitches.map(p => ((p % 12) + 12) % 12));
  const rootPc = ((root % 12) + 12) % 12;
  const result: (number | null)[] = [null, null, null, null, null, null];

  // Find lowest string that can play the root within first 5 frets
  let rootStringIdx = -1;
  for (let s = 0; s < 6; s++) {
    const openPc = GUITAR_STANDARD_TUNING[s] % 12;
    for (let fret = 0; fret <= 5; fret++) {
      if ((openPc + fret) % 12 === rootPc) {
        rootStringIdx = s;
        result[s] = fret;
        break;
      }
    }
    if (rootStringIdx >= 0) break;
  }

  // If no root found in first 5 frets, try up to fret 12
  if (rootStringIdx < 0) {
    for (let s = 0; s < 6; s++) {
      const openPc = GUITAR_STANDARD_TUNING[s] % 12;
      for (let fret = 0; fret <= 12; fret++) {
        if ((openPc + fret) % 12 === rootPc) {
          rootStringIdx = s;
          result[s] = fret;
          break;
        }
      }
      if (rootStringIdx >= 0) break;
    }
  }

  if (rootStringIdx < 0) rootStringIdx = 0;

  // Determine base fret area from root position
  const baseFret = result[rootStringIdx] ?? 0;
  const minFret = Math.max(0, baseFret - 1);
  const maxFret = Math.max(5, baseFret + 4);

  // Fill remaining strings with chord tones
  for (let s = rootStringIdx + 1; s < 6; s++) {
    const openPc = GUITAR_STANDARD_TUNING[s] % 12;
    let bestFret: number | null = null;
    let bestDist = Infinity;

    for (let fret = minFret; fret <= maxFret; fret++) {
      const pc = (openPc + fret) % 12;
      if (pitchSet.has(pc)) {
        const dist = Math.abs(fret - baseFret);
        if (dist < bestDist) {
          bestDist = dist;
          bestFret = fret;
        }
      }
    }
    result[s] = bestFret;
  }

  // Mute strings below the root
  for (let s = 0; s < rootStringIdx; s++) {
    result[s] = null;
  }

  return result;
}
