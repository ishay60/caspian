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
  // TODO: Implement edit mode UI
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

      {/* TODO: Render lyrics lines with chord placement UI */}
      <div className="lyrics-display">
        {lyricsLines.map((line, index) => (
          <div key={index} className="lyrics-line-container">
            <div className="line-number">{index + 1}</div>
            <div className="lyrics-line">
              {line || '\u00A0'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
