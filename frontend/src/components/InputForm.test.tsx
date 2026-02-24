/**
 * Component Tests for InputForm with Paste Preview
 *
 * NOTE: This test file is ready to run once a testing framework is configured.
 * Recommended setup: Vitest + React Testing Library
 *
 * To enable tests:
 * 1. Install dependencies:
 *    npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
 * 2. Add vitest.config.ts
 * 3. Add test script to package.json: "test": "vitest"
 * 4. Run: npm test
 */

// Uncomment when testing framework is set up:
// import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// import { vi } from 'vitest';
// import userEvent from '@testing-library/user-event';
// import { InputForm } from './InputForm';
// import * as api from '../api';

// Mock the API module
// vi.mock('../api');

describe('InputForm with Paste Preview', () => {
  describe('Initial State', () => {
    test('renders empty textarea', () => {
      // const onAnalyze = vi.fn();
      // render(<InputForm onAnalyze={onAnalyze} loading={false} sampleInput="sample" />);

      // const textarea = screen.getByRole('textbox');
      // expect(textarea).toBeInTheDocument();
      // expect(textarea).toHaveValue('');
    });

    test('does not show format badge when text is empty', () => {
      // const onAnalyze = vi.fn();
      // render(<InputForm onAnalyze={onAnalyze} loading={false} sampleInput="sample" />);

      // expect(screen.queryByText(/format/i)).not.toBeInTheDocument();
    });

    test('analyze button is disabled when text is empty', () => {
      // const onAnalyze = vi.fn();
      // render(<InputForm onAnalyze={onAnalyze} loading={false} sampleInput="sample" />);

      // const analyzeButton = screen.getByRole('button', { name: /analyze/i });
      // expect(analyzeButton).toBeDisabled();
    });
  });

  describe('Format Detection', () => {
    test('triggers format detection 500ms after typing stops', async () => {
      // vi.useFakeTimers();
      // const onAnalyze = vi.fn();
      // const mockDetectFormat = vi.mocked(api.detectFormat);
      // mockDetectFormat.mockResolvedValue({
      //   format: 'format_a',
      //   confidence: 'high',
      //   preview: { sections: [] },
      // });

      // render(<InputForm onAnalyze={onAnalyze} loading={false} sampleInput="sample" />);

      // const textarea = screen.getByRole('textbox');
      // await userEvent.type(textarea, 'key: Am');

      // // Should not call immediately
      // expect(mockDetectFormat).not.toHaveBeenCalled();

      // // Fast-forward 500ms
      // vi.advanceTimersByTime(500);

      // await waitFor(() => {
      //   expect(mockDetectFormat).toHaveBeenCalledWith('key: Am', undefined);
      // });

      // vi.useRealTimers();
    });

    test('debounces multiple typing events', async () => {
      // vi.useFakeTimers();
      // const onAnalyze = vi.fn();
      // const mockDetectFormat = vi.mocked(api.detectFormat);
      // mockDetectFormat.mockResolvedValue({
      //   format: 'format_a',
      //   confidence: 'high',
      //   preview: { sections: [] },
      // });

      // render(<InputForm onAnalyze={onAnalyze} loading={false} sampleInput="sample" />);

      // const textarea = screen.getByRole('textbox');

      // // Type multiple times
      // await userEvent.type(textarea, 'k');
      // vi.advanceTimersByTime(200);
      // await userEvent.type(textarea, 'e');
      // vi.advanceTimersByTime(200);
      // await userEvent.type(textarea, 'y');
      // vi.advanceTimersByTime(200);

      // // Should not have called yet
      // expect(mockDetectFormat).not.toHaveBeenCalled();

      // // Wait full 500ms from last keypress
      // vi.advanceTimersByTime(500);

      // await waitFor(() => {
      //   expect(mockDetectFormat).toHaveBeenCalledTimes(1);
      // });

      // vi.useRealTimers();
    });

    test('shows format badge after detection completes', async () => {
      // const onAnalyze = vi.fn();
      // const mockDetectFormat = vi.mocked(api.detectFormat);
      // mockDetectFormat.mockResolvedValue({
      //   format: 'format_a',
      //   confidence: 'high',
      //   preview: { sections: [] },
      // });

      // render(<InputForm onAnalyze={onAnalyze} loading={false} sampleInput="sample" />);

      // const textarea = screen.getByRole('textbox');
      // await userEvent.type(textarea, 'key: Am');

      // await waitFor(() => {
      //   expect(screen.getByText('Format A')).toBeInTheDocument();
      // });
    });

    test('shows loading indicator during detection', async () => {
      // vi.useFakeTimers();
      // const onAnalyze = vi.fn();
      // const mockDetectFormat = vi.mocked(api.detectFormat);
      // mockDetectFormat.mockImplementation(() => new Promise(() => {})); // Never resolves

      // render(<InputForm onAnalyze={onAnalyze} loading={false} sampleInput="sample" />);

      // const textarea = screen.getByRole('textbox');
      // await userEvent.type(textarea, 'key: Am');
      // vi.advanceTimersByTime(500);

      // await waitFor(() => {
      //   expect(screen.getByText('Detecting...')).toBeInTheDocument();
      // });

      // vi.useRealTimers();
    });
  });

  describe('Format Selector', () => {
    test('opens format selector when badge is clicked', async () => {
      // const onAnalyze = vi.fn();
      // const mockDetectFormat = vi.mocked(api.detectFormat);
      // mockDetectFormat.mockResolvedValue({
      //   format: 'format_a',
      //   confidence: 'high',
      //   preview: { sections: [] },
      // });

      // render(<InputForm onAnalyze={onAnalyze} loading={false} sampleInput="sample" />);

      // const textarea = screen.getByRole('textbox');
      // await userEvent.type(textarea, 'key: Am');

      // await waitFor(() => {
      //   expect(screen.getByText('Format A')).toBeInTheDocument();
      // });

      // const badge = screen.getByText('Format A');
      // fireEvent.click(badge);

      // await waitFor(() => {
      //   expect(screen.getByText('Auto-detect (recommended)')).toBeInTheDocument();
      // });
    });

    test('changes to manual mode when format is manually selected', async () => {
      // const onAnalyze = vi.fn();
      // const mockDetectFormat = vi.mocked(api.detectFormat);
      // mockDetectFormat.mockResolvedValue({
      //   format: 'format_a',
      //   confidence: 'high',
      //   preview: { sections: [] },
      // });

      // render(<InputForm onAnalyze={onAnalyze} loading={false} sampleInput="sample" />);

      // const textarea = screen.getByRole('textbox');
      // await userEvent.type(textarea, 'key: Am');

      // await waitFor(() => {
      //   expect(screen.getByText('Format A')).toBeInTheDocument();
      // });

      // // Open selector
      // const badge = screen.getByText('Format A');
      // fireEvent.click(badge);

      // // Select ChordPro
      // const chordproOption = await screen.findByText('ChordPro');
      // fireEvent.click(chordproOption);

      // // Should show manual indicator
      // await waitFor(() => {
      //   expect(screen.getByText('👤')).toBeInTheDocument();
      // });
    });

    test('passes format hint when manual format is selected', async () => {
      // const onAnalyze = vi.fn();
      // const mockDetectFormat = vi.mocked(api.detectFormat);
      // mockDetectFormat.mockResolvedValue({
      //   format: 'chordpro',
      //   confidence: 'high',
      //   preview: { sections: [] },
      // });

      // render(<InputForm onAnalyze={onAnalyze} loading={false} sampleInput="sample" />);

      // const textarea = screen.getByRole('textbox');
      // await userEvent.type(textarea, 'some text');

      // // Wait for initial detection
      // await waitFor(() => {
      //   expect(mockDetectFormat).toHaveBeenCalledWith('some text', undefined);
      // });

      // // Open selector and choose ChordPro
      // const badge = await screen.findByRole('button', { name: /format/i });
      // fireEvent.click(badge);
      // const chordproOption = await screen.findByText('ChordPro');
      // fireEvent.click(chordproOption);

      // // Should call with format hint
      // await waitFor(() => {
      //   expect(mockDetectFormat).toHaveBeenCalledWith('some text', 'chordpro');
      // });
    });
  });

  describe('Parse Preview', () => {
    test('preview panel is initially collapsed', async () => {
      // const onAnalyze = vi.fn();
      // const mockDetectFormat = vi.mocked(api.detectFormat);
      // mockDetectFormat.mockResolvedValue({
      //   format: 'format_a',
      //   confidence: 'high',
      //   preview: {
      //     key: 'Am',
      //     sections: [{ name: 'intro', chord_count: 4, first_chords: ['Am', 'D'] }],
      //   },
      // });

      // render(<InputForm onAnalyze={onAnalyze} loading={false} sampleInput="sample" />);

      // const textarea = screen.getByRole('textbox');
      // await userEvent.type(textarea, 'key: Am');

      // await waitFor(() => {
      //   expect(screen.getByText('Preview')).toBeInTheDocument();
      // });

      // // Should not show preview content initially
      // expect(screen.queryByText('Key:')).not.toBeInTheDocument();
    });

    test('expands preview when toggle is clicked', async () => {
      // const onAnalyze = vi.fn();
      // const mockDetectFormat = vi.mocked(api.detectFormat);
      // mockDetectFormat.mockResolvedValue({
      //   format: 'format_a',
      //   confidence: 'high',
      //   preview: {
      //     key: 'Am',
      //     sections: [{ name: 'intro', chord_count: 4, first_chords: ['Am', 'D'] }],
      //   },
      // });

      // render(<InputForm onAnalyze={onAnalyze} loading={false} sampleInput="sample" />);

      // const textarea = screen.getByRole('textbox');
      // await userEvent.type(textarea, 'key: Am');

      // await waitFor(() => {
      //   expect(screen.getByText('Preview')).toBeInTheDocument();
      // });

      // const previewToggle = screen.getByText('Preview');
      // fireEvent.click(previewToggle);

      // await waitFor(() => {
      //   expect(screen.getByText('Key:')).toBeInTheDocument();
      //   expect(screen.getByText('Am')).toBeInTheDocument();
      // });
    });
  });

  describe('Load Sample', () => {
    test('loads sample text when button is clicked', () => {
      // const onAnalyze = vi.fn();
      // const sampleInput = 'key: Am\ntitle: Test Song';
      // render(<InputForm onAnalyze={onAnalyze} loading={false} sampleInput={sampleInput} />);

      // const loadSampleButton = screen.getByText(/load sample/i);
      // fireEvent.click(loadSampleButton);

      // const textarea = screen.getByRole('textbox');
      // expect(textarea).toHaveValue(sampleInput);
    });

    test('triggers format detection after loading sample', async () => {
      // vi.useFakeTimers();
      // const onAnalyze = vi.fn();
      // const mockDetectFormat = vi.mocked(api.detectFormat);
      // mockDetectFormat.mockResolvedValue({
      //   format: 'format_a',
      //   confidence: 'high',
      //   preview: { sections: [] },
      // });

      // const sampleInput = 'key: Am\ntitle: Test Song';
      // render(<InputForm onAnalyze={onAnalyze} loading={false} sampleInput={sampleInput} />);

      // const loadSampleButton = screen.getByText(/load sample/i);
      // fireEvent.click(loadSampleButton);

      // vi.advanceTimersByTime(500);

      // await waitFor(() => {
      //   expect(mockDetectFormat).toHaveBeenCalledWith(sampleInput, undefined);
      // });

      // vi.useRealTimers();
    });
  });

  describe('Analyze Button', () => {
    test('calls onAnalyze with text when clicked', () => {
      // const onAnalyze = vi.fn();
      // render(<InputForm onAnalyze={onAnalyze} loading={false} sampleInput="sample" />);

      // const textarea = screen.getByRole('textbox');
      // fireEvent.change(textarea, { target: { value: 'key: Am' } });

      // const analyzeButton = screen.getByRole('button', { name: /analyze/i });
      // fireEvent.click(analyzeButton);

      // expect(onAnalyze).toHaveBeenCalledWith('key: Am');
    });

    test('collapses input form after analyzing', () => {
      // const onAnalyze = vi.fn();
      // render(<InputForm onAnalyze={onAnalyze} loading={false} sampleInput="sample" />);

      // const textarea = screen.getByRole('textbox');
      // fireEvent.change(textarea, { target: { value: 'key: Am' } });

      // const analyzeButton = screen.getByRole('button', { name: /analyze/i });
      // fireEvent.click(analyzeButton);

      // // Textarea should be hidden after collapse
      // expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    test('shows loading spinner when loading is true', () => {
      // const onAnalyze = vi.fn();
      // render(<InputForm onAnalyze={onAnalyze} loading={true} sampleInput="sample" />);

      // const spinner = screen.getByRole('button', { name: /analyze/i }).querySelector('.animate-spin');
      // expect(spinner).toBeInTheDocument();
    });

    test('is disabled when loading', () => {
      // const onAnalyze = vi.fn();
      // render(<InputForm onAnalyze={onAnalyze} loading={true} sampleInput="sample" />);

      // const analyzeButton = screen.getByRole('button', { name: /analyze/i });
      // expect(analyzeButton).toBeDisabled();
    });
  });

  describe('Collapse/Expand', () => {
    test('toggles textarea visibility when input header is clicked', () => {
      // const onAnalyze = vi.fn();
      // render(<InputForm onAnalyze={onAnalyze} loading={false} sampleInput="sample" />);

      // const textarea = screen.getByRole('textbox');
      // expect(textarea).toBeVisible();

      // const inputHeader = screen.getByText('Input');
      // fireEvent.click(inputHeader);

      // expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

      // // Click again to expand
      // fireEvent.click(inputHeader);
      // expect(screen.getByRole('textbox')).toBeVisible();
    });
  });
});
