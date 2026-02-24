/**
 * Tests for LyricsChordEditor component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LyricsChordEditor } from './LyricsChordEditor';
import * as api from '../api';

// Mock the API module
vi.mock('../api', () => ({
  getChordCompletions: vi.fn(),
}));

describe('LyricsChordEditor', () => {
  describe('Input Mode', () => {
    it('renders lyrics input textarea', () => {
      render(<LyricsChordEditor />);

      expect(screen.getByText('Paste Your Lyrics')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Paste or type your lyrics/i)).toBeInTheDocument();
    });

    it('enables next button when lyrics are entered', () => {
      render(<LyricsChordEditor />);

      const textarea = screen.getByPlaceholderText(/Paste or type your lyrics/i);
      const nextButton = screen.getByText('Next: Add Chords');

      // Initially disabled
      expect(nextButton).toBeDisabled();

      // Enter lyrics
      fireEvent.change(textarea, { target: { value: 'Test lyrics line 1\nTest lyrics line 2' } });

      // Button should be enabled
      expect(nextButton).not.toBeDisabled();
    });

    it('switches to edit mode when next button clicked', () => {
      render(<LyricsChordEditor />);

      const textarea = screen.getByPlaceholderText(/Paste or type your lyrics/i);
      fireEvent.change(textarea, { target: { value: 'Test lyrics' } });

      const nextButton = screen.getByText('Next: Add Chords');
      fireEvent.click(nextButton);

      // Should show edit mode
      expect(screen.getByText('Add Chords')).toBeInTheDocument();
      expect(screen.getByText(/Click on any position/i)).toBeInTheDocument();
    });

    it('handles RTL text with dir=auto', () => {
      render(<LyricsChordEditor />);

      const textarea = screen.getByPlaceholderText(/Paste or type your lyrics/i);
      expect(textarea).toHaveAttribute('dir', 'auto');
    });
  });

  describe('Edit Mode', () => {
    it('displays lyrics line by line', () => {
      render(<LyricsChordEditor initialLyrics="Line 1\nLine 2\nLine 3" />);

      // Submit to enter edit mode
      const nextButton = screen.getByText('Next: Add Chords');
      fireEvent.click(nextButton);

      // Should display all lines
      expect(screen.getByText('Line 1')).toBeInTheDocument();
      expect(screen.getByText('Line 2')).toBeInTheDocument();
      expect(screen.getByText('Line 3')).toBeInTheDocument();
    });

    it('shows line numbers', () => {
      render(<LyricsChordEditor initialLyrics="Line 1\nLine 2" />);

      fireEvent.click(screen.getByText('Next: Add Chords'));

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('displays section marker toolbar', () => {
      render(<LyricsChordEditor initialLyrics="Line 1" />);

      fireEvent.click(screen.getByText('Next: Add Chords'));

      expect(screen.getByText('+ Verse')).toBeInTheDocument();
      expect(screen.getByText('+ Chorus')).toBeInTheDocument();
      expect(screen.getByText('+ Bridge')).toBeInTheDocument();
      expect(screen.getByText('+ Intro')).toBeInTheDocument();
      expect(screen.getByText('+ Outro')).toBeInTheDocument();
    });

    it('allows adding section markers', () => {
      render(<LyricsChordEditor initialLyrics="Line 1\nLine 2" />);

      fireEvent.click(screen.getByText('Next: Add Chords'));

      // Add a verse marker
      fireEvent.click(screen.getByText('+ Verse'));

      // Should display the section marker
      expect(screen.getByText('Verse')).toBeInTheDocument();
    });

    it('allows removing section markers', () => {
      render(<LyricsChordEditor initialLyrics="Line 1\nLine 2" />);

      fireEvent.click(screen.getByText('Next: Add Chords'));

      // Add a chorus marker
      fireEvent.click(screen.getByText('+ Chorus'));
      expect(screen.getByText('Chorus')).toBeInTheDocument();

      // Remove it
      const removeButton = screen.getByTitle('Remove section marker');
      fireEvent.click(removeButton);

      // Should be gone
      expect(screen.queryByText('Chorus')).not.toBeInTheDocument();
    });

    it('disables preview button when no chords placed', () => {
      render(<LyricsChordEditor initialLyrics="Line 1" />);

      fireEvent.click(screen.getByText('Next: Add Chords'));

      const previewButton = screen.getByText('Preview');
      expect(previewButton).toBeDisabled();
    });

    it('allows navigating back to input mode', () => {
      render(<LyricsChordEditor initialLyrics="Line 1" />);

      fireEvent.click(screen.getByText('Next: Add Chords'));

      const backButton = screen.getByText('← Back to Lyrics');
      fireEvent.click(backButton);

      // Should return to input mode
      expect(screen.getByText('Paste Your Lyrics')).toBeInTheDocument();
    });
  });

  describe('Chord Placement', () => {
    it('opens chord input popup when character clicked', () => {
      render(<LyricsChordEditor initialLyrics="Test" />);

      fireEvent.click(screen.getByText('Next: Add Chords'));

      // Click on first character
      const chars = screen.getAllByText('T');
      fireEvent.click(chars[0]);

      // Should show chord input
      expect(screen.getByPlaceholderText(/Type chord/i)).toBeInTheDocument();
    });

    it('closes popup on Escape key', () => {
      render(<LyricsChordEditor initialLyrics="Test" />);

      fireEvent.click(screen.getByText('Next: Add Chords'));

      // Open popup
      const chars = screen.getAllByText('T');
      fireEvent.click(chars[0]);

      const input = screen.getByPlaceholderText(/Type chord/i);

      // Press Escape
      fireEvent.keyDown(input, { key: 'Escape' });

      // Popup should be closed
      expect(screen.queryByPlaceholderText(/Type chord/i)).not.toBeInTheDocument();
    });

    it('places chord on Enter key', async () => {
      render(<LyricsChordEditor initialLyrics="Test" />);

      fireEvent.click(screen.getByText('Next: Add Chords'));

      // Click on first character
      const chars = screen.getAllByText('T');
      fireEvent.click(chars[0]);

      const input = screen.getByPlaceholderText(/Type chord/i);
      fireEvent.change(input, { target: { value: 'Am' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should place chord and close popup
      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/Type chord/i)).not.toBeInTheDocument();
      });

      // Chord should be displayed
      expect(screen.getByText('Am')).toBeInTheDocument();
    });

    it('fetches chord completions from API', async () => {
      const mockCompletions = ['Am', 'Am7', 'Amaj7'];
      vi.mocked(api.getChordCompletions).mockResolvedValue(mockCompletions);

      render(<LyricsChordEditor initialLyrics="Test" keyRootName="C" keyMode="major" />);

      fireEvent.click(screen.getByText('Next: Add Chords'));

      // Click on character
      const chars = screen.getAllByText('T');
      fireEvent.click(chars[0]);

      const input = screen.getByPlaceholderText(/Type chord/i);
      fireEvent.change(input, { target: { value: 'A' } });

      // Wait for debounced API call
      await waitFor(() => {
        expect(api.getChordCompletions).toHaveBeenCalledWith(
          'A',
          'C',
          'major',
          undefined,
          undefined,
          20
        );
      }, { timeout: 500 });
    });

    it('allows removing placed chords', async () => {
      render(<LyricsChordEditor initialLyrics="Test" />);

      fireEvent.click(screen.getByText('Next: Add Chords'));

      // Place a chord
      const chars = screen.getAllByText('T');
      fireEvent.click(chars[0]);

      const input = screen.getByPlaceholderText(/Type chord/i);
      fireEvent.change(input, { target: { value: 'C' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('C')).toBeInTheDocument();
      });

      // Remove the chord
      const removeButton = screen.getByTitle('Remove chord');
      fireEvent.click(removeButton);

      // Chord should be gone
      expect(screen.queryByText('C')).not.toBeInTheDocument();
    });
  });

  describe('Preview Mode', () => {
    it('shows preview when preview button clicked', async () => {
      render(<LyricsChordEditor initialLyrics="Test lyrics" />);

      fireEvent.click(screen.getByText('Next: Add Chords'));

      // Place a chord
      const chars = screen.getAllByText('T');
      fireEvent.click(chars[0]);

      const input = screen.getByPlaceholderText(/Type chord/i);
      fireEvent.change(input, { target: { value: 'G' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('G')).toBeInTheDocument();
      });

      // Click preview
      const previewButton = screen.getByText('Preview');
      fireEvent.click(previewButton);

      // Should show preview mode
      expect(screen.getByText('← Back to Edit')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('displays chords above lyrics in preview', async () => {
      render(<LyricsChordEditor initialLyrics="Test" />);

      fireEvent.click(screen.getByText('Next: Add Chords'));

      // Place chord at position 0
      const chars = screen.getAllByText('T');
      fireEvent.click(chars[0]);

      const input = screen.getByPlaceholderText(/Type chord/i);
      fireEvent.change(input, { target: { value: 'D' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('D')).toBeInTheDocument();
      });

      // Go to preview
      fireEvent.click(screen.getByText('Preview'));

      // Should still show chord and lyrics
      expect(screen.getByText('D')).toBeInTheDocument();
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('allows navigating back to edit mode', async () => {
      render(<LyricsChordEditor initialLyrics="Test" />);

      fireEvent.click(screen.getByText('Next: Add Chords'));

      // Place a chord
      const chars = screen.getAllByText('T');
      fireEvent.click(chars[0]);

      const input = screen.getByPlaceholderText(/Type chord/i);
      fireEvent.change(input, { target: { value: 'E' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('E')).toBeInTheDocument();
      });

      // Go to preview
      fireEvent.click(screen.getByText('Preview'));

      // Go back to edit
      const backButton = screen.getByText('← Back to Edit');
      fireEvent.click(backButton);

      // Should return to edit mode
      expect(screen.getByText('Add Chords')).toBeInTheDocument();
    });

    it('calls onComplete when done button clicked in preview', async () => {
      const onComplete = vi.fn();
      render(<LyricsChordEditor initialLyrics="Test" onComplete={onComplete} />);

      fireEvent.click(screen.getByText('Next: Add Chords'));

      // Place a chord
      const chars = screen.getAllByText('T');
      fireEvent.click(chars[0]);

      const input = screen.getByPlaceholderText(/Type chord/i);
      fireEvent.change(input, { target: { value: 'F' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('F')).toBeInTheDocument();
      });

      // Go to preview
      fireEvent.click(screen.getByText('Preview'));

      // Click done
      const doneButton = screen.getByText('Done');
      fireEvent.click(doneButton);

      // Should call onComplete with sections
      expect(onComplete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            lines: expect.any(Array),
          }),
        ])
      );
    });
  });

  describe('RTL Support', () => {
    it('detects Hebrew text as RTL', () => {
      render(<LyricsChordEditor initialLyrics="שלום עולם" />);

      fireEvent.click(screen.getByText('Next: Add Chords'));

      const hebrewLine = screen.getByText('שלום עולם');
      expect(hebrewLine.closest('.lyrics-line')).toHaveAttribute('dir', 'rtl');
    });

    it('keeps English text as LTR', () => {
      render(<LyricsChordEditor initialLyrics="Hello world" />);

      fireEvent.click(screen.getByText('Next: Add Chords'));

      const englishLine = screen.getByText('Hello world');
      expect(englishLine.closest('.lyrics-line')).toHaveAttribute('dir', 'ltr');
    });
  });

  describe('Integration', () => {
    it('supports full workflow: input → edit → place chords → add sections → preview', async () => {
      const onComplete = vi.fn();
      render(<LyricsChordEditor onComplete={onComplete} />);

      // 1. Input lyrics
      const textarea = screen.getByPlaceholderText(/Paste or type your lyrics/i);
      fireEvent.change(textarea, { target: { value: 'Line 1\nLine 2' } });
      fireEvent.click(screen.getByText('Next: Add Chords'));

      // 2. Add section marker
      fireEvent.click(screen.getByText('+ Verse'));
      expect(screen.getByText('Verse')).toBeInTheDocument();

      // 3. Place chords
      const chars = screen.getAllByText('L');
      fireEvent.click(chars[0]);

      let input = screen.getByPlaceholderText(/Type chord/i);
      fireEvent.change(input, { target: { value: 'C' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('C')).toBeInTheDocument();
      });

      // 4. Go to preview
      fireEvent.click(screen.getByText('Preview'));
      expect(screen.getByText('← Back to Edit')).toBeInTheDocument();

      // 5. Complete
      fireEvent.click(screen.getByText('Done'));
      expect(onComplete).toHaveBeenCalled();
    });
  });
});
