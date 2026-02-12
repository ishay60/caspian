import { useState } from 'react';
import type { AnalysisResult } from './types';
import { analyzeChords } from './api';
import { SettingsProvider } from './lib/settingsContext';
import { InputForm } from './components/InputForm';
import { AnalysisView } from './components/AnalysisView';
import { SettingsBar } from './components/SettingsBar';

const SAMPLE_INPUT = `key: Am
title: יום שישי חזר
artist: מתי כספי

[intro]
Am Am/G D G Am Am/G D D
C C/B Am B Em Em/F Em/G E

[verse]
D Am | יום שישי חזר
Am C | בלי שום חדשות
B Em C | יום שישי אכזר
E Am D | שוב שעות קשות

[chorus]
D#dim Am/E | יש אולי סיכוי קרוב
F F#dim | למצוא גן עדן ברחוב
Dm E Am D | ואולי גם לילה טוב`;

export default function App() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze(text: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeChords(text);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SettingsProvider>
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
        {/* Header */}
        <header className="border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-xl font-bold tracking-tight">Caspian</h1>
                <p className="text-xs" style={{ color: 'var(--color-neutral)' }}>Harmonic Analysis</p>
              </div>
              {/* Color legend */}
              <div className="hidden sm:flex gap-2 text-xs">
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-diatonic)' }} />Diatonic</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-secondary-dom)' }} />Sec. Dom</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-borrowed)' }} />Borrowed</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-diminished)' }} />Dim</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-deceptive)' }} />Deceptive</span>
              </div>
            </div>
            <SettingsBar />
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-8">
          <InputForm
            onAnalyze={handleAnalyze}
            loading={loading}
            sampleInput={SAMPLE_INPUT}
          />

          {error && (
            <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {result && <AnalysisView result={result} />}
        </main>
      </div>
    </SettingsProvider>
  );
}
