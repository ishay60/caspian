import { useState } from 'react';

interface Props {
  onAnalyze: (text: string) => void;
  loading: boolean;
  sampleInput: string;
}

export function InputForm({ onAnalyze, loading, sampleInput }: Props) {
  const [text, setText] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim()) {
      onAnalyze(text);
      setCollapsed(true);
    }
  }

  function handleLoadSample() {
    setText(sampleInput);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border p-5 sm:p-6" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer rounded-lg px-1.5 py-1 -ml-1.5"
          style={{ color: 'var(--color-neutral)' }}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${collapsed ? '' : 'rotate-90'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Input
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleLoadSample}
            className="text-xs px-3.5 py-2 rounded-xl border font-medium transition-all cursor-pointer"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Load sample: יום שישי חזר
          </button>
        </div>
      </div>

      {!collapsed && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`key: Am\ntitle: שם השיר\nartist: שם האמן\n\n[intro]\nAm Am D D\n\n[verse]\nD Am | מילות השיר\n\n[chorus]\nD#dim Am/E | מילות הפזמון`}
          className="w-full h-56 rounded-xl border px-4 py-3 font-mono text-sm focus:outline-none resize-y transition-colors"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text)',
          }}
          dir="ltr"
          spellCheck={false}
        />
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="px-6 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer shadow-md"
          style={{
            backgroundColor: 'var(--color-accent)',
            boxShadow: '0 2px 8px color-mix(in srgb, var(--color-accent) 35%, transparent)',
          }}
        >
          {loading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          Analyze
        </button>
      </div>
    </form>
  );
}
