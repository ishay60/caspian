import { useState, useEffect } from 'react';
import type { Section, Key, ChordAnalysis } from '../types';
import { useSettings } from '../lib/settingsContext';
import { analyzeSectionChords } from '../api';
import { ChordBadge } from './ChordBadge';
import { EditableChordBadge } from './EditableChordBadge';
import { BassLine } from './BassLine';
import { getChordColor } from '../lib/chordColor';
import { InterpretationPanel } from './InterpretationPanel';
import { StaffNotation } from './StaffNotation';
import { ChordDetailPanel } from './ChordDetailPanel';
import { ChordPlayer } from './ChordPlayer';
import { PracticeMode } from './PracticeMode';

interface Props {
  section: Section;
  keyInfo: Key | null;
  isEdited?: boolean;
  onSectionUpdate?: (updated: Section) => void;
  onChordSelect?: (chord: ChordAnalysis | null) => void;
}

export function SectionView({ section, keyInfo, isEdited, onSectionUpdate, onChordSelect }: Props) {
  const { notation, t, dir } = useSettings();
  const [selectedChord, setSelectedChord] = useState<number | null>(() =>
    section.chords.length > 0 ? 0 : null
  );
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editableSymbols, setEditableSymbols] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPlayer, setShowPlayer] = useState(false);
  const [showPractice, setShowPractice] = useState(false);
  const [, setPlayingChordIndex] = useState<number | null>(null);

  const nonDiatonic = section.chords.filter(c => !c.is_diatonic);
  const deceptive = section.chords.filter(c => c.deceptive_resolution);
  const hasAnalysisDetails = nonDiatonic.length > 0 || deceptive.length > 0 || (section.chromatic_runs?.length ?? 0) > 0;

  const showStaff = notation.showStaff;

  // When section or chord list changes, auto-select first chord so Piano & Guitar show immediately
  useEffect(() => {
    if (section.chords.length > 0) {
      setSelectedChord(0);
      onChordSelect?.(section.chords[0]);
    } else {
      setSelectedChord(null);
      onChordSelect?.(null);
    }
  }, [section.name, section.chords.length, onChordSelect]);

  function enterEditMode() {
    setEditableSymbols(section.chords.map(c => c.symbol));
    setError(null);
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setEditableSymbols([]);
    setError(null);
  }

  function updateSymbol(index: number, newSymbol: string) {
    setEditableSymbols(prev => {
      const next = [...prev];
      next[index] = newSymbol;
      return next;
    });
  }

  function deleteSymbol(index: number) {
    setEditableSymbols(prev => prev.filter((_, i) => i !== index));
  }

  function insertSymbol(afterIndex: number) {
    setEditableSymbols(prev => {
      const next = [...prev];
      next.splice(afterIndex + 1, 0, 'C');
      return next;
    });
  }

  async function applyEdit() {
    if (!onSectionUpdate) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await analyzeSectionChords(
        section.name,
        editableSymbols,
        keyInfo?.root_name || 'C',
        keyInfo?.mode || 'major',
      );
      // Preserve original lyrics data (the re-analysis endpoint doesn't return it)
      updated.lines = section.lines || [];
      onSectionUpdate(updated);
      setEditMode(false);
      setEditableSymbols([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="rounded-2xl overflow-hidden section-card"
      style={{
        border: `1px solid ${isEdited ? 'var(--color-primary)' : 'var(--color-border)'}`,
        backgroundColor: 'var(--color-surface)',
        boxShadow: isEdited ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
      }}
    >
      {/* Section header — section name + play/practice/edit */}
      <div
        className="px-5 sm:px-6 py-3.5 border-b flex items-center justify-between"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <h3
            className="font-semibold text-sm uppercase tracking-widest"
            style={{ color: 'var(--color-neutral)', letterSpacing: '0.08em' }}
          >
            {section.name}
          </h3>
          {isEdited && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
              {t.edited}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {section.chords.length > 0 && !editMode && (
            <>
              <button
                onClick={() => { setShowPlayer(!showPlayer); if (!showPlayer) setShowPractice(false); }}
                className="text-xs cursor-pointer px-3 py-1.5 rounded-xl font-medium transition-all border"
                style={{
                  borderColor: showPlayer ? 'var(--color-accent)' : 'var(--color-border)',
                  color: showPlayer ? 'var(--color-accent)' : 'var(--color-neutral)',
                  backgroundColor: showPlayer ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
                }}
                title={t.play}
              >
                &#9835; {t.play}
              </button>
              <button
                onClick={() => { setShowPractice(!showPractice); if (!showPractice) setShowPlayer(false); }}
                className="text-xs cursor-pointer px-3 py-1.5 rounded-xl font-medium transition-all border"
                style={{
                  borderColor: showPractice ? 'var(--color-diatonic)' : 'var(--color-border)',
                  color: showPractice ? 'var(--color-diatonic)' : 'var(--color-neutral)',
                  backgroundColor: showPractice ? 'color-mix(in srgb, var(--color-diatonic) 12%, transparent)' : 'transparent',
                }}
                title={t.practice}
              >
                &#9834; {t.practice}
              </button>
            </>
          )}
          {onSectionUpdate && !editMode && (
            <button
              onClick={enterEditMode}
              className="text-sm cursor-pointer p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--color-neutral)' }}
              title="Edit chords"
            >
              &#9998;
            </button>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {/* Edit mode toolbar */}
        {editMode && (
          <div className="space-y-3">
            {/* Editable chord badges — overflow-visible so completion dropdowns are not clipped */}
            <div className="flex flex-wrap items-center gap-1.5" style={{ overflow: 'visible' }}>
              {/* Insert button before first chord */}
              <button
                onClick={() => insertSymbol(-1)}
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs cursor-pointer transition-colors border"
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-neutral)',
                  backgroundColor: 'var(--color-surface)',
                }}
                title="Insert chord"
              >
                +
              </button>
              {editableSymbols.map((sym, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <EditableChordBadge
                    symbol={sym}
                    onChange={(newSym) => updateSymbol(i, newSym)}
                    onDelete={() => deleteSymbol(i)}
                    completionContext={{
                      keyRootName: keyInfo?.root_name || 'C',
                      keyMode: keyInfo?.mode || 'major',
                      prevChord: editableSymbols[i - 1],
                      nextChord: editableSymbols[i + 1],
                    }}
                  />
                  {/* Insert button after each chord */}
                  <button
                    onClick={() => insertSymbol(i)}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs cursor-pointer transition-colors border"
                    style={{
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-neutral)',
                      backgroundColor: 'var(--color-surface)',
                    }}
                    title="Insert chord"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm" style={{ color: 'var(--color-deceptive, #e53e3e)' }}>
                {error}
              </p>
            )}

            {/* Apply / Cancel buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={applyEdit}
                disabled={loading || editableSymbols.length === 0}
                className="px-4 py-2 text-sm font-semibold rounded-xl cursor-pointer transition-all disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'white',
                }}
              >
                {loading ? t.analyzing : t.apply}
              </button>
              <button
                onClick={cancelEdit}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium rounded-xl cursor-pointer transition-colors border disabled:opacity-50"
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {/* Normal view (hidden during edit) */}
        {!editMode && (
          <>
            {/* Chord Player */}
            {showPlayer && section.chords.length > 0 && (
              <ChordPlayer
                chords={section.chords}
                onChordHighlight={(idx) => {
                  setPlayingChordIndex(idx);
                  if (idx !== null) setSelectedChord(idx);
                }}
              />
            )}

            {/* Practice Mode */}
            {showPractice && section.chords.length > 0 && (
              <PracticeMode
                chords={section.chords}
                sectionName={section.name}
              />
            )}

            {/* Staff notation (conditional) */}
            {showStaff && keyInfo && (
              <StaffNotation
                chords={section.chords}
                keyInfo={keyInfo}
                selectedIndex={selectedChord}
                onSelect={(i) => {
                  const newIdx = selectedChord === i ? null : i;
                  setSelectedChord(newIdx);
                  onChordSelect?.(newIdx !== null ? section.chords[newIdx] : null);
                }}
              />
            )}

            {/* Chord-above-lyrics display (tab-style) */}
            {section.lines && section.lines.length > 0 && (() => {
              // Build a lookup from chord symbol to analysis for coloring
              const chordLookup = new Map<string, ChordAnalysis>();
              for (const ca of section.chords) {
                chordLookup.set(ca.symbol, ca);
              }

              return (
                <div
                  className="font-mono text-sm rounded-xl px-5 py-4"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    overflowX: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: dir === 'rtl' ? 'flex-end' : 'flex-start',
                  }}
                >
                  {section.lines.map((line, lineIdx) => {
                    // Build the chord line: colored chord names at their original column positions
                    const chordSpans: React.ReactNode[] = [];
                    let prevEnd = 0;
                    for (let ci = 0; ci < line.chords.length; ci++) {
                      const [col, sym] = line.chords[ci];
                      const ca = chordLookup.get(sym);
                      const color = ca ? getChordColor(ca) : 'var(--color-neutral)';
                      if (col > prevEnd) {
                        chordSpans.push(' '.repeat(col - prevEnd));
                      }
                      chordSpans.push(
                        <span key={`ch-${ci}`} style={{ color, fontWeight: 700 }}>{sym}</span>
                      );
                      prevEnd = col + sym.length;
                    }

                    return (
                      <div
                        key={lineIdx}
                        className="mb-3"
                        style={{
                          direction: 'ltr',
                          unicodeBidi: 'bidi-override',
                          width: 'fit-content',
                          marginLeft: dir === 'rtl' ? 'auto' : undefined,
                          marginRight: dir === 'ltr' ? 'auto' : undefined,
                        }}
                      >
                        <div style={{ whiteSpace: 'pre', lineHeight: '1.6' }}>
                          {chordSpans}
                        </div>
                        {line.lyrics.trim() && (
                          <div style={{ whiteSpace: 'pre', lineHeight: '1.6', color: 'var(--color-text-secondary)' }}>
                            {line.lyrics}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Chord row: click any chord to see Piano & Guitar below */}
            <div className="flex flex-wrap items-center gap-2" dir="ltr">
              {section.chords.map((chord, i) => (
                <div key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-sm select-none font-medium" style={{ color: 'var(--color-staff-line)' }}>&rarr;</span>}
                  <ChordBadge
                    chord={chord}
                    selected={selectedChord === i}
                    onClick={() => {
                      const newIdx = selectedChord === i ? null : i;
                      setSelectedChord(newIdx);
                      onChordSelect?.(newIdx !== null ? section.chords[newIdx] : null);
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Selected chord detail panel */}
            {selectedChord !== null && section.chords[selectedChord] && keyInfo && (
              <ChordDetailPanel
                chord={section.chords[selectedChord]}
                keyInfo={keyInfo}
              />
            )}

            {/* Bass line */}
            {section.bass_line && section.bass_line.length > 0 && (
              <BassLine
                bassLine={section.bass_line}
                chromaticRuns={section.chromatic_runs || []}
              />
            )}

            {/* Collapsible analysis panel */}
            {hasAnalysisDetails && (
              <div>
                <button
                  onClick={() => setShowAnalysis(!showAnalysis)}
                  className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                  style={{ color: 'var(--color-neutral)' }}
                >
                  <span
                    className="transition-transform"
                    style={{
                      display: 'inline-block',
                      transform: showAnalysis ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}
                  >
                    &#9654;
                  </span>
                  {t.analysisDetails}
                </button>

                {showAnalysis && (
                  <div className="mt-3 space-y-4 pl-4 border-l-2 rounded-r" style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 50%, var(--color-border))' }}>
                    {nonDiatonic.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-neutral)' }}>
                          {t.nonDiatonicEvents}
                        </h4>
                        <div className="space-y-2">
                          {nonDiatonic.map((chord, i) => (
                            <InterpretationPanel key={i} chord={chord} />
                          ))}
                        </div>
                      </div>
                    )}

                    {deceptive.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-deceptive)' }}>
                          {t.deceptiveResolutions}
                        </h4>
                        {deceptive.map((chord, i) => (
                          <p key={i} className="text-sm ml-3" style={{ color: 'var(--color-text-secondary)' }}>
                            {chord.deceptive_resolution}
                          </p>
                        ))}
                      </div>
                    )}

                    {section.chromatic_runs && section.chromatic_runs.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-neutral)' }}>
                          {t.chromaticMotion}
                        </h4>
                        {section.chromatic_runs.map((run, i) => (
                          <p key={i} className="text-sm ml-3 font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                            <span style={{ color: 'var(--color-diminished)' }} className="capitalize">{run.direction}</span>
                            {' '}{run.length === 2 ? t.pair : t.run}: {run.notes.join(' \u2192 ')}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
