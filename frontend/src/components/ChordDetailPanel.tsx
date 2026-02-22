import type { ChordAnalysis, Key } from '../types';
import { useSettings } from '../lib/settingsContext';
import { getChordColor } from '../lib/chordColor';
import { PianoKeyboard } from './PianoKeyboard';
import { GuitarDiagram } from './GuitarDiagram';

interface Props {
  chord: ChordAnalysis;
  keyInfo: Key;
}

export function ChordDetailPanel({ chord, keyInfo }: Props) {
  const { vizMode, t } = useSettings();
  const color = getChordColor(chord);
  const showPiano = vizMode === 'piano' || vizMode === 'all';
  const showGuitar = vizMode === 'guitar' || vizMode === 'all';

  return (
    <div
      className="rounded-lg border p-5 space-y-4"
      style={{
        borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 5%, var(--color-surface))`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono font-bold text-xl" style={{ color }}>
          {chord.symbol}
        </span>
        <span className="text-sm" style={{ color: 'var(--color-neutral)' }}>{chord.roman_numeral}</span>
        {chord.is_inverted && (
          <span className="text-xs" style={{ color: 'var(--color-neutral)' }}>
            ({chord.bass_name} {t.inBass})
          </span>
        )}
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: chord.is_diatonic
              ? 'color-mix(in srgb, var(--color-diatonic) 20%, transparent)'
              : 'color-mix(in srgb, var(--color-borrowed) 20%, transparent)',
            color: chord.is_diatonic ? 'var(--color-diatonic)' : 'var(--color-borrowed)',
          }}
        >
          {chord.is_diatonic ? t.diatonic : t.nonDiatonic}
        </span>
        {chord.secondary_dominant && (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-secondary-dom) 20%, transparent)',
              color: 'var(--color-secondary-dom)',
            }}
          >
            {chord.secondary_dominant}
          </span>
        )}
        {chord.deceptive_resolution && (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-deceptive) 20%, transparent)',
              color: 'var(--color-deceptive)',
            }}
          >
            {t.deceptive}
          </span>
        )}
      </div>

      {/* Visualizations */}
      {(showPiano || showGuitar) && (
        <div className="flex flex-wrap gap-6 items-start">
          {showPiano && (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-neutral)' }}>
                {t.piano}
              </div>
              <PianoKeyboard
                pitches={chord.pitches}
                root={chord.root}
                bass={chord.bass}
                color={color}
                scalePitches={keyInfo.scale_pitches}
              />
            </div>
          )}
          {showGuitar && (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-neutral)' }}>
                {t.guitar}
              </div>
              <GuitarDiagram
                pitches={chord.pitches}
                root={chord.root}
                color={color}
              />
            </div>
          )}
        </div>
      )}

      {/* Theory details */}
      <div className="space-y-2 text-sm">
        {chord.bass_motion_from_previous && (
          <p style={{ color: 'var(--color-neutral)' }}>
            {t.bassMotion}: <span style={{ color: 'var(--color-text-secondary)' }}>{chord.bass_motion_from_previous.replace(/_/g, ' ')}</span>
          </p>
        )}
        {chord.common_tones_with_previous.length > 0 && (
          <p style={{ color: 'var(--color-neutral)' }}>
            {t.commonTonesPrev}: <span className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>{chord.common_tones_with_previous.join(', ')}</span>
          </p>
        )}
        {chord.common_tones_with_next.length > 0 && (
          <p style={{ color: 'var(--color-neutral)' }}>
            {t.commonTonesNext}: <span className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>{chord.common_tones_with_next.join(', ')}</span>
          </p>
        )}
        {chord.deceptive_resolution && (
          <p style={{ color: 'var(--color-deceptive)' }}>
            {chord.deceptive_resolution}
          </p>
        )}
      </div>

      {/* Interpretations */}
      {chord.interpretations.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-neutral)' }}>
            {t.interpretations}
          </div>
          {chord.interpretations.map((interp, i) => {
            const pct = Math.round(interp.confidence * 100);
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface-2)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="text-xs w-8" style={{ color: 'var(--color-neutral)' }}>{pct}%</span>
                </div>
                <span style={{ color: 'var(--color-text-secondary)' }}>{interp.detail}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
