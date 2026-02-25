import type { ChordAnalysis, Key } from '../types';
import { useSettings } from '../lib/settingsContext';
import { getChordColor } from '../lib/chordColor';
import { PianoKeyboard } from './PianoKeyboard';
import { GuitarDiagram } from './GuitarDiagram';
import { ChordSubstitutionPanel } from './ChordSubstitutionPanel';

interface Props {
  chord: ChordAnalysis;
  keyInfo: Key;
  prevChord?: string;
  nextChord?: string;
  onApplySubstitution?: (newChord: string) => void;
}

export function ChordDetailPanel({ chord, keyInfo, prevChord, nextChord, onApplySubstitution }: Props) {
  const { notation, t } = useSettings();
  const color = getChordColor(chord);
  const showPiano = notation.showPiano;
  const showGuitar = notation.showGuitar;

  return (
    <div
      className="chord-detail-panel rounded-2xl border-2 p-6 space-y-5"
      style={{
        borderColor: `color-mix(in srgb, ${color} 45%, var(--color-border))`,
        backgroundColor: `color-mix(in srgb, ${color} 8%, var(--color-surface))`,
        boxShadow: 'var(--shadow-md), 0 0 0 1px color-mix(in srgb, var(--color-border) 30%, transparent)',
      }}
    >
      {/* Header — chord symbol prominent for notation clarity */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono font-bold text-2xl tracking-tight" style={{ color }}>
          {chord.symbol}
        </span>
        <span className="text-sm font-medium" style={{ color: 'var(--color-neutral)' }}>{chord.roman_numeral}</span>
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

      {/* Piano & Guitar — visibility controlled by toolbox toggles */}
      {(showPiano || showGuitar) && (
        <div
          className="instruments-strip rounded-xl border p-4 flex flex-wrap gap-8 items-start"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface-2)',
            boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--color-text) 6%, transparent)',
          }}
        >
          {showPiano && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--color-accent)' }}>
                  &#9835; {t.piano}
                </span>
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
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--color-accent)' }}>
                  &#9836; {t.guitar}
                </span>
              </div>
              <GuitarDiagram
                pitches={chord.pitches}
                root={chord.root}
                color={color}
                symbol={chord.symbol}
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
          <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--color-neutral)' }}>
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

      {/* Substitution suggestions */}
      <div
        className="border-t pt-4"
        style={{ borderColor: 'color-mix(in srgb, var(--color-border) 60%, transparent)' }}
      >
        <ChordSubstitutionPanel
          chordSymbol={chord.symbol}
          keyRootName={keyInfo.root_name}
          keyMode={keyInfo.mode}
          prevChord={prevChord}
          nextChord={nextChord}
          onApplySubstitution={onApplySubstitution}
        />
      </div>
    </div>
  );
}
