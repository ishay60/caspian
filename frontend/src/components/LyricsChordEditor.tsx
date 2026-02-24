/**
 * LyricsChordEditor Component
 *
 * Interactive lyrics-first chord sheet editor.
 * Users paste lyrics, then click positions to place chords.
 *
 * WORKFLOW:
 * 1. User pastes plain lyrics text
 * 2. Lyrics displayed line by line
 * 3. User clicks character positions to place chords
 * 4. Chord autocomplete appears
 * 5. Chords snap to character boundaries
 * 6. Final result rendered using ChordSheetView
 *
 * FEATURES:
 * - Plain lyrics input textarea
 * - Line-by-line display with click handlers
 * - Click-to-place chord functionality
 * - Chord autocomplete integration
 * - Chord position snapping
 * - Visual feedback for chord placement
 * - Chord removal (X button)
 * - Section marker insertion
 * - RTL support for Hebrew lyrics
 * - Mobile-friendly touch interactions
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChordLyricsLine } from '../types';
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

interface LyricsChordEditorProps {
  initialLyrics?: string;
  keyRootName?: string;
  keyMode?: string;
  onComplete?: (sections: { name: string; lines: ChordLyricsLine[] }[]) => void;
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
  }, []);

  // Handler: Go to preview mode
  const handleShowPreview = useCallback(() => {
    setMode('preview');
  }, []);

  // Handler: Back to edit from preview
  const handleBackToEdit = useCallback(() => {
    setMode('edit');
  }, []);

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
          onBack={handleBackToInput}
          onPreview={handleShowPreview}
          onComplete={onComplete}
        />
      ) : (
        <PreviewMode
          lines={buildChordLyricsLines()}
          sectionMarkers={sectionMarkers}
          onBack={handleBackToEdit}
          onComplete={() => {
            // Convert to sections and call onComplete
            const sections = buildSectionsFromMarkersAndLines(
              lyricsLines,
              placedChords,
              sectionMarkers
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
 * EditMode: Line-by-line display with chord placement
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
  onBack: () => void;
  onPreview: () => void;
  onComplete?: (sections: { name: string; lines: ChordLyricsLine[] }[]) => void;
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
  onBack,
  onPreview,
  onComplete,
}: EditModeProps) {
  const [pendingSectionLine, setPendingSectionLine] = useState<number | null>(null);
  const [customSectionName, setCustomSectionName] = useState('');

  // Handler: Click on character position to place chord
  const handleCharClick = useCallback((lineIndex: number, columnPosition: number) => {
    setSelectedPosition({ lineIndex, columnPosition });
    setChordInput('');
    setCompletions([]);
  }, [setSelectedPosition, setChordInput, setCompletions]);

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
    // Prompt for line number or use next available line
    const lineIndex = 0; // TODO: Could prompt user or auto-detect
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

  return (
    <div className="edit-mode">
      <div className="edit-header">
        <button className="btn-secondary" onClick={onBack}>
          ← Back to Lyrics
        </button>
        <h2 className="mode-title">Add Chords</h2>
        <button
          className="btn-primary"
          onClick={onPreview}
          disabled={placedChords.length === 0}
        >
          Preview
        </button>
      </div>

      <div className="edit-instructions">
        Click on any position in the lyrics to place a chord above it.
      </div>

      {/* Toolbar for section markers */}
      <div className="edit-toolbar">
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
                onCharClick={handleCharClick}
                onRemoveChord={handleRemoveChord}
                getChordAt={getChordAt}
                onRequestSection={handleRequestSectionAtLine}
              />
            </div>
          );
        })}
      </div>

      {/* Chord input popup */}
      {selectedPosition && (
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
            // Remove existing chord at this position if any
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
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.3)',
              zIndex: 999,
            }}
            onClick={() => {
              setPendingSectionLine(null);
              setCustomSectionName('');
            }}
          />
          {/* Modal */}
          <div
            className="section-input-popup"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
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
                width: '100%',
                padding: '8px',
                marginBottom: '12px',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                backgroundColor: 'var(--color-surface-2)',
                color: 'var(--color-text)',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setPendingSectionLine(null);
                  setCustomSectionName('');
                }}
                style={{
                  padding: '6px 12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-surface-2)',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSectionMarker}
                disabled={!customSectionName.trim()}
                style={{
                  padding: '6px 12px',
                  border: '1px solid var(--color-accent)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-accent)',
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
 * LyricsLineEditable: Render a line with clickable character positions
 */
interface LyricsLineEditableProps {
  lineIndex: number;
  lineText: string;
  placedChords: PlacedChord[];
  onCharClick: (lineIndex: number, columnPosition: number) => void;
  onRemoveChord: (lineIndex: number, columnPosition: number) => void;
  getChordAt: (lineIndex: number, columnPosition: number) => PlacedChord | undefined;
  onRequestSection: (lineIndex: number) => void;
}

function LyricsLineEditable({
  lineIndex,
  lineText,
  placedChords,
  onCharClick,
  onRemoveChord,
  getChordAt,
  onRequestSection,
}: LyricsLineEditableProps) {
  const lineRef = useRef<HTMLDivElement>(null);

  // Detect RTL text (Hebrew)
  const isRTL = /[\u0590-\u05FF]/.test(lineText);
  const displayText = lineText || '\u00A0'; // non-breaking space for empty lines

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
        className="lyrics-line lyrics-line-editable"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Render each character as a clickable cell */}
        {Array.from(displayText).map((char, charIndex) => {
          const chord = getChordAt(lineIndex, charIndex);
          return (
            <span
              key={charIndex}
              className={`char-cell ${chord ? 'has-chord' : ''}`}
              onClick={() => onCharClick(lineIndex, charIndex)}
            >
              {/* Chord badge above character */}
              {chord && (
                <span className="chord-badge">
                  {chord.symbol}
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

  // Position popup near selected character
  useEffect(() => {
    if (!popupRef.current) return;

    // For now, position at center of screen
    // TODO: Calculate actual position based on selected character
    const popup = popupRef.current;
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
  }, [selectedPosition]);

  // Fetch chord completions from API
  const fetchCompletions = useCallback(async (prefix: string) => {
    if (prefix.length < 1) {
      setCompletions([]);
      return;
    }

    setIsLoading(true);
    try {
      // Find previous and next chords for context
      const currentLine = selectedPosition.lineIndex;
      const currentCol = selectedPosition.columnPosition;

      // Get previous chord (before current position)
      const prevChords = placedChords
        .filter(c => c.lineIndex < currentLine || (c.lineIndex === currentLine && c.columnPosition < currentCol))
        .sort((a, b) => {
          if (a.lineIndex !== b.lineIndex) return a.lineIndex - b.lineIndex;
          return a.columnPosition - b.columnPosition;
        });
      const prevChord = prevChords.length > 0 ? prevChords[prevChords.length - 1].symbol : undefined;

      // Get next chord (after current position)
      const nextChords = placedChords
        .filter(c => c.lineIndex > currentLine || (c.lineIndex === currentLine && c.columnPosition > currentCol))
        .sort((a, b) => {
          if (a.lineIndex !== b.lineIndex) return a.lineIndex - b.lineIndex;
          return a.columnPosition - b.columnPosition;
        });
      const nextChord = nextChords.length > 0 ? nextChords[0].symbol : undefined;

      const results = await getChordCompletions(
        prefix,
        keyRootName,
        keyMode,
        prevChord,
        nextChord,
        20
      );
      setCompletions(results);
    } catch (error) {
      console.error('Failed to fetch chord completions:', error);
      setCompletions([]);
    } finally {
      setIsLoading(false);
    }
  }, [keyRootName, keyMode, placedChords, selectedPosition, setCompletions]);

  // Debounced input handler
  const handleInputChange = useCallback((value: string) => {
    setChordInput(value);
    setSelectedCompletionIndex(0);

    // Clear previous timer
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for debounced API call
    if (value.trim()) {
      debounceTimerRef.current = window.setTimeout(() => {
        fetchCompletions(value.trim());
      }, 200); // 200ms debounce
    } else {
      setCompletions([]);
    }
  }, [setChordInput, fetchCompletions, setCompletions]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Handle keyboard navigation
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
        <div className="chord-completions-loading">
          Loading...
        </div>
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
 * PreviewMode: Display chords above lyrics in a read-only view
 */
interface PreviewModeProps {
  lines: ChordLyricsLine[];
  sectionMarkers: SectionMarker[];
  onBack: () => void;
  onComplete: () => void;
}

function PreviewMode({ lines, sectionMarkers, onBack, onComplete }: PreviewModeProps) {
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

      <div className="preview-content">
        {lines.map((line, index) => (
          <PreviewLine key={index} line={line} />
        ))}
      </div>
    </div>
  );
}

/**
 * PreviewLine: Display a single line with chords above lyrics
 */
interface PreviewLineProps {
  line: ChordLyricsLine;
}

function PreviewLine({ line }: PreviewLineProps) {
  const { chords, lyrics } = line;
  const isRTL = /[\u0590-\u05FF]/.test(lyrics);

  // Build array of character positions with their chords
  const positions: { char: string; chord?: string }[] = Array.from(lyrics).map((char, index) => {
    const chordAtPos = chords.find(([col]) => col === index);
    return {
      char,
      chord: chordAtPos ? chordAtPos[1] : undefined,
    };
  });

  return (
    <div className="preview-line" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="preview-chords">
        {positions.map((pos, index) => (
          <span key={index} className="preview-chord-cell">
            {pos.chord && <span className="preview-chord-badge">{pos.chord}</span>}
            {!pos.chord && <span className="preview-chord-spacer">&nbsp;</span>}
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
 * Helper: Build sections from markers and lines
 */
function buildSectionsFromMarkersAndLines(
  lyricsLines: string[],
  placedChords: PlacedChord[],
  sectionMarkers: SectionMarker[]
): { name: string; lines: ChordLyricsLine[] }[] {
  // If no section markers, create a single "Song" section
  if (sectionMarkers.length === 0) {
    const lines: ChordLyricsLine[] = lyricsLines.map((lineText, lineIndex) => {
      const lineChords = placedChords
        .filter(chord => chord.lineIndex === lineIndex)
        .sort((a, b) => a.columnPosition - b.columnPosition)
        .map(chord => [chord.columnPosition, chord.symbol] as [number, string]);

      return {
        chords: lineChords,
        lyrics: lineText,
      };
    });

    return [{ name: 'Song', lines }];
  }

  // Sort markers by line index
  const sortedMarkers = [...sectionMarkers].sort((a, b) => a.lineIndex - b.lineIndex);

  // Build sections
  const sections: { name: string; lines: ChordLyricsLine[] }[] = [];

  for (let i = 0; i < sortedMarkers.length; i++) {
    const marker = sortedMarkers[i];
    const nextMarker = sortedMarkers[i + 1];

    const startLine = marker.lineIndex;
    const endLine = nextMarker ? nextMarker.lineIndex : lyricsLines.length;

    const sectionLines: ChordLyricsLine[] = [];

    for (let lineIndex = startLine; lineIndex < endLine; lineIndex++) {
      const lineText = lyricsLines[lineIndex];
      const lineChords = placedChords
        .filter(chord => chord.lineIndex === lineIndex)
        .sort((a, b) => a.columnPosition - b.columnPosition)
        .map(chord => [chord.columnPosition, chord.symbol] as [number, string]);

      sectionLines.push({
        chords: lineChords,
        lyrics: lineText,
      });
    }

    sections.push({
      name: marker.name,
      lines: sectionLines,
    });
  }

  return sections;
}
