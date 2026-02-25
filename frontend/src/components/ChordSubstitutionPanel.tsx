import { useState, useEffect } from 'react';
import type { ChordSubstitution } from '../types';
import { getChordSubstitutions } from '../api';

interface ChordSubstitutionPanelProps {
  chordSymbol: string;
  keyRootName: string;
  keyMode: string;
  prevChord?: string;
  nextChord?: string;
  onApplySubstitution?: (newChord: string) => void;
}

/** Color mapping for substitution types */
const SUB_TYPE_COLORS: Record<string, string> = {
  tritone: '#d97706',           // amber
  relative: '#3b82f6',          // blue
  parallel: '#16a34a',          // green
  diatonic: 'var(--color-accent)',
  modal_interchange: '#9333ea', // purple
  dominant_chain: '#dc2626',    // red
};

function getSubTypeColor(subType: string): string {
  // Check for exact match first, then partial match
  const lower = subType.toLowerCase();
  for (const [key, color] of Object.entries(SUB_TYPE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return 'var(--color-accent)';
}

function formatSubType(subType: string): string {
  return subType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function ChordSubstitutionPanel({
  chordSymbol,
  keyRootName,
  keyMode,
  prevChord,
  nextChord,
  onApplySubstitution,
}: ChordSubstitutionPanelProps) {
  const [substitutions, setSubstitutions] = useState<ChordSubstitution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSubstitutions([]);

    getChordSubstitutions(chordSymbol, keyRootName, keyMode, prevChord, nextChord)
      .then(subs => {
        if (!cancelled) {
          setSubstitutions(subs);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load substitutions');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [chordSymbol, keyRootName, keyMode, prevChord, nextChord]);

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div
        className="text-[10px] uppercase tracking-widest font-semibold"
        style={{ color: 'var(--color-neutral)' }}
      >
        Substitutions
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 py-3">
          <div
            className="w-4 h-4 rounded-full border-2 animate-spin"
            style={{
              borderColor: 'var(--color-border)',
              borderTopColor: 'var(--color-accent)',
            }}
          />
          <span className="text-xs" style={{ color: 'var(--color-neutral)' }}>
            Finding substitutions...
          </span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <p className="text-xs py-2" style={{ color: 'var(--color-deceptive, #e53e3e)' }}>
          {error}
        </p>
      )}

      {/* Empty state */}
      {!loading && !error && substitutions.length === 0 && (
        <p className="text-xs py-2" style={{ color: 'var(--color-neutral)' }}>
          No substitutions found for {chordSymbol}.
        </p>
      )}

      {/* Substitution list */}
      {!loading && substitutions.length > 0 && (
        <div className="space-y-2">
          {substitutions.map((sub, i) => {
            const typeColor = getSubTypeColor(sub.sub_type);
            const pct = Math.round(sub.confidence * 100);

            return (
              <div
                key={i}
                className="rounded-xl border p-3 transition-colors"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-surface-2)',
                }}
              >
                {/* Top row: chord symbol + type badge + apply button */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="font-mono font-bold text-lg tracking-tight"
                    style={{ color: typeColor }}
                  >
                    {sub.symbol}
                  </span>

                  {/* Type badge */}
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${typeColor} 15%, transparent)`,
                      color: typeColor,
                    }}
                  >
                    {formatSubType(sub.sub_type)}
                  </span>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Voice leading & common tones indicators */}
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: 'var(--color-neutral)' }}
                    title="Voice leading distance (semitones)"
                  >
                    VL: {sub.voice_leading_distance}
                  </span>
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: 'var(--color-neutral)' }}
                    title="Common tones count"
                  >
                    CT: {sub.common_tone_count}
                  </span>

                  {/* Apply button */}
                  {onApplySubstitution && (
                    <button
                      onClick={() => onApplySubstitution(sub.symbol)}
                      className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg cursor-pointer transition-all border"
                      style={{
                        borderColor: typeColor,
                        color: typeColor,
                        backgroundColor: 'transparent',
                      }}
                      onMouseEnter={e => {
                        (e.target as HTMLElement).style.backgroundColor =
                          `color-mix(in srgb, ${typeColor} 12%, transparent)`;
                      }}
                      onMouseLeave={e => {
                        (e.target as HTMLElement).style.backgroundColor = 'transparent';
                      }}
                    >
                      Apply
                    </button>
                  )}
                </div>

                {/* Reasoning */}
                <p
                  className="text-xs mt-1.5 leading-relaxed"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {sub.reasoning}
                </p>

                {/* Confidence bar */}
                <div className="flex items-center gap-1.5 mt-2">
                  <div
                    className="flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'var(--color-surface)', maxWidth: '120px' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: typeColor,
                      }}
                    />
                  </div>
                  <span
                    className="text-[10px] w-7 font-mono"
                    style={{ color: 'var(--color-neutral)' }}
                  >
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
