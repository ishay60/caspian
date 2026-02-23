import { useState, useRef, useCallback, useEffect } from 'react';
import type { ChordAnalysis } from '../types';

interface Props {
  chords: ChordAnalysis[];
  sectionName: string;
}

/* ------------------------------------------------------------------ */
/*  Audio helpers                                                      */
/* ------------------------------------------------------------------ */

/** Play a single tone with ADSR envelope via a triangle oscillator. */
function playTone(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  startTime: number,
  duration: number,
  volume: number,
) {
  const attack = 0.02;
  const decay = 0.1;
  const sustainLevel = 0.5;
  const release = 0.2;

  const noteEnd = startTime + duration;
  const releaseStart = Math.max(startTime + attack + decay, noteEnd - release);

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, startTime);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, startTime);
  env.gain.linearRampToValueAtTime(volume, startTime + attack);
  env.gain.linearRampToValueAtTime(volume * sustainLevel, startTime + attack + decay);
  env.gain.setValueAtTime(volume * sustainLevel, releaseStart);
  env.gain.linearRampToValueAtTime(0, noteEnd);

  osc.connect(env);
  env.connect(dest);

  osc.start(startTime);
  osc.stop(noteEnd + 0.02);
}

/** Play a metronome click (short oscillator burst). */
function playClick(
  ctx: AudioContext,
  dest: AudioNode,
  startTime: number,
  isDownbeat: boolean,
) {
  const freq = isDownbeat ? 800 : 600;
  const duration = 0.03;
  const volume = 0.35;

  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, startTime);

  const env = ctx.createGain();
  env.gain.setValueAtTime(volume, startTime);
  env.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.connect(env);
  env.connect(dest);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

