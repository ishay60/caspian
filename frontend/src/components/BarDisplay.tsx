/**
 * BarDisplay Component
 *
 * Renders a single musical bar with proportional chord segments.
 * Chord width = duration. Drag dividers between chords to adjust timing.
 * Supports dotted/syncopated durations via 0.5-beat snap granularity.
 * Shows riff/instrumental indicators when bar.has_riff is true.
 */

import { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import type { BarAnalysis, ChordAnalysis } from '../types';
import { getChordColor } from '../lib/chordColor';

interface BarDisplayProps {
  bar: BarAnalysis;
  barIndex: number;
  timeSignature: [number, number];
  editable?: boolean;
  durations?: number[];
  onDurationsChange?: (barIndex: number, durations: number[]) => void;
  onChordSelect?: (chord: ChordAnalysis) => void;
  selectedChord?: ChordAnalysis | null;
  onAddChord?: (barIndex: number, symbol: string) => void;
  onRemoveChord?: (barIndex: number, chordIndex: number) => void;
  onDeleteBar?: (barIndex: number) => void;
  isPlaying?: boolean;
  playingBeat?: number;
}

export function BarDisplay({
  bar,
  barIndex,
  timeSignature,
  editable = false,
  durations,
  onDurationsChange,
  onChordSelect,
  selectedChord,
  onAddChord,
  onRemoveChord,
  onDeleteBar,
  isPlaying = false,
  playingBeat,
}: BarDisplayProps) {
  const [beatsPerBar] = timeSignature;
  const chords = bar.chord_analyses;
  const timelineRef = useRef<HTMLDivElement>(null);
  const [showInput, setShowInput] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dragDurations, setDragDurations] = useState<number[] | null>(null);
  const latestDrag = useRef<number[] | null>(null);

  // Priority: drag state > prop > equal distribution
  const effectiveDurations = (() => {
    if (dragDurations) return dragDurations;
    if (durations && durations.length === chords.length) return durations;
    if (chords.length === 0) return [];
    return chords.map(() => beatsPerBar / chords.length);
  })();

  function handleDragStart(dividerIdx: number, e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startDurations = [...effectiveDurations];
    const el = timelineRef.current;
    if (!el) return;
    const barWidth = el.getBoundingClientRect().width;

    const onMove = (ev: PointerEvent) => {
      const deltaBeats = ((ev.clientX - startX) / barWidth) * beatsPerBar;
      const sum = startDurations[dividerIdx] + startDurations[dividerIdx + 1];
      // Snap to 0.5-beat grid (supports dotted/syncopated values)
      let left = Math.round((startDurations[dividerIdx] + deltaBeats) * 2) / 2;
      left = Math.max(0.5, Math.min(sum - 0.5, left));
      const newDurations = [...startDurations];
      newDurations[dividerIdx] = left;
      newDurations[dividerIdx + 1] = sum - left;
      latestDrag.current = newDurations;
      setDragDurations(newDurations);
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      if (latestDrag.current) {
        onDurationsChange?.(barIndex, latestDrag.current);
      }
      latestDrag.current = null;
      setDragDurations(null);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  function formatDuration(beats: number): string {
    if (beats === Math.floor(beats)) return `${beats}`;
    return beats.toFixed(1);
  }

  return (
    <div
      className={`bar-display ${editable ? 'bar-display--editable' : ''} ${bar.has_riff ? 'bar-display--has-riff' : ''} ${expanded ? 'bar-display--expanded' : ''} ${isPlaying ? 'bar-display--playing' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="bar-number">{barIndex + 1}</div>

      {/* Chord timeline: proportional segments */}
      <div className="bar-timeline" ref={timelineRef}>
        {chords.length > 0 ? (
          chords.map((chord, idx) => (
            <div
              key={idx}
              className={`chord-segment ${selectedChord?.symbol === chord.symbol ? 'chord-segment--selected' : ''}`}
              style={{
                flex: effectiveDurations[idx],
                '--chord-color': getChordColor(chord),
              } as Record<string, string | number>}
              onClick={() => onChordSelect?.(chord)}
              title={chord.symbol}
            >
              {/* Drag handle at left edge (between this and previous chord) */}
              {editable && idx > 0 && (
                <div
                  className="drag-handle"
                  onPointerDown={(e) => handleDragStart(idx - 1, e)}
                  onClick={(e) => e.stopPropagation()}
                  title="Drag to adjust duration"
                />
              )}
              <span className="chord-root">{chord.root_name}</span>
              <span className="chord-quality">{getChordQuality(chord)}</span>
              <span className="duration-label">{formatDuration(effectiveDurations[idx])}</span>
              {editable && (
                <button
                  className="chord-remove-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveChord?.(barIndex, idx);
                  }}
                  title="Remove chord"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="chord-segment chord-segment--empty">
            {editable ? null : 'Empty'}
          </div>
        )}

        {/* Riff badge shown inline after chord segments */}
        {bar.has_riff && !expanded && (
          <button
            className="riff-badge"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
            title={bar.riff_analysis || 'Riff / instrumental content'}
          >
            ~~riff~~
          </button>
        )}

        {/* Add chord button / input at end of timeline */}
        {editable &&
          (showInput ? (
            <div className="chord-add-area">
              <InlineChordInput
                onSubmit={(s) => {
                  onAddChord?.(barIndex, s);
                  setShowInput(false);
                }}
                onCancel={() => setShowInput(false)}
              />
            </div>
          ) : (
            <button
              className="chord-add-segment"
              onClick={() => setShowInput(true)}
              title="Add chord"
            >
              <Plus size={14} />
            </button>
          ))}
      </div>

      {/* Expanded riff detail area */}
      <div className={`bar-expanded-detail ${expanded ? 'bar-expanded-detail--open' : ''}`}>
        {expanded && bar.has_riff && (
          <div
            className="riff-detail-content"
            onClick={() => setExpanded(false)}
          >
            <span className="riff-detail-icon">{'\u266A'}</span>
            <span className="riff-analysis-text">
              {bar.riff_analysis || 'Riff / instrumental'}
            </span>
          </div>
        )}
      </div>

      {/* Beat tick marks along the bottom */}
      <div className="beat-ticks">
        {Array.from({ length: beatsPerBar }, (_, i) => (
          <div
            key={i}
            className={`beat-tick ${isPlaying && playingBeat === i + 1 ? 'beat-tick--active' : ''}`}
            style={{ left: `${(i / beatsPerBar) * 100}%`, width: `${100 / beatsPerBar}%` }}
          >
            <span className="beat-number">{i + 1}</span>
          </div>
        ))}
      </div>

      {/* Delete bar button (hover, edit mode) */}
      {editable && isHovered && onDeleteBar && (
        <button
          className="bar-delete"
          onClick={() => onDeleteBar(barIndex)}
          title="Remove bar"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

/** Inline text input for entering a chord symbol */
function InlineChordInput({
  onSubmit,
  onCancel,
}: {
  onSubmit: (symbol: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <input
      ref={ref}
      className="inline-chord-input"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && value.trim()) onSubmit(value.trim());
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={onCancel}
      placeholder="Am7..."
    />
  );
}

/** Extract chord quality string (everything after root) */
function getChordQuality(chord: ChordAnalysis): string {
  const rootName = chord.root_name;
  const symbol = chord.symbol;
  const parts = symbol.split('/');
  const baseSymbol = parts[0];
  const bassNote = parts[1];

  let quality = '';
  if (baseSymbol.startsWith(rootName)) {
    quality = baseSymbol.slice(rootName.length);
  }

  quality = quality
    .replace(/^maj/, 'M')
    .replace(/^min/, 'm')
    .replace(/^dim/, '\u00B0')
    .replace(/^aug/, '+');

  if (bassNote) {
    quality += `/${bassNote}`;
  }

  return quality;
}
