/**
 * Playback Engine
 *
 * Bar-aware audio scheduling for chord progressions.
 * Handles both bar-based (BarAnalysis[]) and flat chord (ChordAnalysis[]) input.
 * Fires cursor callbacks for UI synchronization.
 */

import type { ChordAnalysis, BarAnalysis } from '../types';
import { playClick } from './metronome';

/* ------------------------------------------------------------------ */
/*  Audio synthesis helpers                                            */
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

/** Synthesize a chord: bass in octave 2, other tones in octave 3. */
function synthChord(
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
/*  Timeline event types                                               */
/* ------------------------------------------------------------------ */

export interface PlaybackCursor {
  /** Index of the bar being played (or chord index in flat mode) */
  barIndex: number;
  /** Index of the chord within the current bar */
  chordIndexInBar: number;
  /** Current beat (1-based) */
  beat: number;
  /** Total beats per bar */
  beatsPerBar: number;
}

interface ScheduledEvent {
  /** Absolute beat offset from song start */
  beatOffset: number;
  /** Duration in beats */
  durationBeats: number;
  /** Chord to play (null for metronome-only beats) */
  chord: ChordAnalysis | null;
  /** Is this beat 1 of a bar? */
  isDownbeat: boolean;
  /** Is this the first beat of a new chord? */
  isChordOnset: boolean;
  /** Cursor state for this event */
  cursor: PlaybackCursor;
}

/* ------------------------------------------------------------------ */
/*  Timeline builders                                                  */
/* ------------------------------------------------------------------ */

/** Build a timeline from BarAnalysis[], respecting chord durations within bars. */
function buildBarTimeline(bars: BarAnalysis[], defaultBeatsPerBar: number): ScheduledEvent[] {
  const events: ScheduledEvent[] = [];
  let beatOffset = 0;

  for (let barIdx = 0; barIdx < bars.length; barIdx++) {
    const bar = bars[barIdx];
    const chords = bar.chord_analyses;
    const beatsPerBar = defaultBeatsPerBar;

    if (chords.length === 0) {
      // Empty bar — just metronome clicks
      for (let beat = 0; beat < beatsPerBar; beat++) {
        events.push({
          beatOffset: beatOffset + beat,
          durationBeats: 1,
          chord: null,
          isDownbeat: beat === 0,
          isChordOnset: false,
          cursor: { barIndex: barIdx, chordIndexInBar: 0, beat: beat + 1, beatsPerBar },
        });
      }
    } else {
      // Distribute beats equally among chords (unless durations are specified later)
      const beatsPerChord = beatsPerBar / chords.length;

      for (let chordIdx = 0; chordIdx < chords.length; chordIdx++) {
        const chordBeatStart = chordIdx * beatsPerChord;
        const wholeBeats = Math.ceil(beatsPerChord);

        for (let subBeat = 0; subBeat < wholeBeats; subBeat++) {
          const globalBeat = beatOffset + chordBeatStart + subBeat;
          const barBeat = Math.floor(chordBeatStart + subBeat);

          events.push({
            beatOffset: globalBeat,
            durationBeats: beatsPerChord,
            chord: chords[chordIdx],
            isDownbeat: barBeat === 0 && subBeat === 0,
            isChordOnset: subBeat === 0,
            cursor: {
              barIndex: barIdx,
              chordIndexInBar: chordIdx,
              beat: barBeat + 1,
              beatsPerBar,
            },
          });
        }
      }
    }

    beatOffset += beatsPerBar;
  }

  return events;
}

/** Build a timeline from a flat ChordAnalysis[], one chord per "beatsPerChord" beats. */
function buildFlatTimeline(
  chords: ChordAnalysis[],
  beatsPerChord: number,
): ScheduledEvent[] {
  const events: ScheduledEvent[] = [];
  let beatOffset = 0;

  for (let i = 0; i < chords.length; i++) {
    for (let beat = 0; beat < beatsPerChord; beat++) {
      events.push({
        beatOffset: beatOffset + beat,
        durationBeats: beatsPerChord,
        chord: chords[i],
        isDownbeat: beat === 0,
        isChordOnset: beat === 0,
        cursor: {
          barIndex: i,
          chordIndexInBar: 0,
          beat: beat + 1,
          beatsPerBar: beatsPerChord,
        },
      });
    }
    beatOffset += beatsPerChord;
  }

  return events;
}

/* ------------------------------------------------------------------ */
/*  Engine                                                             */
/* ------------------------------------------------------------------ */

export interface PlaybackCallbacks {
  onCursorChange: (cursor: PlaybackCursor | null) => void;
  onCountIn?: (beat: number | null) => void;
}

export interface PlaybackConfig {
  bpm: number;
  volume: number;
  metronome: boolean;
  countIn: boolean;
  /** Loop range in bar/chord indices (inclusive). Null = play all. */
  loopRange?: { start: number; end: number } | null;
}

export class PlaybackEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private events: ScheduledEvent[] = [];
  private intervalId: number | null = null;
  private stopRequested = false;

  private config: PlaybackConfig;
  private callbacks: PlaybackCallbacks;

  // Mutable scheduler state
  private nextBeatTime = 0;
  private eventIndex = 0;
  private phase: 'countin' | 'playing' = 'playing';
  private countInBeat = 0;

  private static readonly LOOKAHEAD = 0.1; // seconds
  private static readonly CHECK_INTERVAL = 25; // ms

  constructor(callbacks: PlaybackCallbacks, config: PlaybackConfig) {
    this.callbacks = callbacks;
    this.config = { ...config };
  }

  /** Load bar-based data. */
  loadBars(bars: BarAnalysis[], beatsPerBar = 4): void {
    this.events = buildBarTimeline(bars, beatsPerBar);
  }

  /** Load flat chord list data. */
  loadChords(chords: ChordAnalysis[], beatsPerChord = 1): void {
    this.events = buildFlatTimeline(chords, beatsPerChord);
  }

  /** Update config dynamically (BPM, volume, metronome). */
  updateConfig(partial: Partial<PlaybackConfig>): void {
    Object.assign(this.config, partial);
    if (this.masterGain && this.ctx && partial.volume !== undefined) {
      this.masterGain.gain.setValueAtTime(partial.volume, this.ctx.currentTime);
    }
  }

  get isPlaying(): boolean {
    return this.ctx !== null && !this.stopRequested;
  }

  /** Start playback. */
  play(): void {
    if (this.events.length === 0) return;

    const ctx = new AudioContext();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.setValueAtTime(this.config.volume, ctx.currentTime);
    master.connect(ctx.destination);
    this.masterGain = master;

    this.stopRequested = false;
    this.eventIndex = 0;
    this.nextBeatTime = ctx.currentTime + 0.05;

    if (this.config.countIn) {
      this.phase = 'countin';
      this.countInBeat = 0;
    } else {
      this.phase = 'playing';
    }

    // Apply loop range filter
    this.applyLoopRange();

    this.intervalId = window.setInterval(
      () => this.schedulerTick(),
      PlaybackEngine.CHECK_INTERVAL,
    );
    this.schedulerTick();
  }

  /** Stop playback and clean up. */
  stop(): void {
    this.stopRequested = true;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.masterGain = null;
    }
    this.callbacks.onCursorChange(null);
    this.callbacks.onCountIn?.(null);
  }

  /** Destroy the engine (call on unmount). */
  destroy(): void {
    this.stop();
  }

  private loopEvents: ScheduledEvent[] = [];

  private applyLoopRange(): void {
    const range = this.config.loopRange;
    if (!range) {
      this.loopEvents = this.events;
      return;
    }

    this.loopEvents = this.events.filter(
      (e) => e.cursor.barIndex >= range.start && e.cursor.barIndex <= range.end,
    );

    if (this.loopEvents.length === 0) {
      this.loopEvents = this.events;
    }
  }

  private schedulerTick(): void {
    if (this.stopRequested || !this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const master = this.masterGain;
    const now = ctx.currentTime;
    const beatDuration = 60 / this.config.bpm;

    while (this.nextBeatTime < now + PlaybackEngine.LOOKAHEAD) {
      if (this.stopRequested) return;

      const t = this.nextBeatTime;

      if (this.phase === 'countin') {
        // Count-in: just clicks
        if (this.config.metronome) {
          playClick(ctx, master, t, this.countInBeat === 0);
        }

        const ciBeat = this.countInBeat + 1;
        const delayMs = Math.max(0, (t - ctx.currentTime) * 1000);
        setTimeout(() => {
          if (!this.stopRequested) {
            this.callbacks.onCountIn?.(ciBeat);
            this.callbacks.onCursorChange(null);
          }
        }, delayMs);

        this.countInBeat++;
        if (this.countInBeat >= 4) {
          this.phase = 'playing';
          this.eventIndex = 0;
        }
      } else {
        // Playing phase
        const events = this.loopEvents;
        if (events.length === 0) return;

        const evt = events[this.eventIndex % events.length];

        // Metronome click on every beat
        if (this.config.metronome) {
          playClick(ctx, master, t, evt.isDownbeat);
        }

        // Play chord on onset
        if (evt.isChordOnset && evt.chord) {
          const chordDuration = beatDuration * evt.durationBeats;
          synthChord(ctx, master, evt.chord, t, chordDuration, this.config.volume * 0.3);
        }

        // UI update
        const cursor = evt.cursor;
        const delayMs = Math.max(0, (t - ctx.currentTime) * 1000);
        setTimeout(() => {
          if (!this.stopRequested) {
            this.callbacks.onCountIn?.(null);
            this.callbacks.onCursorChange(cursor);
          }
        }, delayMs);

        this.eventIndex++;
        if (this.eventIndex >= events.length) {
          this.eventIndex = 0; // loop
        }
      }

      this.nextBeatTime += beatDuration;
    }
  }
}
