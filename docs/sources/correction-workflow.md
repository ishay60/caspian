# User Correction Workflow

## User Journey

### Step 1: Fetch Hebrew Song
User searches and selects a Hebrew song from Tab4u.

### Step 2: Review Analysis
System displays chord analysis with potential issues flagged.

### Step 3: Correction Interface
If user notices errors, click "Report Issue" or "Edit Chords".

**Correction Options:**
- Fix individual chord symbol
- Adjust section boundaries
- Add missing sections
- Correct lyrics-to-chord alignment

### Step 4: Save Correction
**Local Storage** (Phase 2):
- Save corrected version to localStorage
- Associate with original URL
- Next fetch from same URL uses corrected version

**Cloud Sync** (Phase 7+):
- Upload correction to server
- Community voting on corrections
- High-confidence corrections auto-applied

### Step 5: Correction Metadata
Track:
- Original URL
- Corrections made (diff format)
- User ID (if logged in)
- Timestamp
- Confidence score

## Implementation Strategy

### Phase 2 (Current): Local Corrections

Store in localStorage:
```typescript
{
  "tab4u:12345": {
    "url": "https://tab4u.com/...",
    "corrections": {
      "sections": {
        "verse1": {
          "chords": [
            { "original": "Am", "corrected": "A", "position": 0 }
          ]
        }
      }
    },
    "corrected_at": "2026-02-24T...",
    "confidence": "user_edited"
  }
}
```

### Phase 7+: Community Corrections

Database schema:
- corrections table
- correction_votes table
- users table
- Voting system (upvote/downvote)
- Auto-apply when confidence > 80%

## Detailed Workflow Scenarios

### Scenario 1: Simple Chord Correction

**User Action**: Notices "Am" should be "A" in verse 1

**System Response**:
1. Enable edit mode for that chord
2. Show inline editor with autocomplete
3. Validate chord symbol on change
4. Save to localStorage with metadata
5. Display "Local Edit" indicator

**Data Structure**:
```typescript
{
  type: 'chord_symbol',
  section: 'verse1',
  line_index: 0,
  chord_index: 2,
  original: 'Am',
  corrected: 'A',
  timestamp: '2026-02-24T15:30:00Z',
  user_note: 'Should be major, not minor'
}
```

### Scenario 2: Section Boundary Adjustment

**User Action**: Realizes chorus starts earlier than marked

**System Response**:
1. Show section boundary editor
2. Allow drag-and-drop of section markers
3. Recalculate analysis for affected sections
4. Save structural change to localStorage

**Data Structure**:
```typescript
{
  type: 'section_boundary',
  section: 'chorus',
  original_start_line: 8,
  corrected_start_line: 6,
  timestamp: '2026-02-24T15:32:00Z'
}
```

### Scenario 3: Adding Missing Section

**User Action**: Song is missing bridge section

**System Response**:
1. Show "Add Section" button
2. Allow user to specify section type and location
3. Provide empty section template or paste area
4. Parse and validate chord content
5. Save to localStorage

**Data Structure**:
```typescript
{
  type: 'section_addition',
  section: 'bridge',
  insert_after: 'chorus2',
  content: 'Bridge:\n| Dm | G | C | Am |\n...',
  timestamp: '2026-02-24T15:35:00Z'
}
```

### Scenario 4: Lyrics-to-Chord Alignment

**User Action**: Chord positioned above wrong syllable

**System Response**:
1. Show alignment grid with chord positions
2. Allow horizontal dragging of chord markers
3. Update column positions in ChordLyricsLine model
4. Save alignment corrections

**Data Structure**:
```typescript
{
  type: 'alignment_correction',
  section: 'verse1',
  line_index: 2,
  chord_adjustments: [
    { chord: 'Dm', original_col: 5, corrected_col: 7 }
  ],
  timestamp: '2026-02-24T15:40:00Z'
}
```

## Correction Application Logic

