/**
 * BarDisplay Component
 *
 * Renders a single musical bar with:
 * - Time signature
 * - Beat grid
 * - Chord symbols positioned at beat positions
 * - Lyrics fragment (if available)
 * - Visual bar lines
 */

import type { BarAnalysis, ChordAnalysis } from '../types';
import { getChordColor } from '../lib/chordColor';

interface BarDisplayProps {
  bar: BarAnalysis;
  barIndex: number;
  timeSignature: [number, number];
  onChordSelect?: (chordIndex: number) => void;
  selectedChordIndex?: number | null;
}

export function BarDisplay({
  bar,
  barIndex,
  timeSignature,
  onChordSelect,
  selectedChordIndex,
}: BarDisplayProps) {
  const [beatsPerBar] = timeSignature;
  const chords = bar.chord_analyses;

  // Dynamic grid columns based on time signature
  const gridStyle = {
    gridTemplateColumns: `repeat(${beatsPerBar}, 1fr)`,
  };

  return (
    <div className="bar-display">
      {/* Bar container with beat grid */}
      <div className="bar-content">
        {/* Chord symbols layer */}
        <div className="chords-layer" style={gridStyle}>
          {chords.map((chord, chordIdx) => (
            <ChordSymbol
              key={chordIdx}
              chord={chord}
              chordIndex={chordIdx}
              beatPosition={getBeatPosition(chordIdx, chords.length, beatsPerBar)}
              isSelected={selectedChordIndex === chordIdx}
              onClick={() => onChordSelect?.(chordIdx)}
            />
          ))}
        </div>

        {/* Beat grid */}
        <div className="beat-grid" style={gridStyle}>
          {Array.from({ length: beatsPerBar }, (_, beatIdx) => (
            <BeatMarker key={beatIdx} beatNumber={beatIdx + 1} />
          ))}
        </div>

        {/* Lyrics fragment (if available) */}
        {/* TODO: Extract lyrics from bar data when available */}
      </div>

      {/* Bar number indicator (optional) */}
      <div className="bar-number">{barIndex + 1}</div>
    </div>
  );
}

/**
 * Chord Symbol Component
 * Displays a chord symbol positioned at its beat location
 */
interface ChordSymbolProps {
  chord: ChordAnalysis;
  chordIndex: number;
  beatPosition: number; // 0-based beat position (0 = beat 1)
  isSelected: boolean;
  onClick: () => void;
}

function ChordSymbol({ chord, beatPosition, isSelected, onClick }: ChordSymbolProps) {
  const color = getChordColor(chord);

  return (
    <button
      className={`chord-symbol ${isSelected ? 'selected' : ''}`}
      style={{
        '--chord-color': color,
        gridColumn: beatPosition + 1, // CSS grid is 1-based
      } as React.CSSProperties}
      onClick={onClick}
      aria-label={`Chord ${chord.symbol}`}
    >
      <span className="chord-root">{chord.root_name}</span>
      <span className="chord-quality">{getChordQuality(chord)}</span>
    </button>
  );
}

/**
 * Beat Marker Component
 * Visual indicator for each beat in the bar
 */
interface BeatMarkerProps {
  beatNumber: number;
}

function BeatMarker({ beatNumber }: BeatMarkerProps) {
  return (
    <div className="beat-marker">
      <div className="beat-dot" />
      <div className="beat-number">{beatNumber}</div>
    </div>
  );
}

/**
 * Helper: Calculate beat position for a chord
 * For now, evenly distributes chords across beats
 * TODO: Use actual BeatPosition data when available
 */
function getBeatPosition(chordIndex: number, totalChords: number, beatsPerBar: number): number {
  // Simple even distribution
  return Math.floor((chordIndex * beatsPerBar) / totalChords);
}

/**
 * Helper: Extract chord quality string (everything after root)
 * e.g., "Am7" -> "m7", "Cmaj9" -> "maj9"
 */
function getChordQuality(chord: ChordAnalysis): string {
  const rootName = chord.root_name;
  const symbol = chord.symbol;

  // Handle slash chords (e.g., "C/E")
  const baseSymbol = symbol.split('/')[0];

  // Remove root from symbol to get quality
  if (baseSymbol.startsWith(rootName)) {
    return baseSymbol.slice(rootName.length);
  }

  return '';
}
