import type { ChordAnalysis } from '../types';
import { getChordColor } from '../lib/chordColor';

interface Props {
  chord: ChordAnalysis;
  selected: boolean;
  onClick: () => void;
}

export function ChordBadge({ chord, selected, onClick }: Props) {
  const color = getChordColor(chord);

  return (
    <button
      onClick={onClick}
      className="group relative rounded-xl px-4 py-2.5 transition-all cursor-pointer border-2 min-w-[3.5rem]"
      style={{
        borderColor: selected ? color : 'var(--color-border)',
        backgroundColor: selected
          ? `color-mix(in srgb, ${color} 16%, var(--color-surface-2))`
          : 'var(--color-surface-2)',
        boxShadow: selected ? `0 0 0 2px color-mix(in srgb, ${color} 35%, transparent)` : 'var(--shadow-sm)',
      }}
    >
      <div className="font-mono font-bold text-sm tracking-wide" style={{ color }}>
        {chord.symbol}
      </div>
      <div className="text-[10px] font-semibold text-center mt-0.5 uppercase tracking-wider" style={{ color: 'var(--color-neutral)' }}>
        {chord.roman_numeral}
      </div>
    </button>
  );
}
