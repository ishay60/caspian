import { useState, useRef, lazy, Suspense } from 'react';
import type { AnalysisResult } from './types';
import { analyzeChords } from './api';
import { SettingsProvider, useSettings } from './lib/settingsContext';
import { AuthProvider } from './lib/authContext';
import { InputForm } from './components/InputForm';
import { AnalysisView } from './components/AnalysisView';
import { SectionSplitter } from './components/SectionSplitter';
import { SettingsBar } from './components/SettingsBar';
import { SongLibrary } from './components/SongLibrary';
import { UserMenu } from './components/UserMenu';
import { ViewToolboxSidebar } from './components/ViewToolboxSidebar';
import { SongSearch } from './components/SongSearch';
import { LyricsChordEditor } from './components/LyricsChordEditor';
import { SheetUpload } from './components/SheetUpload';

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
  const [inputMode, setInputMode] = useState<'paste' | 'lyrics' | 'search'>('paste');
  const [showSheetUpload, setShowSheetUpload] = useState(false);
  const [scannedText, setScannedText] = useState<string | undefined>(undefined);
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

  function handleSongSelected(analysis: AnalysisResult) {
    setResult(analysis);
    setShowSplitter(false);
    setError(null);
  }

  function handleScanComplete(inputText: string) {
    setScannedText(inputText);
    setInputMode('paste');
    setShowSheetUpload(false);
  }

  async function handleLyricsComplete(sections: { name: string; lines: { chords: [number, string][]; lyrics: string }[] }[]) {
    // Convert lyrics editor format to text format for analysis
    // For now, use a simple text representation
    // TODO: Use /api/convert-lyrics endpoint for better integration
    const textLines: string[] = [];

    sections.forEach(section => {
      textLines.push(`[${section.name}]`);
      section.lines.forEach(line => {
        if (line.chords.length > 0) {
          // Build chord line
          let chordLine = '';
          let lastPos = 0;
          line.chords.forEach(([pos, chord]) => {
            chordLine += ' '.repeat(Math.max(0, pos - lastPos)) + chord;
            lastPos = pos + chord.length;
          });
          textLines.push(chordLine);
        }
        if (line.lyrics) {
          textLines.push(line.lyrics);
        }
      });
      textLines.push(''); // Empty line between sections
    });

    const text = textLines.join('\n');
    await handleAnalyze(text);
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

            <UserMenu />
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

        {/* Input Mode Tabs */}
        <div className="mb-8">
          <div
            className="rounded-2xl border overflow-hidden"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            {/* Tab Bar */}
            <div
              className="flex border-b"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {[
                { id: 'paste' as const, label: t.pasteText || 'Paste Text', icon: '📋' },
                { id: 'lyrics' as const, label: t.lyricsFirst || 'Lyrics-First', icon: '✍️' },
                { id: 'search' as const, label: t.searchOnline || 'Search Online', icon: '🔍' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setInputMode(tab.id)}
                  className="flex-1 px-4 py-3 text-sm font-medium transition-all"
                  style={{
                    color: inputMode === tab.id ? 'var(--color-accent)' : 'var(--color-neutral)',
                    backgroundColor: inputMode === tab.id ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent',
                    borderBottom: inputMode === tab.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                  }}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {inputMode === 'paste' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                      {t.pasteChordSheet || 'Paste Chord Sheet'}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowSheetUpload(true)}
                      className="text-xs px-3.5 py-2 rounded-xl border font-medium transition-all cursor-pointer flex items-center gap-1.5"
                      style={{
                        backgroundColor: 'var(--color-surface-2)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      Scan Sheet
                    </button>
                  </div>
                  <InputForm
                    onAnalyze={handleAnalyze}
                    loading={loading}
                    sampleInput={SAMPLE_INPUT}
                    externalText={scannedText}
                  />
                </div>
              )}

              {inputMode === 'lyrics' && (
                <div>
                  <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
                    {t.lyricsFirstMode || 'Lyrics-First Mode'}
                  </h2>
                  <p className="text-sm mb-4" style={{ color: 'var(--color-neutral)' }}>
                    {t.lyricsFirstDesc || 'Enter lyrics, then click to add chords above each word'}
                  </p>
                  <LyricsChordEditor onComplete={handleLyricsComplete} />
                </div>
              )}

              {inputMode === 'search' && (
                <div>
                  <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
                    {t.searchOnlineSheets || 'Search Online Chord Sheets'}
                  </h2>
                  <SongSearch onSongSelected={handleSongSelected} />
                </div>
              )}
            </div>
          </div>
        </div>

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

      {/* Sheet scanning modal */}
      <SheetUpload
        isOpen={showSheetUpload}
        onClose={() => setShowSheetUpload(false)}
        onScanComplete={handleScanComplete}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </AuthProvider>
  );
}
