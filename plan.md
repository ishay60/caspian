# Hebrew Harmonic Analysis Tool — Complete Project Specification

## Project Overview

Build a Python-based harmonic analysis tool for Hebrew-language chord charts (primarily from tab4u.com and israeli-guitar.com). The tool takes guitar chord progressions of Israeli songs, performs deterministic music theory analysis, then uses an LLM (Claude API) to generate interpretive analysis including text-painting (how harmony relates to lyrics).

The target user is an experienced guitarist (20+ years) who wants to understand the theory behind songs they already play. The tool is a collaborator — it proposes analysis, the user corrects it, and the tool learns.

---

## Table of Contents

1. [Domain Knowledge: Israeli Chord Charts](#1-domain-knowledge-israeli-chord-charts)
2. [Domain Knowledge: Music Theory Scope](#2-domain-knowledge-music-theory-scope)
3. [Architecture Overview](#3-architecture-overview)
4. [Module 1: Chord Input & RTL Handling](#4-module-1-chord-input--rtl-handling)
5. [Module 2: Chord Parser](#5-module-2-chord-parser)
6. [Module 3: Music Theory Engine](#6-module-3-music-theory-engine)
7. [Module 4: Analytical Engine](#7-module-4-analytical-engine)
8. [Module 5: LLM Integration Layer](#8-module-5-llm-integration-layer)
9. [Module 6: Output Generator](#9-module-6-output-generator)
10. [Module 7: User Correction Loop](#10-module-7-user-correction-loop)
11. [Data Structures](#11-data-structures)
12. [Edge Cases & Lessons Learned](#12-edge-cases--lessons-learned)
13. [Development Phases](#13-development-phases)
14. [Test Cases](#14-test-cases)
15. [Reference: Complete Analysis of "יום שישי חזר"](#15-reference-complete-analysis-example)

---

## 1. Domain Knowledge: Israeli Chord Charts

### 1.1 Sources

| Source              | Quality               | Detail Level                                    | Accessibility                                     |
| ------------------- | --------------------- | ----------------------------------------------- | ------------------------------------------------- |
| tab4u.com           | Good general accuracy | Simplified (basic triads, some 7ths)            | JS-rendered, needs headless browser or screenshot |
| israeli-guitar.com  | High accuracy         | Detailed (slash chords, extensions, dims, augs) | Blocked by robots.txt                             |
| chordify.net        | AI-generated          | Basic (key + main chords)                       | API available but limited                         |
| shironet.mako.co.il | Variable              | Sometimes missing chords entirely               | HTML scrapeable                                   |

**Primary source is tab4u.** The project file states: "it will not be 100% correct but tab4u generally gives good chords."

### 1.2 The RTL/LTR Reading Direction Problem (CRITICAL)

This is the single most important domain rule. Getting this wrong makes the entire analysis incorrect.

**Rule:**

- **Lines WITHOUT Hebrew lyrics** (intros, outros, instrumental sections): Chords read **LEFT to RIGHT** (LTR), standard Western reading.
- **Lines WITH Hebrew lyrics** (verses, choruses, bridges): Chords read **RIGHT to LEFT** (RTL), following Hebrew text direction. The chords are positioned above the Hebrew words they accompany, so they follow the same reading direction.

**Example from "יום שישי חזר" intro (no lyrics, LTR):**

```
Displayed: Am Am D D Am Am D D
Read as:   Am → Am → D → D → Am → Am → D → D  ✓
```

**Example from verse (with lyrics, RTL):**

```
Displayed:        D  Am
Hebrew text: יום שישי חזר
Read as:   Am → D  (right to left!)
```

**Example from chorus (with lyrics, RTL):**

```
Displayed:     D#dim    Am/E
Hebrew text: יש אולי סיכוי קרוב
Read as:   Am/E → D#dim  (right to left!)
```

**How this caused real errors in our analysis:**
We initially analyzed D#dim → Am/E (bass rising D#→E, "chromatic approach from below") when the actual progression was Am/E → D#dim (bass falling E→D#, "chromatic descent, ground falling away"). The entire narrative interpretation was inverted.

**Detection heuristic:**

- If the line contains Hebrew Unicode characters (U+0590 to U+05FF), read chords RTL
- If the line contains only ASCII/Latin characters (chord symbols, dashes, spaces), read LTR
- If a section is labeled "פתיחה" (intro) or "סיום" (outro) with no accompanying text, read LTR

### 1.3 tab4u Chord Notation Conventions

- Major chords: just the letter — `A`, `B`, `C`, `D`, `E`, `F`, `G`
- Minor chords: letter + `m` — `Am`, `Dm`, `Em`
- Seventh: `7` — `E7`, `B7`
- Suspended: `sus4`, `sus2` — but tab4u sometimes writes `Bsus7` meaning `B7sus4`
- Diminished: `dim` — `D#dim`, `F#dim`
- Half-diminished: `m7b5` — `Bm7b5`
- Augmented: `aug` or `+`
- Slash chords: `Am/E`, `A/C#`, `Am/C` — root chord / bass note
- Sixth: `6` — `A6`
- Major seventh: `maj7` or `M7` — `Fmaj7`
- Added ninth: usually not present in tab4u (too simplified)

**Important:** In a minor key context, when tab4u writes a plain letter like `B` or `E`, it means the MAJOR chord (not minor). This is because they only add `m` for minor. So in Am:

- `B` = B major (non-diatonic! It's V/v, a secondary dominant)
- `E` = E major (non-diatonic in natural minor! It's V from harmonic minor)
- `Em` = E minor (diatonic — natural minor v)
- `Bm7b5` = B half-diminished (diatonic — natural minor iiø)

---

## 2. Domain Knowledge: Music Theory Scope

### 2.1 Scales & Modes the Tool Must Know

All scales shown relative to root A for consistency:

| Scale                       | Notes            | Characteristic                     |
| --------------------------- | ---------------- | ---------------------------------- |
| A Natural Minor (Aeolian)   | A B C D E F G    | Default for minor keys             |
| A Harmonic Minor            | A B C D E F G#   | G# = leading tone, makes V major   |
| A Melodic Minor (ascending) | A B C D E F# G#  | F# + G#                            |
| A Dorian                    | A B C D E F# G   | F# = raised 6th, makes IV major    |
| A Phrygian                  | A Bb C D E F G   | Bb = flat 2, Middle Eastern flavor |
| A Phrygian Dominant         | A Bb C# D E F G  | Common in Mizrachi/Eastern music   |
| A Major (Ionian)            | A B C# D E F# G# | Parallel major                     |
| C Major (relative)          | C D E F G A B    | Relative major of Am               |

Israeli music frequently mixes these, sometimes within a single phrase. The tool should not assume one scale per song — it should identify the active scale per chord or per phrase.

### 2.2 Non-Diatonic Chord Types to Detect

**Secondary Dominants (V/x):**
A major or dominant 7th chord that is the V of another diatonic chord.

- In Am: B or B7 = V/v (resolves to Em), A or A7 = V/iv (resolves to Dm), E or E7 = V (resolves to Am, from harmonic minor), D7 = V/♭VII (resolves to G), C7 = V/♭VI (resolves to F), G7 = V/♭III (resolves to C)

**Borrowed Chords:**
Chords taken from a parallel mode:

- D major in Am = borrowed from A Dorian (IV instead of iv)
- A major in Am = borrowed from A Major (parallel major)
- F#m in Am = borrowed from A Major

**Diminished Chords:**
Three analytical possibilities for any diminished chord:

1. **Rootless dominant 7♭9** — e.g., D#dim = B7♭9 without the B (V7♭9/v)
2. **Chromatic approach** — bass moves by half step to the next chord
3. **Common-tone diminished** — shares a tone with the chord it embellishes
   The tool should present ALL valid interpretations with confidence scores.

**Augmented Chords:**
Usually part of a chromatic line (line cliché) where one voice moves chromatically while others stay.

- Example: A → Aaug → Am = the 5th rises E→E#→(then 3rd falls C#→C)

**Deceptive Resolutions:**
When a dominant chord resolves to something other than its expected target:

- V → vi (most common deceptive cadence in major keys)
- V → IV (plagal motion)
- V → iv (in minor — this happened in "יום שישי חזר": E → Dm)
- V/x → y where y ≠ x

### 2.3 Voice Leading Concepts

**Chromatic Bass Lines:**
Consecutive bass notes moving by half step. Can be ascending or descending.

- Example from our analysis: B → C → C# → D (ascending chromatic, bridge of "יום שישי חזר")

**Line Cliché:**
A single voice moves chromatically while the rest of the chord stays. Common patterns:

- Minor line cliché: Am → Am(maj7) → Am7 → Am6 (top voice: A→G#→G→F#)
- Major to minor morph: A → Aaug → Am (fifth rises then third falls)

**Common Tones:**
Notes shared between consecutive chords. More common tones = smoother transition.

- F#dim [F#, A, C] → F [F, A, C]: TWO common tones (A, C), only root moves. Very smooth.

**Minimal Voice Leading:**
The fewer notes that move (and the smaller the distance), the smoother the progression. The tool should calculate a "smoothness score" for each chord transition.

### 2.4 Analytical Vocabulary (for output)

The tool should use these terms in its output:

- **Diatonic** — belongs to the current scale
- **Non-diatonic / Chromatic** — does not belong to the current scale
- **Secondary dominant (דומיננטה שניונית)** — V/x
- **Borrowed chord (שאילה)** — from parallel mode/scale
- **Deceptive resolution (פתרון מטעה)** — dominant resolves to unexpected chord
- **Chromatic approach** — half-step movement to target chord
- **Passing chord (אקורד מעבר)** — connects two chords, usually chromatic
- **Pedal point** — bass note sustained while chords change above
- **Tonicization (טוניציזציה)** — brief shift to treat another chord as temporary tonic
- **Modulation (מודולציה)** — actual key change
- **Text-painting (ציור טקסטואלי)** — when harmonic choices reflect lyrical meaning

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                      USER INPUT                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Manual Entry │  │ Screenshot + │  │ tab4u URL +    │  │
│  │ (chords +   │  │ Vision OCR   │  │ Scraper        │  │
│  │  lyrics)    │  │              │  │ (Playwright)   │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘  │
│         └────────────────┴──────────────────┘            │
│                          │                               │
│                          ▼                               │
│              ┌───────────────────────┐                   │
│              │   RTL/LTR Handler     │                   │
│              │   + Chord Parser      │                   │
│              └───────────┬───────────┘                   │
│                          │                               │
│              Chronological chord sequence                │
│              with aligned lyrics                         │
│                          │                               │
│                          ▼                               │
│         ┌─────────────────────────────────┐              │
│         │    DETERMINISTIC THEORY ENGINE   │              │
│         │                                 │              │
│         │  • Key detection                │              │
│         │  • Roman numeral assignment     │              │
│         │  • Scale membership             │              │
│         │  • Bass line extraction         │              │
│         │  • Interval calculation         │              │
│         │  • Common tone analysis         │              │
│         │  • Voice leading analysis       │              │
│         │  • Secondary dominant detection │              │
│         │  • Borrowed chord detection     │              │
│         │  • Chromatic line detection     │              │
│         │  • Deceptive resolution detect. │              │
│         │  • Pattern detection            │              │
│         └─────────────┬───────────────────┘              │
│                       │                                  │
│          Structured analysis data (JSON)                 │
│                       │                                  │
│                       ▼                                  │
│         ┌─────────────────────────────────┐              │
│         │       LLM ANALYSIS LAYER        │              │
│         │       (Claude API)              │              │
│         │                                 │              │
│         │  • Multi-interpretation ranking │              │
│         │  • Text-painting analysis       │              │
│         │  • Natural language explanation │              │
│         │  • Hebrew musical terminology  │              │
│         └─────────────┬───────────────────┘              │
│                       │                                  │
│                       ▼                                  │
│         ┌─────────────────────────────────┐              │
│         │       OUTPUT GENERATOR          │              │
│         │                                 │              │
│         │  • Interactive HTML             │              │
│         │  • Color-coded chord charts     │              │
│         │  • Bass line visualization      │              │
│         │  • Voice leading diagrams       │              │
│         │  • Summary tables               │              │
│         │  • Bilingual (Hebrew + English) │              │
│         └─────────────┬───────────────────┘              │
│                       │                                  │
│                       ▼                                  │
│         ┌─────────────────────────────────┐              │
│         │     USER CORRECTION LOOP        │              │
│         │                                 │              │
│         │  "This chord order is wrong"    │              │
│         │  "I hear Dm here, not D"        │              │
│         │  "The resolution is to Am/E"    │              │
│         │                                 │              │
│         │  → Re-run analysis pipeline     │              │
│         └─────────────────────────────────┘              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Module 1: Chord Input & RTL Handling

### 4.1 Input Formats

**Format A: Manual Entry (MVP — build this first)**

```
key: Am
title: יום שישי חזר
artist: מתי כספי

[intro]  # no lyrics = LTR
Am Am D D Am Am D D
C C Am B Em Em Em E

[verse]  # has lyrics = RTL
D Am | יום שישי חזר
Am C | בלי שום חדשות
B Em C | יום שישי אכזר
E Am D | שוב שעות קשות

[chorus]
Am/E D#dim | יש אולי סיכוי קרוב
F#dim F | למצוא גן עדן ברחוב
D Am E Dm | ואולי גם לילה טוב
```

Rules:

- Section headers in `[]` brackets
- `[intro]`, `[outro]`, `[instrumental]` → LTR
- Everything else with `|` separator: chords on left, lyrics on right
- If no `|` and no Hebrew → LTR
- If no `|` but Hebrew present → RTL

**Format B: Screenshot → Vision OCR (Phase 2)**

- Accept image (PNG/JPG) of tab4u page
- Send to Claude Vision API with prompt:
  ```
  Extract all chord symbols and their associated lyrics from this Hebrew chord chart.
  Rules:
  - Sections without lyrics: read chords left to right
  - Sections with Hebrew lyrics: read chords right to left
  - Output each line as: chord1 → chord2 → chord3 | lyrics
  - Always output chords in chronological (performance) order
  ```

**Format C: tab4u URL Scraper (Phase 3)**

- Use Playwright (headless Chromium) to load tab4u page with full JS
- Extract chord elements from DOM
- Detect lyrics presence per line
- Apply RTL/LTR rules

### 4.2 RTL Handler

```python
import re

HEBREW_PATTERN = re.compile(r'[\u0590-\u05FF]')

def has_hebrew(text: str) -> bool:
    return bool(HEBREW_PATTERN.search(text))

def normalize_chord_order(chords: list[str], context: str) -> list[str]:
    """
    Given chords as they appear visually (left to right on screen)
    and context text, return chords in chronological performance order.

    If context contains Hebrew → the visual order is RTL → reverse to get chronological.
    If context is ASCII only → the visual order is already LTR/chronological.
    """
    if has_hebrew(context):
        return list(reversed(chords))
    return chords

def detect_section_type(header: str) -> str:
    """Detect if a section header implies instrumental (LTR) or vocal (RTL)."""
    instrumental_keywords = ['intro', 'outro', 'instrumental', 'solo',
                             'פתיחה', 'סיום', 'סולו']
    header_lower = header.lower().strip('[] ')
    for kw in instrumental_keywords:
        if kw in header_lower:
            return 'instrumental'  # LTR
    return 'vocal'  # RTL when lyrics present
```

---

## 5. Module 2: Chord Parser

### 5.1 Requirements

Parse a chord symbol string into a structured object:

```
"Am/E"    → root=A, quality=minor, extensions=[], bass=E
"D#dim"   → root=D#, quality=diminished, extensions=[], bass=D#
"Bm7b5"  → root=B, quality=half-diminished, extensions=[m7,b5], bass=B
"B7sus4"  → root=B, quality=dominant, extensions=[7,sus4], bass=B
"Bsus7"   → root=B, quality=dominant, extensions=[7,sus4], bass=B  # tab4u convention!
"Fmaj7"   → root=F, quality=major, extensions=[maj7], bass=F
"A6"      → root=A, quality=major, extensions=[6], bass=A
"Gsus4"   → root=G, quality=suspended, extensions=[sus4], bass=G
"A/C#"    → root=A, quality=major, extensions=[], bass=C#
"Am/C"    → root=A, quality=minor, extensions=[], bass=C
```

### 5.2 Pitch Representation

Use integer pitch classes (mod 12):

```
C=0, C#/Db=1, D=2, D#/Eb=3, E=4, F=5, F#/Gb=6, G=7, G#/Ab=8, A=9, A#/Bb=10, B=11
```

Chord → pitch set:

```python
def chord_to_pitches(root: int, quality: str, extensions: list) -> list[int]:
    base_intervals = QUALITY_INTERVALS[quality]  # e.g., minor = [0, 3, 7]
    pitches = [(root + i) % 12 for i in base_intervals]
    # Add extensions...
    return pitches
```

### 5.3 tab4u-Specific Normalization

```python
NORMALIZATIONS = {
    'sus7': '7sus4',    # tab4u shorthand
    'Bsus7': 'B7sus4',
    # Add more as discovered
}

ENHARMONIC_PREFERENCES = {
    # In sharp keys, prefer sharps; in flat keys, prefer flats
    # D#dim is preferred over Ebdim when approaching from E (above)
    # Ebdim is preferred when approaching from D (below)
}
```

---

## 6. Module 3: Music Theory Engine

### 6.1 Scale Library

```python
SCALES = {
    'natural_minor':    [0, 2, 3, 5, 7, 8, 10],    # W-H-W-W-H-W-W
    'harmonic_minor':   [0, 2, 3, 5, 7, 8, 11],     # raised 7th
    'melodic_minor':    [0, 2, 3, 5, 7, 9, 11],     # raised 6th+7th
    'dorian':           [0, 2, 3, 5, 7, 9, 10],     # raised 6th
    'phrygian':         [0, 1, 3, 5, 7, 8, 10],     # flat 2nd
    'phrygian_dominant':[0, 1, 4, 5, 7, 8, 10],     # flat 2, raised 3 (Mizrachi)
    'major':            [0, 2, 4, 5, 7, 9, 11],     # Ionian
    'mixolydian':       [0, 2, 4, 5, 7, 9, 10],     # flat 7th
}
```

### 6.2 Diatonic Chord Builder

Given a scale, build all diatonic triads and 7th chords:

```python
def build_diatonic_chords(root: int, scale_type: str) -> dict:
    """Returns {degree: Chord} for all 7 degrees."""
    # e.g., Am natural minor:
    # i=Am, iiø=Bm7b5, III=C, iv=Dm, v=Em, VI=F, VII=G
```

### 6.3 Interval Calculator

```python
def interval_semitones(note1: int, note2: int) -> int:
    """Signed interval: positive = ascending, negative = descending.
    Uses shortest path (max ±6 semitones)."""
    diff = (note2 - note1) % 12
    if diff > 6:
        diff -= 12
    return diff

def interval_name(semitones: int) -> str:
    names = {0: 'unison', 1: 'minor 2nd', 2: 'major 2nd', 3: 'minor 3rd',
             4: 'major 3rd', 5: 'perfect 4th', 6: 'tritone', 7: 'perfect 5th',
             ...}
    return names.get(abs(semitones), f'{abs(semitones)} semitones')
```

### 6.4 Common Tone Analyzer

```python
def common_tones(chord1_pitches: set, chord2_pitches: set) -> set:
    return chord1_pitches & chord2_pitches

def voice_leading_distance(chord1_pitches: list, chord2_pitches: list) -> int:
    """Total semitones of motion (minimal voice leading)."""
    # Use Hungarian algorithm or simple greedy matching
    pass
```

---

## 7. Module 4: Analytical Engine

### 7.1 Key Detection

```python
def detect_key(chords: list[Chord]) -> tuple[int, str]:
    """Returns (root_pitch, mode) — e.g., (9, 'natural_minor') for Am."""
    # Method 1: First and last chord heuristic
    # Method 2: Chord frequency — most common root
    # Method 3: Cadence detection — look for V→I patterns
    # Method 4: Scale coverage — which key's diatonic set covers most chords?
    # Combine methods with weighting
    pass
```

### 7.2 Roman Numeral Assignment

```python
def assign_roman(chord: Chord, key_root: int, key_mode: str) -> RomanNumeral:
    """
    Returns the Roman numeral analysis of a chord in context.

    If diatonic: straightforward (e.g., Am in key of Am = i)
    If non-diatonic: check secondary dominant, borrowed, chromatic, dim substitution
    """
    pass
```

### 7.3 Secondary Dominant Detector

```python
def detect_secondary_dominant(chord: Chord, next_chord: Chord, key: Key) -> Optional[str]:
    """
    If chord is major or dom7, and its root is a 5th above next_chord's root,
    then it's V/x where x is the degree of next_chord.

    Also check even if next_chord is NOT the expected target (deceptive resolution
    of a secondary dominant).
    """
    if chord.quality in ('major', 'dominant7'):
        expected_target_root = (chord.root + 5) % 12  # down a 5th = up a 4th
        target_degree = degree_of(expected_target_root, key)
        if target_degree is not None:
            if next_chord.root == expected_target_root:
                return f"V/{target_degree} → resolves normally"
            else:
                return f"V/{target_degree} → deceptive resolution to {next_chord}"
    return None
```

### 7.4 Diminished Chord Analyzer

```python
def analyze_diminished(chord: Chord, prev_chord: Chord, next_chord: Chord, key: Key) -> list[Analysis]:
    """
    Returns multiple possible analyses ranked by confidence:

    1. Rootless dominant 7♭9:
       - dim chord pitches are a subset of some dom7♭9
       - e.g., D#dim [D#,F#,A] ⊂ B7♭9 [B,D#,F#,A,C]
       - Check if the implied root's target is nearby

    2. Chromatic approach:
       - Bass moves by half step to/from adjacent chord
       - Check both directions (from prev and to next)

    3. Common-tone diminished:
       - Shares a note with the chord it neighbors
       - Usually the root of the neighbor chord is in the dim chord
    """
    analyses = []

    # Check rootless dominant
    for possible_root in range(12):
        dom7b9_pitches = build_dom7b9(possible_root)
        if set(chord.pitches).issubset(set(dom7b9_pitches)):
            target = (possible_root + 5) % 12
            confidence = 0.7
            if next_chord.root == target:
                confidence = 0.95  # resolves to expected target
            analyses.append(Analysis('rootless_dom7b9',
                                     f'Rootless {note_name(possible_root)}7♭9',
                                     confidence))

    # Check chromatic approach from previous chord
    if prev_chord:
        bass_interval = interval_semitones(prev_chord.bass, chord.bass)
        if abs(bass_interval) == 1:
            direction = 'descending' if bass_interval == -1 else 'ascending'
            analyses.append(Analysis('chromatic_approach_from',
                                     f'Chromatic {direction} from {prev_chord.symbol}',
                                     0.85))

    # Check chromatic approach to next chord
    if next_chord:
        bass_interval = interval_semitones(chord.bass, next_chord.bass)
        if abs(bass_interval) == 1:
            direction = 'descending' if bass_interval == -1 else 'ascending'
            analyses.append(Analysis('chromatic_approach_to',
                                     f'Chromatic {direction} to {next_chord.symbol}',
                                     0.85))

    # Check common tones
    if prev_chord:
        ct = common_tones(set(chord.pitches), set(prev_chord.pitches))
        if len(ct) >= 2:
            analyses.append(Analysis('common_tone_dim',
                                     f'Common-tone dim (shares {len(ct)} tones with {prev_chord.symbol})',
                                     0.6))

    return sorted(analyses, key=lambda a: a.confidence, reverse=True)
```

### 7.5 Borrowed Chord Detector

```python
def detect_borrowed(chord: Chord, key: Key) -> Optional[str]:
    """
    If chord is not diatonic in the primary key, check if it's diatonic
    in a parallel mode.

    Common borrowings in minor keys:
    - IV major (from Dorian)
    - I major (from parallel major)
    - ♭II (from Phrygian — Neapolitan)
    """
    if is_diatonic(chord, key):
        return None

    for mode_name, mode_intervals in SCALES.items():
        parallel_key = Key(key.root, mode_name)
        if is_diatonic(chord, parallel_key):
            return f"Borrowed from {key.root_name} {mode_name}"

    return None
```

### 7.6 Deceptive Resolution Detector

```python
def detect_deceptive_resolution(chord: Chord, next_chord: Chord, key: Key) -> Optional[str]:
    """
    If chord is a dominant (V, V7, or V/x) and doesn't resolve
    to its expected target.
    """
    if chord.quality not in ('major', 'dominant7'):
        return None

    expected_target = (chord.root + 5) % 12  # resolution down a 5th
    if next_chord.root != expected_target:
        expected_name = note_name(expected_target)
        return (f"Deceptive: {chord.symbol} expected → {expected_name}m, "
                f"got → {next_chord.symbol}")
    return None
```

### 7.7 Bass Line Analyzer

```python
def extract_bass_line(chords: list[Chord]) -> list[BassNote]:
    """Extract the bass note sequence and classify each motion."""
    bass_line = []
    for i, chord in enumerate(chords):
        bass = BassNote(
            pitch=chord.bass_pitch,
            name=chord.bass_name,
            chord_symbol=chord.symbol,
            position=i
        )
        if i > 0:
            interval = interval_semitones(bass_line[-1].pitch, bass.pitch)
            bass.motion_from_previous = classify_motion(interval)
            # classify_motion returns: 'chromatic_asc', 'chromatic_desc',
            # 'step_asc', 'step_desc', 'leap_asc', 'leap_desc', 'static'
        bass_line.append(bass)
    return bass_line

def detect_chromatic_runs(bass_line: list[BassNote]) -> list[ChromaticRun]:
    """Find consecutive half-step motions in the bass."""
    runs = []
    current_run = [bass_line[0]]
    for i in range(1, len(bass_line)):
        interval = abs(interval_semitones(bass_line[i-1].pitch, bass_line[i].pitch))
        if interval == 1:
            current_run.append(bass_line[i])
        else:
            if len(current_run) >= 3:  # at least 3 notes = meaningful run
                runs.append(ChromaticRun(current_run))
            current_run = [bass_line[i]]
    if len(current_run) >= 3:
        runs.append(ChromaticRun(current_run))
    return runs
```

### 7.8 Pattern Detector

```python
def detect_patterns(chords: list[Chord], key: Key) -> list[Pattern]:
    """
    Detect higher-level patterns:
    - Repeated progressions (e.g., Am-D-C-Am repeated)
    - Sequences (same pattern transposed)
    - Circle of fifths segments
    - Line clichés
    - Pedal points
    """
    patterns = []
    patterns.extend(detect_repeated_progressions(chords))
    patterns.extend(detect_sequences(chords))
    patterns.extend(detect_line_cliches(chords))
    patterns.extend(detect_pedal_points(chords))
    return patterns
```

---

## 8. Module 5: LLM Integration Layer

### 8.1 Prompt Architecture

The LLM receives ONLY structured data from the deterministic engine. It never does pitch math.

**System Prompt:**

```
You are an expert in harmonic analysis of Israeli popular music,
with deep knowledge of jazz harmony, modal interchange, and the
compositional style of artists like Mati Caspi, Shlomo Gronich,
and Yoni Rechter.

You receive structured analytical data from an algorithmic engine
and your job is to:

1. RANK multiple interpretations of ambiguous chords (e.g., when
   a diminished chord could be a rootless dominant OR a chromatic
   approach, decide which is more likely given the musical context)

2. IDENTIFY text-painting — correlations between harmonic events
   and Hebrew lyrics. Consider:
   - Major chords on hopeful words, minor on sad words
   - Deceptive resolutions on words about disappointment/failure
   - Chromatic descent on words about sinking/falling
   - Modulations on words about change/transformation

3. EXPLAIN the analysis in clear Hebrew and English, using both
   academic music theory terminology and practical guitarist language.

4. COMPARE to known patterns in Israeli music when relevant.

You must NEVER recalculate intervals, pitches, or scale membership.
Trust the algorithmic data completely for all mathematical facts.
Only provide interpretation, ranking, and narrative.
```

**User Message Template:**

```json
{
  "song": {
    "title": "יום שישי חזר",
    "artist": "מתי כספי",
    "key": { "root": "A", "mode": "natural_minor" },
    "year": 1976
  },
  "section": {
    "name": "chorus",
    "chords_chronological": [
      "Am/E",
      "D#dim",
      "F#dim",
      "F",
      "D",
      "Am",
      "E",
      "Dm"
    ],
    "lyrics": ["יש אולי סיכוי קרוב", "למצוא גן עדן ברחוב", "ואולי גם לילה טוב"]
  },
  "algorithmic_analysis": {
    "bass_line": ["E", "D#", "F#", "F", "D", "A", "E", "D"],
    "bass_motions": ["↓½", "↑1½", "↓½", "↓1½", "↓4", "↑5", "↓1"],
    "non_diatonic_chords": [
      {
        "chord": "D#dim",
        "interpretations": [
          {
            "type": "chromatic_descent_from",
            "detail": "bass E→D# (↓½) from Am/E",
            "confidence": 0.9
          },
          {
            "type": "rootless_dom7b9",
            "detail": "= B7♭9 without B (V7♭9/v)",
            "confidence": 0.7
          }
        ]
      },
      {
        "chord": "F#dim",
        "interpretations": [
          {
            "type": "chromatic_approach_to",
            "detail": "bass F#→F (↓½) to F major",
            "confidence": 0.85
          },
          {
            "type": "common_tone_dim",
            "detail": "shares A,C with F major (2 of 3 tones)",
            "confidence": 0.8
          }
        ]
      },
      {
        "chord": "D",
        "interpretations": [
          {
            "type": "borrowed",
            "detail": "IV from A Dorian (F# instead of F)",
            "confidence": 0.95
          }
        ]
      }
    ],
    "deceptive_resolutions": [
      { "dominant": "E", "expected": "Am", "actual": "Dm", "position": 7 }
    ],
    "chromatic_runs": [
      { "notes": ["E", "D#"], "direction": "descending", "position": [0, 1] },
      { "notes": ["F#", "F"], "direction": "descending", "position": [2, 3] }
    ],
    "voice_leading_highlights": [
      {
        "from": "F#dim",
        "to": "F",
        "common_tones": ["A", "C"],
        "moving": { "F#": "F" }
      }
    ]
  }
}
```

### 8.2 Claude API Integration

```python
import anthropic

client = anthropic.Anthropic()

def get_llm_analysis(structured_data: dict, system_prompt: str) -> str:
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=system_prompt,
        messages=[
            {"role": "user", "content": json.dumps(structured_data, ensure_ascii=False)}
        ]
    )
    return message.content[0].text
```

Use Sonnet for speed/cost during development; switch to Opus for production quality.

---

## 9. Module 6: Output Generator

### 9.1 HTML Output

Generate an interactive HTML file similar to the ones built during our conversation:

- Dark theme, monospace chords, serif Hebrew lyrics
- Color-coded chord types (diatonic=green, secondary dominant=pink, dim=purple, chromatic=orange, borrowed=blue)
- Chronological chord display with arrows (→) — ALWAYS left-to-right regardless of original source direction
- Bass line table visualization
- Voice leading diagrams for highlighted transitions
- Analysis boxes with explanations
- Summary table of all non-diatonic events

### 9.2 Design Principles from Our Iterations

Things that worked well in v3:

- **Always show chords in chronological order with arrows** — eliminates RTL confusion
- **Separate "chord display" from "lyrics"** — chords always LTR, lyrics always RTL
- **Color coding by function** — immediate visual distinction between diatonic and non-diatonic
- **Bass line as a separate table** — makes chromatic runs visible
- **Multiple analysis interpretations** — don't commit to one; show possibilities
- **Narrative section** — the "harmony as story" interpretation is what makes it come alive

### 9.3 Bilingual Output

The tool should support both Hebrew and English terminology:

- Hebrew for chord descriptions tied to lyrics (text-painting)
- English for technical terms (secondary dominant, deceptive resolution, voice leading)
- User preference setting for primary language

---

## 10. Module 7: User Correction Loop

### 10.1 Types of Corrections

Based on our conversation, users will correct:

1. **Chord order** — "these chords are in the wrong order" (usually RTL/LTR issue)
2. **Chord identity** — "I hear Dm here, not D" or "this should be E7, not Em"
3. **Chord additions** — "there's an Am/E before that D#dim that's missing"
4. **Analytical disagreement** — "the D#dim doesn't go up to E, it comes AFTER E and goes DOWN"
5. **Section boundaries** — "that's not part of the chorus, it's the bridge"

### 10.2 Correction Interface

```python
def apply_correction(analysis: Analysis, correction: Correction) -> Analysis:
    """
    Correction types:
    - reorder: change chronological order of chords
    - replace: swap one chord for another
    - insert: add a chord at a position
    - delete: remove a chord
    - reassign_section: move chords to a different section
    - override_analysis: user specifies the interpretation
    """
    pass
```

After any correction, the entire analysis pipeline re-runs from the changed point forward. The LLM layer receives updated structured data and regenerates its interpretation.

### 10.3 Correction Memory

Store corrections per song so they persist:

```json
{
  "song_id": "mati_caspi_yom_shishi",
  "corrections": [
    {
      "type": "reorder",
      "section": "chorus",
      "detail": "RTL fix",
      "timestamp": "..."
    },
    {
      "type": "replace",
      "position": 12,
      "from": "D",
      "to": "Dm",
      "timestamp": "..."
    }
  ]
}
```

---

## 11. Data Structures

### 11.1 Core Types

```python
from dataclasses import dataclass
from enum import Enum
from typing import Optional

class ChordQuality(Enum):
    MAJOR = "major"
    MINOR = "minor"
    DIMINISHED = "diminished"
    AUGMENTED = "augmented"
    DOMINANT7 = "dominant7"
    MINOR7 = "minor7"
    MAJOR7 = "major7"
    HALF_DIMINISHED = "half_diminished"
    DIMINISHED7 = "diminished7"
    SUSPENDED2 = "suspended2"
    SUSPENDED4 = "suspended4"
    DOMINANT7SUS4 = "dominant7sus4"

@dataclass
class Chord:
    symbol: str                          # Original symbol: "Am/E"
    root: int                            # Pitch class: 9 (A)
    root_name: str                       # "A"
    quality: ChordQuality                # MINOR
    extensions: list[str]                # []
    bass: int                            # Pitch class: 4 (E)
    bass_name: str                       # "E"
    pitches: list[int]                   # [9, 0, 4] (A, C, E)
    source_text: str                     # Raw text from chart
    chronological_position: int          # Position in time
    aligned_lyrics: Optional[str]        # Hebrew lyrics for this chord

@dataclass
class Key:
    root: int                            # 9 (A)
    root_name: str                       # "A"
    mode: str                            # "natural_minor"
    scale_pitches: list[int]             # [9, 11, 0, 2, 4, 5, 7]

@dataclass
class AnalysisInterpretation:
    type: str                            # "chromatic_approach", "rootless_dom7b9", etc.
    detail: str                          # Human-readable explanation
    confidence: float                    # 0.0 to 1.0

@dataclass
class ChordAnalysis:
    chord: Chord
    roman_numeral: str                   # "i", "V/v", "#iv°", etc.
    is_diatonic: bool
    diatonic_in_scale: Optional[str]     # If not in primary, which scale?
    interpretations: list[AnalysisInterpretation]
    bass_motion_from_previous: Optional[str]  # "chromatic_desc", "step_asc", etc.
    common_tones_with_previous: list[int]
    common_tones_with_next: list[int]
    deceptive_resolution: Optional[str]

@dataclass
class SongAnalysis:
    title: str
    artist: str
    key: Key
    sections: list[SectionAnalysis]
    bass_line: list[BassNote]
    chromatic_runs: list[ChromaticRun]
    patterns: list[Pattern]
    corrections: list[Correction]

@dataclass
class SectionAnalysis:
    name: str                            # "verse", "chorus", "bridge"
    chords: list[ChordAnalysis]
    llm_narrative: Optional[str]         # LLM-generated interpretation
```

---

## 12. Edge Cases & Lessons Learned

### From Our "יום שישי חזר" Analysis

| Issue                       | What Happened                         | Solution                                                |
| --------------------------- | ------------------------------------- | ------------------------------------------------------- |
| RTL chord order             | Entire chorus analysis was backwards  | Always normalize to chronological order before analysis |
| tab4u JS rendering          | Web scraper got only intro chords     | Need headless browser or screenshot input               |
| Multiple valid dim analyses | D#dim had 3 valid interpretations     | Present all with confidence scores                      |
| "B" vs "Bm" ambiguity       | B in Am context = B major (V/v)       | In minor keys, plain letter = major                     |
| Simplified tab4u chords     | Missing extensions, slash chords      | Cross-reference with israeli-guitar.com when possible   |
| Enharmonic confusion        | D#dim vs Ebdim                        | Spell based on approach direction                       |
| User's ear > chart          | Tab4u had errors at end of chorus     | Always support user override                            |
| AI can't hear audio         | User suggested listening to recording | Tool must support user as "ears", AI as "theory brain"  |

### General Edge Cases to Handle

- **Key changes mid-song** — Israeli songs sometimes modulate (especially Caspi, Gronich)
- **Modal mixture** — using chords from multiple parallel modes simultaneously
- **Pedal points** — bass stays while chords change (common in intros)
- **Slash chords vs inversions** — Am/E might be intentional bass note OR just a guitar voicing
- **Compound time signatures** — affects which chords are "strong" beats
- **Live vs studio versions** — same song can have different harmonies
- **Simplified vs full arrangements** — tab4u gives guitar arrangement, original may have richer harmony
- **Capo usage** — tab4u sometimes shows capo'd chords; need actual sounding key

---

## 13. Development Phases

### Phase 1: Core Engine (MVP)

**Goal:** Manual chord input → deterministic analysis → formatted text output

- [ ] Chord parser (all tab4u notation conventions)
- [ ] RTL/LTR handler with manual format
- [ ] Music theory engine (scales, intervals, pitch sets)
- [ ] Key detector
- [ ] Roman numeral assigner
- [ ] Secondary dominant detector
- [ ] Borrowed chord detector
- [ ] Bass line extractor
- [ ] Common tone analyzer
- [ ] Deceptive resolution detector
- [ ] Simple text output (terminal)
- [ ] Test with "יום שישי חזר" (ground truth from our analysis)

### Phase 2: LLM Integration

**Goal:** Algorithmic analysis → Claude API → interpretive narrative

- [ ] Structured data → JSON formatter for LLM input
- [ ] System prompt engineering (see section 8.1)
- [ ] Claude API integration
- [ ] Multi-interpretation ranking
- [ ] Text-painting analysis (harmony + Hebrew lyrics)
- [ ] Bilingual output (Hebrew + English)

### Phase 3: HTML Output

**Goal:** Beautiful interactive analysis document

- [ ] HTML template generator
- [ ] Color-coded chord chart (chronological, with arrows)
- [ ] Bass line visualization table
- [ ] Voice leading diagrams
- [ ] Summary tables
- [ ] Responsive design for mobile

### Phase 4: Input Enhancement

**Goal:** Multiple input sources beyond manual entry

- [ ] Screenshot → Claude Vision OCR → chord extraction
- [ ] tab4u URL → Playwright scraper → chord extraction
- [ ] israeli-guitar.com backup source

### Phase 5: User Correction Loop

**Goal:** Interactive refinement

- [ ] Correction types (reorder, replace, insert, delete)
- [ ] Re-analysis pipeline after corrections
- [ ] Correction persistence (per song)
- [ ] Feedback to improve confidence scores

### Phase 6: Scale/Mode Tools

**Goal:** Extended theory tools for the guitarist

- [ ] Scale identification from a set of chords
- [ ] Scale comparison (what changes between natural minor and dorian?)
- [ ] Tab-to-notes converter (ASCII guitar tab → note names)
- [ ] Notes-to-chord identifier ("I'm playing A-C-E-G" → "Am7")
- [ ] Chord substitution suggester ("what can I play instead of Bm7b5?")

---

## 14. Test Cases

### Test Case 1: "יום שישי חזר" — Mati Caspi (Ground Truth)

**Chorus (correct order, as verified by user):**

```
Am/E → D#dim → F#dim → F → D → Am → E → Dm
```

**Expected analysis results:**

- Am/E: i in second inversion, bass = E
- D#dim: non-diatonic, bass descends ½ from E (Am/E→D#dim), also rootless B7♭9 (V♭9/v)
- F#dim: non-diatonic, common tones [A,C] with next chord F, bass descends ½ to F
- F: ♭VI, diatonic
- D: IV (borrowed from Dorian), non-diatonic in natural minor
- Am: i, tonic
- E: V (from harmonic minor), secondary dominant behavior
- Dm: iv, diatonic — but reached by DECEPTIVE RESOLUTION from E (expected Am)

**Bridge chromatic bass (correct order):**

```
Bm7♭5 → Am/C → A/C# → Dm
Bass: B → C → C# → D (ascending chromatic run)
```

### Test Case 2: Simple Song (Sanity Check)

```
Key: Am
Am → Dm → E → Am
```

Expected: i → iv → V → i. All diatonic (with E from harmonic minor). No special events.

### Test Case 3: Secondary Dominant Chain

```
Key: C
C → A7 → Dm → G7 → C
```

Expected: I → V7/ii → ii → V7 → I. A7 = secondary dominant of Dm.

### Additional test songs to verify with (Israeli repertoire):

- "ברית עולם" — Mati Caspi (complex modulations)
- "לא ידעתי שתלכי ממני" — Mati Caspi (jazz harmony)
- "הנה הנה" — Mati Caspi (from same album)
- "נח" — Mati Caspi / Chocolate Menta Mastik
- Songs by Shlomo Gronich, Yoni Rechter, Berry Sakharof (all harmonically rich)

---

## 15. Reference: Complete Analysis Example

The complete correct analysis of "יום שישי חזר" chorus, as developed through iterative correction with the user:

### What We Got Wrong (v1 & v2):

1. Read tab4u chorus chords in wrong order (LTR instead of RTL)
2. Analyzed D#dim → Am/E (bass ascending D#→E) — WRONG
3. Built an entire "chromatic approach from below" narrative — WRONG
4. Built voice leading diagrams based on wrong direction — WRONG

### What Is Correct (v3):

1. Chorus chords read RTL: Am/E → D#dim | F#dim → F | D → Am → E → Dm
2. Am/E → D#dim: bass DESCENDS E→D# — ground falling away
3. F#dim → F: bass DESCENDS F#→F — same pattern, parallel descent
4. Pattern: two chromatic descents (E→D#, F#→F), then D→Am (arrival), then E→Dm (deceptive)
5. Narrative: descent → descent → brief arrival → disappointment

### The Key Insight:

The direction of bass movement changes the entire emotional reading. Ascending = building tension/hope. Descending = release/sinking/disappointment. When we had the direction wrong, the analysis told the opposite story from what the music actually expresses.

---

_This document captures all domain knowledge, architecture decisions, and lessons learned from the development process. It should be sufficient context for building the complete tool._
