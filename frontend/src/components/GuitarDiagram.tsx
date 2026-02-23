/** Guitar chord diagram (5-fret box notation) with Uberchord voicing support. */

import { useState, useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';
import { getGuitarVoicing, GUITAR_STANDARD_TUNING } from '../lib/musicTheory';
import { fetchUberchordVoicings, type UberchordVoicing } from '../lib/uberchord';

interface Props {
  pitches: number[];
  root: number;
  color: string;
  /** If provided, fetches real voicings from Uberchord API. */
  symbol?: string;
}

/** Read a CSS variable from :root, with fallback. */
function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function GuitarDiagram({ pitches, root, color, symbol }: Props) {
  const [uberVoicings, setUberVoicings] = useState<UberchordVoicing[]>([]);
  const [voicingIndex, setVoicingIndex] = useState(0);

  // Fetch Uberchord voicings when symbol changes
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    fetchUberchordVoicings(symbol).then(v => {
      if (!cancelled) {
        setUberVoicings(v);
        setVoicingIndex(0);
      }
    });
    return () => { cancelled = true; };
  }, [symbol]);

  // Compute algorithmic voicing as fallback (always available as index 0)
  const algorithmicVoicing = getGuitarVoicing(pitches, root);

  // Build the voicing list: algorithmic first, then Uberchord voicings
  const allVoicings: (number | null)[][] = [algorithmicVoicing];
  for (const uv of uberVoicings) {
    if (uv.frets.length === 6) {
      allVoicings.push(uv.frets);
    }
  }

  // Clamp index
  const safeIndex = Math.min(voicingIndex, allVoicings.length - 1);
  const voicing = allVoicings[safeIndex];
  const hasMultiple = allVoicings.length > 1;

  const prev = useCallback(() => {
    setVoicingIndex(i => (i - 1 + allVoicings.length) % allVoicings.length);
  }, [allVoicings.length]);

  const next = useCallback(() => {
    setVoicingIndex(i => (i + 1) % allVoicings.length);
  }, [allVoicings.length]);

  const rootPc = ((root % 12) + 12) % 12;

  const frettedNotes = voicing.filter((f): f is number => f !== null && f > 0);
  const minFret = frettedNotes.length > 0 ? Math.min(...frettedNotes) : 1;
  const maxFret = frettedNotes.length > 0 ? Math.max(...frettedNotes) : 5;

  const displayFrets = 5;
  let startFret = 1;

  if (maxFret > 5 || minFret > 1) {
    startFret = Math.max(1, minFret);
    if (maxFret - startFret >= displayFrets) {
      startFret = maxFret - displayFrets + 1;
    }
  }

  // Theme-aware colors
  const staffLine = cssVar('--color-staff-line', '#475569');
  const neutral = cssVar('--color-neutral', '#94a3b8');
  const bg = cssVar('--color-bg', '#0f172a');
  const text = cssVar('--color-text', '#e2e8f0');

  const stringSpacing = 16;
  const fretSpacing = 20;
  const leftPad = 30;
  const topPad = 24;
  const width = leftPad + 5 * stringSpacing + 20;
  const navHeight = hasMultiple ? 20 : 0;
  const height = topPad + displayFrets * fretSpacing + 20 + navHeight;
  const nutY = topPad;

  const strings: ReactElement[] = [];
  const frets: ReactElement[] = [];
  const markers: ReactElement[] = [];
  const topMarkers: ReactElement[] = [];

  // Strings (vertical)
  for (let s = 0; s < 6; s++) {
    const x = leftPad + s * stringSpacing;
    strings.push(
      <line
        key={`s-${s}`}
        x1={x} y1={nutY}
        x2={x} y2={nutY + displayFrets * fretSpacing}
        stroke={staffLine}
        strokeWidth={1}
      />
    );
  }

  // Frets (horizontal)
  for (let f = 0; f <= displayFrets; f++) {
    const y = nutY + f * fretSpacing;
    frets.push(
      <line
        key={`f-${f}`}
        x1={leftPad} y1={y}
        x2={leftPad + 5 * stringSpacing} y2={y}
        stroke={f === 0 && startFret === 1 ? neutral : staffLine}
        strokeWidth={f === 0 && startFret === 1 ? 3 : 1}
      />
    );
  }

  if (startFret > 1) {
    topMarkers.push(
      <text
        key="fret-num"
        x={leftPad - 14}
        y={nutY + fretSpacing / 2 + 4}
        textAnchor="middle"
        fill={neutral}
        fontSize="10"
        fontFamily="IBM Plex Mono, monospace"
      >
        {startFret}
      </text>
    );
  }

  for (let s = 0; s < 6; s++) {
    const x = leftPad + s * stringSpacing;
    const fret = voicing[s];

    if (fret === null) {
      topMarkers.push(
        <text
          key={`m-${s}`}
          x={x} y={nutY - 8}
          textAnchor="middle"
          fill={staffLine}
          fontSize="11" fontWeight="bold"
          fontFamily="IBM Plex Sans, sans-serif"
        >
          x
        </text>
      );
    } else if (fret === 0) {
      const openPc = GUITAR_STANDARD_TUNING[s] % 12;
      const isRoot = openPc === rootPc;
      topMarkers.push(
        <circle
          key={`o-${s}`}
          cx={x} cy={nutY - 8} r={5}
          fill={isRoot ? color : 'none'}
          stroke={color}
          strokeWidth={1.5}
        />
      );
      if (isRoot) {
        topMarkers.push(
          <text
            key={`or-${s}`}
            x={x} y={nutY - 4.5}
            textAnchor="middle"
            fill={bg}
            fontSize="7" fontWeight="bold"
            fontFamily="IBM Plex Sans, sans-serif"
          >
            R
          </text>
        );
      }
    } else {
      const displayY = nutY + (fret - startFret + 0.5) * fretSpacing;
      const notePc = (GUITAR_STANDARD_TUNING[s] + fret) % 12;
      const isRoot = notePc === rootPc;

      markers.push(
        <circle
          key={`c-${s}`}
          cx={x} cy={displayY} r={6}
          fill={color}
          stroke={isRoot ? text : color}
          strokeWidth={isRoot ? 2 : 0}
        />
      );

      if (isRoot) {
        markers.push(
          <text
            key={`cr-${s}`}
            x={x} y={displayY + 3.5}
            textAnchor="middle"
            fill={bg}
            fontSize="8" fontWeight="bold"
            fontFamily="IBM Plex Sans, sans-serif"
          >
            R
          </text>
        );
      }
    }
  }

  // Voicing label
  const labelText = safeIndex === 0 ? 'Computed' : `Voicing ${safeIndex}`;

  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <svg width={width} height={height - navHeight} viewBox={`0 0 ${width} ${height - navHeight}`} className="block">
        {frets}
        {strings}
        {markers}
        {topMarkers}
      </svg>
      {hasMultiple && (
        <div className="flex items-center gap-1.5" style={{ color: neutral }}>
          <button
            type="button"
            onClick={prev}
            className="w-5 h-5 flex items-center justify-center rounded text-xs cursor-pointer transition-colors hover:brightness-150"
            style={{ color: neutral }}
            aria-label="Previous voicing"
          >
            &#9664;
          </button>
          <span className="text-[9px] font-medium min-w-[52px] text-center select-none">
            {labelText}
          </span>
          <button
            type="button"
            onClick={next}
            className="w-5 h-5 flex items-center justify-center rounded text-xs cursor-pointer transition-colors hover:brightness-150"
            style={{ color: neutral }}
            aria-label="Next voicing"
          >
            &#9654;
          </button>
        </div>
      )}
    </div>
  );
}
