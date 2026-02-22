import { useState, useEffect, useCallback } from 'react';
import type { AnalysisResult, LlmAnalysisResult, Section, Key, ChordAnalysis } from '../types';
import { requestLlmAnalysis } from '../api';
import { SectionView } from './SectionView';
import { LlmNarrative } from './LlmNarrative';
import { TransposeBar } from './TransposeBar';
import { Fretboard } from './Fretboard';
import { transposeChordSymbol, transposePitch, pitchToName } from '../lib/transpose';

const MODE_LABELS: Record<string, string> = {
  natural_minor: 'Natural Minor',
  harmonic_minor: 'Harmonic Minor',
  melodic_minor: 'Melodic Minor',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  phrygian_dominant: 'Phrygian Dominant',
  major: 'Major',
  mixolydian: 'Mixolydian',
};

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
  const [transposeSemitones, setTransposeSemitones] = useState(0);
  const [sections, setSections] = useState<Section[]>(result.sections);
  const [editedSections, setEditedSections] = useState<Set<number>>(new Set());
  const [llmResult, setLlmResult] = useState<LlmAnalysisResult | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [showFretboard, setShowFretboard] = useState(false);
  const [selectedChordForFretboard, setSelectedChordForFretboard] = useState<ChordAnalysis | null>(null);

  // Compute transposed key and sections
  const currentKey = transposeKey(result.key, transposeSemitones);
  const modeLabel = MODE_LABELS[currentKey.mode] ?? currentKey.mode;
  const displaySections = sections.map(s => transposeSection(s, transposeSemitones));

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
      {/* Song header */}
      <div
        className="rounded-xl border p-6"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold" dir="rtl">
              {result.title || 'Untitled'}
            </h2>
            {result.artist && (
              <p className="mt-1" dir="rtl" style={{ color: 'var(--color-neutral)' }}>{result.artist}</p>
            )}
          </div>
          <div
            className="rounded-lg border px-4 py-2 text-center"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-neutral)' }}>Key</div>
            <div className="text-lg font-bold font-mono mt-0.5">
              {currentKey.root_name} {modeLabel}
            </div>
          </div>
        </div>

        {/* Transpose bar */}
        <div className="mt-4">
          <TransposeBar currentKey={currentKey} onTranspose={handleTranspose} />
        </div>

        {/* Action buttons row */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button
            onClick={handleLlmAnalysis}
            disabled={llmLoading}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: llmLoading ? 'var(--color-surface-2)' : 'var(--color-surface)',
              cursor: llmLoading ? 'not-allowed' : 'pointer',
              opacity: llmLoading ? 0.7 : 1,
            }}
          >
            {llmLoading ? 'Generating...' : 'Generate Harmonic Narrative'}
          </button>

          <button
            onClick={() => setShowFretboard(!showFretboard)}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
            style={{
              borderColor: showFretboard ? 'var(--color-accent)' : 'var(--color-border)',
              backgroundColor: showFretboard ? 'color-mix(in srgb, var(--color-accent) 15%, var(--color-surface))' : 'var(--color-surface)',
              color: showFretboard ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          >
            Fretboard
          </button>

          {llmError && (
            <p className="text-sm" style={{ color: 'var(--color-error, #ef4444)' }}>
              {llmError}
            </p>
          )}
        </div>
      </div>

      {/* Fretboard Explorer */}
      {showFretboard && (
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-neutral)' }}>
              Fretboard Explorer
              {selectedChordForFretboard && (
                <span className="ml-2 font-mono normal-case" style={{ color: 'var(--color-accent)' }}>
                  — {selectedChordForFretboard.symbol}
                </span>
              )}
            </h3>
            {selectedChordForFretboard && (
              <button
                onClick={() => setSelectedChordForFretboard(null)}
                className="text-xs px-2 py-1 rounded border cursor-pointer"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-neutral)' }}
              >
                Show scale only
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
