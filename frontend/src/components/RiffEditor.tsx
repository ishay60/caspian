/**
 * RiffEditor Component
 *
 * Interactive editor for adding musical riffs and instrumental sections within bars.
 * Allows users to:
 * - Select beat range within a bar
 * - Enter notes using pitch selection or quick type mode
 * - Toggle between standard notation and guitar tab
 * - Auto-space notes across beat range
 * - Add descriptive labels to riffs
 *
 * WORKFLOW:
 * 1. User clicks "Add Riff" button in bar display
 * 2. User selects start and end beat positions
 * 3. User enters notes via grid or quick-type mode
 * 4. Notes are auto-spaced across the selected range
 * 5. User can switch to tab view and enter string/fret positions
 * 6. User adds optional label (e.g., "Intro Riff")
 * 7. Riff is saved to bar content
 *
 * FEATURES:
 * - Visual beat range selection
 * - Note entry on beat grid with pitch selector
 * - Quick-type mode for fast note entry (e.g., "C4 D4 E4 F4 G4")
 * - Auto-spacing algorithm for even distribution
 * - Tab notation view with string/fret input
 * - Riff label input
 * - Real-time preview of notation
 * - Edit/delete existing riffs
 * - Mobile-friendly touch interactions
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import type { BarNote, TabNote, BeatPosition, BarContent } from '../types';
import './RiffEditor.css';

/**
 * NotationView type: toggle between standard notation and tab
 */
type NotationView = 'notation' | 'tab';

/**
 * Note pitch names
 */
const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [2, 3, 4, 5, 6];

/**
 * Guitar strings (standard tuning)
 * 1 = high E, 6 = low E
 */
const GUITAR_STRINGS = [
  { number: 1, name: 'E (high)', pitch: 'E4' },
  { number: 2, name: 'B', pitch: 'B3' },
  { number: 3, name: 'G', pitch: 'G3' },
  { number: 4, name: 'D', pitch: 'D3' },
  { number: 5, name: 'A', pitch: 'A2' },
  { number: 6, name: 'E (low)', pitch: 'E2' },
];

/**
 * BeatRange: Selected beat range for riff
 */
interface BeatRange {
  startBeat: number;
  startSubdivision: number;
  endBeat: number;
  endSubdivision: number;
}

/**
 * RiffNote: Internal representation of a note during editing
 */
interface RiffNote {
  id: string; // Unique ID for React keys
  pitch?: string; // e.g., "C4", "D#5"
  octave?: number;
  string?: number; // 1-6 for guitar tab
  fret?: number; // 0-24
  beat_position: BeatPosition;
  duration_beats: number;
}

/**
 * RiffEditorProps
 */
interface RiffEditorProps {
  // Bar context
  barIndex: number;
  timeSignature: [number, number];
  existingContent?: BarContent; // Existing bar content to edit

  // Callbacks
  onSave?: (content: BarContent) => void; // Called when user saves riff
  onCancel?: () => void; // Called when user cancels
  onDelete?: () => void; // Called when user deletes existing riff
}

/**
 * RiffEditor Component
 */
