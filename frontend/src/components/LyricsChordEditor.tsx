/**
 * LyricsChordEditor Component
 *
 * Interactive lyrics-first chord sheet editor.
 * Users paste lyrics, then click positions to place chords,
 * then optionally add bar lines directly above the lyrics.
 *
 * WORKFLOW:
 * 1. User pastes plain lyrics text
 * 2. Lyrics displayed line by line
 * 3. User clicks character positions to place chords
 * 4. Chord autocomplete appears
 * 5. User toggles "Add Bars" to insert bar lines between chords
 * 6. Bar lines appear as | dividers in the chord row above lyrics
 * 7. Final result rendered in preview with bar structure
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChordLyricsLine, Bar, BeatPosition } from '../types';
import { getChordCompletions } from '../api';
import './LyricsChordEditor.css';

interface PlacedChord {
  lineIndex: number;
  columnPosition: number;
  symbol: string;
}

interface SectionMarker {
  lineIndex: number;
  name: string;
}

/** Bar line between two chords on a line, identified by the column position it appears at */
interface BarLinePosition {
  lineIndex: number;
  /** Column position where the bar line sits (between the chord before this and the chord at/after this) */
  afterChordColumn: number;
}

interface LyricsChordEditorProps {
  initialLyrics?: string;
  keyRootName?: string;
  keyMode?: string;
  onComplete?: (sections: { name: string; lines: ChordLyricsLine[]; bars?: Bar[] }[]) => void;
}

