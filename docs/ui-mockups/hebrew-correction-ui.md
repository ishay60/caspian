# Hebrew Song Correction UI Mockups

## Overview
This document contains ASCII mockups and implementation notes for the Hebrew song correction interface in Caspian.

## Main Analysis View with Correction Controls

### Default View (No Corrections)
```
┌─────────────────────────────────────────────────────────────┐
│ יום שישי חזר - מתי כספי                                     │
│ Source: Tab4u · Quality: 65/100                             │
│                                                             │
│ [🔍 Analyze] [✏️ Edit Chords] [📤 Export]                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Analysis Results                                             │
│                                                             │
│ Key: Am (detected)                                          │
│ Sections: 4 (Verse, Chorus, Bridge, Outro)                 │
│ Notable: 2 diminished chords, 1 deceptive resolution       │
│                                                             │
│ Section: פזמון                                              │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ [Am/E]  [D#dim]  [F#dim]  [F]                        │  │
│ │ יום שישי חזר                                          │  │
│ │                                                       │  │
│ │ [D]     [Am]     [E]      [Dm]                       │  │
│ │ בואי נא אל הגן                                        │  │
│ └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### View with Local Corrections Applied
```
┌─────────────────────────────────────────────────────────────┐
│ יום שישי חזר - מתי כספי                                     │
│ Source: Tab4u · Quality: 65/100                             │
│                                                             │
│ ℹ️ Local Corrections Applied (3 changes)                    │
│ [View Original] [Edit Corrections] [Clear Corrections]      │
│                                                             │
│ [🔍 Analyze] [✏️ Edit Chords] [📤 Export]                   │
└─────────────────────────────────────────────────────────────┘
```

## Correction Mode - Inline Editing

### Hovering Over Chord
```
Section: פזמון
┌─────────────────────────────────────────────────────────────┐
│ [Am/E]  [D#dim]🎯  [F#dim]  [F]                            │
│         └─ Click to edit                                    │
│ יום שישי חזר                                                │
└─────────────────────────────────────────────────────────────┘
```

### Editing Chord Symbol
```
Section: פזמון
┌─────────────────────────────────────────────────────────────┐
│ [Am/E]  [✎ D#dim    ]▼  [F#dim]  [F]                       │
│         ┌──────────────────┐                                │
│         │ Ddim             │ ← autocomplete suggestions     │
│         │ D#dim7           │                                │
│         │ Dm               │                                │
│         └──────────────────┘                                │
│         [💾 Save] [❌ Cancel]                                │
│ יום שישי חזר                                                │
└─────────────────────────────────────────────────────────────┘
```

### Chord Edited Successfully
```
Section: פזמון
┌─────────────────────────────────────────────────────────────┐
│ [Am/E]  [Ddim]✓  [F#dim]  [F]                              │
│         └─ Local edit                                       │
│ יום שישי חזר                                                │
│                                                             │
│ ✅ Chord corrected: D#dim → Ddim                            │
│ [Undo] [Continue Editing] [Save & Finish]                  │
└─────────────────────────────────────────────────────────────┘
```

## Section Management

### Add Section Button
```
┌─────────────────────────────────────────────────────────────┐
│ Section: Chorus                                             │
│ [Am] [F] [C] [G]                                            │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    [➕ Add Section]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Section: Bridge                                             │
│ (empty - add chords)                                        │
└─────────────────────────────────────────────────────────────┘
```

### Section Editor
```
┌─────────────────────────────────────────────────────────────┐
│ Add New Section                                             │
│                                                             │
│ Section Name: [Bridge        ]▼                             │
│               ├─ Bridge                                     │
│               ├─ Intro                                      │
│               ├─ Outro                                      │
│               ├─ Instrumental                               │
│               └─ Custom...                                  │
│                                                             │
│ Insert After: [Chorus 2      ]▼                             │
│                                                             │
│ Chord Content:                                              │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ | Dm | G | C | Am |                                   │  │
│ │ | F  | G | C |    |                                   │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│ [💾 Add Section] [❌ Cancel]                                 │
└─────────────────────────────────────────────────────────────┘
```

### Edit Section Boundary
```
┌─────────────────────────────────────────────────────────────┐
│ Section: Verse 1                                            │
│ [Am] [F] [C] [G]                                            │
│ Line 1...                                                   │
│ Line 2...                                                   │
│ Line 3... ← Should start Chorus here                        │
├┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│
│ Section: Chorus ⚙️ [Move Boundary Up]                       │
│ [Dm] [G] [C] [Am]                                           │
└─────────────────────────────────────────────────────────────┘
```

## Alignment Correction

### Alignment Mode
```
Section: Verse 1
┌─────────────────────────────────────────────────────────────┐
│ [Align Chords to Lyrics] mode active                        │
│                                                             │
│     Am        Dm        G         C                         │
│     ↕         ↕         ↕         ↕                         │
│ ┌───|─────────|─────────|─────────|───────────────────┐    │
│ │   יום   שישי   חזר   והביא   מנוחה                  │    │
│ └─────────────────────────────────────────────────────┘    │
│     ↑         ↑         ↑         ↑                         │
│   Drag chord markers to align with correct syllables       │
│                                                             │
│ [💾 Save Alignment] [↺ Reset] [❌ Cancel]                    │
└─────────────────────────────────────────────────────────────┘
```

### Alignment Adjusted
```
✅ Chord alignment updated for Verse 1, Line 2
   • Am: column 0 → 2
   • Dm: column 5 → 8
   • G: column 11 → 14
```

## Correction History Panel

### Corrections Summary
```
┌─────────────────────────────────────────────────────────────┐
│ 📝 Local Corrections (5)                                    │
│                                                             │
│ 🟢 Verse 1, Line 1, Chord 2                                 │
│    Am → A                                                   │
│    "Should be major, not minor"                             │
│    2026-02-24 15:30                                         │
│    [↺ Undo]                                                 │
│                                                             │
│ 🟢 Chorus, alignment                                        │
│    Adjusted 3 chord positions                               │
│    2026-02-24 15:32                                         │
│    [↺ Undo]                                                 │
│                                                             │
│ 🟢 Added: Bridge section                                    │
│    4 bars inserted after Chorus 2                           │
│    2026-02-24 15:35                                         │
│    [↺ Undo] [✏️ Edit]                                        │
│                                                             │
│ 🟢 Verse 2, section boundary                                │
│    Moved start from line 8 to line 6                        │
│    2026-02-24 15:38                                         │
│    [↺ Undo]                                                 │
│                                                             │
│ 🟢 Chorus, Chord 3                                          │
│    F#dim → Fdim                                             │
│    2026-02-24 15:40                                         │
│    [↺ Undo]                                                 │
│                                                             │
│ [📤 Export All] [📥 Import] [🗑️ Clear All]                  │
└─────────────────────────────────────────────────────────────┘
```

## Error States

### Invalid Chord Symbol
```
┌─────────────────────────────────────────────────────────────┐
│ ❌ Error: Invalid Chord Symbol                              │
│                                                             │
│ "Amx7" is not a recognized chord symbol.                    │
│                                                             │
│ Did you mean:                                               │
│ • Am7 (A minor 7th)                                         │
│ • Amaj7 (A major 7th)                                       │
│ • Am(maj7) (A minor major 7th)                              │
│                                                             │
│ [Try Again] [Cancel]                                        │
└─────────────────────────────────────────────────────────────┘
```

### Conflicting Correction
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Conflicting Correction                                    │
│                                                             │
│ You already corrected this chord:                           │
│ • Original: Am                                              │
│ • Your previous correction: A                               │
│ • New correction: Am7                                       │
│                                                             │
│ What would you like to do?                                  │
│ [ ] Keep previous correction (A)                            │
│ [ ] Replace with new correction (Am7)                       │
│ [ ] Cancel                                                  │
│                                                             │
│ [Confirm] [Cancel]                                          │
└─────────────────────────────────────────────────────────────┘
```

### Parse Error After Correction
```
┌─────────────────────────────────────────────────────────────┐
│ ❌ Parsing Failed                                            │
│                                                             │
│ The corrected chord sheet failed to parse:                  │
│                                                             │
│ Line 5: Unrecognized chord symbol "Xm"                      │
│                                                             │
│ This correction cannot be applied.                          │
│                                                             │
│ [↺ Revert Last Change] [✏️ Edit Manually] [❌ Cancel]        │
└─────────────────────────────────────────────────────────────┘
```

## Import/Export Dialogs

### Export Corrections
```
┌─────────────────────────────────────────────────────────────┐
│ 📤 Export Corrections                                        │
│                                                             │
│ Export your local corrections to share or backup.           │
│                                                             │
│ Format: JSON                                                │
│ Corrections: 5                                              │
│ Song: יום שישי חזר - מתי כספי                               │
│                                                             │
│ [📋 Copy to Clipboard] [💾 Download File]                   │
│                                                             │
│ [❌ Close]                                                   │
└─────────────────────────────────────────────────────────────┘
```

### Import Corrections
```
┌─────────────────────────────────────────────────────────────┐
│ 📥 Import Corrections                                        │
│                                                             │
│ Import corrections from JSON file or clipboard.             │
│                                                             │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ {                                                     │  │
│ │   "version": "1.0",                                   │  │
│ │   "song": {                                           │  │
│ │     "title": "יום שישי חזר",                          │  │
│ │     ...                                               │  │
│ │ }                                                     │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│ [📁 Choose File] [📋 Paste from Clipboard]                  │
│                                                             │
│ ✅ Valid corrections file (5 corrections)                   │
│                                                             │
│ ⚠️ Note: Importing will merge with existing corrections     │
│                                                             │
│ [📥 Import] [❌ Cancel]                                      │
└─────────────────────────────────────────────────────────────┘
```

## Mobile Responsive Views

### Mobile Correction Mode
```
┌─────────────────────────┐
│ יום שישי חזר             │
│ Tab4u · 65/100          │
│ ℹ️ 3 local edits         │
│ [View] [Edit] [Clear]   │
├─────────────────────────┤
│ פזמון                   │
│ [Am/E]  [D#dim]🎯       │
│     Tap to edit         │
│ יום שישי חזר            │
├─────────────────────────┤
│ [D]  [Am]  [E]  [Dm]    │
│ בואי נא אל הגן          │
└─────────────────────────┘
```

### Mobile Edit Dialog
```
┌─────────────────────────┐
│ Edit Chord              │
│                         │
│ Original: D#dim         │
│                         │
│ New: [Ddim       ]▼     │
│                         │
│ Note (optional):        │
│ ┌─────────────────────┐ │
│ │ Enharmonic spelling │ │
│ └─────────────────────┘ │
│                         │
│ [💾 Save] [❌ Cancel]    │
└─────────────────────────┘
```

## Implementation Notes

### Component Structure
```
AnalysisView
├─ CorrectionBanner (shows correction status)
├─ CorrectionToolbar ([Edit] [Export] buttons)
├─ SectionView (multiple)
│  ├─ SectionHeader (with edit controls)
│  ├─ ChordLineView
│  │  └─ EditableChordSymbol (hover + click to edit)
│  └─ LyricsLine
├─ CorrectionHistoryPanel (collapsible)
└─ CorrectionDialog (for complex edits)
```

### Key Components

**EditableChordSymbol**
```typescript
interface EditableChordSymbolProps {
  chord: string;
  position: ChordPosition;
  isEditMode: boolean;
  onEdit: (newChord: string) => void;
}
```

**CorrectionToolbar**
```typescript
interface CorrectionToolbarProps {
  hasCorrections: boolean;
  correctionCount: number;
  onToggleEditMode: () => void;
  onViewOriginal: () => void;
  onClearCorrections: () => void;
  onExport: () => void;
}
```

**CorrectionHistoryPanel**
```typescript
interface CorrectionHistoryPanelProps {
  corrections: Correction[];
  onUndo: (correctionId: string) => void;
  onEdit: (correctionId: string) => void;
  onExport: () => void;
  onImport: () => void;
  onClearAll: () => void;
}
```

**AlignmentEditor**
```typescript
interface AlignmentEditorProps {
  chords: ChordPosition[];
  lyrics: string;
  onAlignmentChange: (adjustments: AlignmentAdjustment[]) => void;
}
```

### State Management

Use correction store:
```typescript
interface CorrectionStore {
  isEditMode: boolean;
  corrections: Map<string, Correction[]>; // keyed by URL
  currentSongUrl: string | null;

  // Actions
  enterEditMode: () => void;
  exitEditMode: () => void;
  addCorrection: (correction: Correction) => void;
  removeCorrection: (id: string) => void;
  clearCorrections: (url: string) => void;
  exportCorrections: (url: string) => string; // JSON
  importCorrections: (json: string) => void;
  hasCorrections: (url: string) => boolean;
}
```

### Integration Points

1. **SongSearch Component**
   - Check for corrections on fetch
   - Apply corrections before display
   - Show correction indicator

2. **AnalysisView Component**
   - Add correction mode toggle
   - Enable inline editing
   - Show correction history

3. **ChordDisplay Component**
   - Make chords editable in correction mode
   - Show edit indicator (pencil icon)
   - Validate chord symbols

4. **localStorage Integration**
   - Use CorrectionManager class (from Task 2.6.4)
   - Persist on every change
   - Load on component mount

### Accessibility

- **Keyboard navigation**: Tab through editable chords, Enter to edit, Esc to cancel
- **Screen reader**: Announce correction mode, chord changes, validation errors
- **Focus management**: Return focus to edited chord after save
- **ARIA labels**: "Edit chord Am", "Save correction", "Cancel edit"

### Styling

Use Tailwind classes:
- Edit mode: `border-2 border-blue-500 bg-blue-50`
- Corrected chord: `border-green-500 bg-green-50`
- Validation error: `border-red-500 bg-red-50`
- Hover state: `hover:bg-gray-100 cursor-pointer`

### Future Enhancements (Phase 7+)

- **Real-time collaboration**: Multiple users editing simultaneously
- **Undo/redo stack**: Full edit history with time travel
- **Diff view**: Side-by-side original vs corrected
- **Batch corrections**: Apply same correction to multiple sections
- **Smart suggestions**: AI-powered chord correction suggestions based on context
