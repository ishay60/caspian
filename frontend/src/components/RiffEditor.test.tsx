/**
 * RiffEditor Component Tests
 *
 * Comprehensive test suite for the RiffEditor component.
 * Tests all major functionality including:
 * - Beat range selection
 * - Note entry (both notation and tab)
 * - Quick-type mode
 * - Auto-spacing
 * - View switching
 * - Riff label input
 * - Note editing and deletion
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RiffEditor } from './RiffEditor';
import type { BarContent } from '../types';

describe('RiffEditor', () => {
  const mockTimeSignature: [number, number] = [4, 4];
  const mockBarIndex = 0;

  describe('Component Initialization', () => {
    it('renders the component with header', () => {
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
        />
      );

      expect(screen.getByText(/Edit Riff - Bar 1/i)).toBeInTheDocument();
    });

    it('renders riff label input', () => {
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
        />
      );

      const labelInput = screen.getByLabelText(/Riff Label:/i);
      expect(labelInput).toBeInTheDocument();
      expect(labelInput).toHaveAttribute('placeholder');
    });

    it('renders view switcher with notation and tab options', () => {
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
        />
      );

      expect(screen.getByText('Standard Notation')).toBeInTheDocument();
      expect(screen.getByText('Guitar Tab')).toBeInTheDocument();
    });

    it('renders beat range selector initially', () => {
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
        />
      );

      expect(screen.getByText(/Select Beat Range for Riff/i)).toBeInTheDocument();
    });
  });

  describe('Beat Range Selection', () => {
    it('allows selecting start beat', () => {
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
        />
      );

      const beat1Button = screen.getByRole('button', { name: /Beat 1/i });
      fireEvent.click(beat1Button);

      expect(beat1Button).toHaveClass('selected');
    });

    it('allows completing range by selecting end beat', async () => {
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
        />
      );

      const beat1 = screen.getByRole('button', { name: /Beat 1/i });
      const beat4 = screen.getByRole('button', { name: /Beat 4/i });

      fireEvent.click(beat1);
      fireEvent.click(beat4);

      await waitFor(() => {
        expect(screen.getByText(/Range selected: Beat 1 to 4/i)).toBeInTheDocument();
      });
    });

    it('shows subdivisions when checkbox is enabled', () => {
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
        />
      );

      const subdivisionToggle = screen.getByLabelText(/Show subdivisions/i);
      fireEvent.click(subdivisionToggle);

      expect(screen.getByText(/&/)).toBeInTheDocument();
      expect(screen.getByText(/e/)).toBeInTheDocument();
      expect(screen.getByText(/a/)).toBeInTheDocument();
    });

    it('allows resetting range', async () => {
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
        />
      );

      const beat1 = screen.getByRole('button', { name: /Beat 1/i });
      const beat2 = screen.getByRole('button', { name: /Beat 2/i });

      fireEvent.click(beat1);
      fireEvent.click(beat2);

      await waitFor(() => {
        const resetButton = screen.getByText(/Reset Range/i);
        expect(resetButton).toBeInTheDocument();
        fireEvent.click(resetButton);
      });

      expect(screen.queryByText(/Range selected/i)).not.toBeInTheDocument();
    });
  });

  describe('View Switching', () => {
    it('switches from notation to tab view', () => {
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
        />
      );

      const tabButton = screen.getByText('Guitar Tab');
      fireEvent.click(tabButton);

      expect(tabButton).toHaveClass('active');
    });

    it('switches from tab to notation view', () => {
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
        />
      );

      const tabButton = screen.getByText('Guitar Tab');
      const notationButton = screen.getByText('Standard Notation');

      fireEvent.click(tabButton);
      fireEvent.click(notationButton);

      expect(notationButton).toHaveClass('active');
    });
  });

  describe('Riff Label Input', () => {
    it('allows entering riff label', async () => {
      const user = userEvent.setup();
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
        />
      );

      const labelInput = screen.getByPlaceholderText(/Intro Riff/i);
      await user.type(labelInput, 'Solo Section');

      expect(labelInput).toHaveValue('Solo Section');
    });
  });

  describe('Editing Mode Selection', () => {
    beforeEach(() => {
      // Select a beat range first to enable editing modes
      const { container } = render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
        />
      );

      const beat1 = screen.getByRole('button', { name: /Beat 1/i });
      const beat4 = screen.getByRole('button', { name: /Beat 4/i });
      fireEvent.click(beat1);
      fireEvent.click(beat4);
    });

    it('shows editing mode selector after range selection', async () => {
      await waitFor(() => {
        expect(screen.getByText('Grid Entry')).toBeInTheDocument();
        expect(screen.getByText('Quick Type')).toBeInTheDocument();
      });
    });

    it('switches to quick type mode', async () => {
      await waitFor(() => {
        const quickTypeButton = screen.getByText('Quick Type');
        fireEvent.click(quickTypeButton);
        expect(screen.getByText(/Quick Type Mode/i)).toBeInTheDocument();
      });
    });
  });

  describe('Notation Grid Entry', () => {
    beforeEach(async () => {
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
        />
      );

      // Select range
      const beat1 = screen.getByRole('button', { name: /Beat 1/i });
      const beat4 = screen.getByRole('button', { name: /Beat 4/i });
      fireEvent.click(beat1);
      fireEvent.click(beat4);

      await waitFor(() => {
        expect(screen.getByText('Grid Entry')).toBeInTheDocument();
      });
    });

    it('displays pitch and octave selectors', () => {
      expect(screen.getByLabelText(/Pitch:/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Octave:/i)).toBeInTheDocument();
    });

    it('shows current selection', () => {
      expect(screen.getByText(/Current selection:/i)).toBeInTheDocument();
      expect(screen.getByText(/C4/)).toBeInTheDocument();
    });

    it('changes selected pitch', async () => {
      const pitchSelect = screen.getByLabelText(/Pitch:/i);
      fireEvent.change(pitchSelect, { target: { value: 'D' } });

      await waitFor(() => {
        expect(screen.getByText(/D4/)).toBeInTheDocument();
      });
    });

    it('changes selected octave', async () => {
      const octaveSelect = screen.getByLabelText(/Octave:/i);
      fireEvent.change(octaveSelect, { target: { value: '5' } });

      await waitFor(() => {
        expect(screen.getByText(/C5/)).toBeInTheDocument();
      });
    });
  });

  describe('Tab Grid Entry', () => {
    beforeEach(async () => {
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
        />
      );

      // Switch to tab view
      const tabButton = screen.getByText('Guitar Tab');
      fireEvent.click(tabButton);

      // Select range
      const beat1 = screen.getByRole('button', { name: /Beat 1/i });
      const beat4 = screen.getByRole('button', { name: /Beat 4/i });
      fireEvent.click(beat1);
      fireEvent.click(beat4);

      await waitFor(() => {
        expect(screen.getByText('Grid Entry')).toBeInTheDocument();
      });
    });

    it('displays string and fret selectors', () => {
      expect(screen.getByLabelText(/String:/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Fret:/i)).toBeInTheDocument();
    });

    it('shows guitar tab preview', () => {
      expect(screen.getByText(/Guitar Tab Preview/i)).toBeInTheDocument();
    });

    it('changes selected string', async () => {
      const stringSelect = screen.getByLabelText(/String:/i);
      fireEvent.change(stringSelect, { target: { value: '3' } });

      await waitFor(() => {
        expect(screen.getByText(/String 3/)).toBeInTheDocument();
      });
    });

    it('changes selected fret', async () => {
      const fretInput = screen.getByLabelText(/Fret:/i);
      fireEvent.change(fretInput, { target: { value: '5' } });

      await waitFor(() => {
        expect(screen.getByText(/Fret 5/)).toBeInTheDocument();
      });
    });

    it('validates fret range', async () => {
      const fretInput = screen.getByLabelText(/Fret:/i) as HTMLInputElement;
      fireEvent.change(fretInput, { target: { value: '30' } });

      await waitFor(() => {
        expect(fretInput.value).toBe('24'); // Should be clamped to max
      });
    });
  });

  describe('Quick Type Mode', () => {
    beforeEach(async () => {
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
        />
      );

      // Select range
      const beat1 = screen.getByRole('button', { name: /Beat 1/i });
      const beat4 = screen.getByRole('button', { name: /Beat 4/i });
      fireEvent.click(beat1);
      fireEvent.click(beat4);

      await waitFor(() => {
        const quickTypeButton = screen.getByText('Quick Type');
        fireEvent.click(quickTypeButton);
      });
    });

    it('displays quick type input', () => {
      expect(screen.getByPlaceholderText(/C D E F G/i)).toBeInTheDocument();
    });

    it('shows format help', () => {
      expect(screen.getByText(/Format Help:/i)).toBeInTheDocument();
    });

    it('displays parse preview when typing', async () => {
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText(/C D E F G/i);

      await user.type(input, 'C D E');

      await waitFor(() => {
        expect(screen.getByText(/Will add 3 notes/i)).toBeInTheDocument();
      });
    });

    it('disables button when input is empty', () => {
      const addButton = screen.getByText('Add Notes');
      expect(addButton).toBeDisabled();
    });

    it('enables button when input has valid notes', async () => {
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText(/C D E F G/i);

      await user.type(input, 'C D E');

      await waitFor(() => {
        const addButton = screen.getByText('Add Notes');
        expect(addButton).not.toBeDisabled();
      });
    });
  });

  describe('Auto-spacing', () => {
    it('displays auto-space button when notes exist', async () => {
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
        />
      );

      // Select range and add notes via quick type
      const beat1 = screen.getByRole('button', { name: /Beat 1/i });
      const beat4 = screen.getByRole('button', { name: /Beat 4/i });
      fireEvent.click(beat1);
      fireEvent.click(beat4);

      await waitFor(() => {
        const quickTypeButton = screen.getByText('Quick Type');
        fireEvent.click(quickTypeButton);
      });

      const input = screen.getByPlaceholderText(/C D E F G/i);
      await userEvent.type(input, 'C D E F');

      const addButton = screen.getByText('Add Notes');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/Auto-Space Notes/i)).toBeInTheDocument();
      });
    });
  });

  describe('Save and Cancel', () => {
    it('calls onSave when save button is clicked', () => {
      const onSave = jest.fn();
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
          onSave={onSave}
        />
      );

      const saveButton = screen.getByText('Save Riff');
      fireEvent.click(saveButton);

      expect(onSave).toHaveBeenCalled();
    });

    it('calls onCancel when cancel button is clicked', () => {
      const onCancel = jest.fn();
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
          onCancel={onCancel}
        />
      );

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });

    it('exports correct BarContent format on save', async () => {
      let savedContent: BarContent | undefined;
      const onSave = jest.fn((content: BarContent) => {
        savedContent = content;
      });

      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
          onSave={onSave}
        />
      );

      // Select range
      const beat1 = screen.getByRole('button', { name: /Beat 1/i });
      const beat2 = screen.getByRole('button', { name: /Beat 2/i });
      fireEvent.click(beat1);
      fireEvent.click(beat2);

      // Add quick-type notes
      await waitFor(() => {
        const quickTypeButton = screen.getByText('Quick Type');
        fireEvent.click(quickTypeButton);
      });

      const input = screen.getByPlaceholderText(/C D E F G/i);
      await userEvent.type(input, 'C D');

      const addButton = screen.getByText('Add Notes');
      fireEvent.click(addButton);

      // Save
      await waitFor(() => {
        const saveButton = screen.getByText('Save Riff');
        fireEvent.click(saveButton);
      });

      expect(onSave).toHaveBeenCalled();
      expect(savedContent).toBeDefined();
      expect(savedContent?.notes).toBeDefined();
      expect(savedContent?.notes.length).toBeGreaterThan(0);
    });
  });

  describe('Clear All', () => {
    it('shows clear all button when notes exist', async () => {
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
        />
      );

      // Add notes
      const beat1 = screen.getByRole('button', { name: /Beat 1/i });
      const beat4 = screen.getByRole('button', { name: /Beat 4/i });
      fireEvent.click(beat1);
      fireEvent.click(beat4);

      await waitFor(() => {
        const quickTypeButton = screen.getByText('Quick Type');
        fireEvent.click(quickTypeButton);
      });

      const input = screen.getByPlaceholderText(/C D E F G/i);
      await userEvent.type(input, 'C D E');

      const addButton = screen.getByText('Add Notes');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Clear All')).toBeInTheDocument();
      });
    });

    it('clears all notes when clicked', async () => {
      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
        />
      );

      // Add notes
      const beat1 = screen.getByRole('button', { name: /Beat 1/i });
      const beat4 = screen.getByRole('button', { name: /Beat 4/i });
      fireEvent.click(beat1);
      fireEvent.click(beat4);

      await waitFor(() => {
        const quickTypeButton = screen.getByText('Quick Type');
        fireEvent.click(quickTypeButton);
      });

      const input = screen.getByPlaceholderText(/C D E F G/i);
      await userEvent.type(input, 'C D E');

      const addButton = screen.getByText('Add Notes');
      fireEvent.click(addButton);

      await waitFor(() => {
        const clearButton = screen.getByText('Clear All');
        fireEvent.click(clearButton);
      });

      await waitFor(() => {
        expect(screen.queryByText(/Notes \(\d+\)/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading Existing Content', () => {
    it('loads existing notes from bar content', () => {
      const existingContent: BarContent = {
        chords: [],
        notes: [
          {
            pitch: 'C',
            octave: 4,
            beat_position: { beat: 1, subdivision: 0 },
            duration_beats: 0.5,
          },
          {
            pitch: 'D',
            octave: 4,
            beat_position: { beat: 2, subdivision: 0 },
            duration_beats: 0.5,
          },
        ],
        tab: [],
      };

      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
          existingContent={existingContent}
        />
      );

      expect(screen.getByText(/Notes \(2\)/i)).toBeInTheDocument();
    });

    it('loads existing label from bar content', () => {
      const existingContent: BarContent = {
        chords: [],
        notes: [],
        tab: [],
        label: 'Intro Riff',
      };

      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
          existingContent={existingContent}
        />
      );

      const labelInput = screen.getByLabelText(/Riff Label:/i) as HTMLInputElement;
      expect(labelInput.value).toBe('Intro Riff');
    });

    it('switches to tab view when tab notes exist', () => {
      const existingContent: BarContent = {
        chords: [],
        notes: [],
        tab: [
          {
            string: 1,
            fret: 5,
            beat_position: { beat: 1, subdivision: 0 },
            duration_beats: 0.5,
          },
        ],
      };

      render(
        <RiffEditor
          barIndex={mockBarIndex}
          timeSignature={mockTimeSignature}
          existingContent={existingContent}
        />
      );

      const tabButton = screen.getByText('Guitar Tab');
      expect(tabButton).toHaveClass('active');
    });
  });
});
