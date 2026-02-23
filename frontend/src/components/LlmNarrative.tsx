import type { LlmAnalysisResult } from '../types';

interface Props {
  result: LlmAnalysisResult;
}

export function LlmNarrative({ result }: Props) {
  return (
    <div
      className="rounded-2xl border p-6 space-y-4"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>Harmonic Narrative</h3>

      {result.overall_summary && (
        <div dir="rtl" style={{ whiteSpace: 'pre-wrap' }}>
          {result.overall_summary}
        </div>
      )}

      {result.sections.length > 0 && (
        <div className="space-y-3 mt-4">
          {result.sections.map((section, i) => (
            <div key={i}>
              <h4 className="font-semibold" dir="rtl">
                {section.name}
              </h4>
              <p dir="rtl" style={{ whiteSpace: 'pre-wrap', color: 'var(--color-neutral)' }}>
                {section.narrative}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
