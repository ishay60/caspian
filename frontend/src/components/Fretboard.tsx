/** Interactive full 22-fret guitar fretboard explorer. Pure SVG. */

import type { ReactElement } from 'react';

interface Props {
  scalePitches: number[];    // pitch classes (0-11) in the current scale
  chordPitches?: number[];   // pitch classes of the selected chord (optional)
  root: number;              // root pitch class of the key
  chordRoot?: number;        // root of the selected chord (optional)
  color?: string;            // chord accent color (default: --color-accent)
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Standard guitar tuning as MIDI note numbers: E2, A2, D3, G3, B3, E4 (low to high). */
const GUITAR_TUNING = [40, 45, 50, 55, 59, 64];

/** String labels from low E to high E. */
const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'E'];

/** Frets that get single dot markers. */
const SINGLE_DOT_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
/** Fret 12 gets a double dot. */
const DOUBLE_DOT_FRET = 12;

const TOTAL_FRETS = 22;
const NUM_STRINGS = 6;

/** Compute the pitch class (0-11) for a given string and fret. */
function getNotePc(string: number, fret: number): number {
  return (GUITAR_TUNING[string] + fret) % 12;
}

/** Read a CSS variable from :root, with fallback. */
function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function Fretboard({ scalePitches, chordPitches, root, chordRoot, color }: Props) {
  const accentColor = color || cssVar('--color-accent', '#6366f1');

  // Theme-aware colors
  const bg = cssVar('--color-bg', '#0a0e1a');
  const surface = cssVar('--color-surface', '#111827');
  const surface2 = cssVar('--color-surface-2', '#1e293b');
  const border = cssVar('--color-border', '#334155');
  const text = cssVar('--color-text', '#e2e8f0');
  const neutral = cssVar('--color-neutral', '#94a3b8');
  const staffLine = cssVar('--color-staff-line', '#475569');
  const diatonic = cssVar('--color-diatonic', '#22c55e');

  const rootPc = ((root % 12) + 12) % 12;
  const chordRootPc = chordRoot != null ? ((chordRoot % 12) + 12) % 12 : null;
  const scaleSet = new Set(scalePitches.map(p => ((p % 12) + 12) % 12));
  const chordSet = chordPitches ? new Set(chordPitches.map(p => ((p % 12) + 12) % 12)) : new Set<number>();

  // Layout dimensions
  const stringSpacing = 22;
  const leftPad = 36;       // space for string labels
  const topPad = 32;        // space for fret numbers
  const nutWidth = 4;
  const nutGap = 12;        // gap between nut and fret 1
  const openColWidth = 30;  // width of the open-string column (fret 0)
  const bottomPad = 28;     // space for fret markers

  // Fret spacing: use a mild taper from ~38px at fret 1 down to ~26px at fret 22
  const baseFretWidth = 38;
  const taperFactor = 0.025; // how quickly fret widths decrease

  /** Cumulative X offset for the left edge of each fret slot (1-indexed). */
  const fretX: number[] = [0]; // fretX[0] unused, fretX[f] = left edge of fret f region
  let cumulative = leftPad + openColWidth + nutWidth + nutGap;
  for (let f = 1; f <= TOTAL_FRETS; f++) {
    fretX.push(cumulative);
    const w = baseFretWidth * (1 - taperFactor * (f - 1));
    cumulative += w;
  }

  /** X coordinate of each fret wire (right edge of that fret slot). */
  const fretWireX: number[] = [0];
  for (let f = 1; f <= TOTAL_FRETS; f++) {
    const w = baseFretWidth * (1 - taperFactor * (f - 1));
    fretWireX.push(fretX[f] + w);
  }

  /** Center X within a fret slot. */
  function fretCenterX(fret: number): number {
    if (fret === 0) return leftPad + openColWidth / 2;
    const w = baseFretWidth * (1 - taperFactor * (fret - 1));
    return fretX[fret] + w / 2;
  }

  /** Y coordinate for a string (0 = lowest/thickest E, 5 = highest E). */
  function stringY(s: number): number {
    // We draw strings top-to-bottom from high E (index 5) to low E (index 0)
    // so that the visual layout matches a guitarist looking down at the neck.
    return topPad + (NUM_STRINGS - 1 - s) * stringSpacing;
  }

  const neckTop = topPad - stringSpacing * 0.4;
  const neckBottom = topPad + (NUM_STRINGS - 1) * stringSpacing + stringSpacing * 0.4;
  const neckHeight = neckBottom - neckTop;
  const totalWidth = cumulative + 12;
  const totalHeight = neckBottom + bottomPad;

  // Build SVG elements
  const elements: ReactElement[] = [];

  // --- Neck background (rosewood-like surface) ---
  elements.push(
    <rect
      key="neck-bg"
      x={leftPad + openColWidth + nutWidth}
      y={neckTop}
      width={cumulative - (leftPad + openColWidth + nutWidth)}
      height={neckHeight}
      rx={3}
      fill={surface}
    />
  );

  // --- Open string area background ---
  elements.push(
    <rect
      key="open-bg"
      x={leftPad}
      y={neckTop}
      width={openColWidth}
      height={neckHeight}
      rx={3}
      fill={surface2}
    />
  );

  // --- Nut ---
  elements.push(
    <rect
      key="nut"
      x={leftPad + openColWidth}
      y={neckTop}
      width={nutWidth}
      height={neckHeight}
      rx={1}
      fill={neutral}
    />
  );

  // --- Fret wires ---
  for (let f = 1; f <= TOTAL_FRETS; f++) {
    const x = fretWireX[f];
    elements.push(
      <line
        key={`fw-${f}`}
        x1={x} y1={neckTop}
        x2={x} y2={neckBottom}
        stroke={staffLine}
        strokeWidth={1.2}
        strokeOpacity={0.6}
      />
    );
  }

  // --- Fret numbers along the top ---
  for (let f = 1; f <= TOTAL_FRETS; f++) {
    const cx = fretCenterX(f);
    elements.push(
      <text
        key={`fn-${f}`}
        x={cx}
        y={neckTop - 8}
        textAnchor="middle"
        fill={neutral}
        fontSize="9"
        fontFamily="IBM Plex Mono, monospace"
      >
        {f}
      </text>
    );
  }

  // --- Fret markers (dots) below the neck ---
  const markerY = neckBottom + 14;
  for (const f of SINGLE_DOT_FRETS) {
    if (f > TOTAL_FRETS) continue;
    const cx = fretCenterX(f);
    elements.push(
      <circle
        key={`dot-${f}`}
        cx={cx}
        cy={markerY}
        r={3}
        fill={staffLine}
        fillOpacity={0.5}
      />
    );
  }
  // Double dot at fret 12
  {
    const cx = fretCenterX(DOUBLE_DOT_FRET);
    elements.push(
      <circle
        key="dot-12a"
        cx={cx}
        cy={markerY - 5}
        r={3}
        fill={staffLine}
        fillOpacity={0.5}
      />
    );
    elements.push(
      <circle
        key="dot-12b"
        cx={cx}
        cy={markerY + 5}
        r={3}
        fill={staffLine}
        fillOpacity={0.5}
      />
    );
  }

  // --- Strings ---
  const stringWeights = [2.0, 1.7, 1.4, 1.1, 0.9, 0.7]; // thickness low E to high E
  for (let s = 0; s < NUM_STRINGS; s++) {
    const y = stringY(s);
    elements.push(
      <line
        key={`str-${s}`}
        x1={leftPad}
        y1={y}
        x2={cumulative}
        y2={y}
        stroke={staffLine}
        strokeWidth={stringWeights[s]}
        strokeOpacity={0.7}
      />
    );
  }

  // --- String labels on the left ---
  for (let s = 0; s < NUM_STRINGS; s++) {
    const y = stringY(s);
    elements.push(
      <text
        key={`sl-${s}`}
        x={leftPad - 10}
        y={y + 4}
        textAnchor="middle"
        fill={neutral}
        fontSize="11"
        fontWeight="600"
        fontFamily="IBM Plex Mono, monospace"
      >
        {STRING_LABELS[s]}
      </text>
    );
  }

  // --- Notes on the fretboard ---
  for (let s = 0; s < NUM_STRINGS; s++) {
    for (let f = 0; f <= TOTAL_FRETS; f++) {
      const pc = getNotePc(s, f);
      const isScale = scaleSet.has(pc);
      const isChord = chordSet.has(pc);
      const isRoot = pc === rootPc;
      const isChordRoot = chordRootPc != null && pc === chordRootPc;

      // Skip non-scale, non-chord tones
      if (!isScale && !isChord) continue;

      const cx = fretCenterX(f);
      const cy = stringY(s);
      const noteName = NOTE_NAMES[pc];

      if (isChord) {
        // Chord tones: larger filled circles with accent color
        const r = isChordRoot ? 9 : 8;

        if (isRoot) {
          // Key root that is also a chord tone: diamond shape
          const d = r + 1;
          elements.push(
            <polygon
              key={`diamond-${s}-${f}`}
              points={`${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}`}
              fill={accentColor}
              stroke={text}
              strokeWidth={1.5}
            />
          );
        } else {
          elements.push(
            <circle
              key={`cn-${s}-${f}`}
              cx={cx}
              cy={cy}
              r={r}
              fill={accentColor}
              stroke={isChordRoot ? text : 'none'}
              strokeWidth={isChordRoot ? 2 : 0}
            />
          );
        }

        // Label: "R" for chord root, note name otherwise
        elements.push(
          <text
            key={`cl-${s}-${f}`}
            x={cx}
            y={cy + 3.5}
            textAnchor="middle"
            fill={bg}
            fontSize={isChordRoot ? '8' : '7'}
            fontWeight="bold"
            fontFamily="IBM Plex Sans, sans-serif"
          >
            {isChordRoot ? 'R' : noteName}
          </text>
        );
      } else if (isScale) {
        // Scale-only tones: small subtle dots with note name
        const r = isRoot ? 7 : 5;

        if (isRoot) {
          // Key root (not a chord tone): diamond outline
          const d = r + 1;
          elements.push(
            <polygon
              key={`rdiamond-${s}-${f}`}
              points={`${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}`}
              fill={surface2}
              stroke={diatonic}
              strokeWidth={1.5}
            />
          );
          elements.push(
            <text
              key={`rl-${s}-${f}`}
              x={cx}
              y={cy + 3.5}
              textAnchor="middle"
              fill={diatonic}
              fontSize="7"
              fontWeight="bold"
              fontFamily="IBM Plex Sans, sans-serif"
            >
              {noteName}
            </text>
          );
        } else {
          elements.push(
            <circle
              key={`sn-${s}-${f}`}
              cx={cx}
              cy={cy}
              r={r}
              fill={surface2}
              stroke={border}
              strokeWidth={1}
            />
          );
          elements.push(
            <text
              key={`snl-${s}-${f}`}
              x={cx}
              y={cy + 3}
              textAnchor="middle"
              fill={neutral}
              fontSize="7"
              fontFamily="IBM Plex Sans, sans-serif"
            >
              {noteName}
            </text>
          );
        }
      }
    }
  }

  return (
    <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
      <svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="block"
        style={{ minWidth: totalWidth }}
      >
        {/* Overall background */}
        <rect width={totalWidth} height={totalHeight} fill={bg} rx={6} />
        {elements}
      </svg>
    </div>
  );
}
