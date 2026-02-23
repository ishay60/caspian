import { useState, useRef, useCallback, useEffect } from 'react';
import type { ChordAnalysis } from '../types';

interface Props {
  chords: ChordAnalysis[];
  onChordHighlight?: (index: number | null) => void;
}

/**
 * Chord Progression Audio Playback Engine.
 * Synthesizes chord tones via Web Audio API OscillatorNode with ADSR envelopes.
 * Compact toolbar/control-bar layout.
 */
export function ChordPlayer({ chords, onChordHighlight }: Props) {
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(90);
  const [volume, setVolume] = useState(0.5);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const schedulerIdRef = useRef<number | null>(null);
  const stopRequestedRef = useRef(false);

  // Keep refs in sync with state so the scheduler closure always reads fresh values
  const bpmRef = useRef(bpm);
  const volumeRef = useRef(volume);
  const playingRef = useRef(playing);

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  // Update master gain in real time when volume changes
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.setValueAtTime(volume, audioCtxRef.current?.currentTime ?? 0);
    }
  }, [volume]);

  /** Convert a pitch class (0-11) to a frequency. Octave determines the base. */
  const pitchToFreq = useCallback((pitchClass: number, octave: number): number => {
    // MIDI note number: octave * 12 + pitchClass (C4 = 60)
    const midi = (octave + 1) * 12 + pitchClass;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }, []);

  /** Play a single chord at a scheduled time using the given AudioContext. */
  const playChord = useCallback(
    (ctx: AudioContext, master: GainNode, chord: ChordAnalysis, startTime: number, duration: number) => {
      const attack = 0.02;
      const decay = 0.1;
      const sustainLevel = 0.7;
      const release = 0.3;

      const noteEnd = startTime + duration;
      const releaseStart = noteEnd - release;
      const perOscGain = 1 / Math.max(chord.pitches.length, 1);

      chord.pitches.forEach((pc) => {
        const isBass = pc === chord.bass;
        const octave = isBass ? 3 : 4;
        const freq = pitchToFreq(pc, octave);

        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        const env = ctx.createGain();
        // ADSR envelope
        env.gain.setValueAtTime(0, startTime);
        env.gain.linearRampToValueAtTime(perOscGain, startTime + attack);
        env.gain.linearRampToValueAtTime(perOscGain * sustainLevel, startTime + attack + decay);
        env.gain.setValueAtTime(perOscGain * sustainLevel, releaseStart);
        env.gain.linearRampToValueAtTime(0, noteEnd);

        osc.connect(env);
        env.connect(master);

        osc.start(startTime);
        osc.stop(noteEnd + 0.01);
      });
    },
    [pitchToFreq],
  );

  /** Stop playback and clean up. */
  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    if (schedulerIdRef.current !== null) {
      clearTimeout(schedulerIdRef.current);
      schedulerIdRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      masterGainRef.current = null;
    }
    setPlaying(false);
    setCurrentIndex(null);
    onChordHighlight?.(null);
  }, [onChordHighlight]);

  /** Start the looping chord scheduler. */
  const play = useCallback(() => {
    if (chords.length === 0) return;

    // Create a fresh audio context
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.setValueAtTime(volumeRef.current, ctx.currentTime);
    master.connect(ctx.destination);
    masterGainRef.current = master;

    stopRequestedRef.current = false;
    setPlaying(true);

    let index = 0;
    let nextTime = ctx.currentTime + 0.05; // small initial delay

    const scheduleNext = () => {
      if (stopRequestedRef.current) return;

      const currentBpm = bpmRef.current;
      const beatDuration = 60 / currentBpm;
      const gap = 0.05; // small articulation gap
      const chordDuration = beatDuration - gap;

      if (chordDuration <= 0.05) return; // safety: BPM too high

      const chord = chords[index];

      // Schedule the audio
      playChord(ctx, master, chord, nextTime, chordDuration);

      // Schedule the UI highlight update
      const delayMs = (nextTime - ctx.currentTime) * 1000;
      const highlightIndex = index;

      setTimeout(() => {
        if (!stopRequestedRef.current) {
          setCurrentIndex(highlightIndex);
          onChordHighlight?.(highlightIndex);
        }
      }, Math.max(0, delayMs));

      // Advance to next chord (loop)
      index = (index + 1) % chords.length;
      nextTime += beatDuration;

      // Schedule the next chord slightly before it needs to play
      const scheduleAhead = (nextTime - ctx.currentTime) * 1000 - 100;
      schedulerIdRef.current = window.setTimeout(scheduleNext, Math.max(0, scheduleAhead));
    };

    scheduleNext();
  }, [chords, playChord, onChordHighlight]);

  /** Toggle play/pause. */
  const togglePlay = useCallback(() => {
    if (playing) {
      stop();
    } else {
      play();
    }
  }, [playing, stop, play]);

  // Clean up on unmount or when chords change
  useEffect(() => {
    return () => {
      stopRequestedRef.current = true;
      if (schedulerIdRef.current !== null) {
        clearTimeout(schedulerIdRef.current);
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Stop playback when chords change
  useEffect(() => {
    if (playing) {
      stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chords]);

  const noChords = chords.length === 0;

  return (
    <div
      className="rounded-xl border px-4 py-3 flex flex-col gap-3"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: playing
          ? 'var(--color-diatonic)'
          : 'var(--color-border)',
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
            // Pause icon: two vertical bars
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="1" width="3.5" height="12" rx="0.75" />
              <rect x="8.5" y="1" width="3.5" height="12" rx="0.75" />
            </svg>
          ) : (
            // Play icon: triangle
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
            type="range"
            min={40}
            max={200}
            step={1}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-24 h-1.5 appearance-none rounded-full cursor-pointer"
            style={{
              accentColor: 'var(--color-accent)',
              backgroundColor: 'var(--color-surface-2)',
            }}
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
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-16 h-1 appearance-none rounded-full cursor-pointer"
            style={{
              accentColor: 'var(--color-accent)',
              backgroundColor: 'var(--color-surface-2)',
            }}
          />
        </div>

        {/* Progress indicator */}
        {currentIndex !== null && (
          <span
            className="text-xs font-mono tabular-nums"
            style={{ color: 'var(--color-neutral)' }}
          >
            {currentIndex + 1}/{chords.length}
          </span>
        )}
      </div>

      {/* Chord symbols row — always LTR so playback order matches visual order (e.g. Hebrew RTL page) */}
      {chords.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 -mx-0.5" dir="ltr">
          {chords.map((chord, i) => {
            const isActive = currentIndex === i;
            return (
              <span
                key={i}
                className="px-2 py-1 rounded-lg text-xs font-mono font-semibold transition-all"
                style={{
                  backgroundColor: isActive
                    ? 'color-mix(in srgb, var(--color-diatonic) 18%, transparent)'
                    : 'transparent',
                  color: isActive
                    ? 'var(--color-diatonic)'
                    : 'var(--color-neutral)',
                  boxShadow: isActive
                    ? '0 0 0 1px var(--color-diatonic)'
                    : 'none',
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
