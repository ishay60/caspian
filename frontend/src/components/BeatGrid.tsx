/**
 * BeatGrid Component
 *
 * Visual beat grid editor for precise chord and note placement within bars.
 * Provides a graphical interface for:
 * - Visualizing beat positions and subdivisions
 * - Click-to-place chords at specific beat positions
 * - Drag-and-drop to reposition chords and notes
 * - Visual harmonic rhythm indication
 * - Subdivision support (quarter, 8th, 16th notes)
 *
 * WORKFLOW:
 * 1. Display bar as beat grid with time signature-based divisions
 * 2. Show existing chords and notes as markers on the grid
 * 3. User clicks on grid to place new chord at beat position
 * 4. User drags existing chord/note to reposition
 * 5. Visual feedback for harmonic rhythm (chord density)
 * 6. Export updated Bar data when positions change
 *
 * FEATURES:
 * - Time signature support (4/4, 3/4, 6/8, etc.)
 * - Subdivision lines (8th and 16th notes)
 * - Color-coded elements (chords vs notes vs riffs)
 * - Harmonic rhythm visualization
 * - Drag-and-drop repositioning
 * - Responsive design
 * - Keyboard shortcuts for quick editing
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { Bar, BarChord, BarNote, TabNote, BeatPosition, BarContent } from '../types';
import './BeatGrid.css';

/**
 * SubdivisionLevel: Grid subdivision granularity
 */
type SubdivisionLevel = 'quarter' | 'eighth' | 'sixteenth';

/**
 * GridElement: Unified type for chords, notes, and tab notes
 */
interface GridElement {
  id: string;
  type: 'chord' | 'note' | 'tab';
  beat_position: BeatPosition;
  symbol?: string; // For chords
  pitch?: string; // For notes
  octave?: number; // For notes
  string?: number; // For tab notes
  fret?: number; // For tab notes
}

/**
 * DragState: State during drag operation
 */
interface DragState {
  elementId: string;
  originalPosition: BeatPosition;
  offsetX: number;
  offsetY: number;
}

/**
 * BeatGridProps
 */
export interface BeatGridProps {
  // Bar data
  bar: Bar;
  barIndex: number;

  // Display options
  subdivisionLevel?: SubdivisionLevel;
  showHarmonicRhythm?: boolean;
  showNotes?: boolean;
  readOnly?: boolean;

  // Callbacks
  onBarUpdate?: (updatedBar: Bar) => void;
  onChordClick?: (chord: BarChord, position: BeatPosition) => void;
  onNoteClick?: (note: BarNote | TabNote, position: BeatPosition) => void;
  onGridClick?: (position: BeatPosition) => void; // For placing new elements
}

/**
 * Convert beat position to grid fraction
 */
function beatPositionToFraction(pos: BeatPosition, subdivisionLevel: SubdivisionLevel): number {
  const beat = pos.beat - 1; // Convert to 0-based
  let subdivisionFraction = 0;

  switch (subdivisionLevel) {
    case 'quarter':
      // No subdivisions beyond quarter notes
      subdivisionFraction = 0;
      break;
    case 'eighth':
      // 2 subdivisions per beat
      subdivisionFraction = pos.subdivision / 2;
      break;
    case 'sixteenth':
      // 4 subdivisions per beat
      subdivisionFraction = pos.subdivision / 4;
      break;
  }

  return beat + subdivisionFraction;
}

/**
 * Convert grid fraction to beat position
 */
function fractionToBeatPosition(fraction: number, subdivisionLevel: SubdivisionLevel): BeatPosition {
  const beat = Math.floor(fraction) + 1; // Convert to 1-based
  const remainder = fraction - Math.floor(fraction);

  let subdivision = 0;
  switch (subdivisionLevel) {
    case 'quarter':
      subdivision = 0;
      break;
    case 'eighth':
      subdivision = Math.round(remainder * 2);
      break;
    case 'sixteenth':
      subdivision = Math.round(remainder * 4);
      break;
  }

  return { beat, subdivision };
}

/**
 * Calculate harmonic rhythm intensity (chords per beat)
 */
function calculateHarmonicRhythm(chords: BarChord[], beatsPerBar: number): number {
  if (chords.length === 0) return 0;
  return chords.length / beatsPerBar;
}

/**
 * BeatGrid Component
 */
