import { useState } from 'react';
import type { Section, Key, ChordAnalysis } from '../types';
import { useSettings } from '../lib/settingsContext';
import { analyzeSectionChords } from '../api';
import { ChordBadge } from './ChordBadge';
import { EditableChordBadge } from './EditableChordBadge';
import { BassLine } from './BassLine';
import { InterpretationPanel } from './InterpretationPanel';
import { StaffNotation } from './StaffNotation';
import { ChordDetailPanel } from './ChordDetailPanel';
import { ChordPlayer } from './ChordPlayer';
import { PracticeMode } from './PracticeMode';

interface Props {
  section: Section;
  keyInfo: Key;
  isEdited?: boolean;
  onSectionUpdate?: (updated: Section) => void;
  onChordSelect?: (chord: ChordAnalysis | null) => void;
}

export function SectionView({ section, keyInfo, isEdited, onSectionUpdate, onChordSelect }: Props) {
  const { vizMode } = useSettings();
  const [selectedChord, setSelectedChord] = useState<number | null>(null);
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
  const hasAnalysisDetails = nonDiatonic.length > 0 || deceptive.length > 0 || section.chromatic_runs.length > 0;

  const showStaff = vizMode === 'staff' || vizMode === 'all';

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
        keyInfo.root_name,
        keyInfo.mode,
      );
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
      className="rounded-xl overflow-hidden section-card"
      style={{
        border: `1px solid ${isEdited ? 'var(--color-primary)' : 'var(--color-border)'}`,
        backgroundColor: 'var(--color-surface)',
      }}
    >
      {/* Section header */}
      <div
        className="px-6 py-3 border-b flex items-center justify-between"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm uppercase tracking-wider" style={{ color: 'var(--color-neutral)' }}>
            {section.name}
          </h3>
          {isEdited && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
              edited
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {section.chords.length > 0 && !editMode && (
            <>
              <button
                onClick={() => { setShowPlayer(!showPlayer); if (!showPlayer) setShowPractice(false); }}
                className="text-xs cursor-pointer px-2 py-1 rounded transition-colors border"
                style={{
                  borderColor: showPlayer ? 'var(--color-accent)' : 'var(--color-border)',
                  color: showPlayer ? 'var(--color-accent)' : 'var(--color-neutral)',
                  backgroundColor: showPlayer ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
                }}
                title="Play chords"
              >
                &#9835; Play
              </button>
              <button
                onClick={() => { setShowPractice(!showPractice); if (!showPractice) setShowPlayer(false); }}
                className="text-xs cursor-pointer px-2 py-1 rounded transition-colors border"
                style={{
                  borderColor: showPractice ? 'var(--color-diatonic)' : 'var(--color-border)',
                  color: showPractice ? 'var(--color-diatonic)' : 'var(--color-neutral)',
                  backgroundColor: showPractice ? 'color-mix(in srgb, var(--color-diatonic) 10%, transparent)' : 'transparent',
                }}
                title="Practice mode"
              >
                &#9834; Practice
              </button>
            </>
          )}
          {onSectionUpdate && !editMode && (
            <button
              onClick={enterEditMode}
              className="text-sm cursor-pointer p-1 rounded transition-colors"
              style={{ color: 'var(--color-neutral)' }}
              title="Edit chords"
            >
              &#9998;
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Edit mode toolbar */}
        {editMode && (
          <div className="space-y-3">
            {/* Editable chord badges */}
            <div className="flex flex-wrap items-center gap-1.5">
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
                className="px-3 py-1 text-sm font-medium rounded-md cursor-pointer transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'white',
                }}
              >
                {loading ? 'Analyzing...' : 'Apply'}
              </button>
              <button
                onClick={cancelEdit}
                disabled={loading}
                className="px-3 py-1 text-sm font-medium rounded-md cursor-pointer transition-colors border disabled:opacity-50"
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Cancel
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
            {showStaff && (
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

            {/* Chord badges row */}
            <div className="flex flex-wrap items-center gap-1.5">
              {section.chords.map((chord, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-sm select-none" style={{ color: 'var(--color-border)' }}>&rarr;</span>}
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
            {selectedChord !== null && section.chords[selectedChord] && (
              <ChordDetailPanel
                chord={section.chords[selectedChord]}
                keyInfo={keyInfo}
              />
            )}

            {/* Bass line */}
            {section.bass_line.length > 0 && (
              <BassLine
                bassLine={section.bass_line}
                chromaticRuns={section.chromatic_runs}
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
                  Analysis Details
                </button>

                {showAnalysis && (
                  <div className="mt-3 space-y-4 pl-4 border-l-2" style={{ borderColor: 'var(--color-border)' }}>
                    {nonDiatonic.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-neutral)' }}>
                          Non-diatonic Events
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
                          Deceptive Resolutions
                        </h4>
                        {deceptive.map((chord, i) => (
                          <p key={i} className="text-sm ml-3" style={{ color: 'var(--color-text-secondary)' }}>
                            {chord.deceptive_resolution}
                          </p>
                        ))}
                      </div>
                    )}

                    {section.chromatic_runs.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-neutral)' }}>
                          Chromatic Motion
                        </h4>
                        {section.chromatic_runs.map((run, i) => (
                          <p key={i} className="text-sm ml-3 font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                            <span style={{ color: 'var(--color-diminished)' }} className="capitalize">{run.direction}</span>
                            {' '}{run.length === 2 ? 'pair' : 'run'}: {run.notes.join(' \u2192 ')}
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
