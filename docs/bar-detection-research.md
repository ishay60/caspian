# Bar Detection Heuristics - Research Document

**Created:** 2026-02-24
**Author:** Claude Code
**Story Point:** 4.7 - Auto-Bar Detection Heuristic

## Overview

This document provides research findings on automatic bar detection heuristics for chord sheets. The goal is to intelligently suggest bar divisions in chord sequences, helping users structure their songs with minimal manual effort.

## Common Bar Patterns

### 1. Chords-Per-Bar Pattern (Most Common)

**2 Chords Per Bar (4/4 time)**
- Most common in popular music, folk, rock
- Each chord gets 2 beats
- Pattern: `| chord1 chord2 | chord3 chord4 |`
- Example: `| Am F | C G |` (verse progression)
- **Confidence Indicator:** Consistent 2-chord groupings across multiple lines

**4 Chords Per Bar (Fast Changes)**
- Common in jazz, complex progressions
- Each chord gets 1 beat
- Pattern: `| chord1 chord2 chord3 chord4 |`
- Example: `| Cmaj7 Dm7 Em7 Fmaj7 |`
- **Confidence Indicator:** Evenly-spaced chords, jazz context

**1 Chord Per Bar (Slow Songs)**
- Ballads, worship songs, simple folk
- One chord sustains entire bar
- Pattern: `| chord1 | chord2 |`
- Example: `| Am | Dm | F | C |`
- **Confidence Indicator:** Wide spacing between chords, slow tempo indicated

### 2. Duration-Based Heuristics

**Spacing Analysis (ChordLyricsLine)**
When chords are positioned above lyrics, the horizontal spacing indicates duration:

```
Am              F               C               G
I've been looking for freedom, freedom from fear
```

**Calculation Method:**
1. Measure column position differences between consecutive chords
2. Calculate relative duration ratios
3. Larger gaps = longer duration = likely bar boundary after previous chord

**Spacing Ratios:**
- **Small gap (< 5 characters):** Quick chord change (within same bar)
- **Medium gap (5-12 characters):** Half-bar duration (possible bar boundary)
- **Large gap (> 12 characters):** Full bar duration (strong bar boundary indicator)

**Special Cases:**
- Empty space after last chord in line → likely bar boundary
- Chord at end of lyrics line → likely bar boundary before next line

### 3. Repeated Pattern Recognition

**Chord Progression Repetition**
Many songs use repeating harmonic patterns:

```
Verse:  | Am F | C G | Am F | C G |
Chorus: | F C | G Am | F C | G Am |
```

**Detection Strategy:**
1. Identify sequences of 2-8 chords that repeat
2. If pattern repeats ≥2 times, treat each repetition as bar group
3. Handle variations: transpositions, substitutions (relative chords)

**Pattern Types:**
- **Exact repetition:** `Am F C G | Am F C G` → bars after every 4 chords
- **Transposed repetition:** `Am F C G | Dm Bb F C` → same structure, different key
- **Functional repetition:** `I vi IV V | I vi IV V` → same roman numerals

**Confidence Scoring:**
- Exact repetition: 0.9+
- Transposed repetition: 0.8
- Functional repetition: 0.7

### 4. Song Structure Clues

**Section Boundaries**
Section markers often indicate bar boundaries:

```
[Verse]
Am F C G
Am F C G

[Chorus]
F C G Am
F C G Am
```

**Heuristic:**
- First chord of new section → start of new bar (confidence: 0.95)
- Last chord before section change → end of bar (confidence: 0.90)

**Line Breaks**
In many chord sheets, each line represents 1-2 bars:

```
Line 1: Am F C G        → possibly 2 bars
Line 2: Dm G C          → possibly 1.5 bars or 2 bars
```

**Detection:**
- Count chords per line across section
- If consistent (e.g., always 4 chords), divide into bars
- If variable, use duration heuristics

### 5. Time Signature Inference

**4/4 Time (Common Time) - Default**
- Most popular/rock/folk songs
- 4 beats per bar
- Common patterns: 1, 2, or 4 chords per bar

**3/4 Time (Waltz)**
- 3 beats per bar
- Common patterns: 1 or 3 chords per bar
- Indicators: "waltz" in title, dance context

**6/8 Time (Compound Meter)**
- 6 beats per bar (felt in two)
- Common patterns: 2 or 6 chords per bar
- Indicators: Irish folk, ballads

**Inference Heuristics:**
- Default to 4/4 unless evidence suggests otherwise
- Check for divisibility by 3 (waltz indicator)
- Check for groups of 6 (compound meter)

### 6. Musical Context Indicators

**Chord Function Patterns**
Certain chord progressions suggest bar boundaries:

**Cadence Points (Strong Bar Boundaries):**
- V → I progression (e.g., G → C)
- IV → I progression (e.g., F → C)
- ii → V progression (e.g., Dm → G)

**Weak Bar Boundaries:**
- I → IV progression (often mid-bar)
- vi → IV progression (often mid-bar)

**Heuristic:**
1. Analyze chord functions in detected key
2. Boost confidence for bar lines after cadences
3. Reduce confidence for bar lines in middle of progressions

### 7. Lyrics Syllable Alignment

**Strong Syllable Correlation**
In Hebrew and English, strong syllables often align with bar downbeats:

```
Am        F         C         G
יום שישי  חזר אלי   הביתה    שוב
```

**Detection:**
1. Identify stressed syllables (first syllable of Hebrew words)
2. Check if chords align with stressed syllables
3. Suggest bar boundaries at stressed syllable positions

**Confidence:**
- Chord + stressed syllable: +0.15 to confidence
- Chord + unstressed syllable: -0.05 from confidence

## Combined Heuristic Algorithm

### Algorithm Pseudocode

