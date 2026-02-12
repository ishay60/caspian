import { useState, useEffect } from 'react';
import type { AnalysisResult, LlmAnalysisResult, Section } from '../types';
import { requestLlmAnalysis } from '../api';
import { SectionView } from './SectionView';
import { LlmNarrative } from './LlmNarrative';

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

export function AnalysisView({ result }: Props) {
  const modeLabel = MODE_LABELS[result.key.mode] ?? result.key.mode;
  const [sections, setSections] = useState<Section[]>(result.sections);
  const [editedSections, setEditedSections] = useState<Set<number>>(new Set());
  const [llmResult, setLlmResult] = useState<LlmAnalysisResult | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);

  // Reset when a new analysis result comes in
  useEffect(() => {
    setSections(result.sections);
    setEditedSections(new Set());
    setLlmResult(null);
    setLlmLoading(false);
    setLlmError(null);
  }, [result]);

  function handleSectionUpdate(index: number, updated: Section) {
    setSections(prev => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
    setEditedSections(prev => new Set(prev).add(index));
  }

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
              {result.key.root_name} {modeLabel}
            </div>
          </div>
        </div>

        {/* LLM narrative button */}
        <div className="mt-4">
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
          {llmError && (
            <p className="mt-2 text-sm" style={{ color: 'var(--color-error, #ef4444)' }}>
              {llmError}
            </p>
          )}
        </div>
      </div>

      {/* LLM Narrative */}
      {llmResult && <LlmNarrative result={llmResult} />}

      {/* Sections */}
      {sections.map((section, i) => (
        <SectionView
          key={i}
          section={section}
          keyInfo={result.key}
          isEdited={editedSections.has(i)}
          onSectionUpdate={(updated) => handleSectionUpdate(i, updated)}
        />
      ))}
    </div>
  );
}
