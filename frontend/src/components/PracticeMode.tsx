import { useState, useRef, useCallback, useEffect } from 'react';
import type { ChordAnalysis, BarAnalysis } from '../types';
import { PlaybackEngine, type PlaybackCursor } from '../lib/playbackEngine';

interface Props {
  chords: ChordAnalysis[];
  bars?: BarAnalysis[];
  sectionName: string;
  onCursorChange?: (cursor: PlaybackCursor | null) => void;
}

/**
 * Practice Mode — bar-aware loop playback with count-in, metronome, BPM control.
 * Uses PlaybackEngine for scheduling. Supports both bar-based and flat chord data.
 */
export function PracticeMode({ chords, bars, sectionName, onCursorChange }: Props) {
  const [bpm, setBpm] = useState(80);
  const [beatsPerChord, setBeatsPerChord] = useState(2);
  const [playing, setPlaying] = useState(false);
  const [muteMetronome, setMuteMetronome] = useState(false);

  const hasBars = bars && bars.length > 0;

  // Loop range: in bar mode, indexes refer to bars; in flat mode, to chords
  const itemCount = hasBars ? bars!.length : chords.length;
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(itemCount - 1);

  // Visual progress
  const [cursor, setCursor] = useState<PlaybackCursor | null>(null);
  const [countIn, setCountIn] = useState<number | null>(null);

  const engineRef = useRef<PlaybackEngine | null>(null);

  // Keep loop end in sync when data changes
  useEffect(() => {
    setLoopStart(0);
    setLoopEnd(itemCount - 1);
    if (playing) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chords, bars, itemCount]);

  // Sync settings to engine
  useEffect(() => { engineRef.current?.updateConfig({ bpm }); }, [bpm]);
  useEffect(() => { engineRef.current?.updateConfig({ metronome: !muteMetronome }); }, [muteMetronome]);

  /* -- Loop selection -- */
  const selectingRef = useRef<'none' | 'start' | 'end'>('none');

  const handleItemClick = useCallback(
    (index: number) => {
      if (playing) return;
      if (selectingRef.current === 'none') {
        setLoopStart(index);
        setLoopEnd(index);
        selectingRef.current = 'end';
      } else {
        if (index >= loopStart) {
          setLoopEnd(index);
        } else {
          setLoopStart(index);
          setLoopEnd(loopStart);
        }
        selectingRef.current = 'none';
      }
    },
    [playing, loopStart],
  );

  const resetLoop = useCallback(() => {
    setLoopStart(0);
    setLoopEnd(itemCount - 1);
    selectingRef.current = 'none';
  }, [itemCount]);

  /* -- Stop -- */
  const stop = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    setPlaying(false);
    setCursor(null);
    setCountIn(null);
    onCursorChange?.(null);
  }, [onCursorChange]);

  /* -- Play -- */
  const play = useCallback(() => {
    if (itemCount === 0) return;

    const engine = new PlaybackEngine(
      {
        onCursorChange: (c) => {
          setCursor(c);
          onCursorChange?.(c);
        },
        onCountIn: (beat) => {
          setCountIn(beat);
        },
      },
      {
        bpm,
        volume: 0.5,
        metronome: !muteMetronome,
        countIn: true,
        loopRange: { start: loopStart, end: loopEnd },
      },
    );

    if (hasBars) {
      engine.loadBars(bars!, 4);
    } else {
      engine.loadChords(chords, beatsPerChord);
    }

    engineRef.current = engine;
    setPlaying(true);
    engine.play();
  }, [chords, bars, hasBars, itemCount, bpm, beatsPerChord, muteMetronome, loopStart, loopEnd, onCursorChange]);

  const togglePlay = useCallback(() => {
    if (playing) stop(); else play();
  }, [playing, stop, play]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { engineRef.current?.destroy(); };
  }, []);

  /* -- Derived -- */
  const loopLength = loopEnd - loopStart + 1;
  const noChords = itemCount === 0;

  // Flat chord list for display
  const displayChords = hasBars
    ? bars!.flatMap((b) => b.chord_analyses)
    : chords;

  // Map cursor to display item index
  const activeItemIndex = cursor?.barIndex ?? null;

  // For flat mode: map cursor to specific chord index
  const activeFlatChordIndex = (() => {
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
      className="rounded-2xl overflow-hidden"
      style={{
        border: `1px solid ${playing ? 'var(--color-accent)' : 'var(--color-border)'}`,
        backgroundColor: 'var(--color-surface)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-3.5 border-b flex items-center justify-between"
        style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2.5">
          <h3
            className="font-semibold text-sm uppercase tracking-widest"
            style={{ color: 'var(--color-neutral)', letterSpacing: '0.08em' }}
          >
            Practice Loop
          </h3>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-lg"
            style={{
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-neutral)',
              border: '1px solid var(--color-border)',
            }}
          >
            {sectionName}
          </span>
          {hasBars && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                color: 'var(--color-accent)',
              }}
            >
              Bar-aware
            </span>
          )}
        </div>

        {/* Count-in display */}
        {countIn !== null && (
          <span
            className="text-lg font-bold font-mono tabular-nums animate-pulse"
            style={{ color: 'var(--color-accent)' }}
          >
            {countIn}
          </span>
        )}

        {/* Current beat display */}
        {cursor && countIn === null && (
          <span className="text-sm font-mono tabular-nums" style={{ color: 'var(--color-neutral)' }}>
            {hasBars
              ? `Bar ${cursor.barIndex + 1} · Beat ${cursor.beat}/${cursor.beatsPerBar}`
              : `Beat ${cursor.beat}/${cursor.beatsPerBar}`}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Controls row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Play/Stop */}
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
            title={playing ? 'Stop' : 'Play practice loop'}
          >
            {playing ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <rect x="1" y="1" width="10" height="10" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <polygon points="3,1 13,7 3,13" />
              </svg>
            )}
          </button>

          {/* BPM control */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBpm((b) => Math.max(40, b - 5))}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            >
              -
            </button>
            <label
              className="text-[10px] uppercase tracking-widest font-semibold select-none"
              style={{ color: 'var(--color-neutral)' }}
            >
              BPM
            </label>
            <input
              type="range" min={40} max={200} step={1} value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-24 h-1 appearance-none rounded-full cursor-pointer"
              style={{ accentColor: 'var(--color-accent)', backgroundColor: 'var(--color-surface-2)' }}
            />
            <span
              className="text-xs font-mono w-7 text-right tabular-nums"
              style={{ color: 'var(--color-text)' }}
            >
              {bpm}
            </span>
            <button
              onClick={() => setBpm((b) => Math.min(200, b + 5))}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            >
              +
            </button>
          </div>

          {/* Beats per chord (flat mode only) */}
          {!hasBars && (
            <div className="flex items-center gap-1.5">
              <label
                className="text-[10px] uppercase tracking-wider font-semibold select-none"
                style={{ color: 'var(--color-neutral)' }}
              >
                Beats
              </label>
              {[1, 2, 4].map((b) => (
                <button
                  key={b}
                  onClick={() => setBeatsPerChord(b)}
                  className="w-7 h-7 rounded text-xs font-mono font-semibold cursor-pointer transition-all"
                  style={{
                    backgroundColor: beatsPerChord === b ? 'var(--color-accent)' : 'var(--color-surface-2)',
                    color: beatsPerChord === b ? '#fff' : 'var(--color-text)',
                    border: `1px solid ${beatsPerChord === b ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  }}
                >
                  {b}
                </button>
              ))}
            </div>
          )}

          {/* Mute metronome */}
          <button
            onClick={() => setMuteMetronome((m) => !m)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-pointer transition-colors"
            style={{
              backgroundColor: muteMetronome
                ? 'var(--color-surface-2)'
                : 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
              color: muteMetronome ? 'var(--color-neutral)' : 'var(--color-accent)',
              border: `1px solid ${muteMetronome ? 'var(--color-border)' : 'var(--color-accent)'}`,
            }}
            title={muteMetronome ? 'Unmute metronome' : 'Mute metronome'}
          >
            <svg width="12" height="14" viewBox="0 0 12 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="2,13 10,13 8,1 4,1" />
              <line x1="6" y1="10" x2="9" y2="3" />
            </svg>
            {muteMetronome ? 'Click off' : 'Click on'}
          </button>
        </div>

        {/* Loop info + reset */}
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] uppercase tracking-wider font-semibold select-none"
            style={{ color: 'var(--color-neutral)' }}
          >
            Loop: {loopLength} {hasBars ? (loopLength === 1 ? 'bar' : 'bars') : (loopLength === 1 ? 'chord' : 'chords')}
          </span>
          {(loopStart !== 0 || loopEnd !== itemCount - 1) && (
            <button
              onClick={resetLoop}
              disabled={playing}
              className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                color: 'var(--color-neutral)',
                border: '1px solid var(--color-border)',
              }}
            >
              Reset
            </button>
          )}
          {!playing && (
            <span className="text-[10px] italic" style={{ color: 'var(--color-neutral)' }}>
              Click {hasBars ? 'bars' : 'chords'} to set loop range
            </span>
          )}
        </div>

        {/* Item badges — bars or chords */}
        {hasBars ? (
          // Bar-mode display: show bars with their chords
          <div className="flex flex-wrap items-start gap-2" dir="ltr">
            {bars!.map((bar, barIdx) => {
              const inLoop = barIdx >= loopStart && barIdx <= loopEnd;
              const isActive = activeItemIndex === barIdx && countIn === null;

              return (
                <div key={barIdx} className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => handleItemClick(barIdx)}
                    disabled={playing}
                    className="relative rounded-xl px-3.5 py-2 transition-all cursor-pointer disabled:cursor-default border"
                    style={{
                      borderColor: isActive ? 'var(--color-accent)' : inLoop ? 'var(--color-diatonic)' : 'var(--color-border)',
                      backgroundColor: isActive
                        ? 'color-mix(in srgb, var(--color-accent) 18%, transparent)'
                        : inLoop ? 'var(--color-surface-2)' : 'var(--color-surface)',
                      opacity: inLoop || isActive ? 1 : 0.4,
                      boxShadow: isActive ? '0 0 8px color-mix(in srgb, var(--color-accent) 40%, transparent)' : 'none',
                      animation: isActive ? 'practicemode-pulse 0.6s ease-in-out infinite alternate' : 'none',
                    }}
                  >
                    <div className="text-[10px] font-semibold mb-0.5" style={{ color: 'var(--color-neutral)' }}>
                      Bar {barIdx + 1}
                    </div>
                    <div className="flex items-center gap-1">
                      {bar.chord_analyses.map((chord, ci) => {
                        const chordActive = isActive && cursor?.chordIndexInBar === ci;
                        return (
                          <span
                            key={ci}
                            className="font-mono font-semibold text-sm px-1 rounded"
                            style={{
                              color: chordActive ? 'var(--color-accent)' : chord.is_diatonic ? 'var(--color-diatonic)' : 'var(--color-text)',
                              backgroundColor: chordActive ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
                            }}
                          >
                            {chord.symbol}
                          </span>
                        );
                      })}
                    </div>
                  </button>

                  {/* Beat indicator dots */}
                  {inLoop && (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 4 }, (_, b) => {
                        const beatActive = isActive && cursor?.beat === b + 1;
                        return (
                          <div
                            key={b}
                            className="rounded-full transition-all"
                            style={{
                              width: beatActive ? 7 : 5,
                              height: beatActive ? 7 : 5,
                              backgroundColor: beatActive ? 'var(--color-accent)' : 'var(--color-border)',
                              transition: 'all 0.1s',
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // Flat chord display (legacy)
          <div className="flex flex-wrap items-start gap-2" dir="ltr">
            {chords.map((chord, i) => {
              const inLoop = i >= loopStart && i <= loopEnd;
              const isActive = activeFlatChordIndex === i && countIn === null;

              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => handleItemClick(i)}
                    disabled={playing}
                    className="relative rounded-xl px-3.5 py-2 transition-all cursor-pointer disabled:cursor-default border"
                    style={{
                      borderColor: isActive ? 'var(--color-accent)' : inLoop ? 'var(--color-diatonic)' : 'var(--color-border)',
                      backgroundColor: isActive
                        ? 'color-mix(in srgb, var(--color-accent) 18%, transparent)'
                        : inLoop ? 'var(--color-surface-2)' : 'var(--color-surface)',
                      opacity: inLoop || isActive ? 1 : 0.4,
                      boxShadow: isActive ? '0 0 8px color-mix(in srgb, var(--color-accent) 40%, transparent)' : 'none',
                      animation: isActive ? 'practicemode-pulse 0.6s ease-in-out infinite alternate' : 'none',
                    }}
                  >
                    <div
                      className="font-mono font-semibold text-sm"
                      style={{
                        color: isActive ? 'var(--color-accent)' : chord.is_diatonic ? 'var(--color-diatonic)' : 'var(--color-text)',
                      }}
                    >
                      {chord.symbol}
                    </div>
                    <div className="text-[10px] text-center" style={{ color: 'var(--color-neutral)' }}>
                      {chord.roman_numeral}
                    </div>
                  </button>

                  {inLoop && (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: beatsPerChord }, (_, b) => {
                        const beatActive = isActive && cursor?.beat === b + 1;
                        return (
                          <div
                            key={b}
                            className="rounded-full transition-all"
                            style={{
                              width: beatActive ? 7 : 5,
                              height: beatActive ? 7 : 5,
                              backgroundColor: beatActive ? 'var(--color-accent)' : 'var(--color-border)',
                              transition: 'all 0.1s',
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes practicemode-pulse {
          from { box-shadow: 0 0 4px color-mix(in srgb, var(--color-accent) 30%, transparent); }
          to { box-shadow: 0 0 12px color-mix(in srgb, var(--color-accent) 60%, transparent); }
        }
      `}</style>
    </div>
  );
}
