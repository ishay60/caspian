/**
 * ChordSheetView Component
 *
 * Displays bars as visual rectangles with proportional chord segments.
 * Chord width = duration. Sections are collapsible.
 * Supports inline editing: add/remove chords, add/delete bars, drag durations.
 */

import { useState } from 'react';
import { Plus, Pencil, LayoutGrid, ChevronRight, ChevronDown } from 'lucide-react';
import type { Section, BarAnalysis, ChordAnalysis } from '../types';
import { BarDisplay } from './BarDisplay';
import './ChordSheetView.css';

interface ChordSheetViewProps {
  section: Section;
  onChordSelect?: (chord: ChordAnalysis) => void;
  selectedChord?: ChordAnalysis | null;
  onSectionUpdate?: (updated: Section) => void;
}

export function ChordSheetView({
  section,
  onChordSelect,
  selectedChord,
  onSectionUpdate,
}: ChordSheetViewProps) {
  const [editable, setEditable] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [barDurations, setBarDurations] = useState<Record<number, number[]>>({});
  const hasBarData = section.bars && section.bars.length > 0;
  const timeSignature: [number, number] = [4, 4];

  function handleDurationsChange(barIndex: number, durations: number[]) {
    setBarDurations((prev) => ({ ...prev, [barIndex]: durations }));
  }

  function resetDurations(barIndex?: number) {
    if (barIndex !== undefined) {
      setBarDurations((prev) => {
        const next = { ...prev };
        delete next[barIndex];
        return next;
      });
    } else {
      setBarDurations({});
    }
  }

  /** Add a chord to the end of a bar's chord list */
  function handleAddChord(barIndex: number, symbol: string) {
    if (!section.bars || !onSectionUpdate) return;
    const bars = section.bars.map((b, i) => {
      if (i !== barIndex) return b;
      const newChord = createMinimalChord(symbol);
      const newChords = [...b.chord_analyses, newChord];
      return {
        ...b,
        chord_analyses: newChords,
        harmonic_rhythm: harmonicRhythm(newChords.length),
      };
    });
    resetDurations(barIndex);
    onSectionUpdate({ ...section, bars });
  }

  /** Remove a chord from a bar; if bar becomes empty, remove the bar */
  function handleRemoveChord(barIndex: number, chordIndex: number) {
    if (!section.bars || !onSectionUpdate) return;
    let bars = section.bars.map((b, i) => {
      if (i !== barIndex) return b;
      const newChords = b.chord_analyses.filter((_, ci) => ci !== chordIndex);
      return {
        ...b,
        chord_analyses: newChords,
        harmonic_rhythm: harmonicRhythm(newChords.length),
      };
    });
    bars = bars
      .filter((b) => b.chord_analyses.length > 0)
      .map((b, i) => ({ ...b, bar_index: i }));
    resetDurations();
    onSectionUpdate({ ...section, bars });
  }

  /** Delete an entire bar */
  function handleDeleteBar(barIndex: number) {
    if (!section.bars || !onSectionUpdate) return;
    const bars = section.bars
      .filter((_, i) => i !== barIndex)
      .map((b, i) => ({ ...b, bar_index: i }));
    resetDurations();
    onSectionUpdate({ ...section, bars });
  }

  /** Add a new empty bar at the end */
  function handleAddBar() {
    if (!onSectionUpdate) return;
    const bars = [...(section.bars || [])];
    bars.push({
      bar_index: bars.length,
      chord_analyses: [],
      harmonic_rhythm: 'static',
      has_riff: false,
    });
    onSectionUpdate({ ...section, bars });
  }

  /** Auto-create bars from flat chord list (one chord per bar) */
  function handleAutoCreateBars() {
    if (!section.chords.length || !onSectionUpdate) return;
    const bars: BarAnalysis[] = section.chords.map((chord, i) => ({
      bar_index: i,
      chord_analyses: [chord],
      harmonic_rhythm: 'static',
      has_riff: false,
    }));
    resetDurations();
    onSectionUpdate({ ...section, bars });
  }

  // --- NO BAR DATA ---
  if (!hasBarData) {
    return (
      <div className="chord-sheet-view chord-sheet-view--empty">
        <div className="section-header">
          <h3 className="section-name">{section.name}</h3>
        </div>
        {section.chords.length > 0 ? (
          <div className="empty-state">
            <LayoutGrid size={32} strokeWidth={1.5} />
            <p>No bar structure for this section</p>
            <button className="btn-primary" onClick={handleAutoCreateBars}>
              <Plus size={16} />
              Create Bars ({section.chords.length} chords)
            </button>
          </div>
        ) : (
          <div className="empty-state">
            <p>No chords in this section</p>
          </div>
        )}
      </div>
    );
  }

  // --- MAIN VIEW ---
  const barCount = section.bars!.length;
  const chordSummary = section.bars!
    .map((b) => b.chord_analyses.map((c) => c.symbol).join(' '))
    .join(' | ');

  return (
    <div className="chord-sheet-view">
      {/* Section header */}
      <div className="section-header">
        <div className="section-header-left">
          <button
            className="btn-icon btn-collapse"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand section' : 'Collapse section'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
          <h3 className="section-name">{section.name}</h3>
          <div className="time-signature">
            <span className="numerator">{timeSignature[0]}</span>
            <span className="separator">/</span>
            <span className="denominator">{timeSignature[1]}</span>
          </div>
          <span className="bar-count">{barCount} bars</span>
        </div>
        {onSectionUpdate && !collapsed && (
          <button
            className={`btn-icon ${editable ? 'btn-icon--active' : ''}`}
            onClick={() => setEditable(!editable)}
            title={editable ? 'Done editing' : 'Edit bars'}
          >
            <Pencil size={16} />
          </button>
        )}
      </div>

      {/* Collapsed: show chord summary */}
      {collapsed ? (
        <div className="collapsed-summary">{chordSummary}</div>
      ) : (
        /* Expanded: show bar grid */
        <div className="bars-container">
          {section.bars!.map((bar, index) => (
            <BarDisplay
              key={index}
              bar={bar}
              barIndex={index}
              timeSignature={timeSignature}
              editable={editable}
              durations={barDurations[index]}
              onDurationsChange={handleDurationsChange}
              onChordSelect={onChordSelect}
              selectedChord={selectedChord}
              onAddChord={handleAddChord}
              onRemoveChord={handleRemoveChord}
              onDeleteBar={handleDeleteBar}
            />
          ))}

          {/* Add bar button (edit mode only) */}
          {editable && (
            <button
              className="add-bar-button"
              onClick={handleAddBar}
              title="Add new bar"
            >
              <Plus size={24} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Create a minimal ChordAnalysis for a newly entered chord symbol */
function createMinimalChord(symbol: string): ChordAnalysis {
  const rootMatch = symbol.match(/^[A-G][#b]?/);
  const rootName = rootMatch ? rootMatch[0] : symbol;
  return {
    symbol,
    root_name: rootName,
    root: 0,
    quality: '',
    bass_name: rootName,
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
}

function harmonicRhythm(count: number): string {
  if (count <= 1) return 'static';
  if (count === 2) return 'half-bar';
  return 'per-beat';
}
