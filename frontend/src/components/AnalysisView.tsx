import { useState, useEffect } from 'react';
import type { AnalysisResult, Section } from '../types';
import { SectionView } from './SectionView';

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

  // Reset when a new analysis result comes in
  useEffect(() => {
    setSections(result.sections);
    setEditedSections(new Set());
  }, [result]);

  function handleSectionUpdate(index: number, updated: Section) {
    setSections(prev => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
    setEditedSections(prev => new Set(prev).add(index));
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
      </div>

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
