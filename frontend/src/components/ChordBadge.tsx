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
      className="group relative rounded-lg px-3 py-1.5 transition-all cursor-pointer border"
      style={{
        borderColor: selected ? color : 'transparent',
        backgroundColor: selected
          ? `color-mix(in srgb, ${color} 15%, transparent)`
          : 'var(--color-surface-2)',
      }}
    >
      <div className="font-mono font-semibold text-sm" style={{ color }}>
        {chord.symbol}
      </div>
      <div className="text-[10px] text-center" style={{ color: 'var(--color-neutral)' }}>
        {chord.roman_numeral}
      </div>
    </button>
  );
}
