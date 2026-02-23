import { useState, useRef, lazy, Suspense } from 'react';
import type { AnalysisResult } from './types';
import { analyzeChords } from './api';
import { SettingsProvider, useSettings } from './lib/settingsContext';
import { InputForm } from './components/InputForm';
import { AnalysisView } from './components/AnalysisView';
import { SectionSplitter } from './components/SectionSplitter';
import { SettingsBar } from './components/SettingsBar';
import { SongLibrary } from './components/SongLibrary';
import { ViewToolboxSidebar } from './components/ViewToolboxSidebar';

const Tuner = lazy(() => import('./components/Tuner').then(m => ({ default: m.Tuner })));

const SAMPLE_INPUT = `key: Am
title: יום שישי חזר
artist: מתי כספי

[intro]
Am Am D D Am Am D D
C C Am B Em Em Em E
Am Am D D Am Am D D
C C Am B Em Em Em E
Am Am D
D Am

[verse]
D Am | יום שישי חזר
Am C | בלי שום חדשות
C Em B | יום שישי אכזר
D Am E | שוב שעות קשות
D Am | שמונה השעה
Am C | תכניות לי אין
Am F Em B | ואני מונה שתי אפשרויות

[bridge]
D Am Bsus7
A E7 A E7
Gsus4 C G F
Am C F C | מיד אבטל אותה אך
Am/C Bm7b5 | המודד את הרחובות
Dm A/C# | נחמד דבר שיקרה עד
Am/E D#dim | יש אולי סיכוי קרוב
F#dim F | ברחוב עדן גן למצוא
D Am E Dm | טוב לילה גם ואולי
D Am | תכנית כבר לי יש

[verse]
Am C | במדרגות אור
C Em B | מכונית לי יש
D Am E | חגיגות לי אין
D Am | מאוד ירוק גל
Am C | העיריה עד
Am E | לאותת מה אין
F Em B | לאהוב מי אין

[bridge]
D Am Bsus7
A E7 A E7
Gsus4 C G F
Am C F C | לאט מתקרב חלומי
Am/C Bm7b5 | הארורה השעה
Dm A/C# | כמעט שלוש כבר היא עכשיו
Am/E D#dim | יש אולי סיכוי קרוב
F#dim F | ברחוב עדן גן למצוא
D Am E Dm | טוב לילה גם ואולי
D Am | אחד סיבוב עוד

[verse]
Am C | ומר רע לי, רע
C Em B | נפחד אני שוב
D Am E | נגמר והטנק
D Am | מת כבר הסיכוי
Am C | צהוב הרמזור
F Em B | לאותת מה אין
Am E | לאהוב מי אין

[bridge]
D Am Bsus7
A E7 A E7
Gsus4 C G F
Am C F C | וים שבת יום מעט עוד
Am/C Bm7b5 | מידי גדולה והמיטה
Dm A/C# | ומיילל דפוק אני אם
Am/E D#dim | קיים אני משמע
F#dim F | ברחוב עדן גן למצוא
D Am E Dm | טוב לילה שום לא וגם
D Am | אחד סיבוב עוד

[verse]
Am C | ומר לי רע
C Em B | נפחד אני שוב
D Am E | נגמר והטנק
D Am | מת כבר הסיכוי
Am C | צהוב הרמזור
F Em B | לאותת מה אין
Am E | לאהוב מי אין

[outro]
D D Am Am D D
C C Am B Em Em Em E
Am Am D D Am Am D D
C C Am B Em Em Em E
Am Am D D Am Am D D
C C Am B Em Em Em E
Am Am D D Am Am D D
C C Am B Em Em Em E
Am Am D D Am Am D D
C C Am B Em Em Em E
Am Am D D Am Am D D
C C Am B Em Em Em E`;

function AppContent() {
  const { t } = useSettings();
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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {/* Header — modern, approachable branding + chord legend */}
      <header
        className="border-b"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          boxShadow: '0 1px 0 color-mix(in srgb, var(--color-border) 30%, transparent)',
        }}
      >
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl select-none" style={{ color: 'var(--color-accent)' }} aria-hidden>&#9833;</span>
              <h1
                className="text-2xl sm:text-3xl font-bold tracking-tight"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}
              >
                {t.appName}
              </h1>
              <p
                className="text-sm font-medium hidden sm:inline"
                style={{ color: 'var(--color-neutral)', letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >
                {t.appSubtitle}
              </p>
            </div>
            {/* Chord color legend — pill style for clarity */}
            <div className="hidden md:flex flex-wrap items-center gap-1.5">
              {[
                [t.diatonic, '--color-diatonic'],
                [t.secDom, '--color-secondary-dom'],
                [t.borrowed, '--color-borrowed'],
                [t.dim, '--color-diminished'],
                [t.deceptive, '--color-deceptive'],
              ].map(([label, varName]) => (
                <span
                  key={String(label)}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
                  style={{
                    backgroundColor: `color-mix(in srgb, var(${varName}) 14%, transparent)`,
                    color: `var(${varName})`,
                    border: `1px solid color-mix(in srgb, var(${varName}) 35%, transparent)`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: `var(${varName})` }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Tuner toggle */}
            <button
              onClick={() => setShowTuner(!showTuner)}
              className="rounded-xl border px-3.5 py-2 text-xs font-medium transition-all cursor-pointer"
              style={{
                borderColor: showTuner ? 'var(--color-accent)' : 'var(--color-border)',
                backgroundColor: showTuner ? 'color-mix(in srgb, var(--color-accent) 14%, var(--color-surface))' : 'var(--color-surface-2)',
                color: showTuner ? 'var(--color-accent)' : 'var(--color-neutral)',
              }}
            >
              {t.tuner}
            </button>

            {/* Song Library */}
            <SongLibrary
              onLoadSong={handleLoadFromLibrary}
              currentTitle={result?.title}
              currentArtist={result?.artist}
              currentInputText={currentInputRef.current || undefined}
              currentAnalysis={result}
            />

            <SettingsBar />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 pr-14">
        {/* Tuner panel */}
        {showTuner && (
          <div className="mb-8">
            <Suspense fallback={
              <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)' }}>
                <p className="font-medium" style={{ color: 'var(--color-neutral)' }}>{t.loadingTuner}</p>
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
          <div
            className="mt-6 rounded-xl border px-4 py-3.5 text-sm font-medium"
            style={{
              borderColor: 'color-mix(in srgb, var(--color-diminished) 50%, transparent)',
              backgroundColor: 'color-mix(in srgb, var(--color-diminished) 12%, transparent)',
              color: 'var(--color-diminished)',
            }}
          >
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

      {/* Sidebar toolbox: notation types (Staff / Piano / Guitar) + theme + language */}
      <ViewToolboxSidebar />
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}
