/** 2-octave piano keyboard (C3-B4) with highlighted chord and scale tones. Pure SVG. */

import type { ReactElement } from 'react';

interface Props {
  pitches: number[];
  root: number;
  bass: number;
  color: string;
  scalePitches: number[];
}

// White key layout within one octave: C D E F G A B
const WHITE_KEY_PCS = [0, 2, 4, 5, 7, 9, 11];
// Black key positions: C# D# _ F# G# A#
const BLACK_KEY_PCS = [1, 3, 6, 8, 10];
// Black key x-offsets within an octave (fraction of white key width)
const BLACK_KEY_OFFSETS = [0.65, 1.65, 3.6, 4.6, 5.6];

/** Read a CSS variable from :root, with fallback. */
function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function PianoKeyboard({ pitches, root, bass, color, scalePitches }: Props) {
  const octaves = 2;
  const whiteKeyWidth = 24;
  const whiteKeyHeight = 80;
  const blackKeyWidth = 14;
  const blackKeyHeight = 50;
  const whiteKeysPerOctave = 7;
  const totalWhiteKeys = whiteKeysPerOctave * octaves;
  const width = totalWhiteKeys * whiteKeyWidth;
  const height = whiteKeyHeight + 20;

  const pitchSet = new Set(pitches.map(p => ((p % 12) + 12) % 12));
  const scaleSet = new Set(scalePitches.map(p => ((p % 12) + 12) % 12));
  const rootPc = ((root % 12) + 12) % 12;
  const bassPc = ((bass % 12) + 12) % 12;

  // Theme-aware colors
  const surface2 = cssVar('--color-surface-2', '#1e293b');
  const border = cssVar('--color-border', '#334155');
  const bg = cssVar('--color-bg', '#0f172a');
  const staffLine = cssVar('--color-staff-line', '#475569');

  const whiteKeys: ReactElement[] = [];
  const blackKeys: ReactElement[] = [];
  const labels: ReactElement[] = [];

  for (let oct = 0; oct < octaves; oct++) {
    const octOffset = oct * whiteKeysPerOctave * whiteKeyWidth;

    WHITE_KEY_PCS.forEach((pc, wi) => {
      const x = octOffset + wi * whiteKeyWidth;
      const isChordTone = pitchSet.has(pc);
      const isScale = scaleSet.has(pc);
      const isRoot = pc === rootPc;
      const isBass = pc === bassPc && bass !== root;

      whiteKeys.push(
        <rect
          key={`w-${oct}-${pc}`}
          x={x} y={0}
          width={whiteKeyWidth - 1} height={whiteKeyHeight}
          rx={2}
          fill={isChordTone ? color : surface2}
          stroke={isChordTone ? color : border}
          strokeWidth={1}
        />
      );

      if (isScale && !isChordTone) {
        whiteKeys.push(
          <circle
            key={`ws-${oct}-${pc}`}
            cx={x + (whiteKeyWidth - 1) / 2}
            cy={whiteKeyHeight - 10}
            r={3}
            fill={staffLine}
          />
        );
      }

      if (isChordTone && (isRoot || isBass)) {
        labels.push(
          <text
            key={`wl-${oct}-${pc}`}
            x={x + (whiteKeyWidth - 1) / 2}
            y={whiteKeyHeight + 14}
            textAnchor="middle"
            fill={color}
            fontSize="9" fontWeight="bold"
            fontFamily="IBM Plex Mono, monospace"
          >
            {isRoot ? 'R' : 'B'}
          </text>
        );
      }
    });

    BLACK_KEY_PCS.forEach((pc, bi) => {
      const x = octOffset + BLACK_KEY_OFFSETS[bi] * whiteKeyWidth - blackKeyWidth / 2 + whiteKeyWidth / 2;
      const isChordTone = pitchSet.has(pc);
      const isScale = scaleSet.has(pc);
      const isRoot = pc === rootPc;
      const isBass = pc === bassPc && bass !== root;

      blackKeys.push(
        <rect
          key={`b-${oct}-${pc}`}
          x={x} y={0}
          width={blackKeyWidth} height={blackKeyHeight}
          rx={2}
          fill={isChordTone ? color : bg}
          stroke={isChordTone ? color : surface2}
          strokeWidth={1}
        />
      );

      if (isScale && !isChordTone) {
        blackKeys.push(
          <circle
            key={`bs-${oct}-${pc}`}
            cx={x + blackKeyWidth / 2}
            cy={blackKeyHeight - 8}
            r={2.5}
            fill={staffLine}
          />
        );
      }

      if (isChordTone && (isRoot || isBass)) {
        labels.push(
          <text
            key={`bl-${oct}-${pc}`}
            x={x + blackKeyWidth / 2}
            y={whiteKeyHeight + 14}
            textAnchor="middle"
            fill={color}
            fontSize="9" fontWeight="bold"
            fontFamily="IBM Plex Mono, monospace"
          >
            {isRoot ? 'R' : 'B'}
          </text>
        );
      }
    });
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      {whiteKeys}
      {blackKeys}
      {labels}
    </svg>
  );
}
