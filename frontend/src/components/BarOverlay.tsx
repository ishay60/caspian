/**
 * BarOverlay Component
 *
 * Interactive bar structure editor for chord sequences.
 * Allows users to:
 * - Insert bar lines between chords
 * - Auto-suggest bar line positions
 * - Set time signature per section
 * - Assign beat positions within bars
 * - Drag to adjust beat positions
 * - Validate bar consistency
 *
 * WORKFLOW:
 * 1. Display chord sequence from LyricsChordEditor or ChordSheetView
 * 2. User clicks between chords to insert bar lines
 * 3. Auto-suggest algorithm proposes bar line positions
 * 4. User can adjust time signature (4/4, 3/4, 6/8, etc.)
 * 5. Chords are assigned to beat positions within bars
 * 6. User can drag chords to adjust beat positions
 * 7. Validation checks for bar completeness and consistency
 * 8. Export to Bar format for analysis
 *
 * FEATURES:
 * - Visual bar line insertion indicators
 * - Time signature selector dropdown
 * - Beat grid display within bars
 * - Drag-and-drop chord positioning
 * - Validation warnings for incomplete bars
 * - Auto-suggest based on chord count and time signature
 * - Mobile-friendly touch interactions
 */

import { useState, useCallback, useRef } from 'react';
import type { Bar, BarChord, BeatPosition, ChordLyricsLine } from '../types';
import './BarOverlay.css';

/**
 * TimeSignature type: [beats_per_bar, beat_unit]
 * Examples: [4, 4] = 4/4, [3, 4] = 3/4, [6, 8] = 6/8
 */
type TimeSignature = [number, number];

/**
 * BarLine represents a bar line position in the chord sequence
 * position: index in the chords array where bar line occurs
 */
interface BarLine {
  position: number; // 0 means before first chord, 1 means after first chord, etc.
}

/**
 * ChordWithPosition represents a chord with its beat position assignment
 */
interface ChordWithPosition {
  symbol: string;
  beatPosition: BeatPosition;
  columnPosition?: number; // Original column position from lyrics line
}

/**
 * BarGroup represents a complete bar with chords and metadata
 */
interface BarGroup {
  chords: ChordWithPosition[];
  timeSignature: TimeSignature;
  isComplete: boolean; // Whether bar has correct number of beats
  hasConflict: boolean; // Whether chords exceed bar capacity
}

/**
 * BarOverlayProps
 */
interface BarOverlayProps {
  // Input: Chord sequence from editor
  chordSequence: string[]; // Array of chord symbols in order
  initialBarLines?: BarLine[]; // Optional initial bar line positions
  initialTimeSignature?: TimeSignature; // Default time signature

  // Callbacks
  onBarsComplete?: (bars: Bar[]) => void; // Called when user completes bar editing
  onCancel?: () => void; // Called when user cancels
}

/**
 * Common time signatures
 */
const TIME_SIGNATURES: TimeSignature[] = [
  [4, 4], // Common time
  [3, 4], // Waltz
  [2, 4], // March
  [6, 8], // Compound duple
  [12, 8], // Compound quadruple
  [5, 4], // Quintuple
  [7, 8], // Septuple
];

/**
 * BarOverlay Component
 */
