import type { BassNote, ChromaticRun } from '../types';

interface Props {
  bassLine: BassNote[];
  chromaticRuns: ChromaticRun[];
}

export function BassLine({ bassLine, chromaticRuns }: Props) {
  // Build a set of positions that are part of chromatic runs
  const chromaticPositions = new Set<number>();
  for (const run of chromaticRuns) {
    for (let i = 0; i < run.length; i++) {
      chromaticPositions.add(run.start_position + i);
    }
  }

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-neutral)' }}>
        Bass Line
      </h4>
      <div className="flex flex-wrap items-center gap-1 font-mono text-sm">
        {bassLine.map((note, i) => {
          const isChromatic = chromaticPositions.has(note.position);
          return (
            <div key={i} className="flex items-center gap-1">
              {i > 0 && (
                <span className="text-xs" style={{ color: 'var(--color-border)' }}>
                  {getMotionArrow(note.motion_from_previous)}
                </span>
              )}
              <span
                className="px-1.5 py-0.5 rounded"
                style={isChromatic ? {
                  backgroundColor: 'color-mix(in srgb, var(--color-diminished) 20%, transparent)',
                  color: 'var(--color-diminished)',
                  fontWeight: 600,
                } : {
                  color: 'var(--color-text-secondary)',
                }}
              >
                {note.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getMotionArrow(motion: string | null): string {
  if (!motion) return '\u2192';
  if (motion.includes('chromatic_asc')) return '\u2197';
  if (motion.includes('chromatic_desc')) return '\u2198';
  if (motion.includes('step_asc')) return '\u2191';
  if (motion.includes('step_desc')) return '\u2193';
  if (motion.includes('leap_asc')) return '\u2934';
  if (motion.includes('leap_desc')) return '\u2935';
  if (motion === 'static') return '=';
  return '\u2192';
}
