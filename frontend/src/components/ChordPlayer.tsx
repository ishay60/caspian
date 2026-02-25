import { useState, useRef, useCallback, useEffect } from 'react';
import type { ChordAnalysis, BarAnalysis } from '../types';
import { PlaybackEngine, type PlaybackCursor } from '../lib/playbackEngine';

interface Props {
  chords: ChordAnalysis[];
  bars?: BarAnalysis[];
  onChordHighlight?: (index: number | null) => void;
  onCursorChange?: (cursor: PlaybackCursor | null) => void;
}

/**
 * Chord Progression Audio Playback.
 * Uses PlaybackEngine for bar-aware scheduling.
 * Falls back to flat chord list when no bars available.
 */
export function ChordPlayer({ chords, bars, onChordHighlight, onCursorChange }: Props) {
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(90);
  const [volume, setVolume] = useState(0.5);
  const [metronome, setMetronome] = useState(false);
  const [cursor, setCursor] = useState<PlaybackCursor | null>(null);

  const engineRef = useRef<PlaybackEngine | null>(null);

  const hasBars = bars && bars.length > 0;
  const noChords = chords.length === 0 && !hasBars;

  // Sync BPM/volume/metronome to engine
  useEffect(() => {
    engineRef.current?.updateConfig({ bpm });
  }, [bpm]);

  useEffect(() => {
    engineRef.current?.updateConfig({ volume });
  }, [volume]);

  useEffect(() => {
    engineRef.current?.updateConfig({ metronome });
  }, [metronome]);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    setPlaying(false);
    setCursor(null);
    onChordHighlight?.(null);
    onCursorChange?.(null);
  }, [onChordHighlight, onCursorChange]);

  const play = useCallback(() => {
    if (noChords) return;

    const engine = new PlaybackEngine(
      {
        onCursorChange: (c) => {
          setCursor(c);
          onCursorChange?.(c);
          // Map barIndex to flat chord index for backward compat
          if (c) {
            if (hasBars) {
              // Sum chords in bars before current bar + chordIndexInBar
              let flatIdx = 0;
              for (let i = 0; i < c.barIndex && i < (bars?.length ?? 0); i++) {
                flatIdx += bars![i].chord_analyses.length;
              }
              flatIdx += c.chordIndexInBar;
              onChordHighlight?.(flatIdx);
            } else {
              onChordHighlight?.(c.barIndex);
            }
          } else {
            onChordHighlight?.(null);
          }
        },
      },
      { bpm, volume, metronome, countIn: false },
    );

    if (hasBars) {
      engine.loadBars(bars!, 4);
    } else {
      engine.loadChords(chords, 1);
    }

    engineRef.current = engine;
    setPlaying(true);
    engine.play();
  }, [chords, bars, hasBars, noChords, bpm, volume, metronome, onChordHighlight, onCursorChange]);

  const togglePlay = useCallback(() => {
    if (playing) stop(); else play();
  }, [playing, stop, play]);

  // Stop on unmount
  useEffect(() => {
    return () => { engineRef.current?.destroy(); };
  }, []);

  // Stop when data changes
  useEffect(() => {
    if (playing) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chords, bars]);

  // Derive display chords (flat list for the badge row)
  const displayChords = hasBars
    ? bars!.flatMap((b) => b.chord_analyses)
    : chords;

  // Current flat index for highlighting
  const currentFlatIndex = (() => {
    if (!cursor) return null;
    if (!hasBars) return cursor.barIndex;
    let idx = 0;
    for (let i = 0; i < cursor.barIndex && i < bars!.length; i++) {
      idx += bars![i].chord_analyses.length;
    }
    return idx + cursor.chordIndexInBar;
  })();

  return (
    <div
      className="rounded-xl border px-4 py-3 flex flex-col gap-3"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: playing ? 'var(--color-diatonic)' : 'var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Play / Pause button */}
        <button
          onClick={togglePlay}
          disabled={noChords}
          className="flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          style={{
            backgroundColor: playing ? 'var(--color-diatonic)' : 'var(--color-accent)',
            color: '#fff',
            boxShadow: playing
              ? '0 0 14px color-mix(in srgb, var(--color-diatonic) 50%, transparent)'
              : '0 2px 8px color-mix(in srgb, var(--color-accent) 35%, transparent)',
          }}
          title={playing ? 'Pause' : 'Play chord progression'}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="1" width="3.5" height="12" rx="0.75" />
              <rect x="8.5" y="1" width="3.5" height="12" rx="0.75" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <polygon points="3,1 13,7 3,13" />
            </svg>
          )}
        </button>

        {/* BPM control */}
        <div className="flex items-center gap-2">
          <label
            className="text-[10px] uppercase tracking-widest font-semibold select-none"
            style={{ color: 'var(--color-neutral)' }}
          >
            BPM
          </label>
          <input
            type="range" min={40} max={200} step={1} value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-24 h-1.5 appearance-none rounded-full cursor-pointer"
            style={{ accentColor: 'var(--color-accent)', backgroundColor: 'var(--color-surface-2)' }}
          />
          <span
            className="text-xs font-mono w-8 text-right tabular-nums font-medium"
            style={{ color: 'var(--color-text)' }}
          >
            {bpm}
          </span>
        </div>

        {/* Volume control */}
        <div className="flex items-center gap-2">
          <label
            className="text-[10px] uppercase tracking-widest font-semibold select-none"
            style={{ color: 'var(--color-neutral)' }}
          >
            Vol
          </label>
          <input
            type="range" min={0} max={1} step={0.01} value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-16 h-1 appearance-none rounded-full cursor-pointer"
            style={{ accentColor: 'var(--color-accent)', backgroundColor: 'var(--color-surface-2)' }}
          />
        </div>

        {/* Metronome toggle */}
        <button
          onClick={() => setMetronome((m) => !m)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-pointer transition-colors"
          style={{
            backgroundColor: metronome
              ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)'
              : 'var(--color-surface-2)',
            color: metronome ? 'var(--color-accent)' : 'var(--color-neutral)',
            border: `1px solid ${metronome ? 'var(--color-accent)' : 'var(--color-border)'}`,
          }}
          title={metronome ? 'Mute metronome' : 'Enable metronome'}
        >
          <svg width="12" height="14" viewBox="0 0 12 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="2,13 10,13 8,1 4,1" />
            <line x1="6" y1="10" x2="9" y2="3" />
          </svg>
          {metronome ? 'On' : 'Off'}
        </button>

        {/* Progress / bar indicator */}
        {cursor && (
          <span
            className="text-xs font-mono tabular-nums"
            style={{ color: 'var(--color-neutral)' }}
          >
            {hasBars
              ? `Bar ${cursor.barIndex + 1}/${bars!.length} · Beat ${cursor.beat}/${cursor.beatsPerBar}`
              : `${cursor.barIndex + 1}/${chords.length}`}
          </span>
        )}
      </div>

      {/* Chord symbols row — always LTR */}
      {displayChords.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 -mx-0.5" dir="ltr">
          {displayChords.map((chord, i) => {
            const isActive = currentFlatIndex === i;
            return (
              <span
                key={i}
                className="px-2 py-1 rounded-lg text-xs font-mono font-semibold transition-all"
                style={{
                  backgroundColor: isActive
                    ? 'color-mix(in srgb, var(--color-diatonic) 18%, transparent)'
                    : 'transparent',
                  color: isActive ? 'var(--color-diatonic)' : 'var(--color-neutral)',
                  boxShadow: isActive ? '0 0 0 1px var(--color-diatonic)' : 'none',
                }}
              >
                {chord.symbol}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
