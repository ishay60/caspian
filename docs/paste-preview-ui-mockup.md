# Paste Preview UI Mockup

**Date:** 2026-02-24
**Story Point:** 3.5 - Frontend Paste Preview

## Overview

This document describes the UI design for the paste preview feature, which shows users:
1. What format was detected from their pasted text
2. A preview of the parsed structure
3. The ability to override auto-detection if needed

## Component Structure

### New Components

1. **FormatBadge.tsx** - Small badge showing detected format with color coding
2. **FormatSelector.tsx** - Dropdown for manual format override
3. **ParsePreview.tsx** - Collapsible preview of parsed structure

### Updated Components

- **InputForm.tsx** - Main container integrating all preview features

## Visual Design

### Format Detection Badge

**Location:** Below the textarea, left side
**Appearance:** Small pill-shaped badge with icon and text
**States:**
- Auto-detected: Shows format name with checkmark icon
- Manually selected: Shows format name with user icon
- Unknown: Shows "Unknown format" with warning icon

**Color Coding:**
```typescript
const formatColors = {
  format_a: 'blue',      // #3b82f6
  website_paste: 'green',     // #10b981
  ug_html: 'orange',     // #f97316
  tab4u_html: 'purple',  // #a855f7
  chordpro: 'teal',      // #14b8a6
  bar_notation: 'indigo',     // #6366f1
  unknown: 'gray'        // #6b7280
};
```

**Format Display Names:**
- `format_a` → "Format A"
- `website_paste` → "Website Paste"
- `ug_html` → "Ultimate Guitar HTML"
- `tab4u_html` → "Tab4u HTML"
- `chordpro` → "ChordPro"
- `bar_notation` → "Bar Notation"
- `unknown` → "Unknown"

### Format Selector Dropdown

**Location:** Next to format badge
**Trigger:** Click "Change format" button or format badge itself
**Options:**
1. "Auto-detect (recommended)" - default, shows with sparkles icon
2. Divider
3. All supported formats listed alphabetically with their icons

**States:**
- Default: Shows "Auto"
- Override active: Shows selected format name

### Parse Preview Panel

**Location:** Between format badge and Analyze button
**Default State:** Collapsed (but shows format badge)
**Expanded State:** Shows parsed structure summary

**Contents when expanded:**
1. **Header**: "Preview" with expand/collapse toggle
2. **Metadata section:**
   - Detected key (if any)
   - Title and artist (if any)
   - Number of sections detected
3. **Sections preview:**
   - List of section names with chord count
   - First 3-5 chords from each section
   - "..." if more chords exist
4. **Confidence indicator:**
   - High confidence (green): Parser confident in detection
   - Medium confidence (yellow): Some ambiguity detected
   - Low confidence (red): Multiple format matches, may need manual selection

**Example Preview Content:**
```
Preview
───────────────────────────
Key: Am
Title: יום שישי חזר
Artist: מתי כספי

Sections (4):
├─ [intro] (4 chords): Am, D, F, E
├─ [verse] (8 chords): Am, Dm, F, E...
├─ [chorus] (8 chords): Am/E, D#dim, F#dim, F...
└─ [outro] (2 chords): Am, Am

Format confidence: High ✓
```

## User Flow

### Initial State
1. User sees empty textarea with placeholder
2. No format badge visible
3. No preview visible

### After Paste (Auto-detection)
1. User pastes text into textarea
2. After 500ms debounce:
   - Format detection runs in background
   - Format badge appears with detected format
   - Preview panel shows with collapsed state indicator
3. User can click preview to expand and see structure
4. User can click "Analyze" to proceed immediately

### Manual Override Flow
1. User clicks format badge or "Change format" button
2. Dropdown appears with all format options
3. User selects different format
4. Badge updates to show manual selection
5. Preview re-parses with new format (if preview was expanded)
6. User can click "Analyze" to proceed

### Error States
1. **Unknown format detected:**
   - Badge shows "Unknown format" in gray
   - Preview shows error message: "Could not detect format. Please select manually."
   - Format selector becomes more prominent
2. **Parse error:**
   - Preview shows error message with details
   - Suggests trying different format
3. **Empty input:**
   - No badge shown
   - Analyze button disabled

## API Requirements

### New Backend Endpoint

```python
@app.post("/api/detect-format")
async def detect_format(req: DetectFormatRequest) -> DetectFormatResponse:
    """Detect input format and return preview without full analysis.

    This is lighter weight than full analysis - just detection + basic parsing.
    """
    pass
```

**Request:**
```typescript
interface DetectFormatRequest {
  text: string;
  formatHint?: string; // Optional explicit format to try
}
```

**Response:**
```typescript
interface DetectFormatResponse {
  format: string;           // Detected or specified format
  confidence: 'high' | 'medium' | 'low';
  preview: {
    key?: string;
    title?: string;
    artist?: string;
    sections: Array<{
      name: string;
      chordCount: number;
      firstChords: string[]; // First 5 chords
    }>;
  };
  error?: string;  // If parsing failed
}
```

### Frontend API Client Updates

Add to `api.ts`:
```typescript
export async function detectFormat(
  text: string,
  formatHint?: string
): Promise<DetectFormatResponse> {
  const resp = await fetch('/api/detect-format', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, format_hint: formatHint }),
  });
  if (!resp.ok) {
    throw new Error('Format detection failed');
  }
  return resp.json();
}
```

## Component Props

### FormatBadge
```typescript
interface FormatBadgeProps {
  format: string;
  confidence: 'high' | 'medium' | 'low';
  isManual: boolean;  // True if user manually selected
  onClick?: () => void;  // Opens format selector
}
```

### FormatSelector
```typescript
interface FormatSelectorProps {
  selectedFormat: string;
  onSelect: (format: string) => void;
  onClose: () => void;
}
```

### ParsePreview
```typescript
interface ParsePreviewProps {
  preview: DetectFormatResponse['preview'] | null;
  isLoading: boolean;
  error?: string;
  isExpanded: boolean;
  onToggle: () => void;
}
```

## Accessibility

- Format badge has proper ARIA label: "Detected format: {format name}"
- Format selector is keyboard navigable
- Preview toggle has ARIA expanded state
- All interactive elements have focus indicators
- Color is not the only indicator (icons + text labels)

## Mobile Considerations

- Format badge wraps on small screens
- Format selector is full-width modal on mobile
- Preview panel is full-width and scrollable
- Touch targets are minimum 44x44px

## Performance

- Format detection debounced to 500ms to avoid excessive API calls
- Preview uses lazy rendering (only parses when expanded)
- Results cached for same input text
- Format detection runs in background, doesn't block typing

## Future Enhancements (Not in this story point)

- Show syntax highlighting in preview
- Allow editing preview before analysis
- Save user's preferred format per source
- Learning from user corrections to improve auto-detection
