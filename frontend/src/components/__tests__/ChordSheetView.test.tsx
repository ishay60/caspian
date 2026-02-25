import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChordSheetView } from '../ChordSheetView';
import type { Section, ChordAnalysis, BarAnalysis } from '../../types';

function makeChord(symbol: string): ChordAnalysis {
  const root = symbol.replace(/[^A-G#b].*/, '');
  return {
    symbol,
    root_name: root,
    root: 0,
    quality: '',
    bass_name: root,
    bass: 0,
    pitches: [],
    is_inverted: false,
    roman_numeral: 'i',
    is_diatonic: true,
    diatonic_in_scales: [],
    interpretations: [],
    bass_motion_from_previous: null,
    common_tones_with_previous: [],
    common_tones_with_next: [],
    deceptive_resolution: null,
    secondary_dominant: null,
  };
}

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    name: 'Verse',
    chords: [],
    bass_line: [],
    chromatic_runs: [],
    patterns: [],
    lines: [],
    bars: [],
    ...overrides,
  };
}

function makeBar(chords: string[], index = 0): BarAnalysis {
  return {
    bar_index: index,
    chord_analyses: chords.map(makeChord),
    harmonic_rhythm: chords.length <= 1 ? 'static' : 'per-beat',
    has_riff: false,
  };
}

describe('ChordSheetView', () => {
  describe('empty state', () => {
    it('shows "Create Bars" button when section has chords but no bars', () => {
      const section = makeSection({
        chords: [makeChord('Am'), makeChord('C')],
        bars: [],
      });
      render(<ChordSheetView section={section} onSectionUpdate={vi.fn()} />);
      expect(screen.getByText(/Create Bars/)).toBeInTheDocument();
      expect(screen.getByText(/2 chords/)).toBeInTheDocument();
    });

    it('shows "No chords" message when section is completely empty', () => {
      const section = makeSection({ chords: [], bars: [] });
      render(<ChordSheetView section={section} />);
      expect(screen.getByText('No chords in this section')).toBeInTheDocument();
    });

    it('auto-creates bars on "Create Bars" click', () => {
      const onUpdate = vi.fn();
      const section = makeSection({
        chords: [makeChord('Am'), makeChord('Dm')],
        bars: [],
      });
      render(<ChordSheetView section={section} onSectionUpdate={onUpdate} />);
      fireEvent.click(screen.getByText(/Create Bars/));
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          bars: expect.arrayContaining([
            expect.objectContaining({
              chord_analyses: [expect.objectContaining({ symbol: 'Am' })],
            }),
            expect.objectContaining({
              chord_analyses: [expect.objectContaining({ symbol: 'Dm' })],
            }),
          ]),
        }),
      );
    });
  });

  describe('with bar data', () => {
    it('renders section name and bar count', () => {
      const section = makeSection({
        name: 'Chorus',
        bars: [makeBar(['Am'], 0), makeBar(['G'], 1)],
      });
      render(<ChordSheetView section={section} />);
      expect(screen.getByText('Chorus')).toBeInTheDocument();
      expect(screen.getByText('2 bars')).toBeInTheDocument();
    });

    it('renders all bars', () => {
      const section = makeSection({
        bars: [makeBar(['Am'], 0), makeBar(['C'], 1), makeBar(['F'], 2)],
      });
      render(<ChordSheetView section={section} />);
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('C')).toBeInTheDocument();
      expect(screen.getByText('F')).toBeInTheDocument();
    });

    it('shows edit button when onSectionUpdate is provided', () => {
      const section = makeSection({
        bars: [makeBar(['Am'], 0)],
      });
      render(<ChordSheetView section={section} onSectionUpdate={vi.fn()} />);
      expect(screen.getByTitle('Edit bars')).toBeInTheDocument();
    });

    it('does not show edit button when no onSectionUpdate', () => {
      const section = makeSection({
        bars: [makeBar(['Am'], 0)],
      });
      render(<ChordSheetView section={section} />);
      expect(screen.queryByTitle('Edit bars')).not.toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('toggles edit mode on pencil click', () => {
      const section = makeSection({
        bars: [makeBar(['Am'], 0)],
      });
      render(<ChordSheetView section={section} onSectionUpdate={vi.fn()} />);
      // Initially no add-chord buttons
      expect(screen.queryByTitle('Add chord')).not.toBeInTheDocument();
      // Click edit
      fireEvent.click(screen.getByTitle('Edit bars'));
      // Now add-chord button should appear
      expect(screen.getByTitle('Add chord')).toBeInTheDocument();
      // Shows "Add new bar" button
      expect(screen.getByTitle('Add new bar')).toBeInTheDocument();
    });

    it('adds a new empty bar on + click', () => {
      const onUpdate = vi.fn();
      const section = makeSection({
        bars: [makeBar(['Am'], 0)],
      });
      render(<ChordSheetView section={section} onSectionUpdate={onUpdate} />);
      fireEvent.click(screen.getByTitle('Edit bars'));
      fireEvent.click(screen.getByTitle('Add new bar'));
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          bars: expect.arrayContaining([
            expect.objectContaining({ bar_index: 0 }),
            expect.objectContaining({ bar_index: 1, chord_analyses: [] }),
          ]),
        }),
      );
    });
  });
});
