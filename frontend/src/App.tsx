import { useState, useRef, lazy, Suspense } from 'react';
import type { AnalysisResult } from './types';
import { analyzeChords } from './api';
import { SettingsProvider } from './lib/settingsContext';
import { InputForm } from './components/InputForm';
import { AnalysisView } from './components/AnalysisView';
import { SectionSplitter } from './components/SectionSplitter';
import { SettingsBar } from './components/SettingsBar';
import { SongLibrary } from './components/SongLibrary';

const Tuner = lazy(() => import('./components/Tuner').then(m => ({ default: m.Tuner })));

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
  const [showSplitter, setShowSplitter] = useState(false);
  const [showTuner, setShowTuner] = useState(false);
  const currentInputRef = useRef<string>('');

  async function handleAnalyze(text: string) {
    currentInputRef.current = text;
    setLoading(true);
    setError(null);
    setShowSplitter(false);
    try {
      const data = await analyzeChords(text);
      setResult(data);
      if (data.segmentation_suggested && data.pairs && data.pairs.length > 0) {
        setShowSplitter(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSegmentedSubmit(formatAText: string) {
    currentInputRef.current = formatAText;
    setLoading(true);
    setError(null);
    setShowSplitter(false);
    try {
      const data = await analyzeChords(formatAText);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function handleSkipSegmentation() {
    setShowSplitter(false);
  }

  function handleLoadFromLibrary(inputText: string) {
    handleAnalyze(inputText);
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
            <div className="flex items-center gap-3">
              {/* Tuner toggle */}
              <button
                onClick={() => setShowTuner(!showTuner)}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
                style={{
                  borderColor: showTuner ? 'var(--color-accent)' : 'var(--color-border)',
                  backgroundColor: showTuner ? 'color-mix(in srgb, var(--color-accent) 15%, var(--color-surface))' : 'var(--color-surface-2)',
                  color: showTuner ? 'var(--color-accent)' : 'var(--color-neutral)',
                }}
              >
                Tuner
              </button>

              {/* Song Library */}
              <SongLibrary
                onLoadSong={handleLoadFromLibrary}
                currentTitle={result?.title}
                currentArtist={result?.artist}
                currentInputText={currentInputRef.current || undefined}
              />

              <SettingsBar />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-8">
          {/* Tuner panel */}
          {showTuner && (
            <div className="mb-8">
              <Suspense fallback={
                <div className="rounded-xl border p-8 text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                  <p style={{ color: 'var(--color-neutral)' }}>Loading tuner...</p>
                </div>
              }>
                <Tuner />
              </Suspense>
            </div>
          )}

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

          {/* Segmentation UI */}
          {showSplitter && result?.pairs && (
            <SectionSplitter
              pairs={result.pairs}
              title={result.title}
              artist={result.artist}
              onSubmit={handleSegmentedSubmit}
              onSkip={handleSkipSegmentation}
            />
          )}

          {/* Analysis results */}
          {result && !showSplitter && <AnalysisView result={result} />}
        </main>
      </div>
    </SettingsProvider>
  );
}
