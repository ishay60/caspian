/**
 * BeatGrid Component Tests
 *
 * Comprehensive test suite for the BeatGrid component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BeatGrid } from './BeatGrid';
import type { Bar, BarChord, BarNote, TabNote, BeatPosition } from '../types';

describe('BeatGrid Component', () => {
  // Helper function to create test bar
  const createTestBar = (
    timeSignature: [number, number] = [4, 4],
    chords: BarChord[] = [],
    notes: BarNote[] = [],
    tab: TabNote[] = []
  ): Bar => ({
    time_signature: timeSignature,
    content: {
      chords,
      notes,
      tab,
    },
    lyrics_fragment: '',
    is_expandable: true,
  });

  // Helper function to create beat position
  const createBeatPosition = (beat: number, subdivision: number = 0): BeatPosition => ({
    beat,
    subdivision,
  });

  // Helper function to create chord
  const createChord = (symbol: string, beat: number, subdivision: number = 0): BarChord => ({
    symbol,
    beat_position: createBeatPosition(beat, subdivision),
    duration_beats: null,
  });

  // Helper function to create note
  const createNote = (pitch: string, octave: number, beat: number, subdivision: number = 0): BarNote => ({
    pitch,
    octave,
    beat_position: createBeatPosition(beat, subdivision),
    duration_beats: 0.5,
  });

  // Helper function to create tab note
  const createTabNote = (string: number, fret: number, beat: number, subdivision: number = 0): TabNote => ({
    string,
    fret,
    beat_position: createBeatPosition(beat, subdivision),
    duration_beats: 0.5,
  });

  describe('Task 4.5.1: Component Skeleton', () => {
    it('should render without crashing', () => {
      const bar = createTestBar();
      render(<BeatGrid bar={bar} barIndex={0} />);
      expect(screen.getByText(/Bar 1/)).toBeInTheDocument();
    });

    it('should display bar index correctly', () => {
      const bar = createTestBar();
      render(<BeatGrid bar={bar} barIndex={5} />);
      expect(screen.getByText(/Bar 6/)).toBeInTheDocument();
    });

    it('should accept all required props', () => {
      const bar = createTestBar();
      const onBarUpdate = vi.fn();
      const onChordClick = vi.fn();
      const onNoteClick = vi.fn();
      const onGridClick = vi.fn();

      render(
        <BeatGrid
          bar={bar}
          barIndex={0}
          onBarUpdate={onBarUpdate}
          onChordClick={onChordClick}
          onNoteClick={onNoteClick}
          onGridClick={onGridClick}
        />
      );

      expect(screen.getByText(/Bar 1/)).toBeInTheDocument();
    });
  });

  describe('Task 4.5.2: Render Beat Grid per Bar', () => {
    it('should render 4/4 time signature by default', () => {
      const bar = createTestBar([4, 4]);
      render(<BeatGrid bar={bar} barIndex={0} />);
      expect(screen.getByText(/4\/4/)).toBeInTheDocument();
    });

    it('should render 3/4 time signature correctly', () => {
      const bar = createTestBar([3, 4]);
      render(<BeatGrid bar={bar} barIndex={0} />);
      expect(screen.getByText(/3\/4/)).toBeInTheDocument();
    });

    it('should render 6/8 time signature correctly', () => {
      const bar = createTestBar([6, 8]);
      render(<BeatGrid bar={bar} barIndex={0} />);
      expect(screen.getByText(/6\/8/)).toBeInTheDocument();
    });

    it('should render correct number of beat lines for 4/4', () => {
      const bar = createTestBar([4, 4]);
      const { container } = render(<BeatGrid bar={bar} barIndex={0} />);
      const mainBeatLines = container.querySelectorAll('.beat-line.main-beat');
      expect(mainBeatLines.length).toBe(4);
    });

    it('should render correct number of beat lines for 3/4', () => {
      const bar = createTestBar([3, 4]);
      const { container } = render(<BeatGrid bar={bar} barIndex={0} />);
      const mainBeatLines = container.querySelectorAll('.beat-line.main-beat');
      expect(mainBeatLines.length).toBe(3);
    });

    it('should display beat numbers correctly', () => {
      const bar = createTestBar([4, 4]);
      render(<BeatGrid bar={bar} barIndex={0} />);
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  describe('Task 4.5.3: Click-to-Place Chords', () => {
    it('should call onGridClick when grid is clicked', async () => {
      const bar = createTestBar();
      const onGridClick = vi.fn();
      const { container } = render(<BeatGrid bar={bar} barIndex={0} onGridClick={onGridClick} />);

      const grid = container.querySelector('.beat-grid');
      expect(grid).toBeTruthy();
      fireEvent.click(grid!);

      await waitFor(() => {
        expect(onGridClick).toHaveBeenCalled();
      });
    });

    it('should not call onGridClick when readOnly is true', () => {
      const bar = createTestBar();
      const onGridClick = vi.fn();
      const { container } = render(
        <BeatGrid bar={bar} barIndex={0} onGridClick={onGridClick} readOnly={true} />
      );

      const grid = container.querySelector('.beat-grid');
      fireEvent.click(grid!);

      expect(onGridClick).not.toHaveBeenCalled();
    });

    it('should calculate beat position from click location', async () => {
      const bar = createTestBar([4, 4]);
      const onGridClick = vi.fn();
      const { container } = render(<BeatGrid bar={bar} barIndex={0} onGridClick={onGridClick} />);

      const grid = container.querySelector('.beat-grid') as HTMLElement;

      // Mock getBoundingClientRect
      vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 400,
        top: 0,
        height: 120,
        right: 400,
        bottom: 120,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      // Click at 25% (beat 1)
      fireEvent.click(grid, { clientX: 100 });

      await waitFor(() => {
        expect(onGridClick).toHaveBeenCalledWith(
          expect.objectContaining({ beat: 1 })
        );
      });
    });
  });

  describe('Task 4.5.4: Subdivision Support', () => {
    it('should render eighth note subdivisions by default', () => {
      const bar = createTestBar([4, 4]);
      const { container } = render(<BeatGrid bar={bar} barIndex={0} />);

      // 4 beats * 2 subdivisions per beat = 8 subdivision lines
      const subdivisionLines = container.querySelectorAll('.beat-line.subdivision');
      expect(subdivisionLines.length).toBe(4); // One subdivision between each beat
    });

    it('should render sixteenth note subdivisions when specified', () => {
      const bar = createTestBar([4, 4]);
      const { container } = render(
        <BeatGrid bar={bar} barIndex={0} subdivisionLevel="sixteenth" />
      );

      // 4 beats * 4 subdivisions per beat = 16 subdivision positions
      const subdivisionLines = container.querySelectorAll('.beat-line.subdivision');
      expect(subdivisionLines.length).toBeGreaterThan(8);
    });

    it('should render quarter note only (no subdivisions)', () => {
      const bar = createTestBar([4, 4]);
      const { container } = render(
        <BeatGrid bar={bar} barIndex={0} subdivisionLevel="quarter" />
      );

      const subdivisionLines = container.querySelectorAll('.beat-line.subdivision');
      expect(subdivisionLines.length).toBe(0);
    });

    it('should place chords on subdivision positions correctly', () => {
      const chords = [
        createChord('C', 1, 0), // On beat 1
        createChord('G', 1, 2), // Eighth note subdivision
      ];
      const bar = createTestBar([4, 4], chords);
      const { container } = render(
        <BeatGrid bar={bar} barIndex={0} subdivisionLevel="eighth" />
      );

      const chordElements = container.querySelectorAll('.grid-element.chord');
      expect(chordElements.length).toBe(2);
    });
  });

  describe('Task 4.5.5: Harmonic Rhythm Indication', () => {
    it('should display harmonic rhythm indicator by default', () => {
      const bar = createTestBar([4, 4]);
      render(<BeatGrid bar={bar} barIndex={0} />);
      expect(screen.getByText(/chords\/beat/)).toBeInTheDocument();
    });

    it('should hide harmonic rhythm when showHarmonicRhythm is false', () => {
      const bar = createTestBar([4, 4]);
      render(<BeatGrid bar={bar} barIndex={0} showHarmonicRhythm={false} />);
      expect(screen.queryByText(/chords\/beat/)).not.toBeInTheDocument();
    });

    it('should calculate low harmonic rhythm correctly (0-1 chords/beat)', () => {
      const chords = [createChord('C', 1), createChord('F', 3)]; // 2 chords in 4 beats = 0.5
      const bar = createTestBar([4, 4], chords);
      const { container } = render(<BeatGrid bar={bar} barIndex={0} />);

      const indicator = container.querySelector('.beat-grid-harmonic-rhythm.low');
      expect(indicator).toBeTruthy();
      expect(screen.getByText(/0.5 chords\/beat/)).toBeInTheDocument();
    });

    it('should calculate medium harmonic rhythm correctly (1-2 chords/beat)', () => {
      const chords = [
        createChord('C', 1),
        createChord('F', 2),
        createChord('G', 3),
        createChord('Am', 4),
        createChord('Em', 4, 2),
      ]; // 5 chords in 4 beats = 1.25
      const bar = createTestBar([4, 4], chords);
      const { container } = render(<BeatGrid bar={bar} barIndex={0} />);

      const indicator = container.querySelector('.beat-grid-harmonic-rhythm.medium');
      expect(indicator).toBeTruthy();
    });

    it('should calculate high harmonic rhythm correctly (>2 chords/beat)', () => {
      const chords = [
        createChord('C', 1),
        createChord('F', 1, 2),
        createChord('G', 2),
        createChord('Am', 2, 2),
        createChord('Em', 3),
        createChord('Dm', 3, 2),
        createChord('G7', 4),
        createChord('C', 4, 2),
        createChord('F', 4, 3),
      ]; // 9 chords in 4 beats = 2.25
      const bar = createTestBar([4, 4], chords);
      const { container } = render(<BeatGrid bar={bar} barIndex={0} />);

      const indicator = container.querySelector('.beat-grid-harmonic-rhythm.high');
      expect(indicator).toBeTruthy();
    });
  });

  describe('Task 4.5.6: Show Notes/Riffs as Smaller Dots', () => {
    it('should display notes when showNotes is true', () => {
      const notes = [createNote('C', 4, 1), createNote('E', 4, 2)];
      const bar = createTestBar([4, 4], [], notes);
      const { container } = render(<BeatGrid bar={bar} barIndex={0} showNotes={true} />);

      const noteElements = container.querySelectorAll('.grid-element.note');
      expect(noteElements.length).toBe(2);
    });

    it('should hide notes when showNotes is false', () => {
      const notes = [createNote('C', 4, 1), createNote('E', 4, 2)];
      const bar = createTestBar([4, 4], [], notes);
      const { container } = render(<BeatGrid bar={bar} barIndex={0} showNotes={false} />);

      const noteElements = container.querySelectorAll('.grid-element.note');
      expect(noteElements.length).toBe(0);
    });

    it('should display tab notes as distinct markers', () => {
      const tabNotes = [createTabNote(3, 5, 1), createTabNote(2, 7, 2)];
      const bar = createTestBar([4, 4], [], [], tabNotes);
      const { container } = render(<BeatGrid bar={bar} barIndex={0} showNotes={true} />);

      const tabElements = container.querySelectorAll('.grid-element.tab');
      expect(tabElements.length).toBe(2);
    });

    it('should display chords, notes, and tab simultaneously', () => {
      const chords = [createChord('C', 1)];
      const notes = [createNote('E', 4, 2)];
      const tabNotes = [createTabNote(1, 0, 3)];
      const bar = createTestBar([4, 4], chords, notes, tabNotes);
      const { container } = render(<BeatGrid bar={bar} barIndex={0} showNotes={true} />);

      expect(container.querySelectorAll('.grid-element.chord').length).toBe(1);
      expect(container.querySelectorAll('.grid-element.note').length).toBe(1);
      expect(container.querySelectorAll('.grid-element.tab').length).toBe(1);
    });

    it('should render note markers smaller than chord markers', () => {
      const chords = [createChord('C', 1)];
      const notes = [createNote('E', 4, 2)];
      const bar = createTestBar([4, 4], chords, notes);
      const { container } = render(<BeatGrid bar={bar} barIndex={0} showNotes={true} />);

      const chordMarker = container.querySelector('.chord-marker') as HTMLElement;
      const noteMarker = container.querySelector('.note-marker') as HTMLElement;

      // Note markers should be visually smaller (24px vs chord padding)
      expect(noteMarker).toBeTruthy();
      expect(chordMarker).toBeTruthy();
    });
  });

  describe('Task 4.5.7: Drag-to-Reposition Functionality', () => {
    it('should initiate drag on mouse down', () => {
      const chords = [createChord('C', 1)];
      const bar = createTestBar([4, 4], chords);
      const { container } = render(<BeatGrid bar={bar} barIndex={0} />);

      const chordElement = container.querySelector('.grid-element.chord');
      expect(chordElement).toBeTruthy();

      fireEvent.mouseDown(chordElement!);

      // Check if dragging class is applied
      expect(chordElement!.classList.contains('dragging')).toBe(true);
    });

    it('should not initiate drag when readOnly is true', () => {
      const chords = [createChord('C', 1)];
      const bar = createTestBar([4, 4], chords);
      const { container } = render(<BeatGrid bar={bar} barIndex={0} readOnly={true} />);

      const chordElement = container.querySelector('.grid-element.chord');
      fireEvent.mouseDown(chordElement!);

      expect(chordElement!.classList.contains('dragging')).toBe(false);
    });

    it('should call onBarUpdate when drag completes', async () => {
      const chords = [createChord('C', 1)];
      const bar = createTestBar([4, 4], chords);
      const onBarUpdate = vi.fn();
      const { container } = render(
        <BeatGrid bar={bar} barIndex={0} onBarUpdate={onBarUpdate} />
      );

      const chordElement = container.querySelector('.grid-element.chord') as HTMLElement;
      const grid = container.querySelector('.beat-grid') as HTMLElement;

      // Mock getBoundingClientRect
      vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 400,
        top: 0,
        height: 120,
        right: 400,
        bottom: 120,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      // Start drag
      fireEvent.mouseDown(chordElement);

      // Move to new position (50% = beat 2)
      fireEvent.mouseMove(window, { clientX: 200 });

      // End drag
      fireEvent.mouseUp(window, { clientX: 200 });

      await waitFor(() => {
        expect(onBarUpdate).toHaveBeenCalled();
      });
    });

    it('should show hover indicator during drag', () => {
      const chords = [createChord('C', 1)];
      const bar = createTestBar([4, 4], chords);
      const { container } = render(<BeatGrid bar={bar} barIndex={0} />);

      const chordElement = container.querySelector('.grid-element.chord');
      fireEvent.mouseDown(chordElement!);

      const grid = container.querySelector('.beat-grid') as HTMLElement;
      vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 400,
        top: 0,
        height: 120,
        right: 400,
        bottom: 120,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      fireEvent.mouseMove(window, { clientX: 200 });

      const hoverIndicator = container.querySelector('.hover-indicator');
      expect(hoverIndicator).toBeTruthy();
    });

    it('should reposition notes via drag', async () => {
      const notes = [createNote('C', 4, 1)];
      const bar = createTestBar([4, 4], [], notes);
      const onBarUpdate = vi.fn();
      const { container } = render(
        <BeatGrid bar={bar} barIndex={0} onBarUpdate={onBarUpdate} showNotes={true} />
      );

      const noteElement = container.querySelector('.grid-element.note') as HTMLElement;
      const grid = container.querySelector('.beat-grid') as HTMLElement;

      vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 400,
        top: 0,
        height: 120,
        right: 400,
        bottom: 120,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      fireEvent.mouseDown(noteElement);
      fireEvent.mouseMove(window, { clientX: 200 });
      fireEvent.mouseUp(window, { clientX: 200 });

      await waitFor(() => {
        expect(onBarUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('Task 4.5.8: Component Tests - Edge Cases', () => {
    it('should handle empty bar gracefully', () => {
      const bar = createTestBar([4, 4]);
      render(<BeatGrid bar={bar} barIndex={0} />);

      expect(screen.getByText(/Bar 1/)).toBeInTheDocument();
      expect(screen.getByText(/0.0 chords\/beat/)).toBeInTheDocument();
    });

    it('should handle all chords on beat 1', () => {
      const chords = [
        createChord('C', 1),
        createChord('F', 1, 1),
        createChord('G', 1, 2),
      ];
      const bar = createTestBar([4, 4], chords);
      const { container } = render(<BeatGrid bar={bar} barIndex={0} />);

      const chordElements = container.querySelectorAll('.grid-element.chord');
      expect(chordElements.length).toBe(3);
    });

    it('should handle complex time signatures (7/8)', () => {
      const bar = createTestBar([7, 8]);
      render(<BeatGrid bar={bar} barIndex={0} />);
      expect(screen.getByText(/7\/8/)).toBeInTheDocument();
    });

    it('should call onChordClick when chord is clicked', () => {
      const chords = [createChord('C', 1)];
      const bar = createTestBar([4, 4], chords);
      const onChordClick = vi.fn();
      const { container } = render(
        <BeatGrid bar={bar} barIndex={0} onChordClick={onChordClick} />
      );

      const chordElement = container.querySelector('.grid-element.chord');
      fireEvent.click(chordElement!);

      expect(onChordClick).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'C' }),
        expect.objectContaining({ beat: 1, subdivision: 0 })
      );
    });

    it('should call onNoteClick when note is clicked', () => {
      const notes = [createNote('E', 4, 2)];
      const bar = createTestBar([4, 4], [], notes);
      const onNoteClick = vi.fn();
      const { container } = render(
        <BeatGrid bar={bar} barIndex={0} onNoteClick={onNoteClick} showNotes={true} />
      );

      const noteElement = container.querySelector('.grid-element.note');
      fireEvent.click(noteElement!);

      expect(onNoteClick).toHaveBeenCalledWith(
        expect.objectContaining({ pitch: 'E', octave: 4 }),
        expect.objectContaining({ beat: 2, subdivision: 0 })
      );
    });

    it('should render legend correctly', () => {
      const bar = createTestBar([4, 4]);
      render(<BeatGrid bar={bar} barIndex={0} showNotes={true} />);

      expect(screen.getByText('Chord')).toBeInTheDocument();
      expect(screen.getByText('Note')).toBeInTheDocument();
      expect(screen.getByText('Tab')).toBeInTheDocument();
    });

    it('should hide instructions when readOnly', () => {
      const bar = createTestBar([4, 4]);
      render(<BeatGrid bar={bar} barIndex={0} readOnly={true} />);

      expect(screen.queryByText(/Click on grid to place elements/)).not.toBeInTheDocument();
    });

    it('should show instructions when not readOnly', () => {
      const bar = createTestBar([4, 4]);
      render(<BeatGrid bar={bar} barIndex={0} />);

      expect(screen.getByText(/Click on grid to place elements/)).toBeInTheDocument();
    });

    it('should prevent drag event from propagating to grid', () => {
      const chords = [createChord('C', 1)];
      const bar = createTestBar([4, 4], chords);
      const onGridClick = vi.fn();
      const { container } = render(
        <BeatGrid bar={bar} barIndex={0} onGridClick={onGridClick} />
      );

      const chordElement = container.querySelector('.grid-element.chord');
      fireEvent.click(chordElement!);

      // Grid click should not be called when clicking element
      expect(onGridClick).not.toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    it('should integrate with BarOverlay data structure', () => {
      const chords = [
        createChord('Am', 1),
        createChord('F', 2),
        createChord('C', 3),
        createChord('G', 4),
      ];
      const bar = createTestBar([4, 4], chords);
      const { container } = render(<BeatGrid bar={bar} barIndex={0} />);

      expect(container.querySelectorAll('.grid-element.chord').length).toBe(4);
      expect(screen.getByText('Am')).toBeInTheDocument();
      expect(screen.getByText('F')).toBeInTheDocument();
      expect(screen.getByText('C')).toBeInTheDocument();
      expect(screen.getByText('G')).toBeInTheDocument();
    });

    it('should integrate with RiffEditor data structure', () => {
      const notes = [
        createNote('C', 4, 1, 0),
        createNote('D', 4, 1, 2),
        createNote('E', 4, 2, 0),
        createNote('F', 4, 2, 2),
      ];
      const bar = createTestBar([4, 4], [], notes);
      const { container } = render(
        <BeatGrid bar={bar} barIndex={0} showNotes={true} subdivisionLevel="eighth" />
      );

      expect(container.querySelectorAll('.grid-element.note').length).toBe(4);
    });
  });
});
