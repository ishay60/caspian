/** Transposition utilities for chord symbols and pitch classes. */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/**
 * Map from note name (including flats) to pitch class (0-11).
 * Flats are mapped to their sharp enharmonic equivalents.
 */
const NAME_TO_PITCH: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1,
  'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4,
  'F': 5, 'E#': 5, 'F#': 6, 'Gb': 6,
  'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11,
};

/** Get the note name for a pitch class (0-11). Always returns sharp notation. */
export function pitchToName(pitch: number): string {
  return NOTE_NAMES[((pitch % 12) + 12) % 12];
}

/** Transpose a pitch class by N semitones, wrapping within 0-11. */
export function transposePitch(pitch: number, semitones: number): number {
  return ((pitch + semitones) % 12 + 12) % 12;
}

/**
 * Parse the root note from a chord symbol.
 * Returns [rootName, rootPitch, remainder] where remainder is everything after the root.
 *
 * Examples:
 *   'Am'     -> ['A', 9, 'm']
 *   'C#dim'  -> ['C#', 1, 'dim']
 *   'Bbmaj7' -> ['Bb', 10, 'maj7']
 *   'Am/E'   -> ['A', 9, 'm/E']
 */
export function parseChordRoot(symbol: string): [string, number, string] {
  if (symbol.length === 0) {
    return ['C', 0, ''];
  }

  // The root is a letter (A-G) optionally followed by # or b
  const letter = symbol[0].toUpperCase();
  let rootName = letter;
  let rest = symbol.slice(1);

  if (rest.length > 0 && (rest[0] === '#' || rest[0] === 'b')) {
    rootName += rest[0];
    rest = rest.slice(1);
  }

  const pitch = NAME_TO_PITCH[rootName];
  if (pitch === undefined) {
    // Fallback: treat as C if unrecognized
    return ['C', 0, symbol];
  }

  return [rootName, pitch, rest];
}

/**
 * Transpose a chord symbol by N semitones.
 * Handles simple chords, sharps, flats (converted to sharps), slash chords, and extensions.
 *
 * Examples:
 *   transposeChordSymbol('Am', 2)     -> 'Bm'
 *   transposeChordSymbol('D#dim', -2) -> 'C#dim'
 *   transposeChordSymbol('Am/E', 3)   -> 'Cm/G'
 *   transposeChordSymbol('Bbmaj7', 1) -> 'Bmaj7'
 *   transposeChordSymbol('A/C#', 2)   -> 'B/D#'
 */
export function transposeChordSymbol(symbol: string, semitones: number): string {
  if (semitones === 0) return normalizeChordSymbol(symbol);

  const [_rootName, rootPitch, remainder] = parseChordRoot(symbol);

  const newRootPitch = transposePitch(rootPitch, semitones);
  const newRootName = pitchToName(newRootPitch);

  // Check if there's a slash chord (bass note)
  const slashIndex = remainder.indexOf('/');
  if (slashIndex >= 0) {
    const quality = remainder.slice(0, slashIndex);
    const bassStr = remainder.slice(slashIndex + 1);

    // Parse and transpose the bass note
    const [_bassName, bassPitch, bassRemainder] = parseChordRoot(bassStr);
    const newBassPitch = transposePitch(bassPitch, semitones);
    const newBassName = pitchToName(newBassPitch);

    return `${newRootName}${quality}/${newBassName}${bassRemainder}`;
  }

  return `${newRootName}${remainder}`;
}

/**
 * Normalize a chord symbol by converting flat notation to sharp notation.
 * This is applied when semitones = 0 in transposeChordSymbol.
 */
function normalizeChordSymbol(symbol: string): string {
  const [rootName, rootPitch, remainder] = parseChordRoot(symbol);

  const normalizedRoot = pitchToName(rootPitch);

  // Check for slash chord
  const slashIndex = remainder.indexOf('/');
  if (slashIndex >= 0) {
    const quality = remainder.slice(0, slashIndex);
    const bassStr = remainder.slice(slashIndex + 1);
    const [_bassName, bassPitch, bassRemainder] = parseChordRoot(bassStr);
    const normalizedBass = pitchToName(bassPitch);
    return `${normalizedRoot}${quality}/${normalizedBass}${bassRemainder}`;
  }

  // If root was already in sharp form, return as-is to preserve exact input
  if (normalizedRoot === rootName) return symbol;

  return `${normalizedRoot}${remainder}`;
}

/**
 * Calculate the capo fret position given original and new root pitch classes.
 * Returns 0 (no capo) through 11.
 *
 * The idea: if you place a capo at fret N and play the original chord shapes,
 * the sounding pitch is N semitones higher.
 */
export function capoFret(originalRoot: number, newRoot: number): number {
  return ((newRoot - originalRoot) % 12 + 12) % 12;
}
