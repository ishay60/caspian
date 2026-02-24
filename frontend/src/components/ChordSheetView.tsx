/**
 * ChordSheetView Component
 *
 * READ-ONLY chord sheet view that displays bars with chords positioned on a beat grid.
 * Handles both bar-aware sections and legacy sections.
 *
 * ============================================================================
 * UI MOCKUP (Task 4.1.1)
 * ============================================================================
 *
 * LAYOUT STRUCTURE:
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ Section Header: "Verse 1"                                    [4/4]  │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │                                                                       │
 * │  Bar 1              Bar 2              Bar 3              Bar 4      │
 * │ ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
 * │ │ Am          │   │ F           │   │ C           │   │ G           │
 * │ │ •   •   •   •   │ •   •   •   •   │ •   •   •   •   │ •   •   •   •
 * │ │ 1   2   3   4   │ 1   2   3   4   │ 1   2   3   4   │ 1   2   3   4
 * │ │ שורה ראשונה    │ │                 │ │                 │ │             │
 * │ └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
 * │                                                                       │
 * │  Bar 5              Bar 6                                            │
 * │ ┌─────────────┐   ┌─────────────┐                                   │
 * │ │ Dm    Em    │   │ Am          │                                   │
 * │ │ •     •   • •   │ •   •   •   •                                   │
 * │ │ 1     2   3 4   │ 1   2   3   4                                   │
 * │ │ שורה שנייה     │ │                                                │
 * │ └─────────────┘   └─────────────┘                                   │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * DESIGN ELEMENTS:
 *
 * 1. Section Header:
 *    - Section name (bold, larger font)
 *    - Time signature on the right
 *    - Staff-paper texture background
 *    - Left border accent (like existing section cards)
 *
 * 2. Bar Container:
 *    - Fixed width for each beat (responsive)
 *    - Vertical bar lines (|) as separators
 *    - Rounded corners
 *    - Subtle background color for each bar
 *    - Hover effect for interactivity
 *
 * 3. Beat Grid:
 *    - Visual beat positions (dots or tick marks)
 *    - Beat numbers below (1, 2, 3, 4)
 *    - Subdivisions indicated by smaller marks
 *    - Grid helps align chords visually
 *
 * 4. Chord Symbols:
 *    - Positioned above the beat grid
 *    - Aligned to their exact beat position
 *    - Use chord badge styling (colored, rounded)
 *    - Root note + quality + extensions
 *    - Clickable for analysis details
 *
 * 5. Lyrics Fragment:
 *    - Below the beat grid
 *    - RTL support for Hebrew
 *    - Subtle color (secondary text)
 *    - Ellipsis for overflow
 *
 * 6. Responsive Layout:
 *    - Desktop: 4-6 bars per row
 *    - Tablet: 2-3 bars per row
 *    - Mobile: 1-2 bars per row
 *    - Bars wrap naturally
 *    - Print-friendly CSS
 *
 * 7. Visual Hierarchy:
 *    - Chords are most prominent
 *    - Beat grid is subtle but clear
 *    - Lyrics are supportive
 *    - Bar separators are minimal
 *
 * COLOR SCHEME:
 *    - Uses existing CSS variables
 *    - --color-surface for bar background
 *    - --color-border for bar lines
 *    - --color-text-secondary for beat numbers
 *    - Chord colors from getChordColor() utility
 *
 * ANIMATIONS:
 *    - Fade in on mount
 *    - Smooth hover transitions
 *    - Bar highlighting on chord selection
 *    - Smooth wrapping on resize
 *
 * ACCESSIBILITY:
 *    - Semantic HTML structure
 *    - ARIA labels for screen readers
 *    - Keyboard navigation support
 *    - Focus indicators
 *    - Proper heading hierarchy
 */

import type { Section, BarAnalysis, BarChord, BeatPosition } from '../types';
import { BarDisplay } from './BarDisplay';
import './ChordSheetView.css';

interface ChordSheetViewProps {
  section: Section;
  onChordSelect?: (chordIndex: number) => void;
  selectedChordIndex?: number | null;
}

export function ChordSheetView({ section, onChordSelect, selectedChordIndex }: ChordSheetViewProps) {
  // Check if section has bar-aware data
  const hasBarData = section.bars && section.bars.length > 0;

  if (!hasBarData) {
    // Fallback for legacy sections without bar data
    return (
      <div className="chord-sheet-legacy">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Bar view not available for this section. Use the standard chord view.
        </p>
      </div>
    );
  }

  // Extract time signature from first bar (assuming consistent within section)
  const timeSignature = section.bars?.[0] ? getTimeSignature(section.bars[0]) : [4, 4];

  return (
    <div className="chord-sheet-view">
      {/* Section header with name and time signature */}
      <SectionHeader
        name={section.name}
        timeSignature={timeSignature}
      />

      {/* Bar grid container */}
      <div className="bars-container">
        {section.bars.map((bar, index) => (
          <BarDisplay
            key={index}
            bar={bar}
            barIndex={index}
            timeSignature={timeSignature}
            onChordSelect={onChordSelect}
            selectedChordIndex={selectedChordIndex}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Section Header Component
 * Displays section name and time signature
 */
interface SectionHeaderProps {
  name: string;
  timeSignature: [number, number];
}

function SectionHeader({ name, timeSignature }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <h3 className="section-name">{name}</h3>
      <div className="time-signature">
        <span className="numerator">{timeSignature[0]}</span>
        <span className="separator">/</span>
        <span className="denominator">{timeSignature[1]}</span>
      </div>
    </div>
  );
}

/**
 * Extract time signature from bar analysis
 * Falls back to 4/4 if not available
 */
function getTimeSignature(bar: BarAnalysis): [number, number] {
  // For now, return default 4/4
  // TODO: Extract from bar data when available
  return [4, 4];
}

// BarDisplay component is now imported from ./BarDisplay.tsx
