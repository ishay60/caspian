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
  onComplete?: (sections: { name: string; lines: ChordLyricsLine[] }[]) => void;
}

export function LyricsChordEditor({ initialLyrics = '', onComplete }: LyricsChordEditorProps) {
  // State management
  const [mode, setMode] = useState<'input' | 'edit'>('input');
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
      ) : (
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
          onBack={handleBackToInput}
          onComplete={onComplete}
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
  onBack: () => void;
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
  onBack,
  onComplete,
}: EditModeProps) {
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

  return (
    <div className="edit-mode">
      <div className="edit-header">
        <button className="btn-secondary" onClick={onBack}>
          ← Back to Lyrics
        </button>
        <h2 className="mode-title">Add Chords</h2>
        <button
          className="btn-primary"
          onClick={() => {
            // TODO: Convert to sections and call onComplete
          }}
        >
          Done
        </button>
      </div>

      <div className="edit-instructions">
        Click on any position in the lyrics to place a chord above it.
      </div>

      {/* Render lyrics lines with clickable characters */}
      <div className="lyrics-display">
        {lyricsLines.map((lineText, lineIndex) => (
          <LyricsLineEditable
            key={lineIndex}
            lineIndex={lineIndex}
            lineText={lineText}
            placedChords={placedChords}
            onCharClick={handleCharClick}
            onRemoveChord={handleRemoveChord}
            getChordAt={getChordAt}
          />
        ))}
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
}

function LyricsLineEditable({
  lineIndex,
  lineText,
  placedChords,
  onCharClick,
  onRemoveChord,
  getChordAt,
}: LyricsLineEditableProps) {
  const lineRef = useRef<HTMLDivElement>(null);

  // Detect RTL text (Hebrew)
  const isRTL = /[\u0590-\u05FF]/.test(lineText);
  const displayText = lineText || '\u00A0'; // non-breaking space for empty lines

  return (
    <div className="lyrics-line-container">
      <div className="line-number">{lineIndex + 1}</div>
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
  onPlaceChord,
  onCancel,
}: ChordInputPopupProps) {
  const [selectedCompletionIndex, setSelectedCompletionIndex] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);

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
        onChange={(e) => {
          setChordInput(e.target.value);
          setSelectedCompletionIndex(0);
          // TODO: Fetch completions from API
        }}
        onKeyDown={handleKeyDown}
        placeholder="Type chord (e.g. Am, C7)"
        autoComplete="off"
      />

      {completions.length > 0 && (
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