/** Synthesize a chord: bass in octave 2, other tones in octave 3-4. */
function playChord(
  ctx: AudioContext,
  dest: AudioNode,
  chord: ChordAnalysis,
  startTime: number,
  duration: number,
  volume: number,
) {
  const bassPc = ((chord.bass % 12) + 12) % 12;
  const bassFreq = 440 * Math.pow(2, (bassPc - 9) / 12 - 2); // octave 2
  playTone(ctx, dest, bassFreq, startTime, duration * 0.9, volume);

  for (const p of chord.pitches) {
    const pc = ((p % 12) + 12) % 12;
    if (pc === bassPc) continue;
    const freq = 440 * Math.pow(2, (pc - 9) / 12 - 1); // octave 3
    playTone(ctx, dest, freq, startTime, duration * 0.9, volume * 0.8);
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PracticeMode({ chords, sectionName }: Props) {
  /* -- state -- */
  const [bpm, setBpm] = useState(80);
  const [beatsPerChord, setBeatsPerChord] = useState(2);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(chords.length - 1);
  const [playing, setPlaying] = useState(false);
  const [muteMetronome, setMuteMetronome] = useState(false);

  // Visual progress
  const [currentChordIdx, setCurrentChordIdx] = useState<number | null>(null);
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);
  const [countIn, setCountIn] = useState<number | null>(null); // 1-4 during count-in

  /* -- refs for scheduler -- */
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const intervalIdRef = useRef<number | null>(null);
  const stopRequestedRef = useRef(false);

  // Mutable copies so the scheduler always reads fresh values
  const bpmRef = useRef(bpm);
  const beatsPerChordRef = useRef(beatsPerChord);
  const loopStartRef = useRef(loopStart);
  const loopEndRef = useRef(loopEnd);
  const muteMetronomeRef = useRef(muteMetronome);
  const chordsRef = useRef(chords);

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { beatsPerChordRef.current = beatsPerChord; }, [beatsPerChord]);
  useEffect(() => { loopStartRef.current = loopStart; }, [loopStart]);
  useEffect(() => { loopEndRef.current = loopEnd; }, [loopEnd]);
  useEffect(() => { muteMetronomeRef.current = muteMetronome; }, [muteMetronome]);
  useEffect(() => { chordsRef.current = chords; }, [chords]);

  // Reset loop range when chords change
  useEffect(() => {
    setLoopStart(0);
    setLoopEnd(chords.length - 1);
    if (playing) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chords]);

  /* -- Loop selection helpers -- */
  const selectingRef = useRef<'none' | 'start' | 'end'>('none');

  const handleChordClick = useCallback(
    (index: number) => {
      if (playing) return; // don't change loop while playing

      if (selectingRef.current === 'none') {
        // First click sets the start
        setLoopStart(index);
        setLoopEnd(index);
        selectingRef.current = 'end';
      } else if (selectingRef.current === 'end') {
        // Second click sets the end
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
    setLoopEnd(chords.length - 1);
    selectingRef.current = 'none';
  }, [chords.length]);

  /* -- Stop -- */
  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      masterGainRef.current = null;
    }
    setPlaying(false);
    setCurrentChordIdx(null);
    setCurrentBeat(null);
    setCountIn(null);
  }, []);

  /* -- Play -- */
  const play = useCallback(() => {
    if (chords.length === 0) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.setValueAtTime(1, ctx.currentTime);
    master.connect(ctx.destination);
    masterGainRef.current = master;

    stopRequestedRef.current = false;
    setPlaying(true);

    // Scheduler state (lives in closure, mutated by setInterval)
    const state = {
      // We schedule beats as discrete events.
      // The "sequence" is: 4 count-in beats, then the loop forever.
      nextBeatTime: ctx.currentTime + 0.05,
      phase: 'countin' as 'countin' | 'loop',
      countInBeat: 0, // 0-3
      chordIndex: 0,  // index within the looped range
      beatInChord: 0, // 0..(beatsPerChord-1)
    };

    const LOOKAHEAD = 0.1; // seconds to schedule ahead
    const CHECK_INTERVAL = 25; // ms between checks

    const scheduleBeat = () => {
      if (stopRequestedRef.current) return;

      const now = ctx.currentTime;
      const currentBpm = bpmRef.current;
      const beatDuration = 60 / currentBpm;

      while (state.nextBeatTime < now + LOOKAHEAD) {
        if (stopRequestedRef.current) return;

        const t = state.nextBeatTime;

        if (state.phase === 'countin') {
          // Count-in: just click, no chord
          if (!muteMetronomeRef.current) {
            playClick(ctx, master, t, state.countInBeat === 0);
          }

          // Schedule UI update
          const ciBeat = state.countInBeat + 1; // 1-4 for display
          const delayMs = Math.max(0, (t - ctx.currentTime) * 1000);
          setTimeout(() => {
            if (!stopRequestedRef.current) {
              setCountIn(ciBeat);
              setCurrentBeat(null);
              setCurrentChordIdx(null);
            }
          }, delayMs);

          state.countInBeat++;
          if (state.countInBeat >= 4) {
            state.phase = 'loop';
            state.chordIndex = 0;
            state.beatInChord = 0;
          }
        } else {
          // Loop phase
          const ls = loopStartRef.current;
          const le = loopEndRef.current;
          const bpc = beatsPerChordRef.current;
          const loopChords = chordsRef.current;

          const actualIdx = ls + state.chordIndex;
          const chord = loopChords[actualIdx];

          if (chord) {
            // Metronome click
            if (!muteMetronomeRef.current) {
              playClick(ctx, master, t, state.beatInChord === 0);
            }

            // Play chord sound on the first beat of each chord
            if (state.beatInChord === 0) {
              const chordDuration = beatDuration * bpc;
              playChord(ctx, master, chord, t, chordDuration, 0.15);
            }

            // Schedule UI update
            const uiChordIdx = actualIdx;
            const uiBeat = state.beatInChord + 1;
            const delayMs = Math.max(0, (t - ctx.currentTime) * 1000);
            setTimeout(() => {
              if (!stopRequestedRef.current) {
                setCountIn(null);
                setCurrentChordIdx(uiChordIdx);
                setCurrentBeat(uiBeat);
              }
            }, delayMs);
          }

          // Advance
          state.beatInChord++;
          if (state.beatInChord >= bpc) {
            state.beatInChord = 0;
            state.chordIndex++;
            const loopLen = le - ls + 1;
            if (state.chordIndex >= loopLen) {
              state.chordIndex = 0;
            }
          }
        }

        state.nextBeatTime += beatDuration;
      }
    };

    // Run the scheduler on an interval
    intervalIdRef.current = window.setInterval(scheduleBeat, CHECK_INTERVAL);
    // Kick off immediately
    scheduleBeat();
  }, [chords]);

  const togglePlay = useCallback(() => {
    if (playing) {
      stop();
    } else {
      play();
    }
  }, [playing, stop, play]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRequestedRef.current = true;
      if (intervalIdRef.current !== null) clearInterval(intervalIdRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  /* -- derived -- */
  const loopLength = loopEnd - loopStart + 1;
  const noChords = chords.length === 0;

  /* -- render -- */
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
        style={{
          backgroundColor: 'var(--color-surface-2)',
          borderColor: 'var(--color-border)',
        }}
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
        {currentBeat !== null && countIn === null && (
          <span
            className="text-sm font-mono tabular-nums"
            style={{ color: 'var(--color-neutral)' }}
          >
            Beat {currentBeat}/{beatsPerChord}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Controls row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Play/Stop button */}
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
              /* Stop icon */
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <rect x="1" y="1" width="10" height="10" rx="1" />
              </svg>
            ) : (
              /* Play icon */
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
              title="Decrease tempo"
            >
              −
            </button>
            <label
              className="text-[10px] uppercase tracking-widest font-semibold select-none"
              style={{ color: 'var(--color-neutral)' }}
            >
              BPM
            </label>
            <input
              type="range"
              min={40}
              max={200}
              step={1}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-24 h-1 appearance-none rounded-full cursor-pointer"
              style={{
                accentColor: 'var(--color-accent)',
                backgroundColor: 'var(--color-surface-2)',
              }}
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
              title="Increase tempo"
            >
              +
            </button>
          </div>

          {/* Beats per chord selector */}
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
                  backgroundColor:
                    beatsPerChord === b
                      ? 'var(--color-accent)'
                      : 'var(--color-surface-2)',
                  color: beatsPerChord === b ? '#fff' : 'var(--color-text)',
                  border: `1px solid ${beatsPerChord === b ? 'var(--color-accent)' : 'var(--color-border)'}`,
                }}
              >
                {b}
              </button>
            ))}
          </div>

          {/* Mute metronome toggle */}
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
            {/* Metronome icon */}
            <svg
              width="12"
              height="14"
              viewBox="0 0 12 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="2,13 10,13 8,1 4,1" />
              <line x1="6" y1="10" x2="9" y2="3" />
            </svg>
            {muteMetronome ? 'Click off' : 'Click on'}
          </button>
        </div>

        {/* Loop selection info + reset */}
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] uppercase tracking-wider font-semibold select-none"
            style={{ color: 'var(--color-neutral)' }}
          >
            Loop: {loopLength} chord{loopLength !== 1 ? 's' : ''}
          </span>
          {(loopStart !== 0 || loopEnd !== chords.length - 1) && (
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
            <span
              className="text-[10px] italic"
              style={{ color: 'var(--color-neutral)' }}
            >
              Click chords to set loop range
            </span>
          )}
        </div>

        {/* Chord badges with beat indicators — LTR so order matches playback (e.g. Hebrew RTL page) */}
        {chords.length > 0 && (
          <div className="flex flex-wrap items-start gap-2" dir="ltr">
            {chords.map((chord, i) => {
              const inLoop = i >= loopStart && i <= loopEnd;
              const isActive = currentChordIdx === i;

              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  {/* Chord badge */}
                  <button
                    onClick={() => handleChordClick(i)}
                    disabled={playing}
                    className="relative rounded-xl px-3.5 py-2 transition-all cursor-pointer disabled:cursor-default border"
                    style={{
                      borderColor: isActive
                        ? 'var(--color-accent)'
                        : inLoop
                          ? 'var(--color-diatonic)'
                          : 'var(--color-border)',
                      backgroundColor: isActive
                        ? 'color-mix(in srgb, var(--color-accent) 18%, transparent)'
                        : inLoop
                          ? 'var(--color-surface-2)'
                          : 'var(--color-surface)',
                      opacity: inLoop || isActive ? 1 : 0.4,
                      boxShadow: isActive
                        ? '0 0 8px color-mix(in srgb, var(--color-accent) 40%, transparent)'
                        : 'none',
                      animation: isActive ? 'practicemode-pulse 0.6s ease-in-out infinite alternate' : 'none',
                    }}
                  >
                    <div
                      className="font-mono font-semibold text-sm"
                      style={{
                        color: isActive
                          ? 'var(--color-accent)'
                          : chord.is_diatonic
                            ? 'var(--color-diatonic)'
                            : 'var(--color-text)',
                      }}
                    >
                      {chord.symbol}
                    </div>
                    <div
                      className="text-[10px] text-center"
                      style={{ color: 'var(--color-neutral)' }}
                    >
                      {chord.roman_numeral}
                    </div>
                  </button>

                  {/* Beat indicator dots */}
                  {inLoop && (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: beatsPerChord }, (_, b) => {
                        const beatActive =
                          isActive && currentBeat !== null && currentBeat === b + 1;
                        return (
                          <div
                            key={b}
                            className="rounded-full transition-all"
                            style={{
                              width: beatActive ? 7 : 5,
                              height: beatActive ? 7 : 5,
                              backgroundColor: beatActive
                                ? 'var(--color-accent)'
                                : 'var(--color-border)',
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

      {/* Pulse keyframes injected as inline style tag */}
      <style>{`
        @keyframes practicemode-pulse {
          from {
            box-shadow: 0 0 4px color-mix(in srgb, var(--color-accent) 30%, transparent);
          }
          to {
            box-shadow: 0 0 12px color-mix(in srgb, var(--color-accent) 60%, transparent);
          }
        }
      `}</style>
    </div>
  );
}