export function BarOverlay({
  chordSequence,
  initialBarLines = [],
  initialTimeSignature = [4, 4],
  onBarsComplete,
  onCancel,
}: BarOverlayProps) {
  // State
  const [timeSignature, setTimeSignature] = useState<TimeSignature>(initialTimeSignature);
  const [barLines, setBarLines] = useState<BarLine[]>(initialBarLines);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [selectedChordIndex, setSelectedChordIndex] = useState<number | null>(null);
  const [draggedChordIndex, setDraggedChordIndex] = useState<number | null>(null);
  const [customBeatPositions, setCustomBeatPositions] = useState<Map<string, BeatPosition>>(new Map());
  const [editingBeatPosition, setEditingBeatPosition] = useState<{
    barIndex: number;
    chordIndex: number;
  } | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Build bar groups from chord sequence and bar lines
   */
  const buildBarGroups = useCallback((): BarGroup[] => {
    const groups: BarGroup[] = [];
    const sortedBarLines = [...barLines].sort((a, b) => a.position - b.position);

    let currentStartIndex = 0;
    let barGroupIndex = 0;

    // Add bar lines at end if not present
    const allBarLines = [...sortedBarLines];
    const lastBarLine = sortedBarLines[sortedBarLines.length - 1];
    if (!lastBarLine || lastBarLine.position < chordSequence.length) {
      allBarLines.push({ position: chordSequence.length });
    }

    for (const barLine of allBarLines) {
      const endIndex = barLine.position;
      const barChords = chordSequence.slice(currentStartIndex, endIndex);

      if (barChords.length > 0) {
        // Assign chords to beat positions
        const chordsWithPositions: ChordWithPosition[] = barChords.map((symbol, idx) => {
          const globalChordIndex = currentStartIndex + idx;
          const customKey = `${barGroupIndex}-${idx}`;

          // Check if user has set a custom beat position
          const customBeat = customBeatPositions.get(customKey);

          let beatPosition: BeatPosition;
          if (customBeat) {
            beatPosition = customBeat;
          } else {
            // Auto-assign evenly distributed beat positions
            beatPosition = calculateEvenBeatPosition(idx, barChords.length, timeSignature[0]);
          }

          return {
            symbol,
            beatPosition,
          };
        });

        // Check if bar is complete and valid
        const [beatsPerBar] = timeSignature;
        const isComplete = barChords.length <= beatsPerBar;
        const hasConflict = barChords.length > beatsPerBar * 4; // Allow subdivisions

        groups.push({
          chords: chordsWithPositions,
          timeSignature,
          isComplete,
          hasConflict,
        });
      }

      currentStartIndex = endIndex;
      barGroupIndex++;
    }

    return groups;
  }, [chordSequence, barLines, timeSignature, customBeatPositions]);

  /**
   * Auto-suggest bar line positions based on chord count and time signature
   */
  const autoSuggestBarLines = useCallback(() => {
    const [beatsPerBar] = timeSignature;
    const totalChords = chordSequence.length;

    // Simple heuristic: create bars with ~beatsPerBar chords each
    const suggestedBarLines: BarLine[] = [];

    for (let i = beatsPerBar; i < totalChords; i += beatsPerBar) {
      suggestedBarLines.push({ position: i });
    }

    setBarLines(suggestedBarLines);
  }, [chordSequence, timeSignature]);

  /**
   * Insert bar line at position
   */
  const insertBarLine = useCallback((position: number) => {
    // Check if bar line already exists at this position
    const exists = barLines.some(bl => bl.position === position);
    if (exists) return;

    setBarLines([...barLines, { position }]);
  }, [barLines]);

  /**
   * Remove bar line at position
   */
  const removeBarLine = useCallback((position: number) => {
    setBarLines(barLines.filter(bl => bl.position !== position));
  }, [barLines]);

  /**
   * Toggle bar line at position (insert if not exists, remove if exists)
   */
  const toggleBarLine = useCallback((position: number) => {
    const exists = barLines.some(bl => bl.position === position);
    if (exists) {
      removeBarLine(position);
    } else {
      insertBarLine(position);
    }
  }, [barLines, insertBarLine, removeBarLine]);

  /**
   * Export bars to Bar format
   */
  const exportBars = useCallback((): Bar[] => {
    const groups = buildBarGroups();

    return groups.map(group => ({
      time_signature: group.timeSignature,
      content: {
        chords: group.chords.map(chord => ({
          symbol: chord.symbol,
          beat_position: chord.beatPosition,
          duration_beats: null, // Auto-calculated or user-specified
        })),
        notes: [],
        tab: [],
      },
      lyrics_fragment: '', // TODO: Extract from lyrics
      is_expandable: false,
    }));
  }, [buildBarGroups]);

  /**
   * Update beat position for a chord
   */
  const updateBeatPosition = useCallback((
    barIndex: number,
    chordIndex: number,
    newBeatPosition: BeatPosition
  ) => {
    const key = `${barIndex}-${chordIndex}`;
    const newMap = new Map(customBeatPositions);
    newMap.set(key, newBeatPosition);
    setCustomBeatPositions(newMap);
  }, [customBeatPositions]);

  /**
   * Handle drag start
   */
  const handleDragStart = useCallback((
    barIndex: number,
    chordIndex: number
  ) => {
    setDraggedChordIndex(chordIndex);
  }, []);

  /**
   * Handle drag over beat position
   */
  const handleDragOver = useCallback((
    e: React.DragEvent,
    barIndex: number,
    beat: number,
    subdivision: number
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  /**
   * Handle drop on beat position
   */
  const handleDrop = useCallback((
    e: React.DragEvent,
    barIndex: number,
    chordIndex: number,
    beat: number,
    subdivision: number
  ) => {
    e.preventDefault();
    if (draggedChordIndex === null) return;

    const newBeatPosition: BeatPosition = { beat, subdivision };
    updateBeatPosition(barIndex, chordIndex, newBeatPosition);
    setDraggedChordIndex(null);
  }, [draggedChordIndex, updateBeatPosition]);

  /**
   * Handle complete button
   */
  const handleComplete = useCallback(() => {
    const bars = exportBars();
    onBarsComplete?.(bars);
  }, [exportBars, onBarsComplete]);

  // Render
  return (
    <div className="bar-overlay" ref={containerRef}>
      {/* Header with controls */}
      <BarOverlayHeader
        timeSignature={timeSignature}
        onTimeSignatureChange={setTimeSignature}
        onAutoSuggest={autoSuggestBarLines}
        onCancel={onCancel}
        onComplete={handleComplete}
      />

      {/* Main editing area */}
      <div className="bar-overlay-content">
        {mode === 'edit' ? (
          <EditMode
            chordSequence={chordSequence}
            barLines={barLines}
            timeSignature={timeSignature}
            onToggleBarLine={toggleBarLine}
            selectedChordIndex={selectedChordIndex}
            onSelectChord={setSelectedChordIndex}
          />
        ) : (
          <PreviewMode
            barGroups={buildBarGroups()}
            onUpdateBeatPosition={updateBeatPosition}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            editingBeatPosition={editingBeatPosition}
            setEditingBeatPosition={setEditingBeatPosition}
          />
        )}
      </div>

      {/* Validation warnings */}
      <ValidationPanel barGroups={buildBarGroups()} />
    </div>
  );
}

/**
 * BarOverlayHeader: Header with controls
 */
interface BarOverlayHeaderProps {
  timeSignature: TimeSignature;
  onTimeSignatureChange: (ts: TimeSignature) => void;
  onAutoSuggest: () => void;
  onCancel?: () => void;
  onComplete: () => void;
}

function BarOverlayHeader({
  timeSignature,
  onTimeSignatureChange,
  onAutoSuggest,
  onCancel,
  onComplete,
}: BarOverlayHeaderProps) {
  return (
    <div className="bar-overlay-header">
      <div className="header-left">
        {onCancel && (
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <h2 className="header-title">Add Bar Structure</h2>
      </div>

      <div className="header-controls">
        <TimeSignatureSelector
          value={timeSignature}
          onChange={onTimeSignatureChange}
        />

        <button className="btn-secondary" onClick={onAutoSuggest}>
          Auto-Suggest Bars
        </button>

        <button className="btn-primary" onClick={onComplete}>
          Complete
        </button>
      </div>
    </div>
  );
}

/**
 * TimeSignatureSelector: Dropdown for selecting time signature
 */
interface TimeSignatureSelectorProps {
  value: TimeSignature;
  onChange: (ts: TimeSignature) => void;
}

function TimeSignatureSelector({ value, onChange }: TimeSignatureSelectorProps) {
  const formatTS = (ts: TimeSignature) => `${ts[0]}/${ts[1]}`;

  return (
    <div className="time-signature-selector">
      <label htmlFor="time-signature">Time Signature:</label>
      <select
        id="time-signature"
        value={formatTS(value)}
        onChange={(e) => {
          const selected = TIME_SIGNATURES.find(ts => formatTS(ts) === e.target.value);
          if (selected) {
            onChange(selected);
          }
        }}
      >
        {TIME_SIGNATURES.map(ts => (
          <option key={formatTS(ts)} value={formatTS(ts)}>
            {formatTS(ts)}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * EditMode: Interactive editing mode with bar line insertion
 */
interface EditModeProps {
  chordSequence: string[];
  barLines: BarLine[];
  timeSignature: TimeSignature;
  onToggleBarLine: (position: number) => void;
  selectedChordIndex: number | null;
  onSelectChord: (index: number | null) => void;
}

function EditMode({
  chordSequence,
  barLines,
  timeSignature,
  onToggleBarLine,
  selectedChordIndex,
  onSelectChord,
}: EditModeProps) {
  return (
    <div className="edit-mode">
      <div className="edit-instructions">
        Click between chords to insert or remove bar lines. Click "Auto-Suggest" for automatic bar placement.
      </div>

      <div className="chord-sequence">
        {chordSequence.map((chord, index) => {
          const hasBarLineBefore = barLines.some(bl => bl.position === index);
          const hasBarLineAfter = barLines.some(bl => bl.position === index + 1);

          return (
            <div key={index} className="chord-item-wrapper">
              {/* Bar line insertion point BEFORE chord */}
              {index === 0 && (
                <BarLineInsertion
                  position={0}
                  hasBarLine={hasBarLineBefore}
                  onToggle={onToggleBarLine}
                  isFirst={true}
                />
              )}

              {/* Chord */}
              <ChordItem
                symbol={chord}
                index={index}
                isSelected={selectedChordIndex === index}
                onClick={() => onSelectChord(index)}
              />

              {/* Bar line insertion point AFTER chord */}
              <BarLineInsertion
                position={index + 1}
                hasBarLine={hasBarLineAfter}
                onToggle={onToggleBarLine}
                isLast={index === chordSequence.length - 1}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * BarLineInsertion: Visual indicator for bar line insertion point
 */
interface BarLineInsertionProps {
  position: number;
  hasBarLine: boolean;
  onToggle: (position: number) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

function BarLineInsertion({
  position,
  hasBarLine,
  onToggle,
  isFirst = false,
  isLast = false,
}: BarLineInsertionProps) {
  return (
    <button
      className={`bar-line-insertion ${hasBarLine ? 'has-bar-line' : ''} ${isFirst ? 'first' : ''} ${isLast ? 'last' : ''}`}
      onClick={() => onToggle(position)}
      title={hasBarLine ? 'Click to remove bar line' : 'Click to insert bar line'}
      aria-label={hasBarLine ? 'Remove bar line' : 'Insert bar line'}
    >
      <span className="bar-line-indicator">|</span>
    </button>
  );
}

/**
 * ChordItem: Individual chord display
 */
interface ChordItemProps {
  symbol: string;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}

function ChordItem({ symbol, index, isSelected, onClick }: ChordItemProps) {
  return (
    <div
      className={`chord-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="chord-symbol">{symbol}</div>
      <div className="chord-index">{index + 1}</div>
    </div>
  );
}

/**
 * PreviewMode: Preview of bar structure with beat position editing
 */
interface PreviewModeProps {
  barGroups: BarGroup[];
  onUpdateBeatPosition: (barIndex: number, chordIndex: number, beatPosition: BeatPosition) => void;
  onDragStart: (barIndex: number, chordIndex: number) => void;
  onDragOver: (e: React.DragEvent, barIndex: number, beat: number, subdivision: number) => void;
  onDrop: (e: React.DragEvent, barIndex: number, chordIndex: number, beat: number, subdivision: number) => void;
  editingBeatPosition: { barIndex: number; chordIndex: number } | null;
  setEditingBeatPosition: (pos: { barIndex: number; chordIndex: number } | null) => void;
}

function PreviewMode({
  barGroups,
  onUpdateBeatPosition,
  onDragStart,
  onDragOver,
  onDrop,
  editingBeatPosition,
  setEditingBeatPosition,
}: PreviewModeProps) {
  return (
    <div className="preview-mode">
      <h3 className="preview-title">Preview Bar Structure (Drag chords to adjust beat positions)</h3>

      <div className="preview-bars">
        {barGroups.map((group, index) => (
          <BarGroupPreview
            key={index}
            group={group}
            barIndex={index}
            onUpdateBeatPosition={onUpdateBeatPosition}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            editingBeatPosition={editingBeatPosition}
            setEditingBeatPosition={setEditingBeatPosition}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * BarGroupPreview: Preview of a single bar group with drag-and-drop editing
 */
interface BarGroupPreviewProps {
  group: BarGroup;
  barIndex: number;
  onUpdateBeatPosition: (barIndex: number, chordIndex: number, beatPosition: BeatPosition) => void;
  onDragStart: (barIndex: number, chordIndex: number) => void;
  onDragOver: (e: React.DragEvent, barIndex: number, beat: number, subdivision: number) => void;
  onDrop: (e: React.DragEvent, barIndex: number, chordIndex: number, beat: number, subdivision: number) => void;
  editingBeatPosition: { barIndex: number; chordIndex: number } | null;
  setEditingBeatPosition: (pos: { barIndex: number; chordIndex: number } | null) => void;
}

function BarGroupPreview({
  group,
  barIndex,
  onUpdateBeatPosition,
  onDragStart,
  onDragOver,
  onDrop,
  editingBeatPosition,
  setEditingBeatPosition,
}: BarGroupPreviewProps) {
  const [beatsPerBar] = group.timeSignature;

  return (
    <div className={`bar-group-preview ${!group.isComplete ? 'incomplete' : ''} ${group.hasConflict ? 'conflict' : ''}`}>
      <div className="bar-header">
        <span className="bar-number">Bar {barIndex + 1}</span>
        <span className="bar-time-sig">{group.timeSignature[0]}/{group.timeSignature[1]}</span>
      </div>

      <div className="bar-chords">
        {group.chords.map((chord, chordIdx) => {
          const isEditing = editingBeatPosition?.barIndex === barIndex && editingBeatPosition?.chordIndex === chordIdx;

          return (
            <div
              key={chordIdx}
              className="bar-chord"
              draggable
              onDragStart={() => onDragStart(barIndex, chordIdx)}
            >
              <span className="chord-symbol">{chord.symbol}</span>
              {isEditing ? (
                <BeatPositionEditor
                  beatPosition={chord.beatPosition}
                  maxBeats={beatsPerBar}
                  onUpdate={(newBeat) => {
                    onUpdateBeatPosition(barIndex, chordIdx, newBeat);
                    setEditingBeatPosition(null);
                  }}
                  onCancel={() => setEditingBeatPosition(null)}
                />
              ) : (
                <button
                  className="beat-position"
                  onClick={() => setEditingBeatPosition({ barIndex, chordIndex: chordIdx })}
                  title="Click to edit beat position"
                >
                  {chord.beatPosition.beat}
                  {chord.beatPosition.subdivision > 0 && (
                    <sup className="subdivision">+{chord.beatPosition.subdivision}</sup>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Interactive beat grid - drop zones */}
      <div className="beat-grid-interactive">
        {Array.from({ length: beatsPerBar }, (_, beatIdx) => (
          <BeatDropZone
            key={beatIdx}
            barIndex={barIndex}
            beat={beatIdx + 1}
            onDragOver={onDragOver}
            onDrop={(e, chordIdx) => onDrop(e, barIndex, chordIdx, beatIdx + 1, 0)}
            chords={group.chords.filter(c => c.beatPosition.beat === beatIdx + 1)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * BeatPositionEditor: Inline editor for beat positions
 */
interface BeatPositionEditorProps {
  beatPosition: BeatPosition;
  maxBeats: number;
  onUpdate: (beatPosition: BeatPosition) => void;
  onCancel: () => void;
}

function BeatPositionEditor({
  beatPosition,
  maxBeats,
  onUpdate,
  onCancel,
}: BeatPositionEditorProps) {
  const [beat, setBeat] = useState(beatPosition.beat);
  const [subdivision, setSubdivision] = useState(beatPosition.subdivision);

  const handleSave = () => {
    onUpdate({ beat, subdivision });
  };

  return (
    <div className="beat-position-editor" onClick={(e) => e.stopPropagation()}>
      <div className="editor-inputs">
        <select
          value={beat}
          onChange={(e) => setBeat(Number(e.target.value))}
          className="beat-select"
        >
          {Array.from({ length: maxBeats }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <select
          value={subdivision}
          onChange={(e) => setSubdivision(Number(e.target.value))}
          className="subdivision-select"
        >
          <option value={0}>On beat</option>
          <option value={1}>& (and)</option>
          <option value={2}>e</option>
          <option value={3}>a</option>
        </select>
      </div>
      <div className="editor-actions">
        <button className="btn-save" onClick={handleSave}>
          ✓
        </button>
        <button className="btn-cancel" onClick={onCancel}>
          ✗
        </button>
      </div>
    </div>
  );
}

/**
 * BeatDropZone: Drop zone for a beat position
 */
interface BeatDropZoneProps {
  barIndex: number;
  beat: number;
  onDragOver: (e: React.DragEvent, barIndex: number, beat: number, subdivision: number) => void;
  onDrop: (e: React.DragEvent, chordIndex: number) => void;
  chords: ChordWithPosition[];
}

function BeatDropZone({
  barIndex,
  beat,
  onDragOver,
  onDrop,
  chords,
}: BeatDropZoneProps) {
  return (
    <div
      className="beat-drop-zone"
      onDragOver={(e) => onDragOver(e, barIndex, beat, 0)}
      onDrop={(e) => onDrop(e, 0)} // chord index is determined by dragged chord
    >
      <div className="beat-number">{beat}</div>
      {chords.length > 0 && (
        <div className="beat-chord-count">
          {chords.length} chord{chords.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

/**
 * Helper: Calculate even beat position distribution
 */
function calculateEvenBeatPosition(
  chordIndex: number,
  totalChords: number,
  beatsPerBar: number
): BeatPosition {
  // Distribute chords evenly across beats
  const beatFraction = (chordIndex * beatsPerBar) / totalChords;
  const beat = Math.floor(beatFraction) + 1;

  // Calculate subdivision based on fractional part
  const fractionalPart = beatFraction - Math.floor(beatFraction);
  let subdivision = 0;

  if (fractionalPart >= 0.75) {
    subdivision = 3; // "a"
  } else if (fractionalPart >= 0.5) {
    subdivision = 2; // "e"
  } else if (fractionalPart >= 0.25) {
    subdivision = 1; // "&" (and)
  }

  return { beat: Math.min(beat, beatsPerBar), subdivision };
}

/**
 * ValidationPanel: Display validation warnings
 */
interface ValidationPanelProps {
  barGroups: BarGroup[];
}

function ValidationPanel({ barGroups }: ValidationPanelProps) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  barGroups.forEach((group, barIndex) => {
    const [beatsPerBar] = group.timeSignature;

    // Check for empty bars
    if (group.chords.length === 0) {
      warnings.push(`Bar ${barIndex + 1}: Empty bar`);
      return;
    }

    // Check for too many chords (beyond subdivisions)
    if (group.hasConflict) {
      errors.push(
        `Bar ${barIndex + 1}: Too many chords (${group.chords.length} chords in ${group.timeSignature[0]}/${group.timeSignature[1]}). ` +
        `Maximum is ${beatsPerBar * 4} (with subdivisions).`
      );
    }

    // Check for beat position conflicts (multiple chords on same beat+subdivision)
    const positionMap = new Map<string, number[]>();
    group.chords.forEach((chord, chordIdx) => {
      const key = `${chord.beatPosition.beat}-${chord.beatPosition.subdivision}`;
      const existing = positionMap.get(key) || [];
      existing.push(chordIdx);
      positionMap.set(key, existing);
    });

    positionMap.forEach((chordIndices, key) => {
      if (chordIndices.length > 1) {
        const [beat, subdivision] = key.split('-');
        const subdivisionName = ['on beat', '&', 'e', 'a'][Number(subdivision)];
        warnings.push(
          `Bar ${barIndex + 1}: Multiple chords on beat ${beat} (${subdivisionName}): ` +
          chordIndices.map(i => group.chords[i].symbol).join(', ')
        );
      }
    });

    // Check for invalid beat positions (beat > beatsPerBar)
    group.chords.forEach((chord, chordIdx) => {
      if (chord.beatPosition.beat > beatsPerBar) {
        errors.push(
          `Bar ${barIndex + 1}, Chord "${chord.symbol}": Beat ${chord.beatPosition.beat} exceeds time signature (${beatsPerBar} beats per bar)`
        );
      }
      if (chord.beatPosition.beat < 1) {
        errors.push(
          `Bar ${barIndex + 1}, Chord "${chord.symbol}": Invalid beat position ${chord.beatPosition.beat} (must be ≥ 1)`
        );
      }
      if (chord.beatPosition.subdivision < 0 || chord.beatPosition.subdivision > 3) {
        errors.push(
          `Bar ${barIndex + 1}, Chord "${chord.symbol}": Invalid subdivision ${chord.beatPosition.subdivision} (must be 0-3)`
        );
      }
    });

    // Check for sparse bars (too few chords for time signature)
    if (group.chords.length === 1 && beatsPerBar > 2) {
      info.push(
        `Bar ${barIndex + 1}: Only 1 chord in ${group.timeSignature[0]}/${group.timeSignature[1]} time. ` +
        `Consider adding more chords or adjusting bar lines.`
      );
    }

    // Check for uneven distribution (all chords on beat 1)
    const allOnBeatOne = group.chords.every(c => c.beatPosition.beat === 1);
    if (allOnBeatOne && group.chords.length > 1) {
      warnings.push(
        `Bar ${barIndex + 1}: All ${group.chords.length} chords are on beat 1. ` +
        `Consider spreading them across the bar.`
      );
    }

    // Check for missing beats (gaps in beat coverage)
    const beatsUsed = new Set(group.chords.map(c => c.beatPosition.beat));
    if (beatsUsed.size < beatsPerBar && beatsUsed.size > 1) {
      const missingBeats = Array.from({ length: beatsPerBar }, (_, i) => i + 1)
        .filter(beat => !beatsUsed.has(beat));
      if (missingBeats.length > 0) {
        info.push(
          `Bar ${barIndex + 1}: No chords on beat${missingBeats.length > 1 ? 's' : ''} ${missingBeats.join(', ')}`
        );
      }
    }
  });

  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;
  const hasInfo = info.length > 0;

  if (!hasErrors && !hasWarnings && !hasInfo) {
    return (
      <div className="validation-panel validation-success">
        <h4 className="validation-title">✓ Bar structure is valid</h4>
        <p className="validation-success-message">
          All bars have consistent beat positions and proper time signatures.
        </p>
      </div>
    );
  }

  return (
    <div className={`validation-panel ${hasErrors ? 'has-errors' : hasWarnings ? 'has-warnings' : 'has-info'}`}>
      {hasErrors && (
        <div className="validation-section">
          <h4 className="validation-title validation-errors">Errors:</h4>
          <ul className="validation-list">
            {errors.map((error, index) => (
              <li key={index} className="validation-error">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasWarnings && (
        <div className="validation-section">
          <h4 className="validation-title validation-warnings">Warnings:</h4>
          <ul className="validation-list">
            {warnings.map((warning, index) => (
              <li key={index} className="validation-warning">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasInfo && (
        <div className="validation-section">
          <h4 className="validation-title validation-info">Info:</h4>
          <ul className="validation-list">
            {info.map((item, index) => (
              <li key={index} className="validation-info">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