### On Sheet Fetch
```typescript
async function fetchAndCorrect(url: string): Promise<Analysis> {
  // 1. Fetch original sheet
  const originalSheet = await fetchFromTab4u(url);

  // 2. Check for local corrections
  const corrections = correctionManager.getCorrections(url);

  // 3. Apply corrections if present
  if (corrections) {
    const correctedSheet = applyCorrections(originalSheet, corrections);
    correctedSheet.metadata.has_local_corrections = true;
    correctedSheet.metadata.correction_count = corrections.length;
    return correctedSheet;
  }

  return originalSheet;
}
```

### Correction Application Order
1. **Structural corrections first**: Section boundaries, additions
2. **Chord symbol corrections**: Replace chord symbols
3. **Alignment corrections last**: Adjust positioning

### Validation Rules
- **Chord symbols**: Must parse correctly using existing chord parser
- **Section names**: Must match known section types or be custom
- **Alignment**: Column positions must be within line bounds
- **No duplicate corrections**: Same position can't have multiple corrections

## User Interface Elements

### Correction Mode Indicator
```
┌─────────────────────────────────────────┐
│ ✏️ Edit Mode Active                     │
│ Click any chord to edit                 │
│ [Save All] [Cancel] [Revert to Original]│
└─────────────────────────────────────────┘
```

### Inline Chord Editor
```
Section: פזמון
┌──────────────────────────────────────┐
│ [Am] → [✎ A    ]  💾 ❌              │
│       └─ autocomplete dropdown       │
│ יום שישי חזר                         │
└──────────────────────────────────────┘
```

### Correction History Panel
```
┌─────────────────────────────────────────┐
│ Local Corrections (3)                   │
│ • Verse 1, chord 2: Am → A              │
│ • Chorus, alignment adjusted            │
│ • Added bridge section                  │
│                                         │
│ [Export] [Import] [Clear All]           │
└─────────────────────────────────────────┘
```

### Correction Confidence Badges
```
🟢 User Verified (you edited this)
🟡 Community Suggested (5+ votes, Phase 7+)
🔵 Expert Verified (musicologist review, Phase 7+)
```

## Import/Export

### Export Format (JSON)
```json
{
  "version": "1.0",
  "song": {
    "title": "יום שישי חזר",
    "artist": "מתי כספי",
    "source_url": "https://tab4u.com/...",
    "source": "tab4u"
  },
  "corrections": [
    {
      "type": "chord_symbol",
      "section": "verse1",
      "original": "Am",
      "corrected": "A",
      "position": { "line": 0, "chord": 2 },
      "timestamp": "2026-02-24T15:30:00Z",
      "note": "Should be major"
    }
  ],
  "metadata": {
    "corrected_by": "user_local",
    "total_corrections": 1,
    "last_updated": "2026-02-24T15:30:00Z"
  }
}
```

### Import Flow
1. User clicks "Import Corrections"
2. Paste JSON or upload file
3. Validate correction format
4. Preview changes
5. Confirm and apply
6. Merge with existing corrections (if any)

## Error Handling

### Invalid Chord Symbol
```
❌ Error: "Amx7" is not a valid chord symbol
   Suggestions: Am7, Amaj7, Am(maj7)
```

### Conflicting Corrections
```
⚠️ Warning: You already corrected this chord to "A"
   Do you want to:
   [ ] Keep existing correction (A)
   [ ] Replace with new correction (Am7)
   [ ] Cancel
```

### Parsing Failure After Correction
```
❌ Error: Corrected chord sheet failed to parse
   Line 5: Unrecognized chord symbol "Xm"
   [Revert Last Change] [Edit Manually]
```

## Future Enhancements (Phase 7+)

### Community Voting
- Upvote/downvote corrections
- Reputation system for contributors
- Auto-apply high-confidence corrections

### Expert Review
- Flag corrections for musicologist review
- Expert verification badge
- Override low-confidence community votes

### Conflict Resolution
- Multiple users suggest different corrections
- Voting decides winner
- Tie-breaker: expert review or original

### Analytics
- Track most commonly corrected songs
- Identify systematic Tab4u issues
- Improve parser based on correction patterns
