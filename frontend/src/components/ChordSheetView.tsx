/**
 * ChordSheetView Component
 *
 * Chord sheet view that displays bars with chords on a beat grid.
 * Supports both read-only display and interactive editing via BarOverlay.
 *
 * EDITING FLOW:
 * 1. Click "Edit Bars" button in section header
 * 2. BarOverlay opens with the section's chord sequence
 * 3. User inserts bar lines, adjusts time signature, drags beat positions
 * 4. On "Complete", bars are updated and re-analyzed
 *
 * READ-ONLY DISPLAY:
 * - Bars shown as visual rectangles with beat grids
 * - Chords positioned at beat positions
 * - Click chords for analysis details
 */

import { useState } from 'react';
import type { Section, BarAnalysis, ChordAnalysis, Bar } from '../types';
import { BarDisplay } from './BarDisplay';
import { BarOverlay } from './BarOverlay';
import './ChordSheetView.css';

interface ChordSheetViewProps {
  section: Section;
  onChordSelect?: (chord: ChordAnalysis) => void;
  selectedChord?: ChordAnalysis | null;
  onSectionUpdate?: (updated: Section) => void;
}

export function ChordSheetView({ section, onChordSelect, selectedChord, onSectionUpdate }: ChordSheetViewProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Check if section has bar-aware data
  const hasBarData = section.bars && section.bars.length > 0;

  // Extract all chord symbols from the section (for BarOverlay input)
  const chordSequence: string[] = hasBarData
    ? section.bars!.flatMap(bar => bar.chord_analyses.map(ca => ca.symbol))
    : section.chords.map(c => c.symbol);

  // Build a lookup map from chord symbol to ChordAnalysis for re-mapping after edit
  const chordAnalysisMap = new Map<string, ChordAnalysis>();
  for (const chord of section.chords) {
    if (!chordAnalysisMap.has(chord.symbol)) {
      chordAnalysisMap.set(chord.symbol, chord);
    }
  }
  if (hasBarData) {
    for (const bar of section.bars!) {
      for (const ca of bar.chord_analyses) {
        if (!chordAnalysisMap.has(ca.symbol)) {
          chordAnalysisMap.set(ca.symbol, ca);
        }
      }
    }
  }

  // Handle BarOverlay completion: convert Bar[] to BarAnalysis[]
  function handleBarsComplete(newBars: Bar[]) {
    const newBarAnalyses: BarAnalysis[] = newBars.map((bar, index) => {
      // Map each bar's chords to ChordAnalysis using the lookup
      const chordAnalyses: ChordAnalysis[] = bar.content.chords.map(barChord => {
        const existing = chordAnalysisMap.get(barChord.symbol);
        if (existing) return existing;

        // Fallback: create a minimal ChordAnalysis for new/unknown chords
        return {
          symbol: barChord.symbol,
          root_name: barChord.symbol.replace(/[^A-G#b].*/, ''),
          root: 0,
          quality: '',
          bass_name: barChord.symbol.replace(/[^A-G#b].*/, ''),
          bass: 0,
          pitches: [],
          is_inverted: false,
          roman_numeral: '?',
          is_diatonic: false,
          diatonic_in_scales: [],
          interpretations: [],
          bass_motion_from_previous: null,
          common_tones_with_previous: [],
          common_tones_with_next: [],
          deceptive_resolution: null,
          secondary_dominant: null,
        };
      });

      // Determine harmonic rhythm
      let harmonicRhythm = 'static';
      if (chordAnalyses.length === 2) harmonicRhythm = 'half-bar';
      else if (chordAnalyses.length >= 3) harmonicRhythm = 'per-beat';

      return {
        bar_index: index,
        chord_analyses: chordAnalyses,
        harmonic_rhythm: harmonicRhythm,
        has_riff: false,
      };
    });

    // Update the section with new bars
    if (onSectionUpdate) {
      onSectionUpdate({
        ...section,
        bars: newBarAnalyses,
      });
    }

    setIsEditing(false);
  }

  // Extract time signature from first bar
  const timeSignature: [number, number] = [4, 4];

  // --- EDITING MODE ---
  if (isEditing) {
    return (
      <div className="chord-sheet-view" style={{ padding: '16px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--color-text)',
            margin: 0,
          }}>
            Editing: {section.name}
          </h3>
        </div>
        <BarOverlay
          chordSequence={chordSequence}
          initialTimeSignature={timeSignature}
          onBarsComplete={handleBarsComplete}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  // --- NO BAR DATA: show "Create Bars" prompt ---
  if (!hasBarData) {
    return (
      <div className="chord-sheet-view" style={{
        padding: '24px',
        textAlign: 'center',
        border: '2px dashed var(--color-border)',
        borderRadius: '12px',
        backgroundColor: 'var(--color-surface)',
      }}>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
          No bar structure defined for "{section.name}".
        </p>
        {chordSequence.length > 0 && (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: 'var(--color-accent)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            Define Bars ({chordSequence.length} chords)
          </button>
        )}
      </div>
    );
  }

  // --- READ-ONLY MODE ---
  return (
    <div className="chord-sheet-view">
      {/* Section header with name, time signature, and edit button */}
      <div className="section-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 className="section-name">{section.name}</h3>
          <div className="time-signature">
            <span className="numerator">{timeSignature[0]}</span>
            <span className="separator">/</span>
            <span className="denominator">{timeSignature[1]}</span>
          </div>
        </div>
        {onSectionUpdate && (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              padding: '6px 14px',
              backgroundColor: 'transparent',
              color: 'var(--color-accent)',
              border: '1px solid var(--color-accent)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-accent) 10%, transparent)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Edit Bars
          </button>
        )}
      </div>

      {/* Bar grid container */}
      <div className="bars-container">
        {section.bars!.map((bar, index) => (
          <BarDisplay
            key={index}
            bar={bar}
            barIndex={index}
            timeSignature={timeSignature}
            onChordSelect={onChordSelect}
            selectedChord={selectedChord}
          />
        ))}
      </div>
    </div>
  );
}
