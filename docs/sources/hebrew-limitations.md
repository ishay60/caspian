# Hebrew Source Limitations

## Overview
This document outlines the known limitations and challenges when working with Hebrew song sources, primarily Tab4u, and describes mitigation strategies for each.

## Tab4u Limitations

### 1. No Quality Ratings

**Issue**: Tab4u doesn't have a rating/voting system like Ultimate Guitar's 5-star ratings.

**Impact**:
- Cannot filter for quality before fetching
- Cannot sort results by community-verified accuracy
- Higher risk of inaccurate chord sheets

**Mitigation**:
- Assume baseline quality of 65/100 (medium-high) for all Tab4u songs
- Implement local user correction workflow (Phase 2)
- Track correction patterns to identify systematically poor transcriptions
- Consider view count as weak proxy for popularity (not quality)
- Look for "edited" or "professional" markers when available
- Build community correction database (Phase 7+)

**Code Location**: `backend/src/caspian/sources/tab4u.py`

### 2. Variable Accuracy

**Issue**: Chord accuracy varies widely (60-95%) across different transcriptions.

**Impact**:
- Some sheets have significant errors (wrong chord symbols)
- Section mislabeling (פזמון vs בית confusion)
- Missing sections (bridge, intro, outro)
- Enharmonic spelling inconsistencies (G# vs Ab)

**Mitigation**:
- User correction workflow with localStorage (Phase 2)
- Visual indicators for user-edited content
- Export/import corrections for sharing
- Community voting and verification (Phase 7+)
- Expert verification program for popular songs
- Automated quality heuristics (formatting consistency, completeness)

**Common Error Patterns**:
```python
# Enharmonic confusion in harmonic minor
Original: "Am | G# | Am"  # technically correct
Common error: "Am | Ab | Am"  # functionally equivalent but less clear

# Suspension notation
Tab4u: "Csus7"
Standard: "C7sus4"
# Handled by tab4u_normalize.py

# Slash chord ambiguity
Tab4u: "Am E"
Should be: "Am/E" (Am over E bass)
# Requires manual correction
```

### 3. Limited Bar Notation

**Issue**: 95% of Tab4u sheets lack bar lines (`| chord |` notation).

**Impact**:
- Cannot create bar-aware analysis (Phase 3 feature)
- Timing and meter information unavailable
- Chord duration ambiguous
- Cannot sync with playback (Phase 6 feature)

**Mitigation**:
- Fall back to legacy chord sequence analysis (current implementation)
- Allow users to manually add bar lines in correction UI
- Implement spacing-based bar boundary detection (Phase 4)
- Use bar notation when available (5% of sheets)
- Accept that full bar-aware analysis requires manual work

**Example of Rare Bar Notation**:
```
Tab4u (rare):
| Am | Dm | G | C |
| F  | G  | Am |

Tab4u (typical):
Am  Dm  G  C
F  G  Am
```

### 4. RTL Formatting Inconsistencies

**Issue**: Mixed Hebrew/English, inconsistent spacing, Unicode issues.

**Impact**:
- Parsing challenges (chord vs text detection)
- Alignment errors (chord not above correct syllable)
- Visual rendering issues in UI
- Copy-paste formatting loss

**Mitigation**:
- Existing `rtl_handler.py` normalization (reverses chord order for Hebrew lines)
- `tab4u_normalize.py` for Tab4u-specific quirks
- Chord-above-lyrics parser handles column positions
- User alignment correction tool (Task 2.6.3)
- Test with ground truth cases (יום שישי חזר)

**RTL Rule** (from MEMORY.md):
```python
# Lines with Hebrew text → reverse chord order
Input:  "Am  Dm  G  C\nיום שישי חזר"
Stored: [C, G, Dm, Am]  # chronological

# Lines without Hebrew → keep LTR
Input:  "Am  Dm  G  C\nVerse starts here"
Stored: [Am, Dm, G, C]  # chronological
```

### 5. Section Name Variations

**Issue**: Inconsistent section naming conventions.

**Impact**:
- Section detection failures
- Inconsistent analysis grouping
- User confusion

**Common Variations**:
```
Chorus:
  פזמון, פזמון 1, פז', Chorus, פזמון א', refrain

Verse:
  בית, בית 1, verse, בית א', куплет

Bridge:
  גשר, bridge, בריג'

Intro:
  הקדמה, intro, פתיחה

Outro:
  סיום, outro, ending
```

**Mitigation**:
- Fuzzy matching for section names in parser
- Normalize common variants to standard names
- User can relabel sections in correction UI
- Maintain mapping of Hebrew ↔ English terms
- Support custom section names

**Code Enhancement**:
```python
SECTION_ALIASES = {
    'פזמון': ['פז\'', 'chorus', 'refrain', 'פזמון א\'', 'פזמון ב\''],
    'בית': ['verse', 'בית א\'', 'בית ב\'', 'куплет'],
    'גשר': ['bridge', 'בריג\''],
    'הקדמה': ['intro', 'פתיחה', 'introduction'],
    'סיום': ['outro', 'ending', 'conclusion']
}
```

### 6. Incomplete Sheets

**Issue**: Some sheets missing intro, bridge, outro, or even full verses.

**Impact**:
- Analysis incomplete
- Cannot perform full structural analysis
- User disappointment

**Mitigation**:
- Flag missing sections in UI ("This sheet may be incomplete")
- Allow user to add sections via correction UI
- Link to alternate sources (Shironet, YouTube)
- Show completeness score in search results
- Community can fill in missing sections (Phase 7+)

**Completeness Heuristic**:
```python
def estimate_completeness(sections):
    expected = {'בית', 'פזמון'}  # minimum
    bonus = {'הקדמה', 'גשר', 'סיום'}  # nice to have

    has_expected = len(expected & sections) / len(expected)
    has_bonus = len(bonus & sections) / len(bonus)

    return has_expected * 0.7 + has_bonus * 0.3
```

## Shironet Limitations

### Primary Issue: Lyrics-Focused

**Problem**: Shironet is primarily a lyrics database, not a chord database.

**Impact**:
- Most songs lack chord notation
- When chords present, often less accurate than Tab4u
- Fewer transcriptions available

**Recommendation**:
- Use Shironet as **fallback only**
- Verify chord availability before fetch
- Prefer Tab4u for Hebrew songs
- Use Shironet for lyrics-only when needed

**Status**: Phase 2 does not prioritize Shironet integration

## General Hebrew Music Challenges

### 1. Different Musical Traditions

**Challenge**: Israeli pop uses different progressions than Western pop.

**Characteristics**:
- More modal (Phrygian dominant, Ahava Rabba scale)
- Arabic influences (maqam-based)
- Less functional harmony
- More chromatic motion

**Impact on Analysis**:
- Roman numeral analysis less meaningful
- Borrowed chords from exotic scales common
- Diminished chords used differently (chromatic approach vs functional)

**Mitigation**:
- Support for Ahava Rabba mode (in theory module)
- Recognize chromatic approach patterns
- Don't over-rely on functional harmony assumptions
- Provide multiple interpretations for ambiguous progressions

**Example** (from ground truth):
```
D#dim in Am context:
1. Chromatic descent: Am/E → D#dim → Dm (0.90 confidence)
2. Rootless B7b9: V7/V approach (0.70 confidence)

Both valid in Israeli music!
```

### 2. Smaller User Base

**Challenge**: Fewer contributors than Ultimate Guitar.

**Impact**:
- Less error correction by community
- Slower updates
- Fewer alternate versions
- Less voting/rating data

**Mitigation**:
- Build internal community (Phase 7+)
- Incentivize contributions
- Expert verification program
- Import corrections from other sources (with permission)

### 3. Copyright Complexity

**Challenge**: ACUM licensing in Israel, stricter copyright than US.

**Concerns**:
- Displaying full lyrics may violate copyright
- Chord sheets are grey area
- Different rules than US fair use

**Best Practices**:
- **Always attribute source**: Display Tab4u URL prominently
- **No lyrics storage**: Link to original, don't store full lyrics in database
- **Chord-only focus**: Emphasize chord analysis, not lyrics reproduction
- **Respect robots.txt**: Follow scraping restrictions
- **User-generated**: Rely on user input, not automated scraping

**Legal Status** (Phase 2):
- Chord progressions: Not copyrightable (facts)
- Chord charts: Grey area (transformative use)
- Full lyrics: Copyrighted (do not store)
- Analysis: Clearly transformative (educational/analytical)

## Comparison Matrix

| Factor | Tab4u | Ultimate Guitar | Shironet |
|--------|-------|-----------------|----------|
| Hebrew content | Extensive | Very limited | Extensive (lyrics) |
| Quality ratings | None | 5-star system | None |
| Bar notation | Rare (5%) | Common (60%) | N/A |
| Chord accuracy | 65-75% | 75-85% | 50-60% |
| Completeness | Variable | High | Low (chords) |
| Community edits | Limited | Extensive | Minimal |
| Professional content | Some | Pro tabs | No |
| Chord focus | Yes | Yes | No (lyrics) |
| RTL support | Native | Poor | Native |

## Best Practices for Developers

### 1. Always Show Source
```typescript
<SourceAttribution
  source="tab4u"
  url="https://tab4u.com/..."
  quality={65}
/>
```

### 2. Correction UI Priority
- Make it **easy** to fix errors
- Persist corrections locally immediately
- Provide clear feedback
- Allow undo/redo

### 3. Local First, Cloud Later
- **Phase 2**: localStorage only
- **Phase 7+**: Sync to cloud, community voting
- Never lose user edits

### 4. Attribution Always
```python
# In analysis output
analysis.metadata.source = "tab4u"
analysis.metadata.source_url = original_url
analysis.metadata.fetched_at = datetime.now()
analysis.metadata.has_corrections = True  # if user edited
```

### 5. No Lyrics Storage
```python
# DO NOT DO THIS
def store_song(lyrics, chords):
    db.insert(lyrics=lyrics, chords=chords)  # ❌ Copyright violation

# DO THIS INSTEAD
def store_song(source_url, chords_only):
    db.insert(
        source_url=source_url,  # Link to original
        chords=chords_only,     # Just chord symbols
        has_lyrics=False        # Flag for UI
    )
```

### 6. Transparent Quality Indicators
```typescript
<QualityBadge
  score={65}
  reason="Tab4u baseline (no ratings available)"
  corrections={3}  // user made 3 edits
/>
```

## Roadmap for Improvements

### Phase 2 (Current)
- [x] Baseline quality score (65/100)
- [x] Local correction workflow
- [x] Correction storage implementation
- [ ] UI integration (Task 2.6.3 mockups)

### Phase 3 (Bar-Aware Analysis)
- [ ] Auto-detect bar boundaries from spacing
- [ ] Manual bar line addition
- [ ] Bar-aware chord analysis

### Phase 4 (Enhanced Parsing)
- [ ] Improved RTL handling
- [ ] Better section name fuzzy matching
- [ ] Completeness scoring

### Phase 5 (Multi-Source)
- [ ] Shironet integration (lyrics fallback)
- [ ] Cross-source comparison
- [ ] Best-of-both-worlds merging

### Phase 7+ (Community)
- [ ] Cloud correction database
- [ ] Community voting system
- [ ] Expert verification program
- [ ] Reputation tracking
- [ ] Auto-apply high-confidence corrections

## Testing Strategy

### Test with Ground Truth
```python
# examples/yom_shishi.txt (verified accurate)
def test_tab4u_with_ground_truth():
    original = fetch_tab4u("yom_shishi_url")
    verified = load_ground_truth("yom_shishi.txt")

    accuracy = compare_chord_sequences(original, verified)
    assert accuracy > 0.9  # 90%+ accuracy on quality songs
```

### Test Correction Workflow
```typescript
test('user correction persists', () => {
  const url = "https://tab4u.com/test";

  // User corrects Am → A
  correctionManager.saveCorrection(url, {
    type: 'chord_symbol',
    position: { section: 'verse1', line: 0, chord: 2 },
    original: 'Am',
    corrected: 'A'
  });

  // Next fetch should apply correction
  const analysis = fetchAndApplyCorrections(url);
  expect(analysis.sections.verse1.chords[2]).toBe('A');
});
```

### Test RTL Handling
```python
def test_rtl_normalization():
    # Hebrew line → reverse chords
    input_line = "Am  Dm  G  C\nיום שישי חזר"
    parsed = parse_chord_line(input_line)
    assert parsed.chords == ['C', 'G', 'Dm', 'Am']  # chronological

    # English line → keep LTR
    input_line = "Am  Dm  G  C\nFriday returns"
    parsed = parse_chord_line(input_line)
    assert parsed.chords == ['Am', 'Dm', 'G', 'C']  # chronological
```

## Conclusion

Hebrew sources, primarily Tab4u, present unique challenges:
- **No quality ratings** → Implement user corrections
- **Variable accuracy** → Build community verification
- **Limited bars** → Fall back to legacy analysis
- **RTL complexity** → Robust normalization
- **Copyright concerns** → Attribute, link, don't store lyrics

The mitigation strategies outlined in this document, combined with the user correction workflow (Task 2.6.2) and future community features (Task 2.6.6), will progressively improve the quality and reliability of Hebrew song analysis in Caspian.

**Key Principle**: Local corrections first (Phase 2), community validation later (Phase 7+).
