/**
 * Built-in Chromatic Guitar Tuner using Web Audio API.
 * Uses autocorrelation-based pitch detection to identify the fundamental frequency
 * from microphone input and displays note name, octave, cents offset, and a
 * visual gauge with color-coded tuning accuracy.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

/* ── Constants ──────────────────────────────────────────────────────── */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const A4_FREQ = 440;
const A4_MIDI = 69;

/** Standard guitar strings with label and frequency. */
const GUITAR_STRINGS = [
  { label: 'E2', freq: 82.41 },
  { label: 'A2', freq: 110.0 },
  { label: 'D3', freq: 146.83 },
  { label: 'G3', freq: 196.0 },
  { label: 'B3', freq: 246.94 },
  { label: 'E4', freq: 329.63 },
] as const;

/* ── Pitch Detection (Autocorrelation) ──────────────────────────────── */

/**
 * Autocorrelation-based pitch detection.
 * Returns the detected frequency in Hz, or null if no clear pitch is found.
 *
 * This implements a simplified YIN-like autocorrelation approach:
 * 1. Compute the autocorrelation function over the time-domain buffer.
 * 2. Find the first significant dip (period) in the ACF.
 * 3. Use parabolic interpolation to refine the period estimate.
 * 4. Convert period (in samples) to frequency (Hz).
 */
function detectPitch(buffer: Float32Array<ArrayBuffer>, sampleRate: number): number | null {
  const SIZE = buffer.length;

  // Check if there is enough signal energy (RMS threshold)
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return null; // too quiet

  // Autocorrelation: find the period of the fundamental frequency.
  // We search between ~50 Hz and ~1200 Hz.
  const minPeriod = Math.floor(sampleRate / 1200);
  const maxPeriod = Math.floor(sampleRate / 50);
  const correlations = new Float32Array(maxPeriod + 1);

  // Compute normalized autocorrelation
  for (let lag = minPeriod; lag <= maxPeriod; lag++) {
    let corr = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (let i = 0; i < SIZE - lag; i++) {
      corr += buffer[i] * buffer[i + lag];
      norm1 += buffer[i] * buffer[i];
      norm2 += buffer[i + lag] * buffer[i + lag];
    }
    const norm = Math.sqrt(norm1 * norm2);
    correlations[lag] = norm > 0 ? corr / norm : 0;
  }

  // Find the best (highest) correlation peak after the first dip.
  // First, find the first point where correlation dips below a threshold.
  let foundDip = false;
  let bestLag = -1;
  let bestCorr = -1;

  for (let lag = minPeriod; lag <= maxPeriod; lag++) {
    if (!foundDip && correlations[lag] < 0.5) {
      foundDip = true;
    }
    if (foundDip && correlations[lag] > bestCorr) {
      bestCorr = correlations[lag];
      bestLag = lag;
    }
  }

  // If we never found a good dip-then-peak pattern, try finding just the best correlation
  if (bestLag === -1 || bestCorr < 0.8) {
    // Fallback: find the highest peak overall
    for (let lag = minPeriod; lag <= maxPeriod; lag++) {
      if (correlations[lag] > bestCorr) {
        bestCorr = correlations[lag];
        bestLag = lag;
      }
    }
  }

  if (bestLag === -1 || bestCorr < 0.8) return null; // no clear pitch

  // Parabolic interpolation around the peak for sub-sample accuracy
  const prev = correlations[bestLag - 1] ?? bestCorr;
  const next = correlations[bestLag + 1] ?? bestCorr;
  const shift = (prev - next) / (2 * (prev - 2 * bestCorr + next));
  const refinedLag = bestLag + (isFinite(shift) ? shift : 0);

  const frequency = sampleRate / refinedLag;
  return frequency;
}

/* ── Note Math ──────────────────────────────────────────────────────── */

/** Convert a frequency to the nearest note name, octave, and cents offset. */
function frequencyToNote(freq: number): { note: string; octave: number; cents: number; midi: number } {
  const midiFloat = 12 * Math.log2(freq / A4_FREQ) + A4_MIDI;
  const midi = Math.round(midiFloat);
  const cents = Math.round((midiFloat - midi) * 100);
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return { note: NOTE_NAMES[noteIndex], octave, cents, midi };
}