export function RiffEditor({
  barIndex,
  timeSignature,
  existingContent,
  onSave,
  onCancel,
  onDelete,
}: RiffEditorProps) {
  // State
  const [view, setView] = useState<NotationView>('notation');
  const [beatRange, setBeatRange] = useState<BeatRange | null>(null);
  const [notes, setNotes] = useState<RiffNote[]>([]);
  const [riffLabel, setRiffLabel] = useState<string>('');
  const [quickTypeInput, setQuickTypeInput] = useState<string>('');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editingMode, setEditingMode] = useState<'grid' | 'quicktype'>('grid');

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);

  // Derived state
  const [beatsPerBar] = timeSignature;
  const hasNotes = notes.length > 0;
  const isRangeSelected = beatRange !== null;

  /**
   * Initialize from existing content (for editing)
   */
  useMemo(() => {
    if (existingContent) {
      // Load existing notes
      if (existingContent.notes && existingContent.notes.length > 0) {
        const loadedNotes: RiffNote[] = existingContent.notes.map((note, idx) => ({
          id: `note-${idx}`,
          pitch: note.pitch,
          octave: note.octave,
          beat_position: note.beat_position,
          duration_beats: note.duration_beats,
        }));
        setNotes(loadedNotes);
      }

      // Load existing tab notes
      if (existingContent.tab && existingContent.tab.length > 0) {
        const loadedNotes: RiffNote[] = existingContent.tab.map((note, idx) => ({
          id: `note-${idx}`,
          string: note.string,
          fret: note.fret,
          beat_position: note.beat_position,
          duration_beats: note.duration_beats,
        }));
        setNotes(loadedNotes);
        setView('tab'); // Switch to tab view if tab notes exist
      }

      // Load label
      if (existingContent.label) {
        setRiffLabel(existingContent.label);
      }

      // Calculate beat range from notes
      if (notes.length > 0) {
        const sortedNotes = [...notes].sort((a, b) => {
          if (a.beat_position.beat !== b.beat_position.beat) {
            return a.beat_position.beat - b.beat_position.beat;
          }
          return a.beat_position.subdivision - b.beat_position.subdivision;
        });

        const firstNote = sortedNotes[0];
        const lastNote = sortedNotes[sortedNotes.length - 1];

        setBeatRange({
          startBeat: firstNote.beat_position.beat,
          startSubdivision: firstNote.beat_position.subdivision,
          endBeat: lastNote.beat_position.beat,
          endSubdivision: lastNote.beat_position.subdivision,
        });
      }
    }
  }, [existingContent]);

  /**
   * Handle beat range selection
   */
  const handleBeatClick = useCallback((beat: number, subdivision: number) => {
    // Reset if beat is 0 (reset button clicked)
    if (beat === 0) {
      setBeatRange(null);
      return;
    }

    if (!beatRange) {
      // Start new range
      setBeatRange({
        startBeat: beat,
        startSubdivision: subdivision,
        endBeat: beat,
        endSubdivision: subdivision,
      });
    } else if (!beatRange.endBeat ||
               (beatRange.endBeat === beatRange.startBeat &&
                beatRange.endSubdivision === beatRange.startSubdivision)) {
      // Complete range
      setBeatRange({
        ...beatRange,
        endBeat: beat,
        endSubdivision: subdivision,
      });
    } else {
      // Reset and start new range
      setBeatRange({
        startBeat: beat,
        startSubdivision: subdivision,
        endBeat: beat,
        endSubdivision: subdivision,
      });
    }
  }, [beatRange]);

  /**
   * Add note at beat position
   */
  const addNote = useCallback((beat: number, subdivision: number, pitch?: string, octave?: number) => {
    const newNote: RiffNote = {
      id: `note-${Date.now()}-${Math.random()}`,
      pitch,
      octave,
      beat_position: { beat, subdivision },
      duration_beats: 0.5, // Default duration
    };

    setNotes([...notes, newNote]);
  }, [notes]);

  /**
   * Add tab note at beat position
   */
  const addTabNote = useCallback((beat: number, subdivision: number, string?: number, fret?: number) => {
    const newNote: RiffNote = {
      id: `note-${Date.now()}-${Math.random()}`,
      string,
      fret,
      beat_position: { beat, subdivision },
      duration_beats: 0.5, // Default duration
    };

    setNotes([...notes, newNote]);
  }, [notes]);

  /**
   * Remove note by ID
   */
  const removeNote = useCallback((noteId: string) => {
    setNotes(notes.filter(n => n.id !== noteId));
  }, [notes]);

  /**
   * Update note
   */
  const updateNote = useCallback((noteId: string, updates: Partial<RiffNote>) => {
    setNotes(notes.map(n => n.id === noteId ? { ...n, ...updates } : n));
  }, [notes]);

  /**
   * Auto-space notes evenly across beat range
   */
  const autoSpaceNotes = useCallback(() => {
    if (!beatRange || notes.length === 0) return;

    // Calculate total beats in range
    const totalBeats = calculateBeatSpan(beatRange);
    const noteCount = notes.length;

    // Distribute notes evenly
    const spacedNotes = notes.map((note, index) => {
      const fraction = index / (noteCount - 1 || 1);
      const beatOffset = fraction * totalBeats;
      const absoluteBeat = beatRange.startBeat + beatOffset;
      const beat = Math.floor(absoluteBeat);
      const subdivision = Math.floor((absoluteBeat - beat) * 4);

      return {
        ...note,
        beat_position: {
          beat: Math.max(1, Math.min(beat, beatsPerBar)),
          subdivision: Math.max(0, Math.min(subdivision, 3)),
        },
      };
    });

    setNotes(spacedNotes);
  }, [beatRange, notes, beatsPerBar]);

  /**
   * Parse quick-type input
   * Format: "C4 D4 E4 F4 G4" or "C D E F G" (default to octave 4)
   */
  const parseQuickTypeInput = useCallback((input: string) => {
    const parts = input.trim().split(/\s+/);
    const parsedNotes: RiffNote[] = [];

    for (const part of parts) {
      const match = part.match(/^([A-G]#?)(\d?)$/);
      if (match) {
        const pitch = match[1];
        const octave = match[2] ? parseInt(match[2]) : 4;

        parsedNotes.push({
          id: `note-${Date.now()}-${Math.random()}`,
          pitch,
          octave,
          beat_position: { beat: 1, subdivision: 0 }, // Will be auto-spaced
          duration_beats: 0.5,
        });
      }
    }

    return parsedNotes;
  }, []);

  /**
   * Handle quick-type submit
   */
  const handleQuickTypeSubmit = useCallback(() => {
    const parsedNotes = parseQuickTypeInput(quickTypeInput);
    if (parsedNotes.length > 0) {
      setNotes([...notes, ...parsedNotes]);
      setQuickTypeInput('');

      // Auto-space after adding
      setTimeout(autoSpaceNotes, 0);
    }
  }, [quickTypeInput, notes, parseQuickTypeInput, autoSpaceNotes]);

  /**
   * Export riff to BarContent
   */
  const exportRiff = useCallback((): BarContent => {
    const content: BarContent = {
      chords: existingContent?.chords || [],
      notes: [],
      tab: [],
      label: riffLabel || undefined,
    };

    // Convert notes based on current view
    if (view === 'notation') {
      content.notes = notes.map(note => ({
        pitch: note.pitch || 'C',
        octave: note.octave || 4,
        beat_position: note.beat_position,
        duration_beats: note.duration_beats,
      }));
    } else {
      content.tab = notes.map(note => ({
        string: note.string || 1,
        fret: note.fret || 0,
        beat_position: note.beat_position,
        duration_beats: note.duration_beats,
      }));
    }

    return content;
  }, [notes, riffLabel, view, existingContent]);

  /**
   * Handle save
   */
  const handleSave = useCallback(() => {
    const content = exportRiff();
    onSave?.(content);
  }, [exportRiff, onSave]);

  /**
   * Clear all notes
   */
  const handleClear = useCallback(() => {
    setNotes([]);
    setBeatRange(null);
    setRiffLabel('');
    setQuickTypeInput('');
  }, []);

  // Render
  return (
    <div className="riff-editor" ref={containerRef}>
      {/* Header with title and controls */}
      <RiffEditorHeader
        barIndex={barIndex}
        onCancel={onCancel}
        onSave={handleSave}
        onDelete={onDelete}
        onClear={handleClear}
        hasContent={hasNotes}
      />

      {/* Riff label input */}
      <div className="riff-label-section">
        <label htmlFor="riff-label" className="riff-label-text">
          Riff Label:
        </label>
        <input
          id="riff-label"
          type="text"
          className="riff-label-input"
          placeholder="e.g., Intro Riff, Solo, Bridge"
          value={riffLabel}
          onChange={(e) => setRiffLabel(e.target.value)}
        />
      </div>

      {/* View switcher */}
      <ViewSwitcher
        currentView={view}
        onViewChange={setView}
      />

      {/* Beat range selector */}
      {!isRangeSelected && (
        <BeatRangeSelector
          beatsPerBar={beatsPerBar}
          onBeatClick={handleBeatClick}
          selectedRange={beatRange}
        />
      )}

      {/* Editing mode switcher */}
      {isRangeSelected && (
        <EditingModeSelector
          mode={editingMode}
          onModeChange={setEditingMode}
        />
      )}

      {/* Main editing area */}
      {isRangeSelected && (
        <div className="riff-editor-main">
          {editingMode === 'grid' ? (
            view === 'notation' ? (
              <NotationGridEditor
                beatRange={beatRange}
                notes={notes}
                selectedNoteId={selectedNoteId}
                onNoteAdd={addNote}
                onNoteSelect={setSelectedNoteId}
                onNoteUpdate={updateNote}
                onNoteRemove={removeNote}
              />
            ) : (
              <TabGridEditor
                beatRange={beatRange}
                notes={notes}
                selectedNoteId={selectedNoteId}
                onNoteAdd={addTabNote}
                onNoteSelect={setSelectedNoteId}
                onNoteUpdate={updateNote}
                onNoteRemove={removeNote}
              />
            )
          ) : (
            <QuickTypeEditor
              input={quickTypeInput}
              onInputChange={setQuickTypeInput}
              onSubmit={handleQuickTypeSubmit}
            />
          )}
        </div>
      )}

      {/* Auto-space button */}
      {hasNotes && (
        <div className="riff-actions">
          <button className="btn-secondary" onClick={autoSpaceNotes}>
            Auto-Space Notes
          </button>
        </div>
      )}

      {/* Notes preview */}
      {hasNotes && (
        <NotesPreview
          notes={notes}
          view={view}
          onNoteRemove={removeNote}
        />
      )}
    </div>
  );
}

/**
 * RiffEditorHeader: Header with controls
 */
interface RiffEditorHeaderProps {
  barIndex: number;
  onCancel?: () => void;
  onSave: () => void;
  onDelete?: () => void;
  onClear: () => void;
  hasContent: boolean;
}

function RiffEditorHeader({
  barIndex,
  onCancel,
  onSave,
  onDelete,
  onClear,
  hasContent,
}: RiffEditorHeaderProps) {
  return (
    <div className="riff-editor-header">
      <div className="header-left">
        {onCancel && (
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <h2 className="header-title">Edit Riff - Bar {barIndex + 1}</h2>
      </div>

      <div className="header-controls">
        {onDelete && (
          <button className="btn-danger" onClick={onDelete}>
            Delete Riff
          </button>
        )}
        {hasContent && (
          <button className="btn-secondary" onClick={onClear}>
            Clear All
          </button>
        )}
        <button className="btn-primary" onClick={onSave}>
          Save Riff
        </button>
      </div>
    </div>
  );
}

/**
 * ViewSwitcher: Toggle between notation and tab
 */
interface ViewSwitcherProps {
  currentView: NotationView;
  onViewChange: (view: NotationView) => void;
}

function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  return (
    <div className="view-switcher">
      <button
        className={`view-button ${currentView === 'notation' ? 'active' : ''}`}
        onClick={() => onViewChange('notation')}
      >
        Standard Notation
      </button>
      <button
        className={`view-button ${currentView === 'tab' ? 'active' : ''}`}
        onClick={() => onViewChange('tab')}
      >
        Guitar Tab
      </button>
    </div>
  );
}

/**
 * EditingModeSelector: Toggle between grid and quick-type
 */
interface EditingModeSelectorProps {
  mode: 'grid' | 'quicktype';
  onModeChange: (mode: 'grid' | 'quicktype') => void;
}

function EditingModeSelector({ mode, onModeChange }: EditingModeSelectorProps) {
  return (
    <div className="editing-mode-selector">
      <button
        className={`mode-button ${mode === 'grid' ? 'active' : ''}`}
        onClick={() => onModeChange('grid')}
      >
        Grid Entry
      </button>
      <button
        className={`mode-button ${mode === 'quicktype' ? 'active' : ''}`}
        onClick={() => onModeChange('quicktype')}
      >
        Quick Type
      </button>
    </div>
  );
}

/**
 * BeatRangeSelector: Interactive beat range selection with subdivision support
 */
interface BeatRangeSelectorProps {
  beatsPerBar: number;
  onBeatClick: (beat: number, subdivision: number) => void;
  selectedRange: BeatRange | null;
}

function BeatRangeSelector({
  beatsPerBar,
  onBeatClick,
  selectedRange,
}: BeatRangeSelectorProps) {
  const [showSubdivisions, setShowSubdivisions] = useState(false);

  // Check if a beat is in the selected range
  const isBeatInRange = (beat: number): boolean => {
    if (!selectedRange) return false;
    if (!selectedRange.endBeat) return selectedRange.startBeat === beat;

    const start = selectedRange.startBeat;
    const end = selectedRange.endBeat;

    if (start <= end) {
      return beat >= start && beat <= end;
    } else {
      return beat >= end && beat <= start;
    }
  };

  // Check if a beat is a range endpoint
  const isRangeEndpoint = (beat: number): boolean => {
    if (!selectedRange) return false;
    return selectedRange.startBeat === beat || selectedRange.endBeat === beat;
  };

  return (
    <div className="beat-range-selector">
      <div className="selector-header">
        <h3 className="selector-title">Select Beat Range for Riff</h3>
        <label className="subdivision-toggle">
          <input
            type="checkbox"
            checked={showSubdivisions}
            onChange={(e) => setShowSubdivisions(e.target.checked)}
          />
          <span>Show subdivisions</span>
        </label>
      </div>

      {!showSubdivisions ? (
        // Simple beat grid (no subdivisions)
        <div className="beat-grid-selector">
          {Array.from({ length: beatsPerBar }, (_, beatIdx) => {
            const beat = beatIdx + 1;
            return (
              <BeatButton
                key={beatIdx}
                beat={beat}
                subdivision={0}
                onClick={onBeatClick}
                isSelected={isRangeEndpoint(beat)}
                isInRange={isBeatInRange(beat)}
              />
            );
          })}
        </div>
      ) : (
        // Beat grid with subdivisions (quarter notes)
        <div className="beat-grid-subdivisions">
          {Array.from({ length: beatsPerBar }, (_, beatIdx) => {
            const beat = beatIdx + 1;
            return (
              <div key={beatIdx} className="beat-with-subdivisions">
                <div className="subdivision-group">
                  {[0, 1, 2, 3].map(subdivision => (
                    <SubdivisionButton
                      key={subdivision}
                      beat={beat}
                      subdivision={subdivision}
                      onClick={onBeatClick}
                      isSelected={
                        selectedRange !== null &&
                        ((selectedRange.startBeat === beat && selectedRange.startSubdivision === subdivision) ||
                         (selectedRange.endBeat === beat && selectedRange.endSubdivision === subdivision))
                      }
                    />
                  ))}
                </div>
                <div className="beat-label">Beat {beat}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="selector-info">
        <p className="selector-instructions">
          {!selectedRange
            ? "Click a beat to start selection, then click another beat to complete the range."
            : selectedRange.endBeat
            ? `Range selected: Beat ${selectedRange.startBeat}${selectedRange.startSubdivision > 0 ? `.${selectedRange.startSubdivision}` : ''} to ${selectedRange.endBeat}${selectedRange.endSubdivision > 0 ? `.${selectedRange.endSubdivision}` : ''}`
            : `Start: Beat ${selectedRange.startBeat}${selectedRange.startSubdivision > 0 ? `.${selectedRange.startSubdivision}` : ''}. Click another beat to complete.`
          }
        </p>
        {selectedRange && (
          <button
            className="btn-reset-range"
            onClick={() => onBeatClick(0, 0)} // This will trigger reset in parent
          >
            Reset Range
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * BeatButton: Individual beat button for range selection
 */
interface BeatButtonProps {
  beat: number;
  subdivision: number;
  onClick: (beat: number, subdivision: number) => void;
  isSelected: boolean;
  isInRange: boolean;
}

function BeatButton({ beat, subdivision, onClick, isSelected, isInRange }: BeatButtonProps) {
  return (
    <button
      className={`beat-button ${isSelected ? 'selected' : ''} ${isInRange ? 'in-range' : ''}`}
      onClick={() => onClick(beat, subdivision)}
      aria-label={`Beat ${beat}`}
    >
      <span className="beat-number">{beat}</span>
    </button>
  );
}

/**
 * SubdivisionButton: Individual subdivision button for precise beat selection
 */
interface SubdivisionButtonProps {
  beat: number;
  subdivision: number;
  onClick: (beat: number, subdivision: number) => void;
  isSelected: boolean;
}

const SUBDIVISION_LABELS = ['', '&', 'e', 'a'];

function SubdivisionButton({ beat, subdivision, onClick, isSelected }: SubdivisionButtonProps) {
  return (
    <button
      className={`subdivision-button ${isSelected ? 'selected' : ''} ${subdivision === 0 ? 'on-beat' : ''}`}
      onClick={() => onClick(beat, subdivision)}
      aria-label={`Beat ${beat}, subdivision ${SUBDIVISION_LABELS[subdivision] || subdivision}`}
      title={`${subdivision === 0 ? 'On beat' : SUBDIVISION_LABELS[subdivision]}`}
    >
      {subdivision === 0 ? beat : SUBDIVISION_LABELS[subdivision]}
    </button>
  );
}

/**
 * NotationGridEditor: Grid-based note entry for standard notation
 */
interface NotationGridEditorProps {
  beatRange: BeatRange;
  notes: RiffNote[];
  selectedNoteId: string | null;
  onNoteAdd: (beat: number, subdivision: number, pitch: string, octave: number) => void;
  onNoteSelect: (noteId: string | null) => void;
  onNoteUpdate: (noteId: string, updates: Partial<RiffNote>) => void;
  onNoteRemove: (noteId: string) => void;
}

function NotationGridEditor({
  beatRange,
  notes,
  selectedNoteId,
  onNoteAdd,
  onNoteSelect,
  onNoteUpdate,
  onNoteRemove,
}: NotationGridEditorProps) {
  const [selectedPitch, setSelectedPitch] = useState<string>('C');
  const [selectedOctave, setSelectedOctave] = useState<number>(4);
  const [showSubdivisions, setShowSubdivisions] = useState(false);

  // Calculate beats to display in grid
  const beatsToDisplay = useMemo(() => {
    const beats: number[] = [];
    const start = beatRange.startBeat;
    const end = beatRange.endBeat;

    if (start <= end) {
      for (let i = start; i <= end; i++) {
        beats.push(i);
      }
    } else {
      for (let i = start; i >= end; i--) {
        beats.push(i);
      }
    }

    return beats;
  }, [beatRange]);

  // Handle grid cell click
  const handleGridClick = useCallback((beat: number, subdivision: number) => {
    onNoteAdd(beat, subdivision, selectedPitch, selectedOctave);
  }, [onNoteAdd, selectedPitch, selectedOctave]);

  // Get notes at specific position
  const getNotesAtPosition = useCallback((beat: number, subdivision: number): RiffNote[] => {
    return notes.filter(
      note => note.beat_position.beat === beat && note.beat_position.subdivision === subdivision
    );
  }, [notes]);

  return (
    <div className="notation-grid-editor">
      <div className="editor-controls">
        <div className="pitch-selector">
          <label>Pitch:</label>
          <select value={selectedPitch} onChange={(e) => setSelectedPitch(e.target.value)}>
            {PITCH_NAMES.map(pitch => (
              <option key={pitch} value={pitch}>{pitch}</option>
            ))}
          </select>
          <label>Octave:</label>
          <select value={selectedOctave} onChange={(e) => setSelectedOctave(Number(e.target.value))}>
            {OCTAVES.map(octave => (
              <option key={octave} value={octave}>{octave}</option>
            ))}
          </select>
        </div>

        <label className="subdivision-toggle-small">
          <input
            type="checkbox"
            checked={showSubdivisions}
            onChange={(e) => setShowSubdivisions(e.target.checked)}
          />
          <span>Show subdivisions</span>
        </label>
      </div>

      <div className="current-selection">
        <span className="selection-label">Current selection:</span>
        <span className="selection-value">{selectedPitch}{selectedOctave}</span>
        <span className="selection-hint">Click a beat to add this note</span>
      </div>

      <div className="notation-beat-grid">
        {!showSubdivisions ? (
          // Simple beat grid
          <div className="simple-grid">
            {beatsToDisplay.map(beat => {
              const notesHere = getNotesAtPosition(beat, 0);
              return (
                <div key={beat} className="grid-column">
                  <div className="beat-label">Beat {beat}</div>
                  <button
                    className={`grid-cell ${notesHere.length > 0 ? 'has-notes' : ''}`}
                    onClick={() => handleGridClick(beat, 0)}
                    title={`Add ${selectedPitch}${selectedOctave} on beat ${beat}`}
                  >
                    {notesHere.length > 0 ? (
                      <div className="notes-at-position">
                        {notesHere.map(note => (
                          <div
                            key={note.id}
                            className={`note-display ${selectedNoteId === note.id ? 'selected' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onNoteSelect(note.id);
                            }}
                          >
                            <span className="note-name">{note.pitch}{note.octave}</span>
                            <button
                              className="note-remove-inline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNoteRemove(note.id);
                              }}
                              title="Remove note"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="add-note-icon">+</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          // Grid with subdivisions
          <div className="subdivided-grid">
            {beatsToDisplay.map(beat => (
              <div key={beat} className="grid-column">
                <div className="beat-label">Beat {beat}</div>
                <div className="subdivision-cells">
                  {[0, 1, 2, 3].map(subdivision => {
                    const notesHere = getNotesAtPosition(beat, subdivision);
                    const subdivLabel = ['on', '&', 'e', 'a'][subdivision];

                    return (
                      <div key={subdivision} className="subdivision-row">
                        <span className="subdivision-label">{subdivLabel}</span>
                        <button
                          className={`grid-cell ${notesHere.length > 0 ? 'has-notes' : ''} ${subdivision === 0 ? 'on-beat' : ''}`}
                          onClick={() => handleGridClick(beat, subdivision)}
                          title={`Add ${selectedPitch}${selectedOctave} on beat ${beat}.${subdivision}`}
                        >
                          {notesHere.length > 0 ? (
                            <div className="notes-at-position-compact">
                              {notesHere.map(note => (
                                <div
                                  key={note.id}
                                  className={`note-display-compact ${selectedNoteId === note.id ? 'selected' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNoteSelect(note.id);
                                  }}
                                  title={`${note.pitch}${note.octave}`}
                                >
                                  <span>{note.pitch}{note.octave}</span>
                                  <button
                                    className="note-remove-tiny"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onNoteRemove(note.id);
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="add-note-icon-small">+</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedNoteId && (
        <div className="selected-note-editor">
          <h4>Edit Selected Note</h4>
          {(() => {
            const note = notes.find(n => n.id === selectedNoteId);
            if (!note) return null;

            return (
              <div className="note-editor-controls">
                <div className="control-group">
                  <label>Pitch:</label>
                  <select
                    value={note.pitch || 'C'}
                    onChange={(e) => onNoteUpdate(selectedNoteId, { pitch: e.target.value })}
                  >
                    {PITCH_NAMES.map(pitch => (
                      <option key={pitch} value={pitch}>{pitch}</option>
                    ))}
                  </select>
                </div>
                <div className="control-group">
                  <label>Octave:</label>
                  <select
                    value={note.octave || 4}
                    onChange={(e) => onNoteUpdate(selectedNoteId, { octave: Number(e.target.value) })}
                  >
                    {OCTAVES.map(octave => (
                      <option key={octave} value={octave}>{octave}</option>
                    ))}
                  </select>
                </div>
                <div className="control-group">
                  <label>Duration (beats):</label>
                  <input
                    type="number"
                    min={0.25}
                    max={4}
                    step={0.25}
                    value={note.duration_beats}
                    onChange={(e) => onNoteUpdate(selectedNoteId, { duration_beats: Number(e.target.value) })}
                  />
                </div>
                <button
                  className="btn-deselect"
                  onClick={() => onNoteSelect(null)}
                >
                  Done Editing
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/**
 * TabGridEditor: Grid-based note entry for guitar tab
 */
interface TabGridEditorProps {
  beatRange: BeatRange;
  notes: RiffNote[];
  selectedNoteId: string | null;
  onNoteAdd: (beat: number, subdivision: number, string: number, fret: number) => void;
  onNoteSelect: (noteId: string | null) => void;
  onNoteUpdate: (noteId: string, updates: Partial<RiffNote>) => void;
  onNoteRemove: (noteId: string) => void;
}

function TabGridEditor({
  beatRange,
  notes,
  selectedNoteId,
  onNoteAdd,
  onNoteSelect,
  onNoteUpdate,
  onNoteRemove,
}: TabGridEditorProps) {
  const [selectedString, setSelectedString] = useState<number>(1);
  const [selectedFret, setSelectedFret] = useState<number>(0);

  return (
    <div className="tab-grid-editor">
      <div className="tab-selector">
        <label>String:</label>
        <select value={selectedString} onChange={(e) => setSelectedString(Number(e.target.value))}>
          {GUITAR_STRINGS.map(str => (
            <option key={str.number} value={str.number}>
              {str.number} - {str.name}
            </option>
          ))}
        </select>
        <label>Fret:</label>
        <input
          type="number"
          min={0}
          max={24}
          value={selectedFret}
          onChange={(e) => setSelectedFret(Number(e.target.value))}
        />
      </div>

      <div className="tab-grid">
        {/* Grid will be implemented in Task 4.4.8 */}
        <p className="text-sm text-gray-500">Tab entry coming in Task 4.4.8</p>
      </div>
    </div>
  );
}

/**
 * QuickTypeEditor: Quick text-based note entry
 */
interface QuickTypeEditorProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
}

function QuickTypeEditor({ input, onInputChange, onSubmit }: QuickTypeEditorProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSubmit();
    }
  };

  return (
    <div className="quick-type-editor">
      <h3 className="editor-title">Quick Type Mode</h3>
      <p className="editor-instructions">
        Type note names separated by spaces. Examples: "C D E F G" or "C4 D#4 E4 F#4 G4"
      </p>
      <div className="quick-type-input-group">
        <input
          type="text"
          className="quick-type-input"
          placeholder="e.g., C D E F G"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <button className="btn-primary" onClick={onSubmit}>
          Add Notes
        </button>
      </div>
    </div>
  );
}

/**
 * NotesPreview: Preview list of entered notes
 */
interface NotesPreviewProps {
  notes: RiffNote[];
  view: NotationView;
  onNoteRemove: (noteId: string) => void;
}

function NotesPreview({ notes, view, onNoteRemove }: NotesPreviewProps) {
  return (
    <div className="notes-preview">
      <h3 className="preview-title">Notes ({notes.length})</h3>
      <div className="notes-list">
        {notes.map(note => (
          <div key={note.id} className="note-item">
            <span className="note-info">
              {view === 'notation'
                ? `${note.pitch || 'C'}${note.octave || 4}`
                : `String ${note.string || 1}, Fret ${note.fret || 0}`
              }
              {' @ '}
              Beat {note.beat_position.beat}
              {note.beat_position.subdivision > 0 && `.${note.beat_position.subdivision}`}
            </span>
            <button
              className="btn-remove"
              onClick={() => onNoteRemove(note.id)}
              aria-label="Remove note"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Helper: Calculate beat span from beat range
 */
function calculateBeatSpan(range: BeatRange): number {
  const startTotal = range.startBeat + range.startSubdivision / 4;
  const endTotal = range.endBeat + range.endSubdivision / 4;
  return endTotal - startTotal;
}
