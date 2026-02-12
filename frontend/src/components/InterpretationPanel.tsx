import type { ChordAnalysis } from '../types';

interface Props {
  chord: ChordAnalysis;
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    chromatic_approach_from: 'Chromatic approach',
    chromatic_approach_to: 'Chromatic approach',
    rootless_dom7b9: 'Rootless dom7\u266d9',
    common_tone_dim: 'Common-tone dim',
    borrowed: 'Borrowed chord',
    secondary_dominant: 'Secondary dominant',
  };
  return labels[type] ?? type;
}

function getTypeColor(type: string): string {
  if (type.startsWith('chromatic') || type === 'rootless_dom7b9' || type === 'common_tone_dim')
    return 'var(--color-diminished)';
  if (type === 'borrowed') return 'var(--color-borrowed)';
  if (type === 'secondary_dominant') return 'var(--color-secondary-dom)';
  return 'var(--color-neutral)';
}

export function InterpretationPanel({ chord }: Props) {
  if (chord.interpretations.length === 0) return null;

  return (
    <div
      className="rounded-lg border p-3"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface-2)',
      }}
    >
      <div className="font-mono font-semibold text-sm mb-2">{chord.symbol}</div>
      <div className="space-y-1.5">
        {chord.interpretations.map((interp, i) => {
          const pct = Math.round(interp.confidence * 100);
          const color = getTypeColor(interp.type);
          return (
            <div key={i} className="flex items-start gap-3 text-sm">
              <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
                <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-xs w-7" style={{ color: 'var(--color-neutral)' }}>{pct}%</span>
              </div>
              <div>
                <span
                  className="text-xs font-medium px-1.5 py-0.5 rounded mr-2"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`,
                    color,
                  }}
                >
                  {getTypeLabel(interp.type)}
                </span>
                <span style={{ color: 'var(--color-text-secondary)' }}>{interp.detail}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