/** Find the nearest guitar string to a given frequency. Returns index or -1. */
function nearestGuitarString(freq: number): number {
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < GUITAR_STRINGS.length; i++) {
    // Use cents distance for musical relevance
    const centsDist = Math.abs(1200 * Math.log2(freq / GUITAR_STRINGS[i].freq));
    if (centsDist < bestDist) {
      bestDist = centsDist;
      bestIdx = i;
    }
  }
  // Only highlight if within ~100 cents (a semitone) of a guitar string
  return bestDist <= 100 ? bestIdx : -1;
}

/* ── Component ──────────────────────────────────────────────────────── */

export function Tuner() {
  const [isListening, setIsListening] = useState(false);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [noteName, setNoteName] = useState<string>('--');
  const [octave, setOctave] = useState<number | null>(null);
  const [cents, setCents] = useState(0);
  const [activeString, setActiveString] = useState(-1);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null);

  // Smoothing: keep a short history for display stability
  const historyRef = useRef<number[]>([]);
  const HISTORY_SIZE = 5;

  /** Median of an array of numbers. */
  const median = useCallback((arr: number[]): number => {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }, []);

  /** The main detection loop, called every animation frame. */
  const detect = useCallback(() => {
    const analyser = analyserRef.current;
    const buffer = bufferRef.current;
    if (!analyser || !buffer) return;

    analyser.getFloatTimeDomainData(buffer);
    const sampleRate = audioCtxRef.current?.sampleRate ?? 44100;
    const detected = detectPitch(buffer, sampleRate);

    if (detected !== null && detected > 50 && detected < 1200) {
      historyRef.current.push(detected);
      if (historyRef.current.length > HISTORY_SIZE) {
        historyRef.current.shift();
      }

      const smoothedFreq = median(historyRef.current);
      const { note, octave: oct, cents: c } = frequencyToNote(smoothedFreq);

      setFrequency(Math.round(smoothedFreq * 10) / 10);
      setNoteName(note);
      setOctave(oct);
      setCents(c);
      setActiveString(nearestGuitarString(smoothedFreq));
    }

    rafRef.current = requestAnimationFrame(detect);
  }, [median]);

  /** Start listening to the microphone. */
  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      streamRef.current = stream;
      bufferRef.current = buffer;
      historyRef.current = [];

      setIsListening(true);

      // Start the detection loop
      rafRef.current = requestAnimationFrame(detect);
    } catch {
      // Microphone access denied or unavailable
      console.warn('Tuner: Could not access microphone.');
    }
  }, [detect]);

  /** Stop listening and clean up all audio resources. */
  const stopListening = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    sourceRef.current?.disconnect();
    sourceRef.current = null;

    analyserRef.current = null;
    bufferRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    historyRef.current = [];
    setIsListening(false);
    setFrequency(null);
    setNoteName('--');
    setOctave(null);
    setCents(0);
    setActiveString(-1);
  }, []);

  /** Toggle microphone on/off. */
  const toggle = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      sourceRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  /* ── Derived display values ───────────────────────────────────────── */

  const absCents = Math.abs(cents);
  const tuningColor =
    absCents <= 5
      ? 'var(--color-diatonic)'   // green: in tune
      : absCents <= 15
        ? 'var(--color-borrowed)' // yellow: close
        : 'var(--color-diminished)'; // red: far

  // For the arc gauge: compute the SVG arc
  const gaugeRadius = 110;
  const gaugeStroke = 6;
  const gaugeCenterX = 160;
  const gaugeCenterY = 140;
  const gaugeStartAngle = -135; // degrees (left side)
  const gaugeEndAngle = -45;   // degrees (right side)
  const gaugeSweep = gaugeEndAngle - gaugeStartAngle; // 90 degrees total visible

  function polarToCart(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  // Full arc path (background)
  const arcStart = polarToCart(gaugeCenterX, gaugeCenterY, gaugeRadius, gaugeStartAngle);
  const arcEnd = polarToCart(gaugeCenterX, gaugeCenterY, gaugeRadius, gaugeEndAngle);
  const fullArcPath = `M ${arcStart.x} ${arcStart.y} A ${gaugeRadius} ${gaugeRadius} 0 0 1 ${arcEnd.x} ${arcEnd.y}`;

  // Tick marks on the gauge
  const ticks: { x1: number; y1: number; x2: number; y2: number; isMajor: boolean }[] = [];
  const tickValues = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];
  for (const val of tickValues) {
    const frac = (val + 50) / 100;
    const angle = gaugeStartAngle + frac * gaugeSweep;
    const inner = polarToCart(gaugeCenterX, gaugeCenterY, gaugeRadius - 12, angle);
    const outer = polarToCart(gaugeCenterX, gaugeCenterY, gaugeRadius - 2, angle);
    ticks.push({ x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, isMajor: val % 10 === 0 });
  }

  // Small intermediate ticks
  for (let val = -45; val <= 45; val += 10) {
    const frac = (val + 50) / 100;
    const angle = gaugeStartAngle + frac * gaugeSweep;
    const inner = polarToCart(gaugeCenterX, gaugeCenterY, gaugeRadius - 8, angle);
    const outer = polarToCart(gaugeCenterX, gaugeCenterY, gaugeRadius - 2, angle);
    ticks.push({ x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, isMajor: false });
  }

  // Needle endpoint
  const needleFrac = (cents + 50) / 100;
  const needleAngleDeg = gaugeStartAngle + needleFrac * gaugeSweep;
  const needleTip = polarToCart(gaugeCenterX, gaugeCenterY, gaugeRadius - 18, needleAngleDeg);

  // Labels for -50, 0, +50
  const labelMinus = polarToCart(gaugeCenterX, gaugeCenterY, gaugeRadius + 16, gaugeStartAngle);
  const labelZero = polarToCart(gaugeCenterX, gaugeCenterY, gaugeRadius + 16, (gaugeStartAngle + gaugeEndAngle) / 2);
  const labelPlus = polarToCart(gaugeCenterX, gaugeCenterY, gaugeRadius + 16, gaugeEndAngle);

  // Colored arc segment showing current tuning zone
  // Center zone: from -5 to +5 cents (green zone indicator)
  const greenStart = polarToCart(gaugeCenterX, gaugeCenterY, gaugeRadius, gaugeStartAngle + (45 / 100) * gaugeSweep);
  const greenEnd = polarToCart(gaugeCenterX, gaugeCenterY, gaugeRadius, gaugeStartAngle + (55 / 100) * gaugeSweep);
  const greenArcPath = `M ${greenStart.x} ${greenStart.y} A ${gaugeRadius} ${gaugeRadius} 0 0 1 ${greenEnd.x} ${greenEnd.y}`;

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: isListening ? tuningColor : 'var(--color-border)',
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: 12,
        padding: 24,
        maxWidth: 420,
        margin: '0 auto',
        transition: 'border-color 0.3s, box-shadow 0.3s',
        boxShadow: isListening
          ? `0 0 24px color-mix(in srgb, ${tuningColor} 20%, transparent)`
          : 'none',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Tuning fork icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3v10.5a3.5 3.5 0 0 0 7 0V3" />
            <line x1="12.5" y1="17" x2="12.5" y2="22" />
          </svg>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Chromatic Tuner
          </span>
        </div>

        {/* Status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: isListening ? 'var(--color-diatonic)' : 'var(--color-neutral)',
              boxShadow: isListening ? '0 0 8px var(--color-diatonic)' : 'none',
              transition: 'all 0.3s',
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: 'var(--color-neutral)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {isListening ? 'Listening' : 'Off'}
          </span>
        </div>
      </div>

      {/* ── Gauge SVG ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <svg
          width={320}
          height={190}
          viewBox="0 0 320 190"
          style={{ overflow: 'visible', display: 'block' }}
        >
          {/* Background arc */}
          <path
            d={fullArcPath}
            fill="none"
            stroke="var(--color-surface-2)"
            strokeWidth={gaugeStroke}
            strokeLinecap="round"
          />

          {/* Green "in tune" zone */}
          <path
            d={greenArcPath}
            fill="none"
            stroke="var(--color-diatonic)"
            strokeWidth={gaugeStroke + 2}
            strokeLinecap="round"
            opacity={0.4}
          />

          {/* Tick marks */}
          {ticks.map((t, i) => (
            <line
              key={`tick-${i}`}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.isMajor ? 'var(--color-neutral)' : 'var(--color-border)'}
              strokeWidth={t.isMajor ? 2 : 1}
              strokeLinecap="round"
            />
          ))}

          {/* Arc labels */}
          <text
            x={labelMinus.x}
            y={labelMinus.y}
            textAnchor="middle"
            fill="var(--color-neutral)"
            fontSize="10"
            fontFamily="IBM Plex Mono, monospace"
          >
            -50
          </text>
          <text
            x={labelZero.x}
            y={labelZero.y + 2}
            textAnchor="middle"
            fill="var(--color-text)"
            fontSize="10"
            fontWeight="bold"
            fontFamily="IBM Plex Mono, monospace"
          >
            0
          </text>
          <text
            x={labelPlus.x}
            y={labelPlus.y}
            textAnchor="middle"
            fill="var(--color-neutral)"
            fontSize="10"
            fontFamily="IBM Plex Mono, monospace"
          >
            +50
          </text>

          {/* Flat / Sharp labels */}
          <text
            x={gaugeCenterX - 78}
            y={gaugeCenterY + 24}
            textAnchor="middle"
            fill="var(--color-neutral)"
            fontSize="11"
            fontFamily="IBM Plex Sans, sans-serif"
            fontWeight="500"
          >
            FLAT
          </text>
          <text
            x={gaugeCenterX + 78}
            y={gaugeCenterY + 24}
            textAnchor="middle"
            fill="var(--color-neutral)"
            fontSize="11"
            fontFamily="IBM Plex Sans, sans-serif"
            fontWeight="500"
          >
            SHARP
          </text>

          {/* Needle */}
          {isListening && frequency !== null && (
            <>
              {/* Needle shadow / glow */}
              <line
                x1={gaugeCenterX}
                y1={gaugeCenterY}
                x2={needleTip.x}
                y2={needleTip.y}
                stroke={tuningColor}
                strokeWidth={4}
                strokeLinecap="round"
                opacity={0.2}
                style={{
                  transition: 'x2 0.12s ease-out, y2 0.12s ease-out',
                }}
              />
              {/* Needle line */}
              <line
                x1={gaugeCenterX}
                y1={gaugeCenterY}
                x2={needleTip.x}
                y2={needleTip.y}
                stroke={tuningColor}
                strokeWidth={2.5}
                strokeLinecap="round"
                style={{
                  transition: 'x2 0.12s ease-out, y2 0.12s ease-out, stroke 0.2s',
                }}
              />
              {/* Needle pivot dot */}
              <circle
                cx={gaugeCenterX}
                cy={gaugeCenterY}
                r={5}
                fill={tuningColor}
                style={{ transition: 'fill 0.2s' }}
              />
              <circle
                cx={gaugeCenterX}
                cy={gaugeCenterY}
                r={2.5}
                fill="var(--color-surface)"
              />
            </>
          )}

          {/* Inactive state: center dot only */}
          {(!isListening || frequency === null) && (
            <circle
              cx={gaugeCenterX}
              cy={gaugeCenterY}
              r={4}
              fill="var(--color-border)"
            />
          )}

          {/* Note name display (large, centered) */}
          <text
            x={gaugeCenterX}
            y={gaugeCenterY - 20}
            textAnchor="middle"
            fill={isListening && frequency !== null ? tuningColor : 'var(--color-border)'}
            fontSize="48"
            fontWeight="bold"
            fontFamily="IBM Plex Sans, sans-serif"
            style={{ transition: 'fill 0.2s' }}
          >
            {noteName}
          </text>

          {/* Octave number */}
          {octave !== null && isListening && (
            <text
              x={gaugeCenterX + (noteName.length > 1 ? 30 : 20)}
              y={gaugeCenterY - 24}
              textAnchor="start"
              fill="var(--color-neutral)"
              fontSize="18"
              fontFamily="IBM Plex Mono, monospace"
            >
              {octave}
            </text>
          )}
        </svg>
      </div>

      {/* ── Info Row ───────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 32,
          marginBottom: 20,
          opacity: isListening && frequency !== null ? 1 : 0.3,
          transition: 'opacity 0.3s',
        }}
      >
        {/* Frequency */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 10,
              color: 'var(--color-neutral)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 600,
              marginBottom: 2,
            }}
          >
            Frequency
          </div>
          <div
            style={{
              fontSize: 18,
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text)',
              fontWeight: 500,
            }}
          >
            {frequency !== null ? `${frequency} Hz` : '--- Hz'}
          </div>
        </div>

        {/* Cents offset */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 10,
              color: 'var(--color-neutral)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 600,
              marginBottom: 2,
            }}
          >
            Cents
          </div>
          <div
            style={{
              fontSize: 18,
              fontFamily: 'var(--font-mono)',
              color: isListening && frequency !== null ? tuningColor : 'var(--color-text)',
              fontWeight: 600,
              transition: 'color 0.2s',
            }}
          >
            {cents > 0 ? `+${cents}` : cents === 0 ? '0' : `${cents}`}
          </div>
        </div>
      </div>

      {/* ── Guitar String Indicators ──────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 6,
          marginBottom: 20,
        }}
      >
        {GUITAR_STRINGS.map((gs, i) => {
          const isActive = activeString === i && isListening;
          const isInTune = isActive && absCents <= 5;
          return (
            <div
              key={gs.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid',
                borderColor: isActive
                  ? isInTune
                    ? 'var(--color-diatonic)'
                    : tuningColor
                  : 'var(--color-border)',
                backgroundColor: isActive
                  ? isInTune
                    ? 'color-mix(in srgb, var(--color-diatonic) 12%, var(--color-surface-2))'
                    : `color-mix(in srgb, ${tuningColor} 10%, var(--color-surface-2))`
                  : 'var(--color-surface-2)',
                transition: 'all 0.2s',
                boxShadow: isActive
                  ? `0 0 12px color-mix(in srgb, ${isInTune ? 'var(--color-diatonic)' : tuningColor} 25%, transparent)`
                  : 'none',
                minWidth: 44,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: isActive
                    ? isInTune
                      ? 'var(--color-diatonic)'
                      : tuningColor
                    : 'var(--color-neutral)',
                  transition: 'color 0.2s',
                }}
              >
                {gs.label}
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-neutral)',
                  opacity: 0.7,
                }}
              >
                {gs.freq.toFixed(0)}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Start / Stop Button ────────────────────────────────────── */}
      <button
        onClick={toggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
          padding: '12px 0',
          borderRadius: 8,
          border: 'none',
          backgroundColor: isListening ? 'var(--color-diminished)' : 'var(--color-accent)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
          transition: 'background-color 0.2s, box-shadow 0.2s',
          boxShadow: isListening
            ? '0 0 16px color-mix(in srgb, var(--color-diminished) 40%, transparent)'
            : '0 0 16px color-mix(in srgb, var(--color-accent) 30%, transparent)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {isListening ? (
          <>
            {/* Stop icon */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="2" width="10" height="10" rx="1.5" />
            </svg>
            Stop Tuner
          </>
        ) : (
          <>
            {/* Microphone icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="11" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            Start Tuner
          </>
        )}
      </button>

      {/* ── Reference info ─────────────────────────────────────────── */}
      <div
        style={{
          textAlign: 'center',
          marginTop: 12,
          fontSize: 10,
          color: 'var(--color-neutral)',
          fontFamily: 'var(--font-mono)',
          opacity: 0.6,
        }}
      >
        A4 = 440 Hz | Autocorrelation pitch detection
      </div>
    </div>
  );
}