export function BeatGrid({
  bar,
  barIndex,
  subdivisionLevel = 'eighth',
  showHarmonicRhythm = true,
  showNotes = true,
  readOnly = false,
  onBarUpdate,
  onChordClick,
  onNoteClick,
  onGridClick,
}: BeatGridProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<BeatPosition | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const beatsPerBar = bar.time_signature[0];
  const beatUnit = bar.time_signature[1];

  // Convert bar content to unified grid elements
  const gridElements = useMemo<GridElement[]>(() => {
    const elements: GridElement[] = [];

    // Add chords
    bar.content.chords.forEach((chord, index) => {
      elements.push({
        id: `chord-${index}`,
        type: 'chord',
        beat_position: chord.beat_position,
        symbol: chord.symbol,
      });
    });

    // Add notes if enabled
    if (showNotes) {
      bar.content.notes.forEach((note, index) => {
        elements.push({
          id: `note-${index}`,
          type: 'note',
          beat_position: note.beat_position,
          pitch: note.pitch,
          octave: note.octave,
        });
      });

      bar.content.tab.forEach((tabNote, index) => {
        elements.push({
          id: `tab-${index}`,
          type: 'tab',
          beat_position: tabNote.beat_position,
          string: tabNote.string,
          fret: tabNote.fret,
        });
      });
    }

    return elements;
  }, [bar.content, showNotes]);

  // Calculate harmonic rhythm intensity
  const harmonicRhythmIntensity = useMemo(() => {
    return calculateHarmonicRhythm(bar.content.chords, beatsPerBar);
  }, [bar.content.chords, beatsPerBar]);

  // Calculate grid positions for subdivisions
  const gridPositions = useMemo(() => {
    const positions: BeatPosition[] = [];

    for (let beat = 1; beat <= beatsPerBar; beat++) {
      // Always add main beat
      positions.push({ beat, subdivision: 0 });

      // Add subdivisions based on level
      if (subdivisionLevel === 'eighth' || subdivisionLevel === 'sixteenth') {
        const subdivisionsPerBeat = subdivisionLevel === 'eighth' ? 2 : 4;
        for (let sub = 1; sub < subdivisionsPerBeat; sub++) {
          positions.push({ beat, subdivision: sub });
        }
      }
    }

    return positions;
  }, [beatsPerBar, subdivisionLevel]);

  // Handle grid click
  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const gridWidth = rect.width;

    // Calculate beat position from click location
    const fraction = (x / gridWidth) * beatsPerBar;
    const position = fractionToBeatPosition(fraction, subdivisionLevel);

    // Validate position
    if (position.beat >= 1 && position.beat <= beatsPerBar) {
      onGridClick?.(position);
    }
  }, [readOnly, beatsPerBar, subdivisionLevel, onGridClick]);

  // Handle element click
  const handleElementClick = useCallback((element: GridElement, e: React.MouseEvent) => {
    e.stopPropagation();

    if (element.type === 'chord') {
      const chord = bar.content.chords.find((c, i) => `chord-${i}` === element.id);
      if (chord) {
        onChordClick?.(chord, element.beat_position);
      }
    } else if (element.type === 'note') {
      const note = bar.content.notes.find((n, i) => `note-${i}` === element.id);
      if (note) {
        onNoteClick?.(note, element.beat_position);
      }
    } else if (element.type === 'tab') {
      const tabNote = bar.content.tab.find((t, i) => `tab-${i}` === element.id);
      if (tabNote) {
        onNoteClick?.(tabNote, element.beat_position);
      }
    }
  }, [bar.content, onChordClick, onNoteClick]);

  // Handle drag start
  const handleDragStart = useCallback((element: GridElement, e: React.MouseEvent) => {
    if (readOnly) return;

    e.preventDefault();
    e.stopPropagation();

    setDragState({
      elementId: element.id,
      originalPosition: element.beat_position,
      offsetX: 0,
      offsetY: 0,
    });
  }, [readOnly]);

  // Handle drag move
  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!dragState || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const gridWidth = rect.width;

    // Calculate new position
    const fraction = (x / gridWidth) * beatsPerBar;
    const newPosition = fractionToBeatPosition(fraction, subdivisionLevel);

    // Validate and update hovered position
    if (newPosition.beat >= 1 && newPosition.beat <= beatsPerBar) {
      setHoveredPosition(newPosition);
    }
  }, [dragState, beatsPerBar, subdivisionLevel]);

  // Handle drag end
  const handleDragEnd = useCallback((e: MouseEvent) => {
    if (!dragState || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const gridWidth = rect.width;

    // Calculate final position
    const fraction = (x / gridWidth) * beatsPerBar;
    const newPosition = fractionToBeatPosition(fraction, subdivisionLevel);

    // Validate position
    if (newPosition.beat >= 1 && newPosition.beat <= beatsPerBar) {
      // Update bar content with new position
      const updatedBar = { ...bar };
      const element = gridElements.find(e => e.id === dragState.elementId);

      if (element) {
        if (element.type === 'chord') {
          const chordIndex = parseInt(element.id.split('-')[1]);
          updatedBar.content.chords = [...bar.content.chords];
          updatedBar.content.chords[chordIndex] = {
            ...updatedBar.content.chords[chordIndex],
            beat_position: newPosition,
          };
        } else if (element.type === 'note') {
          const noteIndex = parseInt(element.id.split('-')[1]);
          updatedBar.content.notes = [...bar.content.notes];
          updatedBar.content.notes[noteIndex] = {
            ...updatedBar.content.notes[noteIndex],
            beat_position: newPosition,
          };
        } else if (element.type === 'tab') {
          const tabIndex = parseInt(element.id.split('-')[1]);
          updatedBar.content.tab = [...bar.content.tab];
          updatedBar.content.tab[tabIndex] = {
            ...updatedBar.content.tab[tabIndex],
            beat_position: newPosition,
          };
        }

        onBarUpdate?.(updatedBar);
      }
    }

    setDragState(null);
    setHoveredPosition(null);
  }, [dragState, bar, beatsPerBar, subdivisionLevel, gridElements, onBarUpdate]);

  // Set up drag event listeners
  useEffect(() => {
    if (!dragState) return;

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [dragState, handleDragMove, handleDragEnd]);

  // Render harmonic rhythm indicator
  const renderHarmonicRhythmIndicator = () => {
    if (!showHarmonicRhythm) return null;

    // Map intensity to visual properties
    let intensityClass = 'low';
    if (harmonicRhythmIntensity > 2) {
      intensityClass = 'high';
    } else if (harmonicRhythmIntensity > 1) {
      intensityClass = 'medium';
    }

    return (
      <div className={`beat-grid-harmonic-rhythm ${intensityClass}`}>
        <div className="harmonic-rhythm-bar" style={{
          width: `${Math.min(harmonicRhythmIntensity * 50, 100)}%`
        }} />
        <span className="harmonic-rhythm-label">
          {harmonicRhythmIntensity.toFixed(1)} chords/beat
        </span>
      </div>
    );
  };

  // Calculate element position on grid
  const getElementPosition = (element: GridElement): number => {
    const position = dragState?.elementId === element.id && hoveredPosition
      ? hoveredPosition
      : element.beat_position;

    const fraction = beatPositionToFraction(position, subdivisionLevel);
    return (fraction / beatsPerBar) * 100;
  };

  return (
    <div className="beat-grid-container">
      {/* Header */}
      <div className="beat-grid-header">
        <div className="beat-grid-title">
          Bar {barIndex + 1} • {beatsPerBar}/{beatUnit}
        </div>
        {renderHarmonicRhythmIndicator()}
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        className={`beat-grid ${readOnly ? 'read-only' : ''}`}
        onClick={handleGridClick}
      >
        {/* Beat lines */}
        <div className="beat-grid-lines">
          {gridPositions.map((pos, index) => {
            const isMainBeat = pos.subdivision === 0;
            const fraction = beatPositionToFraction(pos, subdivisionLevel);
            const leftPercent = (fraction / beatsPerBar) * 100;

            return (
              <div
                key={`line-${index}`}
                className={`beat-line ${isMainBeat ? 'main-beat' : 'subdivision'}`}
                style={{ left: `${leftPercent}%` }}
              >
                {isMainBeat && (
                  <span className="beat-number">{pos.beat}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Grid elements (chords, notes, tab) */}
        <div className="beat-grid-elements">
          {gridElements.map((element) => {
            const leftPercent = getElementPosition(element);
            const isDragging = dragState?.elementId === element.id;

            return (
              <div
                key={element.id}
                className={`grid-element ${element.type} ${isDragging ? 'dragging' : ''}`}
                style={{ left: `${leftPercent}%` }}
                onClick={(e) => handleElementClick(element, e)}
                onMouseDown={(e) => handleDragStart(element, e)}
              >
                {element.type === 'chord' && (
                  <div className="chord-marker">
                    <span className="chord-symbol">{element.symbol}</span>
                  </div>
                )}
                {element.type === 'note' && (
                  <div className="note-marker">
                    <span className="note-pitch">{element.pitch}{element.octave}</span>
                  </div>
                )}
                {element.type === 'tab' && (
                  <div className="tab-marker">
                    <span className="tab-notation">{element.string}:{element.fret}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Hover indicator */}
        {hoveredPosition && dragState && (
          <div
            className="hover-indicator"
            style={{
              left: `${(beatPositionToFraction(hoveredPosition, subdivisionLevel) / beatsPerBar) * 100}%`
            }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="beat-grid-legend">
        <div className="legend-item">
          <div className="legend-marker chord" />
          <span>Chord</span>
        </div>
        {showNotes && (
          <>
            <div className="legend-item">
              <div className="legend-marker note" />
              <span>Note</span>
            </div>
            <div className="legend-item">
              <div className="legend-marker tab" />
              <span>Tab</span>
            </div>
          </>
        )}
      </div>

      {/* Instructions */}
      {!readOnly && (
        <div className="beat-grid-instructions">
          Click on grid to place elements • Drag to reposition
        </div>
      )}
    </div>
  );
}
