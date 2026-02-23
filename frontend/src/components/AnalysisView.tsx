import { useState, useEffect, useCallback } from 'react';
import type { AnalysisResult, LlmAnalysisResult, Section, Key, ChordAnalysis } from '../types';
import { requestLlmAnalysis } from '../api';
import { useSettings } from '../lib/settingsContext';
import { SectionView } from './SectionView';
import { LlmNarrative } from './LlmNarrative';
import { TransposeBar } from './TransposeBar';
import { Fretboard } from './Fretboard';
import { transposeChordSymbol, transposePitch, pitchToName } from '../lib/transpose';

const MODE_KEYS = [
  'natural_minor', 'harmonic_minor', 'melodic_minor',
  'dorian', 'phrygian', 'phrygian_dominant', 'major', 'mixolydian',
] as const;

interface Props {
  result: AnalysisResult;
}

/** Apply transposition to all chord data in a section */
function transposeSection(section: Section, semitones: number): Section {
  return {
    ...section,
    chords: section.chords.map(c => transposeChord(c, semitones)),
    bass_line: section.bass_line.map(bn => ({
      ...bn,
      pitch: transposePitch(bn.pitch, semitones),
      name: pitchToName(transposePitch(bn.pitch, semitones)),
      chord_symbol: transposeChordSymbol(bn.chord_symbol, semitones),
    })),
    chromatic_runs: section.chromatic_runs.map(cr => ({
      ...cr,
      notes: cr.notes.map(n => {
        const idx = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].indexOf(n);
        if (idx >= 0) return pitchToName(transposePitch(idx, semitones));
        return n;
      }),
    })),
    patterns: section.patterns,
  };
}

function transposeChord(c: ChordAnalysis, semitones: number): ChordAnalysis {
  return {
    ...c,
    symbol: transposeChordSymbol(c.symbol, semitones),
    root_name: pitchToName(transposePitch(c.root, semitones)),
    root: transposePitch(c.root, semitones),
    bass_name: pitchToName(transposePitch(c.bass, semitones)),
    bass: transposePitch(c.bass, semitones),
    pitches: c.pitches.map(p => transposePitch(p, semitones)),
    common_tones_with_previous: c.common_tones_with_previous.map(n => {
      const idx = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].indexOf(n);
      if (idx >= 0) return pitchToName(transposePitch(idx, semitones));
      return n;
    }),
    common_tones_with_next: c.common_tones_with_next.map(n => {
      const idx = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].indexOf(n);
      if (idx >= 0) return pitchToName(transposePitch(idx, semitones));
      return n;
    }),
  };
}

function transposeKey(key: Key, semitones: number): Key {
  return {
    ...key,
    root_name: pitchToName(transposePitch(key.root, semitones)),
    root: transposePitch(key.root, semitones),
    scale_pitches: key.scale_pitches.map(p => transposePitch(p, semitones)),
  };
}

