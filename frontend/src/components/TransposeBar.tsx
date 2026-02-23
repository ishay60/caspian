import { useState, useCallback } from 'react';
import { pitchToName, capoFret } from '../lib/transpose';
import { useSettings } from '../lib/settingsContext';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

interface Props {
  currentKey: { root_name: string; root: number; mode: string };
  onTranspose: (semitones: number) => void;
}

export function TransposeBar({ currentKey, onTranspose }: Props) {
  const { t } = useSettings();
  // Track the original root so we can compute capo and reset
  const [originalRoot] = useState(currentKey.root);

  const currentRoot = ((currentKey.root % 12) + 12) % 12;
  const capo = capoFret(originalRoot, currentRoot);

  const handleKeyClick = useCallback(
    (targetPitch: number) => {
      const semitones = ((targetPitch - currentRoot) % 12 + 12) % 12;
      if (semitones !== 0) {
        onTranspose(semitones);
      }
    },
    [currentRoot, onTranspose],
  );

  const handleReset = useCallback(() => {
    const semitones = ((originalRoot - currentRoot) % 12 + 12) % 12;
    if (semitones !== 0) {
      onTranspose(semitones);
    }
  }, [originalRoot, currentRoot, onTranspose]);

  return (
    <div
      className="flex items-center gap-3 flex-wrap px-4 py-3 rounded-xl border"
      style={{
        backgroundColor: 'var(--color-surface-2)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Label */}
      <label
        className="text-[10px] uppercase tracking-widest font-semibold shrink-0"
        style={{ color: 'var(--color-neutral)' }}
      >
        {t.key}
      </label>

      {/* 12 key buttons — piano-like row */}
      <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
        {NOTE_NAMES.map((name, pitch) => {
          const isActive = pitch === currentRoot;
          return (
            <button
              key={name}
              onClick={() => handleKeyClick(pitch)}
              className="px-2.5 py-1.5 text-xs font-mono font-semibold transition-all cursor-pointer"
              style={{
                backgroundColor: isActive ? 'var(--color-accent)' : 'var(--color-surface)',
                color: isActive ? '#fff' : 'var(--color-neutral)',
                minWidth: '2.25rem',
              }}
              title={`Transpose to ${name}${currentKey.mode === 'minor' ? 'm' : ''}`}
            >
              {name}
            </button>
          );
        })}
      </div>

      {/* Quick transpose: -1 / +1 */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onTranspose(-1)}
          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer border"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text)',
          }}
          title="Transpose down one half step"
        >
          −1
        </button>
        <button
          onClick={() => onTranspose(1)}
          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer border"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text)',
          }}
          title="Transpose up one half step"
        >
          +1
        </button>
      </div>

      {/* Reset button */}
      <button
        onClick={handleReset}
        disabled={currentRoot === originalRoot}
        className="px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer border disabled:opacity-40"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-neutral)',
        }}
        title={`Reset to original key (${pitchToName(originalRoot)}${currentKey.mode === 'minor' ? 'm' : ''})`}
      >
        {t.reset}
      </button>

      {/* Capo indicator */}
      <span
        className="text-xs font-semibold ml-auto shrink-0"
        style={{ color: capo > 0 ? 'var(--color-accent)' : 'var(--color-neutral)' }}
      >
        {capo > 0
          ? `${t.capoFret} ${capo}`
          : t.noCap}
      </span>
    </div>
  );
}
