import { useState, useRef, useEffect } from 'react';
import type { ChordLyricPair } from '../types';

const SECTION_TYPES = [
  { value: 'verse', label: 'Verse' },
  { value: 'chorus', label: 'Chorus' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'pre-chorus', label: 'Pre-Chorus' },
  { value: 'intro', label: 'Intro' },
  { value: 'outro', label: 'Outro' },
  { value: 'instrumental', label: 'Instrumental' },
  { value: 'interlude', label: 'Interlude' },
  { value: 'solo', label: 'Solo' },
];

interface Props {
  pairs: ChordLyricPair[];
  title: string;
  artist: string;
  onSubmit: (formatAText: string) => void;
  onSkip: () => void;
}

export function SectionSplitter({ pairs, title, artist, onSubmit, onSkip }: Props) {
  // breaks: Map<pairIndex, sectionType>
  // A break at index i means "start a new section of type X before pair[i]"
  // Index 0 always has a break (the first section).
  const [breaks, setBreaks] = useState<Map<number, string>>(() => new Map([[0, 'verse']]));
  const [hoveredGap, setHoveredGap] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to top when component mounts
  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  function addBreak(beforeIndex: number) {
    setBreaks(prev => {
      const next = new Map(prev);
      next.set(beforeIndex, 'chorus');
      return next;
    });
  }

  function removeBreak(index: number) {
    if (index === 0) return; // Can't remove the first section
    setBreaks(prev => {
      const next = new Map(prev);
      next.delete(index);
      return next;
    });
  }

  function updateBreakType(index: number, type: string) {
    setBreaks(prev => {
      const next = new Map(prev);
      next.set(index, type);
      return next;
    });
  }

  function buildFormatA(): string {
    const lines: string[] = [];
    if (title) lines.push(`title: ${title}`);
    if (artist) lines.push(`artist: ${artist}`);
    lines.push('');

    for (let i = 0; i < pairs.length; i++) {
      if (breaks.has(i)) {
        lines.push(`[${breaks.get(i)}]`);
      }
      const pair = pairs[i];
      if (pair.lyrics) {
        lines.push(`${pair.chords} | ${pair.lyrics}`);
      } else {
        lines.push(pair.chords);
      }
    }
    return lines.join('\n');
  }

  function handleSubmit() {
    onSubmit(buildFormatA());
  }

  // Count sections for summary
  const sectionCount = breaks.size;

  return (
    <div ref={containerRef} className="mt-8 space-y-0">
      {/* Header card */}
      <div
        className="rounded-t-2xl border border-b-0 px-6 py-5"
        style={{
          borderColor: 'var(--color-accent)',
          backgroundColor: 'color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              className="text-lg font-bold flex items-center gap-2.5"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
            >
              <svg className="w-5 h-5 shrink-0" style={{ color: 'var(--color-accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              Section Segmentation
            </h2>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--color-neutral)' }}>
              This song has no section markers. Click <strong>+</strong> between lines to mark where new sections begin.
            </p>
          </div>
          <div className="text-right shrink-0">
            {title && <div className="font-semibold text-sm" dir="rtl">{title}</div>}
            {artist && <div className="text-xs" dir="rtl" style={{ color: 'var(--color-neutral)' }}>{artist}</div>}
          </div>
        </div>
      </div>

      {/* Pairs list */}
      <div
        className="border border-t-0 rounded-b-2xl overflow-hidden"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        {pairs.map((pair, i) => (
          <div key={i}>
            {/* Section break bar (if one exists at this index) */}
            {breaks.has(i) && (
              <SectionBreakBar
                type={breaks.get(i)!}
                isFirst={i === 0}
                onChangeType={(t) => updateBreakType(i, t)}
                onRemove={() => removeBreak(i)}
              />
            )}

            {/* Gap / separator between pairs (only if no break exists here) */}
            {!breaks.has(i) && i > 0 && (
              <GapSeparator
                isHovered={hoveredGap === i}
                onHover={(h) => setHoveredGap(h ? i : null)}
                onAdd={() => addBreak(i)}
              />
            )}

            {/* The chord-lyric pair row */}
            <PairRow pair={pair} />
          </div>
        ))}

        {/* Footer with actions */}
        <div
          className="px-6 py-4 flex items-center justify-between border-t"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}
        >
          <div className="text-sm font-medium" style={{ color: 'var(--color-neutral)' }}>
            {sectionCount} section{sectionCount !== 1 ? 's' : ''} · {pairs.length} line{pairs.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onSkip}
              className="text-sm px-4 py-2.5 rounded-xl border font-medium transition-colors cursor-pointer"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-neutral)',
                backgroundColor: 'transparent',
              }}
            >
              Skip
            </button>
            <button
              onClick={handleSubmit}
              className="text-sm px-5 py-2.5 rounded-xl text-white font-semibold transition-all cursor-pointer flex items-center gap-2"
              style={{
                backgroundColor: 'var(--color-accent)',
                boxShadow: '0 2px 8px color-mix(in srgb, var(--color-accent) 35%, transparent)',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Analyze with Sections
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ---------- Sub-components ---------- */

function SectionBreakBar({
  type,
  isFirst,
  onChangeType,
  onRemove,
}: {
  type: string;
  isFirst: boolean;
  onChangeType: (t: string) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5"
      style={{
        backgroundColor: `color-mix(in srgb, var(--color-accent) 12%, transparent)`,
        borderTop: isFirst ? 'none' : '1px solid var(--color-accent)',
        borderBottom: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
      }}
    >
      {/* Section icon */}
      <svg className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>

      {/* Section type selector */}
      <select
        value={type}
        onChange={(e) => onChangeType(e.target.value)}
        className="text-sm font-medium rounded px-2 py-0.5 border-none cursor-pointer focus:outline-none focus:ring-1"
        style={{
          backgroundColor: 'transparent',
          color: 'var(--color-accent)',
          outline: 'none',
        }}
      >
        {SECTION_TYPES.map(st => (
          <option key={st.value} value={st.value} style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}>
            {st.label}
          </option>
        ))}
      </select>

      <div className="flex-1" />

      {/* Remove button (not for the first break) */}
      {!isFirst && (
        <button
          onClick={onRemove}
          className="w-5 h-5 rounded-full flex items-center justify-center transition-colors cursor-pointer"
          style={{ color: 'var(--color-neutral)' }}
          title="Remove section break"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}


function GapSeparator({
  isHovered,
  onHover,
  onAdd,
}: {
  isHovered: boolean;
  onHover: (h: boolean) => void;
  onAdd: () => void;
}) {
  return (
    <div
      className="relative flex items-center justify-center cursor-pointer group"
      style={{
        height: isHovered ? '32px' : '1px',
        backgroundColor: isHovered
          ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)'
          : 'color-mix(in srgb, var(--color-border) 40%, transparent)',
        transition: 'height 0.15s ease, background-color 0.15s ease',
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onAdd}
      title="Add section break"
    >
      {/* Plus button — always rendered, opacity controlled */}
      <div
        className="absolute flex items-center gap-2 transition-opacity"
        style={{ opacity: isHovered ? 1 : 0 }}
      >
        <div
          className="w-0 flex-1 border-t border-dashed"
          style={{ borderColor: 'var(--color-accent)', minWidth: '40px' }}
        />
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'white',
          }}
        >
          +
        </div>
        <div
          className="w-0 flex-1 border-t border-dashed"
          style={{ borderColor: 'var(--color-accent)', minWidth: '40px' }}
        />
      </div>
    </div>
  );
}


function PairRow({ pair }: { pair: ChordLyricPair }) {
  return (
    <div
      className="px-6 py-2 hover:bg-white/[0.02] transition-colors"
    >
      {/* Chords */}
      <div className="font-mono text-sm font-medium tracking-wide" dir="ltr">
        {pair.chords}
      </div>
      {/* Lyrics */}
      {pair.lyrics && (
        <div
          className="text-sm mt-0.5"
          style={{ color: 'var(--color-neutral)' }}
          dir="rtl"
        >
          {pair.lyrics}
        </div>
      )}
    </div>
  );
}