export function LyricsChordEditor({
  initialLyrics = '',
  keyRootName = 'C',
  keyMode = 'major',
  onComplete
}: LyricsChordEditorProps) {
  // State management
  const [mode, setMode] = useState<'input' | 'edit' | 'preview'>('input');
  const [lyrics, setLyrics] = useState(initialLyrics);
  const [lyricsLines, setLyricsLines] = useState<string[]>([]);
  const [placedChords, setPlacedChords] = useState<PlacedChord[]>([]);
  const [sectionMarkers, setSectionMarkers] = useState<SectionMarker[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<{ lineIndex: number; columnPosition: number } | null>(null);
  const [chordInput, setChordInput] = useState('');
  const [completions, setCompletions] = useState<string[]>([]);
  const [barMode, setBarMode] = useState(false);
  const [barLines, setBarLines] = useState<BarLinePosition[]>([]);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chordInputRef = useRef<HTMLInputElement>(null);

  // Effect: Focus chord input when position selected
  useEffect(() => {
    if (selectedPosition && chordInputRef.current) {
      chordInputRef.current.focus();
    }
  }, [selectedPosition]);

  // Handler: Submit lyrics and switch to edit mode
  const handleSubmitLyrics = useCallback(() => {
    if (!lyrics.trim()) return;
    const lines = lyrics.split('\n');
    setLyricsLines(lines);
    setMode('edit');
  }, [lyrics]);

  // Handler: Back to input mode
  const handleBackToInput = useCallback(() => {
    setMode('input');
    setPlacedChords([]);
    setSectionMarkers([]);
    setSelectedPosition(null);
    setBarLines([]);
    setBarMode(false);
  }, []);

  // Handler: Go to preview mode
  const handleShowPreview = useCallback(() => {
    setMode('preview');
  }, []);

  // Handler: Back to edit from preview
  const handleBackToEdit = useCallback(() => {
    setMode('edit');
  }, []);

  // Handler: Toggle bar line at a position
  const handleToggleBarLine = useCallback((lineIndex: number, afterChordColumn: number) => {
    setBarLines(prev => {
      const exists = prev.some(
        bl => bl.lineIndex === lineIndex && bl.afterChordColumn === afterChordColumn
      );
      if (exists) {
        return prev.filter(
          bl => !(bl.lineIndex === lineIndex && bl.afterChordColumn === afterChordColumn)
        );
      }
      return [...prev, { lineIndex, afterChordColumn }];
    });
  }, []);

  // Handler: Auto-suggest bar lines (every N chords)
  const handleAutoSuggestBars = useCallback((chordsPerBar: number = 2) => {
    const newBarLines: BarLinePosition[] = [];
    // Group chords by line
    const chordsByLine = new Map<number, PlacedChord[]>();
    for (const chord of placedChords) {
      const existing = chordsByLine.get(chord.lineIndex) || [];
      existing.push(chord);
      chordsByLine.set(chord.lineIndex, existing);
    }

    for (const [lineIndex, lineChords] of chordsByLine) {
      const sorted = [...lineChords].sort((a, b) => a.columnPosition - b.columnPosition);
      for (let i = chordsPerBar; i < sorted.length; i += chordsPerBar) {
        newBarLines.push({
          lineIndex,
          afterChordColumn: sorted[i].columnPosition,
        });
      }
    }
    setBarLines(newBarLines);
  }, [placedChords]);

  // Convert placed chords to ChordLyricsLine format
  const buildChordLyricsLines = useCallback((): ChordLyricsLine[] => {
    return lyricsLines.map((lineText, lineIndex) => {
      const lineChords = placedChords
        .filter(chord => chord.lineIndex === lineIndex)
        .sort((a, b) => a.columnPosition - b.columnPosition)
        .map(chord => [chord.columnPosition, chord.symbol] as [number, string]);

      return {
        chords: lineChords,
        lyrics: lineText,
      };
    });
  }, [lyricsLines, placedChords]);

  // Build Bar[] from placed chords + bar lines
  const buildBars = useCallback((): Bar[] | undefined => {
    if (barLines.length === 0) return undefined;

    const bars: Bar[] = [];

    // Group chords by line
    const chordsByLine = new Map<number, PlacedChord[]>();
    for (const chord of placedChords) {
      const existing = chordsByLine.get(chord.lineIndex) || [];
      existing.push(chord);
      chordsByLine.set(chord.lineIndex, existing);
    }

    // Group bar lines by line
    const barLinesByLine = new Map<number, number[]>();
    for (const bl of barLines) {
      const existing = barLinesByLine.get(bl.lineIndex) || [];
      existing.push(bl.afterChordColumn);
      barLinesByLine.set(bl.lineIndex, existing);
    }

    // Process each line that has chords
    for (const [lineIndex, lineChords] of chordsByLine) {
      const sorted = [...lineChords].sort((a, b) => a.columnPosition - b.columnPosition);
      const lineBarLines = (barLinesByLine.get(lineIndex) || []).sort((a, b) => a - b);
      const lineText = lyricsLines[lineIndex] || '';

      // Split chords into bar groups based on bar line positions
      let currentBarChords: PlacedChord[] = [];
      let barStartCol = 0;

      for (const chord of sorted) {
        // Check if there's a bar line before this chord
        if (lineBarLines.includes(chord.columnPosition) && currentBarChords.length > 0) {
          // Finalize previous bar
          const barEndCol = chord.columnPosition;
          bars.push(createBarFromChords(currentBarChords, lineText, barStartCol, barEndCol));
          currentBarChords = [];
          barStartCol = chord.columnPosition;
        }
        currentBarChords.push(chord);
      }

      // Finalize last bar on this line
      if (currentBarChords.length > 0) {
        bars.push(createBarFromChords(currentBarChords, lineText, barStartCol, lineText.length));
      }
    }

    return bars.length > 0 ? bars : undefined;
  }, [placedChords, barLines, lyricsLines]);

  // Render based on mode
  return (
    <div className="lyrics-chord-editor">
      {mode === 'input' ? (
        <InputMode
          lyrics={lyrics}
          setLyrics={setLyrics}
          onSubmit={handleSubmitLyrics}
          textareaRef={textareaRef}
        />
      ) : mode === 'edit' ? (
        <EditMode
          lyricsLines={lyricsLines}
          placedChords={placedChords}
          setPlacedChords={setPlacedChords}
          sectionMarkers={sectionMarkers}
          setSectionMarkers={setSectionMarkers}
          selectedPosition={selectedPosition}
          setSelectedPosition={setSelectedPosition}
          chordInput={chordInput}
          setChordInput={setChordInput}
          completions={completions}
          setCompletions={setCompletions}
          chordInputRef={chordInputRef}
          keyRootName={keyRootName}
          keyMode={keyMode}
          barMode={barMode}
          setBarMode={setBarMode}
          barLines={barLines}
          onToggleBarLine={handleToggleBarLine}
          onAutoSuggestBars={handleAutoSuggestBars}
          onBack={handleBackToInput}
          onPreview={handleShowPreview}
          onComplete={onComplete}
        />
      ) : (
        <PreviewMode
          lines={buildChordLyricsLines()}
          sectionMarkers={sectionMarkers}
          barLines={barLines}
          placedChords={placedChords}
          lyricsLines={lyricsLines}
          onBack={handleBackToEdit}
          onComplete={() => {
            const sections = buildSectionsFromMarkersAndLines(
              lyricsLines,
              placedChords,
              sectionMarkers,
              buildBars()
            );
            if (onComplete) {
              onComplete(sections);
            }
          }}
        />
      )}
    </div>
  );
}

/** Create a Bar object from a group of placed chords */
function createBarFromChords(
  chords: PlacedChord[],
  lineText: string,
  startCol: number,
  endCol: number
): Bar {
  const beatsPerBar = 4;
  const barChords = chords.map((chord, idx) => ({
    symbol: chord.symbol,
    beat_position: {
      beat: Math.min(Math.floor((idx * beatsPerBar) / chords.length) + 1, beatsPerBar),
      subdivision: 0,
    } as BeatPosition,
    duration_beats: null,
  }));

  return {
    time_signature: [4, 4] as [number, number],
    content: {
      chords: barChords,
      notes: [],
      tab: [],
    },
    lyrics_fragment: lineText.slice(startCol, endCol).trim(),
    is_expandable: false,
  };
}

/**
 * InputMode: Plain lyrics textarea
 */
interface InputModeProps {
  lyrics: string;
  setLyrics: (lyrics: string) => void;
  onSubmit: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

function InputMode({ lyrics, setLyrics, onSubmit, textareaRef }: InputModeProps) {
  return (
    <div className="input-mode">
      <h2 className="mode-title">Paste Your Lyrics</h2>
      <p className="mode-description">
        Paste your song lyrics below. You'll be able to add chords in the next step.
      </p>

      <textarea
        ref={textareaRef}
        className="lyrics-input"
        value={lyrics}
        onChange={(e) => setLyrics(e.target.value)}
        placeholder="Paste or type your lyrics here..."
        rows={15}
        dir="auto"
      />

      <div className="input-actions">
        <button
          className="btn-primary"
          onClick={onSubmit}
          disabled={!lyrics.trim()}
        >
          Next: Add Chords
        </button>
      </div>
    </div>
  );
}

/**
 * EditMode: Line-by-line display with chord placement and bar lines
 */
interface EditModeProps {
  lyricsLines: string[];
  placedChords: PlacedChord[];
  setPlacedChords: (chords: PlacedChord[]) => void;
  sectionMarkers: SectionMarker[];
  setSectionMarkers: (markers: SectionMarker[]) => void;
  selectedPosition: { lineIndex: number; columnPosition: number } | null;
  setSelectedPosition: (position: { lineIndex: number; columnPosition: number } | null) => void;
  chordInput: string;
  setChordInput: (input: string) => void;
  completions: string[];
  setCompletions: (completions: string[]) => void;
  chordInputRef: React.RefObject<HTMLInputElement>;
  keyRootName: string;
  keyMode: string;
  barMode: boolean;
  setBarMode: (mode: boolean) => void;
  barLines: BarLinePosition[];
  onToggleBarLine: (lineIndex: number, afterChordColumn: number) => void;
  onAutoSuggestBars: (chordsPerBar?: number) => void;
  onBack: () => void;
  onPreview: () => void;
  onComplete?: (sections: { name: string; lines: ChordLyricsLine[]; bars?: Bar[] }[]) => void;
}

function EditMode({
  lyricsLines,
  placedChords,
  setPlacedChords,
  sectionMarkers,
  setSectionMarkers,
  selectedPosition,
  setSelectedPosition,
  chordInput,
  setChordInput,
  completions,
  setCompletions,
  chordInputRef,
  keyRootName,
  keyMode,
  barMode,
  setBarMode,
  barLines,
  onToggleBarLine,
  onAutoSuggestBars,
  onBack,
  onPreview,
  onComplete,
}: EditModeProps) {
  const [pendingSectionLine, setPendingSectionLine] = useState<number | null>(null);
  const [customSectionName, setCustomSectionName] = useState('');

  // Handler: Click on character position to place chord
  const handleCharClick = useCallback((lineIndex: number, columnPosition: number) => {
    if (barMode) return; // Don't place chords in bar mode
    setSelectedPosition({ lineIndex, columnPosition });
    setChordInput('');
    setCompletions([]);
  }, [barMode, setSelectedPosition, setChordInput, setCompletions]);

  // Handler: Remove chord
  const handleRemoveChord = useCallback((lineIndex: number, columnPosition: number) => {
    setPlacedChords(placedChords.filter(
      chord => !(chord.lineIndex === lineIndex && chord.columnPosition === columnPosition)
    ));
  }, [placedChords, setPlacedChords]);

  // Get chord at position
  const getChordAt = useCallback((lineIndex: number, columnPosition: number) => {
    return placedChords.find(
      chord => chord.lineIndex === lineIndex && chord.columnPosition === columnPosition
    );
  }, [placedChords]);

  // Handler: Add section marker at line
  const handleAddSectionMarker = useCallback((name: string) => {
    const lineIndex = 0;
    const newMarker: SectionMarker = { lineIndex, name };
    setSectionMarkers([...sectionMarkers, newMarker]);
  }, [sectionMarkers, setSectionMarkers]);

  // Handler: Request section marker insertion at specific line
  const handleRequestSectionAtLine = useCallback((lineIndex: number) => {
    setPendingSectionLine(lineIndex);
  }, []);

  // Handler: Confirm section marker with custom name
  const handleConfirmSectionMarker = useCallback(() => {
    if (pendingSectionLine !== null && customSectionName.trim()) {
      const newMarker: SectionMarker = {
        lineIndex: pendingSectionLine,
        name: customSectionName.trim(),
      };
      setSectionMarkers([...sectionMarkers, newMarker]);
      setPendingSectionLine(null);
      setCustomSectionName('');
    }
  }, [pendingSectionLine, customSectionName, sectionMarkers, setSectionMarkers]);

  // Handler: Remove section marker
  const handleRemoveSectionMarker = useCallback((lineIndex: number) => {
    setSectionMarkers(sectionMarkers.filter(m => m.lineIndex !== lineIndex));
  }, [sectionMarkers, setSectionMarkers]);

  // Get section marker at line
  const getSectionMarkerAt = useCallback((lineIndex: number) => {
    return sectionMarkers.find(m => m.lineIndex === lineIndex);
  }, [sectionMarkers]);

  // Check if bar line exists at position
  const hasBarLineAt = useCallback((lineIndex: number, afterChordColumn: number) => {
    return barLines.some(
      bl => bl.lineIndex === lineIndex && bl.afterChordColumn === afterChordColumn
    );
  }, [barLines]);

  return (
    <div className="edit-mode">
      <div className="edit-header">
        <button className="btn-secondary" onClick={onBack}>
          ← Back to Lyrics
        </button>
        <h2 className="mode-title">
          {barMode ? 'Add Bar Lines' : 'Add Chords'}
        </h2>
        <button
          className="btn-primary"
          onClick={onPreview}
          disabled={placedChords.length === 0}
        >
          Preview
        </button>
      </div>

      <div className="edit-instructions">
        {barMode
          ? 'Click between chords to insert or remove bar lines. Bars group chords into measures.'
          : 'Click on any position in the lyrics to place a chord above it.'
        }
      </div>

      {/* Toolbar */}
      <div className="edit-toolbar">
        {!barMode ? (
          <>
            <div className="toolbar-label">Insert section marker:</div>
            <button className="toolbar-btn" onClick={() => handleAddSectionMarker('Verse')}>
              + Verse
            </button>
            <button className="toolbar-btn" onClick={() => handleAddSectionMarker('Chorus')}>
              + Chorus
            </button>
            <button className="toolbar-btn" onClick={() => handleAddSectionMarker('Bridge')}>
              + Bridge
            </button>
            <button className="toolbar-btn" onClick={() => handleAddSectionMarker('Intro')}>
              + Intro
            </button>
            <button className="toolbar-btn" onClick={() => handleAddSectionMarker('Outro')}>
              + Outro
            </button>
            <div style={{ flex: 1 }} />
            {placedChords.length >= 2 && (
              <button
                className="toolbar-btn toolbar-btn--bar-mode"
                onClick={() => setBarMode(true)}
              >
                | Add Bars |
              </button>
            )}
          </>
        ) : (
          <>
            <div className="toolbar-label">Bar tools:</div>
            <button className="toolbar-btn" onClick={() => onAutoSuggestBars(2)}>
              Auto: 2 chords/bar
            </button>
            <button className="toolbar-btn" onClick={() => onAutoSuggestBars(4)}>
              Auto: 4 chords/bar
            </button>
            <span className="bar-count-label">
              {barLines.length} bar line{barLines.length !== 1 ? 's' : ''}
            </span>
            <div style={{ flex: 1 }} />
            <button
              className="toolbar-btn"
              onClick={() => setBarMode(false)}
            >
              Done with Bars
            </button>
          </>
        )}
      </div>

      {/* Render lyrics lines with clickable characters */}
      <div className="lyrics-display">
        {lyricsLines.map((lineText, lineIndex) => {
          const sectionMarker = getSectionMarkerAt(lineIndex);
          return (
            <div key={lineIndex}>
              {/* Section marker if present */}
              {sectionMarker && (
                <div className="section-marker">
                  <span className="section-marker-name">{sectionMarker.name}</span>
                  <button
                    className="section-marker-remove"
                    onClick={() => handleRemoveSectionMarker(lineIndex)}
                    title="Remove section marker"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Lyrics line */}
              <LyricsLineEditable
                lineIndex={lineIndex}
                lineText={lineText}
                placedChords={placedChords}
                barMode={barMode}
                barLines={barLines}
                onCharClick={handleCharClick}
                onRemoveChord={handleRemoveChord}
                getChordAt={getChordAt}
                hasBarLineAt={hasBarLineAt}
                onToggleBarLine={onToggleBarLine}
                onRequestSection={handleRequestSectionAtLine}
              />
            </div>
          );
        })}
      </div>

      {/* Chord input popup */}
      {selectedPosition && !barMode && (
        <ChordInputPopup
          selectedPosition={selectedPosition}
          chordInput={chordInput}
          setChordInput={setChordInput}
          completions={completions}
          setCompletions={setCompletions}
          chordInputRef={chordInputRef}
          keyRootName={keyRootName}
          keyMode={keyMode}
          placedChords={placedChords}
          lyricsLines={lyricsLines}
          onPlaceChord={(symbol) => {
            const newChord: PlacedChord = {
              lineIndex: selectedPosition.lineIndex,
              columnPosition: selectedPosition.columnPosition,
              symbol,
            };
            const filtered = placedChords.filter(
              c => !(c.lineIndex === selectedPosition.lineIndex && c.columnPosition === selectedPosition.columnPosition)
            );
            setPlacedChords([...filtered, newChord]);
            setSelectedPosition(null);
            setChordInput('');
            setCompletions([]);
          }}
          onCancel={() => {
            setSelectedPosition(null);
            setChordInput('');
            setCompletions([]);
          }}
        />
      )}

      {/* Section name input popup */}
      {pendingSectionLine !== null && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.3)',
              zIndex: 999,
            }}
            onClick={() => {
              setPendingSectionLine(null);
              setCustomSectionName('');
            }}
          />
          <div
            className="section-input-popup"
            style={{
              position: 'fixed',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1000,
              minWidth: '300px',
            }}
          >
            <h3 style={{ marginBottom: '12px', color: 'var(--color-text)', fontSize: '16px' }}>
              Add Section at Line {pendingSectionLine + 1}
            </h3>
            <input
              type="text"
              value={customSectionName}
              onChange={(e) => setCustomSectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmSectionMarker();
                if (e.key === 'Escape') {
                  setPendingSectionLine(null);
                  setCustomSectionName('');
                }
              }}
              placeholder="e.g. Verse, Chorus, Bridge"
              autoFocus
              style={{
                width: '100%', padding: '8px', marginBottom: '12px',
                border: '1px solid var(--color-border)', borderRadius: '4px',
                backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setPendingSectionLine(null); setCustomSectionName(''); }}
                style={{
                  padding: '6px 12px', border: '1px solid var(--color-border)',
                  borderRadius: '4px', backgroundColor: 'var(--color-surface-2)',
                  color: 'var(--color-text)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSectionMarker}
                disabled={!customSectionName.trim()}
                style={{
                  padding: '6px 12px', border: '1px solid var(--color-accent)',
                  borderRadius: '4px', backgroundColor: 'var(--color-accent)',
                  color: 'white',
                  cursor: customSectionName.trim() ? 'pointer' : 'not-allowed',
                  opacity: customSectionName.trim() ? 1 : 0.5,
                }}
              >
                Add Section
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * LyricsLineEditable: Render a line with clickable character positions and bar lines
 */
interface LyricsLineEditableProps {
  lineIndex: number;
  lineText: string;
  placedChords: PlacedChord[];
  barMode: boolean;
  barLines: BarLinePosition[];
  onCharClick: (lineIndex: number, columnPosition: number) => void;
  onRemoveChord: (lineIndex: number, columnPosition: number) => void;
  getChordAt: (lineIndex: number, columnPosition: number) => PlacedChord | undefined;
  hasBarLineAt: (lineIndex: number, afterChordColumn: number) => boolean;
  onToggleBarLine: (lineIndex: number, afterChordColumn: number) => void;
  onRequestSection: (lineIndex: number) => void;
}

function LyricsLineEditable({
  lineIndex,
  lineText,
  placedChords,
  barMode,
  barLines,
  onCharClick,
  onRemoveChord,
  getChordAt,
  hasBarLineAt,
  onToggleBarLine,
  onRequestSection,
}: LyricsLineEditableProps) {
  const lineRef = useRef<HTMLDivElement>(null);

  // Detect RTL text (Hebrew)
  const isRTL = /[\u0590-\u05FF]/.test(lineText);
  const displayText = lineText || '\u00A0';

  // Get sorted chords for this line (needed for bar line insertion zones)
  const lineChords = placedChords
    .filter(c => c.lineIndex === lineIndex)
    .sort((a, b) => a.columnPosition - b.columnPosition);

  return (
    <div className="lyrics-line-container">
      <div
        className="line-number"
        title="Click to add section marker here"
        onClick={() => onRequestSection(lineIndex)}
        style={{ cursor: 'pointer' }}
      >
        {lineIndex + 1}
      </div>
      <div
        ref={lineRef}
        className={`lyrics-line lyrics-line-editable ${barMode ? 'lyrics-line--bar-mode' : ''}`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {Array.from(displayText).map((char, charIndex) => {
          const chord = getChordAt(lineIndex, charIndex);
          const hasBarLine = hasBarLineAt(lineIndex, charIndex);

          // In bar mode, check if this position is between two chords (valid for bar line insertion)
          const isBarLineCandidate = barMode && chord && lineChords.indexOf(chord) > 0;

          return (
            <span
              key={charIndex}
              className={`char-cell ${chord ? 'has-chord' : ''} ${hasBarLine ? 'has-bar-line' : ''}`}
              onClick={() => {
                if (barMode && isBarLineCandidate) {
                  onToggleBarLine(lineIndex, charIndex);
                } else if (!barMode) {
                  onCharClick(lineIndex, charIndex);
                }
              }}
            >
              {/* Bar line indicator before this chord (in bar mode or always if placed) */}
              {hasBarLine && (
                <span
                  className="bar-line-indicator"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleBarLine(lineIndex, charIndex);
                  }}
                  title="Click to remove bar line"
                >
                  |
                </span>
              )}

              {/* Bar line insertion zone (bar mode only, between chords) */}
              {barMode && isBarLineCandidate && !hasBarLine && (
                <span
                  className="bar-line-zone"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleBarLine(lineIndex, charIndex);
                  }}
                  title="Click to insert bar line"
                >
                  |
                </span>
              )}

              {/* Chord badge above character */}
              {chord && (
                <span className="chord-badge">
                  {chord.symbol}
                  {!barMode && (
                    <button
                      className="chord-remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveChord(lineIndex, charIndex);
                      }}
                      title="Remove chord"
                    >
                      ×
                    </button>
                  )}
                </span>
              )}
              {char}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ChordInputPopup: Popup for entering chord symbol with autocomplete
 */
interface ChordInputPopupProps {
  selectedPosition: { lineIndex: number; columnPosition: number };
  chordInput: string;
  setChordInput: (input: string) => void;
  completions: string[];
  setCompletions: (completions: string[]) => void;
  chordInputRef: React.RefObject<HTMLInputElement>;
  keyRootName: string;
  keyMode: string;
  placedChords: PlacedChord[];
  lyricsLines: string[];
  onPlaceChord: (symbol: string) => void;
  onCancel: () => void;
}

function ChordInputPopup({
  selectedPosition,
  chordInput,
  setChordInput,
  completions,
  setCompletions,
  chordInputRef,
  keyRootName,
  keyMode,
  placedChords,
  lyricsLines,
  onPlaceChord,
  onCancel,
}: ChordInputPopupProps) {
  const [selectedCompletionIndex, setSelectedCompletionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!popupRef.current) return;
    const popup = popupRef.current;
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
  }, [selectedPosition]);

  const fetchCompletions = useCallback(async (prefix: string) => {
    if (prefix.length < 1) {
      setCompletions([]);
      return;
    }

    setIsLoading(true);
    try {
      const currentLine = selectedPosition.lineIndex;
      const currentCol = selectedPosition.columnPosition;

      const prevChords = placedChords
        .filter(c => c.lineIndex < currentLine || (c.lineIndex === currentLine && c.columnPosition < currentCol))
        .sort((a, b) => {
          if (a.lineIndex !== b.lineIndex) return a.lineIndex - b.lineIndex;
          return a.columnPosition - b.columnPosition;
        });
      const prevChord = prevChords.length > 0 ? prevChords[prevChords.length - 1].symbol : undefined;

      const nextChords = placedChords
        .filter(c => c.lineIndex > currentLine || (c.lineIndex === currentLine && c.columnPosition > currentCol))
        .sort((a, b) => {
          if (a.lineIndex !== b.lineIndex) return a.lineIndex - b.lineIndex;
          return a.columnPosition - b.columnPosition;
        });
      const nextChord = nextChords.length > 0 ? nextChords[0].symbol : undefined;

      const results = await getChordCompletions(
        prefix, keyRootName, keyMode, prevChord, nextChord, 20
      );
      setCompletions(results);
    } catch (error) {
      console.error('Failed to fetch chord completions:', error);
      setCompletions([]);
    } finally {
      setIsLoading(false);
    }
  }, [keyRootName, keyMode, placedChords, selectedPosition, setCompletions]);

  const handleInputChange = useCallback((value: string) => {
    setChordInput(value);
    setSelectedCompletionIndex(0);

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    if (value.trim()) {
      debounceTimerRef.current = window.setTimeout(() => {
        fetchCompletions(value.trim());
      }, 200);
    } else {
      setCompletions([]);
    }
  }, [setChordInput, fetchCompletions, setCompletions]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (completions.length > 0 && selectedCompletionIndex < completions.length) {
        onPlaceChord(completions[selectedCompletionIndex]);
      } else if (chordInput.trim()) {
        onPlaceChord(chordInput.trim());
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCompletionIndex(Math.min(selectedCompletionIndex + 1, completions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCompletionIndex(Math.max(selectedCompletionIndex - 1, 0));
    }
  }, [chordInput, completions, selectedCompletionIndex, onPlaceChord, onCancel]);

  return (
    <div ref={popupRef} className="chord-input-popup">
      <input
        ref={chordInputRef}
        type="text"
        className="chord-input-field"
        value={chordInput}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type chord (e.g. Am, C7)"
        autoComplete="off"
      />

      {isLoading && (
        <div className="chord-completions-loading">Loading...</div>
      )}

      {!isLoading && completions.length > 0 && (
        <div className="chord-completions">
          {completions.map((completion, index) => (
            <div
              key={index}
              className={`chord-completion-item ${index === selectedCompletionIndex ? 'selected' : ''}`}
              onClick={() => onPlaceChord(completion)}
              onMouseEnter={() => setSelectedCompletionIndex(index)}
            >
              {completion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * PreviewMode: Display chords above lyrics with bar lines
 */
interface PreviewModeProps {
  lines: ChordLyricsLine[];
  sectionMarkers: SectionMarker[];
  barLines: BarLinePosition[];
  placedChords: PlacedChord[];
  lyricsLines: string[];
  onBack: () => void;
  onComplete: () => void;
}

function PreviewMode({ lines, sectionMarkers, barLines, placedChords, lyricsLines, onBack, onComplete }: PreviewModeProps) {
  const hasBars = barLines.length > 0;

  return (
    <div className="preview-mode">
      <div className="preview-header">
        <button className="btn-secondary" onClick={onBack}>
          ← Back to Edit
        </button>
        <h2 className="mode-title">Preview</h2>
        <button className="btn-primary" onClick={onComplete}>
          Done
        </button>
      </div>

      {hasBars && (
        <div className="preview-bar-info">
          {barLines.length} bar line{barLines.length !== 1 ? 's' : ''} defined
        </div>
      )}

      <div className="preview-content">
        {lines.map((line, index) => (
          <PreviewLine
            key={index}
            line={line}
            lineIndex={index}
            barLines={barLines}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * PreviewLine: Display a single line with chords above lyrics and bar lines
 */
interface PreviewLineProps {
  line: ChordLyricsLine;
  lineIndex: number;
  barLines: BarLinePosition[];
}

function PreviewLine({ line, lineIndex, barLines }: PreviewLineProps) {
  const { chords, lyrics } = line;
  const isRTL = /[\u0590-\u05FF]/.test(lyrics);

  const lineBarLines = barLines
    .filter(bl => bl.lineIndex === lineIndex)
    .map(bl => bl.afterChordColumn);

  const positions: { char: string; chord?: string; hasBarLine: boolean }[] = Array.from(lyrics).map((char, index) => {
    const chordAtPos = chords.find(([col]) => col === index);
    return {
      char,
      chord: chordAtPos ? chordAtPos[1] : undefined,
      hasBarLine: lineBarLines.includes(index),
    };
  });

  return (
    <div className="preview-line" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="preview-chords">
        {positions.map((pos, index) => (
          <span key={index} className="preview-chord-cell">
            {pos.hasBarLine && (
              <span className="preview-bar-line">|</span>
            )}
            {pos.chord && <span className="preview-chord-badge">{pos.chord}</span>}
            {!pos.chord && !pos.hasBarLine && <span className="preview-chord-spacer">&nbsp;</span>}
          </span>
        ))}
      </div>
      <div className="preview-lyrics">
        {lyrics || '\u00A0'}
      </div>
    </div>
  );
}

/**
 * Helper: Build sections from markers, lines, and bars
 */
function buildSectionsFromMarkersAndLines(
  lyricsLines: string[],
  placedChords: PlacedChord[],
  sectionMarkers: SectionMarker[],
  bars?: Bar[]
): { name: string; lines: ChordLyricsLine[]; bars?: Bar[] }[] {
  const buildLines = (startLine: number, endLine: number): ChordLyricsLine[] => {
    const lines: ChordLyricsLine[] = [];
    for (let lineIndex = startLine; lineIndex < endLine; lineIndex++) {
      const lineText = lyricsLines[lineIndex];
      const lineChords = placedChords
        .filter(chord => chord.lineIndex === lineIndex)
        .sort((a, b) => a.columnPosition - b.columnPosition)
        .map(chord => [chord.columnPosition, chord.symbol] as [number, string]);
      lines.push({ chords: lineChords, lyrics: lineText });
    }
    return lines;
  };

  if (sectionMarkers.length === 0) {
    return [{
      name: 'Song',
      lines: buildLines(0, lyricsLines.length),
      bars,
    }];
  }

  const sortedMarkers = [...sectionMarkers].sort((a, b) => a.lineIndex - b.lineIndex);
  const sections: { name: string; lines: ChordLyricsLine[]; bars?: Bar[] }[] = [];

  for (let i = 0; i < sortedMarkers.length; i++) {
    const marker = sortedMarkers[i];
    const nextMarker = sortedMarkers[i + 1];
    const startLine = marker.lineIndex;
    const endLine = nextMarker ? nextMarker.lineIndex : lyricsLines.length;

    sections.push({
      name: marker.name,
      lines: buildLines(startLine, endLine),
      // TODO: Split bars by section when section markers exist
      bars: i === 0 ? bars : undefined,
    });
  }

  return sections;
}
