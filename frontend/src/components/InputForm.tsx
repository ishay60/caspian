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
    <form onSubmit={handleSubmit}>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          style={{ color: 'var(--color-neutral)' }}
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${collapsed ? '' : 'rotate-90'}`}
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
            className="text-xs px-3 py-1.5 rounded-md border transition-colors cursor-pointer"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-neutral)',
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
          className="w-full h-56 rounded-lg border px-4 py-3 font-mono text-sm focus:outline-none focus:ring-1 resize-y"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
          }}
          dir="ltr"
          spellCheck={false}
        />
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="px-5 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 cursor-pointer"
          style={{ backgroundColor: 'var(--color-accent)' }}
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
