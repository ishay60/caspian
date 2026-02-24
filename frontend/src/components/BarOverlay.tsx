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

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Build bar groups from chord sequence and bar lines
   */
  const buildBarGroups = useCallback((): BarGroup[] => {
    const groups: BarGroup[] = [];
    const sortedBarLines = [...barLines].sort((a, b) => a.position - b.position);

    let currentStartIndex = 0;

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
        // Assign chords to beat positions evenly for now
        const chordsWithPositions: ChordWithPosition[] = barChords.map((symbol, idx) => {
          const beatNum = Math.floor((idx * timeSignature[0]) / barChords.length) + 1;
          return {
            symbol,
            beatPosition: {
              beat: beatNum,
              subdivision: 0,
            },
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
    }

    return groups;
  }, [chordSequence, barLines, timeSignature]);

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
          <PreviewMode barGroups={buildBarGroups()} />
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
 * PreviewMode: Preview of bar structure
 */
interface PreviewModeProps {
  barGroups: BarGroup[];
}

function PreviewMode({ barGroups }: PreviewModeProps) {
  return (
    <div className="preview-mode">
      <h3 className="preview-title">Preview Bar Structure</h3>

      <div className="preview-bars">
        {barGroups.map((group, index) => (
          <BarGroupPreview key={index} group={group} barIndex={index} />
        ))}
      </div>
    </div>
  );
}

/**
 * BarGroupPreview: Preview of a single bar group
 */
interface BarGroupPreviewProps {
  group: BarGroup;
  barIndex: number;
}

function BarGroupPreview({ group, barIndex }: BarGroupPreviewProps) {
  const [beatsPerBar] = group.timeSignature;

  return (
    <div className={`bar-group-preview ${!group.isComplete ? 'incomplete' : ''} ${group.hasConflict ? 'conflict' : ''}`}>
      <div className="bar-header">
        <span className="bar-number">Bar {barIndex + 1}</span>
        <span className="bar-time-sig">{group.timeSignature[0]}/{group.timeSignature[1]}</span>
      </div>

      <div className="bar-chords">
        {group.chords.map((chord, chordIdx) => (
          <div key={chordIdx} className="bar-chord">
            <span className="chord-symbol">{chord.symbol}</span>
            <span className="beat-position">
              {chord.beatPosition.beat}
              {chord.beatPosition.subdivision > 0 && (
                <sup className="subdivision">+{chord.beatPosition.subdivision}</sup>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Beat grid visualization */}
      <div className="beat-grid">
        {Array.from({ length: beatsPerBar }, (_, beatIdx) => (
          <div key={beatIdx} className="beat-marker">
            {beatIdx + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ValidationPanel: Display validation warnings
 */
interface ValidationPanelProps {
  barGroups: BarGroup[];
}

function ValidationPanel({ barGroups }: ValidationPanelProps) {
  const warnings: string[] = [];

  barGroups.forEach((group, index) => {
    if (group.hasConflict) {
      warnings.push(`Bar ${index + 1}: Too many chords for time signature (${group.chords.length} chords in ${group.timeSignature[0]}/${group.timeSignature[1]})`);
    }
    if (!group.isComplete && group.chords.length === 0) {
      warnings.push(`Bar ${index + 1}: Empty bar`);
    }
  });

  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="validation-panel">
      <h4 className="validation-title">Warnings:</h4>
      <ul className="validation-warnings">
        {warnings.map((warning, index) => (
          <li key={index} className="validation-warning">
            {warning}
          </li>
        ))}
      </ul>
    </div>
  );
}
