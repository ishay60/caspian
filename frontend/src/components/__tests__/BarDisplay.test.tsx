import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BarDisplay } from '../BarDisplay';
import type { BarAnalysis, ChordAnalysis } from '../../types';

function makeChord(symbol: string, rootName?: string): ChordAnalysis {
  const root = rootName ?? symbol.replace(/[^A-G#b].*/, '');
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

function makeBar(chords: string[], index = 0): BarAnalysis {
  return {
    bar_index: index,
    chord_analyses: chords.map((s) => makeChord(s)),
    harmonic_rhythm: chords.length <= 1 ? 'static' : 'per-beat',
    has_riff: false,
  };
}

describe('BarDisplay', () => {
  it('renders chord symbols', () => {
    render(
      <BarDisplay bar={makeBar(['Am', 'G'])} barIndex={0} timeSignature={[4, 4]} />,
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('G')).toBeInTheDocument();
  });

  it('renders beat numbers based on time signature', () => {
    const { container } = render(
      <BarDisplay bar={makeBar(['C'])} barIndex={0} timeSignature={[3, 4]} />,
    );
    const beatNumbers = container.querySelectorAll('.beat-number');
    expect(beatNumbers).toHaveLength(3);
    expect(beatNumbers[0].textContent).toBe('1');
    expect(beatNumbers[1].textContent).toBe('2');
    expect(beatNumbers[2].textContent).toBe('3');
  });

  it('shows bar number', () => {
    const { container } = render(
      <BarDisplay bar={makeBar(['Am'])} barIndex={2} timeSignature={[4, 4]} />,
    );
    const barNumber = container.querySelector('.bar-number');
    expect(barNumber).toBeInTheDocument();
    expect(barNumber?.textContent).toBe('3'); // barIndex 2 → display "3"
  });

  it('shows add-chord button in editable mode', () => {
    render(
      <BarDisplay
        bar={makeBar(['Am'])}
        barIndex={0}
        timeSignature={[4, 4]}
        editable
      />,
    );
    expect(screen.getByTitle('Add chord')).toBeInTheDocument();
  });

  it('does NOT show add-chord button when not editable', () => {
    render(
      <BarDisplay bar={makeBar(['Am'])} barIndex={0} timeSignature={[4, 4]} />,
    );
    expect(screen.queryByTitle('Add chord')).not.toBeInTheDocument();
  });

  it('opens inline input when add-chord is clicked', () => {
    render(
      <BarDisplay
        bar={makeBar(['Am'])}
        barIndex={0}
        timeSignature={[4, 4]}
        editable
      />,
    );
    fireEvent.click(screen.getByTitle('Add chord'));
    expect(screen.getByPlaceholderText('Am7...')).toBeInTheDocument();
  });

  it('calls onAddChord when input is submitted', () => {
    const onAddChord = vi.fn();
    render(
      <BarDisplay
        bar={makeBar(['Am'])}
        barIndex={0}
        timeSignature={[4, 4]}
        editable
        onAddChord={onAddChord}
      />,
    );
    fireEvent.click(screen.getByTitle('Add chord'));
    const input = screen.getByPlaceholderText('Am7...');
    fireEvent.change(input, { target: { value: 'Dm7' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAddChord).toHaveBeenCalledWith(0, 'Dm7');
  });

  it('cancels input on Escape', () => {
    render(
      <BarDisplay
        bar={makeBar(['Am'])}
        barIndex={0}
        timeSignature={[4, 4]}
        editable
      />,
    );
    fireEvent.click(screen.getByTitle('Add chord'));
    const input = screen.getByPlaceholderText('Am7...');
    fireEvent.keyDown(input, { key: 'Escape' });
    // Input should be gone, add button back
    expect(screen.queryByPlaceholderText('Am7...')).not.toBeInTheDocument();
    expect(screen.getByTitle('Add chord')).toBeInTheDocument();
  });

  it('calls onChordSelect when chord is clicked', () => {
    const onChordSelect = vi.fn();
    render(
      <BarDisplay
        bar={makeBar(['Am'])}
        barIndex={0}
        timeSignature={[4, 4]}
        onChordSelect={onChordSelect}
      />,
    );
    fireEvent.click(screen.getByTitle('Am'));
    expect(onChordSelect).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'Am' }),
    );
  });

  it('renders empty bar with just add button in editable mode', () => {
    render(
      <BarDisplay
        bar={makeBar([])}
        barIndex={0}
        timeSignature={[4, 4]}
        editable
      />,
    );
    expect(screen.getByTitle('Add chord')).toBeInTheDocument();
  });

  it('renders chord quality correctly', () => {
    const bar = makeBar(['Am7']);
    render(
      <BarDisplay bar={bar} barIndex={0} timeSignature={[4, 4]} />,
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('m7')).toBeInTheDocument();
  });
});