```python
def detect_bars(chord_sequence: list[str], lyrics: str | None = None) -> list[BarSuggestion]:
    """
    Detect bar boundaries using multiple heuristics.

    Returns list of suggested bar boundary positions with confidence scores.
    """
    suggestions = []

    # Heuristic 1: Chords-per-line consistency
    consistency_score = analyze_chord_count_consistency(chord_sequence)
    if consistency_score.pattern == "2_per_bar":
        suggestions.extend(every_n_chords(chord_sequence, n=2, confidence=consistency_score.confidence))
    elif consistency_score.pattern == "4_per_bar":
        suggestions.extend(every_n_chords(chord_sequence, n=4, confidence=consistency_score.confidence))

    # Heuristic 2: Spacing analysis (if ChordLyricsLine available)
    if has_spacing_info(chord_sequence):
        spacing_suggestions = analyze_spacing(chord_sequence)
        suggestions.extend(spacing_suggestions)

    # Heuristic 3: Pattern repetition
    pattern_suggestions = find_repeating_patterns(chord_sequence)
    suggestions.extend(pattern_suggestions)

    # Heuristic 4: Cadence detection
    cadence_suggestions = detect_cadences(chord_sequence, detected_key)
    suggestions.extend(cadence_suggestions)

    # Heuristic 5: Section boundaries
    if has_section_markers(chord_sequence):
        section_suggestions = section_boundaries(chord_sequence)
        suggestions.extend(section_suggestions)

    # Combine overlapping suggestions (boost confidence)
    combined = combine_suggestions(suggestions)

    # Apply confidence threshold filtering
    filtered = [s for s in combined if s.confidence >= 0.5]

    return filtered
```

### Confidence Score Calculation

**Base Confidence from Primary Heuristic:**
- Chords-per-line consistency: 0.5-0.8 (based on how consistent)
- Spacing analysis: 0.6-0.9 (based on gap size)
- Pattern repetition: 0.7-0.95 (based on exactness)
- Cadence detection: 0.5-0.7 (supportive evidence)
- Section boundaries: 0.9-0.95 (very strong)

**Confidence Boosting (Multiple Heuristics Agree):**
- 2 heuristics agree: +0.15
- 3 heuristics agree: +0.25
- 4+ heuristics agree: +0.35

**Confidence Penalties:**
- Irregular bar lengths: -0.2
- Conflicting heuristics: -0.15
- Odd time signature (not 4/4, 3/4, 6/8): -0.1

**Final Confidence Ranges:**
- **High (0.8-1.0):** Auto-apply with user notification
- **Medium (0.5-0.8):** Show suggestion, require user confirmation
- **Low (<0.5):** Don't suggest, let user manually add

## Edge Cases

### 1. Pickup Measures (Anacrusis)
Some songs start mid-bar:

```
| (incomplete) | Am F | C G |
```

**Detection:**
- First bar has fewer chords than pattern
- First chord before section marker
- **Handling:** Mark first bar as incomplete, don't penalize

### 2. Fermata / Held Chords
Long pauses or held notes can break patterns:

```
| Am F | C (fermata - held) | G Am |
```

**Detection:**
- Unusually large spacing before/after chord
- "fermata", "pause", "hold" in lyrics/annotations
- **Handling:** Reduce confidence for adjacent suggestions

### 3. Mixed Meter
Some songs change time signature mid-song:

```
[Verse - 4/4]
| Am F | C G |

[Bridge - 3/4]
| Dm | G | C |
```

**Handling:**
- Detect time signature per section independently
- Don't enforce consistency across sections

### 4. No Clear Pattern
Some songs (especially jazz, experimental) have irregular bar structures:

```
Am F G | C | Dm Em F G Am |
```

**Handling:**
- Low confidence across all heuristics
- Don't auto-suggest
- Provide manual bar editor

## Validation & Testing Strategy

### Test Categories

1. **Simple Songs (High Confidence)**
   - 2-chord patterns (Let It Be, Wonderwall)
   - 4-chord patterns (Country roads)
   - Expected accuracy: 95%+

2. **Moderate Songs (Medium Confidence)**
   - Mixed patterns (some 2-chord, some 4-chord bars)
   - Songs with tempo changes
   - Expected accuracy: 80%+

3. **Complex Songs (Low Confidence)**
   - Jazz standards (frequent changes)
   - Progressive rock (odd meters)
   - Expected accuracy: 60%+ (user correction expected)

4. **Hebrew Songs**
   - "יום שישי חזר" (Am, 2-chord pattern)
   - "אוהב אותך" (Bbm, chord-above-lyrics)
   - Expected accuracy: 85%+

### Metrics

- **Precision:** % of suggested bars that are correct
- **Recall:** % of actual bars that were detected
- **F1 Score:** Harmonic mean of precision and recall
- **User Acceptance Rate:** % of suggestions users accept

### Iterative Improvement

1. Collect user corrections
2. Analyze patterns in rejected suggestions
3. Adjust heuristic weights
4. Re-test on validation set
5. Deploy improved algorithm

## References

- ChordPro format specification (bar notation patterns)
- Ultimate Guitar user data (common patterns)
- Music theory: cadences, phrase structure
- Existing tools: iReal Pro, Band-in-a-Box (auto-arrangement)

## Future Enhancements (Phase 7+)

1. **Machine Learning Model**
   - Train on user corrections
   - Learn genre-specific patterns
   - Improve accuracy over time

2. **Audio Analysis Integration**
   - If audio available, detect actual bar boundaries from waveform
   - Use beat tracking algorithms
   - Cross-validate with heuristics

3. **Community Wisdom**
   - Aggregate bar divisions from multiple users for same song
   - Use voting to determine canonical bar structure
   - Build confidence based on consensus
