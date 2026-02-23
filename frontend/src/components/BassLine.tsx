import type { BassNote, ChromaticRun } from '../types';
import { useSettings } from '../lib/settingsContext';

interface Props {
  bassLine: BassNote[];
  chromaticRuns: ChromaticRun[];
}

export function BassLine({ bassLine, chromaticRuns }: Props) {
  const { t } = useSettings();
  // Build a set of positions that are part of chromatic runs
  const chromaticPositions = new Set<number>();
  for (const run of chromaticRuns) {
    for (let i = 0; i < run.length; i++) {
      chromaticPositions.add(run.start_position + i);
    }
  }

  return (
    <div>
      <h4 className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: 'var(--color-neutral)', letterSpacing: '0.08em' }}>
        {t.bassLine}
      </h4>
      <div className="flex flex-wrap items-center gap-1.5 font-mono text-sm">
        {bassLine.map((note, i) => {
          const isChromatic = chromaticPositions.has(note.position);
          return (
            <div key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <span className="text-xs font-medium" style={{ color: 'var(--color-border)' }}>
                  {getMotionArrow(note.motion_from_previous)}
                </span>
              )}
              <span
                className="px-2 py-1 rounded-lg font-semibold"
                style={isChromatic ? {
                  backgroundColor: 'color-mix(in srgb, var(--color-diminished) 18%, transparent)',
                  color: 'var(--color-diminished)',
                  border: '1px solid color-mix(in srgb, var(--color-diminished) 40%, transparent)',
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