export function AnalysisView({ result }: Props) {
  const { t } = useSettings();
  const [transposeSemitones, setTransposeSemitones] = useState(0);
  const [sections, setSections] = useState<Section[]>(result.sections);
  const [editedSections, setEditedSections] = useState<Set<number>>(new Set());
  const [llmResult, setLlmResult] = useState<LlmAnalysisResult | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [showFretboard, setShowFretboard] = useState(false);
  const [selectedChordForFretboard, setSelectedChordForFretboard] = useState<ChordAnalysis | null>(null);

  // Compute transposed key and sections (at 0 preserve API key spelling e.g. Bb not A#)
  const currentKey = transposeKey(result.key, transposeSemitones);
  const modeLabel = (MODE_KEYS as readonly string[]).includes(currentKey.mode)
    ? t[currentKey.mode as typeof MODE_KEYS[number]]
    : currentKey.mode;
  const displaySections =
    transposeSemitones === 0
      ? sections
      : sections.map(s => transposeSection(s, transposeSemitones));

  // Reset when a new analysis result comes in
  useEffect(() => {
    setSections(result.sections);
    setEditedSections(new Set());
    setLlmResult(null);
    setLlmLoading(false);
    setLlmError(null);
    setTransposeSemitones(0);
    setSelectedChordForFretboard(null);
  }, [result]);

  function handleSectionUpdate(index: number, updated: Section) {
    setSections(prev => {
      const next = [...prev];
      // Store the un-transposed version by reversing the transpose
      next[index] = transposeSection(updated, -transposeSemitones);
      return next;
    });
    setEditedSections(prev => new Set(prev).add(index));
  }

  const handleTranspose = useCallback((semitones: number) => {
    setTransposeSemitones(prev => ((prev + semitones) % 12 + 12) % 12);
  }, []);

  const handleChordSelect = useCallback((chord: ChordAnalysis | null) => {
    setSelectedChordForFretboard(chord);
  }, []);

  async function handleLlmAnalysis() {
    setLlmLoading(true);
    setLlmError(null);
    try {
      const res = await requestLlmAnalysis(result);
      setLlmResult(res);
    } catch (err) {
      setLlmError(err instanceof Error ? err.message : 'LLM analysis failed');
    } finally {
      setLlmLoading(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Song header — clear hierarchy, key prominent for musicians */}
      <div
        className="rounded-2xl border p-6 sm:p-7"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2
              className="text-2xl sm:text-3xl font-bold"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}
            >
              {result.title || t.untitled}
            </h2>
            {result.artist && (
              <p className="mt-1.5 text-base" style={{ color: 'var(--color-neutral)' }}>{result.artist}</p>
            )}
          </div>
          <div
            className="rounded-xl border px-5 py-2.5 text-center shrink-0"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-accent) 10%, var(--color-surface-2))',
              borderColor: 'color-mix(in srgb, var(--color-accent) 40%, var(--color-border))',
            }}
          >
            <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--color-neutral)' }}>{t.key}</div>
            <div className="text-xl font-bold font-mono mt-0.5" style={{ color: 'var(--color-accent)' }}>
              {currentKey.root_name} {modeLabel}
            </div>
          </div>
        </div>

        {/* Transpose bar */}
        <div className="mt-5">
          <TransposeBar currentKey={currentKey} onTranspose={handleTranspose} />
        </div>

        {/* Action buttons row */}
        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <button
            onClick={handleLlmAnalysis}
            disabled={llmLoading}
            className="rounded-xl border px-4 py-2.5 text-sm font-medium transition-all cursor-pointer"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: llmLoading ? 'var(--color-surface-2)' : 'var(--color-surface)',
              cursor: llmLoading ? 'not-allowed' : 'pointer',
              opacity: llmLoading ? 0.7 : 1,
            }}
          >
            {llmLoading ? t.generating : t.generateNarrative}
          </button>

          <button
            onClick={() => setShowFretboard(!showFretboard)}
            className="rounded-xl border px-4 py-2.5 text-sm font-medium transition-all cursor-pointer"
            style={{
              borderColor: showFretboard ? 'var(--color-accent)' : 'var(--color-border)',
              backgroundColor: showFretboard ? 'color-mix(in srgb, var(--color-accent) 14%, var(--color-surface))' : 'var(--color-surface)',
              color: showFretboard ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          >
            {t.fretboard}
          </button>

          {llmError && (
            <p className="text-sm font-medium" style={{ color: 'var(--color-diminished)' }}>
              {llmError}
            </p>
          )}
        </div>
      </div>

      {/* Fretboard Explorer */}
      {showFretboard && (
        <div
          className="rounded-2xl border p-5"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-neutral)' }}>
              {t.fretboardExplorer}
              {selectedChordForFretboard && (
                <span className="ml-2 font-mono normal-case font-medium" style={{ color: 'var(--color-accent)' }}>
                  — {selectedChordForFretboard.symbol}
                </span>
              )}
            </h3>
            {selectedChordForFretboard && (
              <button
                onClick={() => setSelectedChordForFretboard(null)}
                className="text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors cursor-pointer"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-neutral)' }}
              >
                {t.showScaleOnly}
              </button>
            )}
          </div>
          <Fretboard
            scalePitches={currentKey.scale_pitches}
            chordPitches={selectedChordForFretboard?.pitches}
            root={currentKey.root}
            chordRoot={selectedChordForFretboard?.root}
          />
        </div>
      )}

      {/* LLM Narrative */}
      {llmResult && <LlmNarrative result={llmResult} />}

      {/* Sections */}
      {displaySections.map((section, i) => (
        <SectionView
          key={i}
          section={section}
          keyInfo={currentKey}
          isEdited={editedSections.has(i)}
          onSectionUpdate={(updated) => handleSectionUpdate(i, updated)}
          onChordSelect={handleChordSelect}
        />
      ))}
    </div>
  );
}
