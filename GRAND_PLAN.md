# Caspian Grand Architecture Plan: Bars, Timing & Multi-Source Input

## Vision

Transform Caspian from a chord-analysis tool into a **rhythm-aware harmonic workstation**. The core shift: sections don't just contain chords — they contain **bars**, and bars contain **chords with exact timing positions**. This enables playback that matches the actual song, supports syncopation, and makes the tool useful for high-level musicians and songwriters exploring harmony.

---

## Current State (Baseline)

| Layer | What Exists Today |
|-------|-------------------|
| **Data model** | `SongInput` → `SectionInput` → `ChordInput(symbol, lyrics, position)`. No concept of bars or timing. |
| **Parsing** | `input_parser.py` (Format A: `chords \| lyrics`), `website_normalizer.py` (auto-detect website paste), `tab4u_normalize.py` (symbol normalization). |
| **Analysis** | `analyzer.py` pipeline: parse chords → detect key → roman numerals, secondary dominants, borrowed chords, diminished, deceptive resolutions, bass line, patterns. |
| **Frontend input** | Single textarea (`InputForm.tsx`), paste-and-analyze. Section splitter UI for unsegmented songs. |
| **Storage** | LocalStorage song library (`songLibrary.ts`). No database. No user accounts. |
| **AI integration** | LLM narrative analysis via Claude/OpenAI API (user-provided key). |
| **User tiers** | None — all features available to everyone. |

---

## Phase 1: Bar & Timing Data Model

**Goal:** Introduce the concept of bars into the data layer without breaking any existing functionality.

### 1.1 — Backend: New data models

Add to `models/input.py`:
```python
class BeatPosition(BaseModel):
    """Position within a bar, supporting arbitrary subdivisions."""
    beat: int          # 1-based beat number (1, 2, 3, 4 for 4/4)
    subdivision: int   # 0 = on the beat, 1 = "and", 2 = "e", 3 = "a" (16th grid)

class BarChord(BaseModel):
    """A chord placed at a specific beat position within a bar."""
    symbol: str
    beat_position: BeatPosition
    duration_beats: float | None = None  # how long it rings (None = until next chord)

class Bar(BaseModel):
    """A single bar/measure in a song."""
    time_signature: tuple[int, int] = (4, 4)  # numerator, denominator
    chords: list[BarChord] = Field(default_factory=list)
    lyrics_fragment: str = ""  # lyrics that fall within this bar

class SectionInput(BaseModel):  # UPDATED
    name: str
    section_type: str = "vocal"
    chords: list[ChordInput] = Field(default_factory=list)  # KEEP for backward compat
    bars: list[Bar] = Field(default_factory=list)           # NEW — bar-aware data
    lines: list[ChordLyricsLine] = Field(default_factory=list)
    tempo_bpm: float | None = None                          # NEW
```

Add to `models/analysis.py`:
```python
class BarAnalysis:
    """Analysis of a single bar."""
    bar_index: int
    chord_analyses: list[ChordAnalysis]
    harmonic_rhythm: str  # "static", "half-bar", "per-beat", "syncopated"
```

Update `SectionAnalysis` to include `bars: list[BarAnalysis]`.

### 1.2 — Backend: Dual-path analysis pipeline

Update `analyzer.py` to support both paths:
- **Legacy path:** `section.chords` is populated → analyze as today (flat chord list).
- **Bar-aware path:** `section.bars` is populated → analyze with bar context, produce `BarAnalysis` objects, detect harmonic rhythm per bar, detect syncopation patterns.

### 1.3 — Frontend: Types & API contract

Update `types.ts` with matching TypeScript interfaces:
```typescript
interface BeatPosition { beat: number; subdivision: number; }
interface BarChord { symbol: string; beat_position: BeatPosition; duration_beats: number | null; }
interface Bar { time_signature: [number, number]; chords: BarChord[]; lyrics_fragment: string; }
interface BarAnalysis { bar_index: number; chord_analyses: ChordAnalysis[]; harmonic_rhythm: string; }
```

Update `Section` to include optional `bars: BarAnalysis[]`.

### 1.4 — API Response updates

Update `api.py` response models to include bar data when present. Keep full backward compatibility — `bars` is an optional field.

### Files touched:
- `src/caspian/models/input.py`
- `src/caspian/models/analysis.py`
- `src/caspian/analysis/analyzer.py`
- `src/caspian/api.py`
- `frontend/src/types.ts`
- Tests for all of the above

---

## Phase 2: Input Method 1 — Ultimate Guitar / Web Scraping

**Goal:** Fetch chord sheets from external sources (primarily Ultimate Guitar, but also Hebrew sites) and convert them into the Caspian format, including bar information where available.

### 2.1 — Research: Source Landscape

- **Ultimate Guitar (UG):** Highest quality when filtered by high rating + high rating count. UG uses a JSON API internally — research the exact endpoint structure. Rate-limited; may need caching strategy.
- **Hebrew sources:** Tab4u.com (already have `tab4u_normalize.py`), shironet.co.il (lyrics only, no chords). Hebrew chord sites are inconsistent — need per-site normalizers.
- **Legal considerations:** Document scraping limitations. Consider linking to source rather than storing full copyrighted lyrics.

### 2.2 — Backend: Chord sheet fetcher service

New module: `src/caspian/sources/`
```
sources/
  __init__.py
  base.py           # Abstract base class for source adapters
  ultimate_guitar.py # UG adapter
  tab4u.py           # Tab4u adapter (leverage existing tab4u_normalize.py)
  cache.py           # Simple disk/DB cache for fetched sheets
```

`base.py`:
```python
class ChordSheetSource(ABC):
    @abstractmethod
    async def search(self, query: str, limit: int = 10) -> list[SearchResult]: ...

    @abstractmethod
    async def fetch(self, url_or_id: str) -> RawChordSheet: ...

class SearchResult(BaseModel):
    source: str          # "ultimate_guitar", "tab4u"
    title: str
    artist: str
    url: str
    rating: float
    rating_count: int
    has_bars: bool       # does this source include bar lines?

class RawChordSheet(BaseModel):
    title: str
    artist: str
    key: str | None
    sections: list[RawSection]
    source_url: str
```

### 2.3 — Backend: Conversion pipeline

New module: `src/caspian/sources/converter.py`
- Convert `RawChordSheet` → `SongInput`
- When UG data includes bar lines (`|`), map them to `Bar` objects
- When bar info is absent, fall back to legacy `ChordInput` list
- Apply `tab4u_normalize` for Tab4u sources
- Handle Hebrew RTL issues (leverage existing `rtl_handler.py`)

### 2.4 — Backend: API endpoints

```python
@app.get("/api/search-songs")
async def search_songs(q: str, source: str = "all") -> list[SearchResult]: ...

@app.get("/api/fetch-sheet")
async def fetch_sheet(url: str) -> AnalyzeResponse: ...
```

### 2.5 — Frontend: Song Search UI

New component: `SongSearch.tsx`
- Search bar with source selector (All / Ultimate Guitar / Tab4u)
- Results list showing title, artist, rating, source badge
- Click to fetch → auto-populate input → auto-analyze
- Sorting: by rating (weighted by count — UG with 500+ ratings and 4.5+ stars first)

### 2.6 — Hebrew Song Strategy

For Hebrew songs, the rating/quality signal is weaker:
- Tab4u is the primary source but quality varies wildly
- Consider allowing users to "correct" fetched sheets and save locally
- Future: community-contributed corrections (Phase 7+)

### 2.7 — Database for caching (optional but recommended)

Introduce a lightweight DB (SQLite via `sqlite3` or `aiosqlite`):
- Cache fetched chord sheets with TTL
- Index by title + artist for dedup
- Store user corrections alongside originals

### Files touched:
- New: `src/caspian/sources/` (entire module)
- `src/caspian/api.py` (new endpoints)
- New: `frontend/src/components/SongSearch.tsx`
- `frontend/src/App.tsx` (integrate search)
- `frontend/src/api.ts` (new API calls)

---

## Phase 3: Input Method 2 — Improved Paste Parsing

**Goal:** Make the existing paste-and-parse flow smarter and more robust.

### 3.1 — Smarter website paste detection

Improve `website_normalizer.py`:
- Detect more website formats (Ultimate Guitar HTML paste, Tab4u HTML paste, generic chord-above-lyrics)
- Handle inconsistent spacing, mixed tabs/spaces
- Detect bar lines in pasted text (`|` between chords) and convert to `Bar` objects
- Better Hebrew section detection (more פזמון/בית/גשר variants)

### 3.2 — Multi-format parser registry

New pattern in `parsing/`:
```python
# parsing/registry.py
class FormatDetector:
    """Detect which parser to use based on input content."""
    def detect(self, text: str) -> str:
        # Returns: "format_a", "website_paste", "ug_html", "tab4u_html",
        #          "chord_above_lyrics", "chord_pro", "bar_notation"
```

Each format gets its own parser module, all producing `SongInput`.

### 3.3 — Bar line detection in pasted text

When users paste text containing `|` between chords (common in many chord sheets), detect and parse as bars:
```
[verse]
| Am  G  | F   C  | Am  G  | E      |
```
→ 4 bars, each with their chords positioned at beats 1 and 3.

### 3.4 — ChordPro format support

Support `.chopro`/ChordPro format:
```
{title: Song Name}
{key: Am}
[Am]Lyrics here [G]more lyrics [F]end
```
This is a widely-used standard. Parse into `SongInput` with chord-lyrics alignment.

### 3.5 — Frontend: Paste preview & format detection indicator

Show the user what format was detected and a preview of how it was parsed before running analysis. Allow them to switch parser if auto-detection was wrong.

### Files touched:
- `src/caspian/parsing/website_normalizer.py` (major improvements)
- New: `src/caspian/parsing/registry.py`
- New: `src/caspian/parsing/chord_pro_parser.py`
- New: `src/caspian/parsing/bar_notation_parser.py`
- `frontend/src/components/InputForm.tsx` (preview, format indicator)
- Tests for all parsers

---

## Phase 4: Input Method 3 — Split Lyrics & Insert Chords

**Goal:** Allow users to paste plain lyrics, then overlay chords line by line, and then assign bar structure on top.

### 4.1 — Frontend: Lyrics-first input mode

New component: `LyricsChordEditor.tsx`
- **Step 1:** User pastes or types plain lyrics
- **Step 2:** System displays lyrics line by line
- **Step 3:** User clicks above a word/syllable to place a chord (autocomplete from `chord-completions` API)
- **Step 4:** Chords snap to character positions, rendered above the lyrics

### 4.2 — Frontend: Bar overlay mode

Once chords are placed over lyrics:
- **Step 5:** User draws bar lines between chords (click between chords to insert `|`)
- **Step 6:** System auto-suggests bar lines based on chord spacing and common time signatures
- **Step 7:** User can set time signature per section (default 4/4)
- **Step 8:** Within each bar, chords are assigned to beat positions (drag to adjust)

### 4.3 — Frontend: Beat grid editor

For advanced users — visual beat grid per bar:
```
Bar 1 (4/4):  | Am        |    G     |          |    F     |
               beat 1       beat 2     beat 3     beat 4
```
- Click to place/remove chords on the grid
- Supports 8th and 16th subdivisions for syncopation
- Visual indication of harmonic rhythm

### 4.4 — Backend: Lyrics-to-SongInput converter

New endpoint or mode in the existing parse pipeline:
- Accept `{ lyrics: string[], chords_per_line: ChordPlacement[][] }`
- Convert to `SongInput` with proper `bars` data

### 4.5 — Auto-bar detection heuristic

When chords are placed over lyrics without explicit bar lines:
- Use common patterns (e.g., 2 chords per line → likely 2 bars or 1 bar with chord change)
- Use chord duration heuristic: if a chord appears twice in sequence, it likely spans a full bar
- Allow user to confirm/adjust

### Files touched:
- New: `frontend/src/components/LyricsChordEditor.tsx`
- New: `frontend/src/components/BarOverlay.tsx`
- New: `frontend/src/components/BeatGrid.tsx`
- `frontend/src/App.tsx` (new input mode routing)
- `src/caspian/api.py` (new endpoint)
- `frontend/src/types.ts` (new types)

---

## Phase 5: Playback Engine

**Goal:** Play the chord progression in time with the actual song rhythm, using the bar/timing data.

### 5.1 — Frontend: Audio synthesis

Extend existing `ChordPlayer.tsx`:
- Currently plays individual chords on click
- Add sequential playback mode: play through bars in time
- Use Web Audio API for scheduling (already in use for ChordPlayer)
- BPM control (tap tempo or manual entry)
- Metronome click track option

### 5.2 — Playback with bar awareness

- Read `bars` data from analysis
- Schedule each chord at its exact beat position
- Handle time signature changes between sections
- Support syncopated rhythms (chords on off-beats)
- Visual cursor that follows playback through the chord sheet

### 5.3 — Practice mode enhancements

Enhance existing `PracticeMode.tsx`:
- Loop specific sections or bar ranges
- Slow down tempo without pitch change
- Count-in before playback starts
- Highlight current bar and next bar

### Files touched:
- `frontend/src/components/ChordPlayer.tsx` (major expansion)
- `frontend/src/components/PracticeMode.tsx` (enhancements)
- New: `frontend/src/lib/playbackEngine.ts`
- New: `frontend/src/lib/metronome.ts`

---

## Phase 6: Songwriting / Harmony Exploration Mode

**Goal:** Let songwriters use Caspian to explore harmonic ideas — try chord substitutions, reharmonize, and hear the results in context.

### 6.1 — Chord substitution suggestions

When a user clicks a chord in bar view:
- Show modal with substitution suggestions (already partially exists with `chord-completions` API)
- Categories: diatonic substitutes, tritone substitutions, modal interchange, chromatic approaches
- Each suggestion shows roman numeral, common tones, and voice leading quality
- Click to preview (play both the original and substitution)

### 6.2 — Reharmonization mode

- Select a range of bars
- "Reharmonize" button generates alternative progressions
- Options: "Jazzier", "Simpler", "Modal", "Chromatic"
- Uses the analysis engine to score alternatives by voice leading smoothness and functional coherence
- Can use LLM analysis to explain the reharmonization

### 6.3 — Blank canvas mode

- Start with empty bars and a key
- Build a progression from scratch using the beat grid
- AI-assisted suggestions: "what chord works well after Am → F → G?"
- Export as ChordPro or Caspian format

### Files touched:
- New: `frontend/src/components/SubstitutionPanel.tsx`
- New: `frontend/src/components/ReharmonizeModal.tsx`
- `src/caspian/completion/chord_completion.py` (expand suggestion logic)
- New: `src/caspian/analysis/reharmonize.py`
- `src/caspian/api.py` (new endpoints)

---

## Phase 7: User Accounts & Pro Tier

**Goal:** Introduce user accounts and a pro tier to gate premium features (especially AI-powered ones).

### 7.1 — Authentication system

- Simple email + password or OAuth (Google)
- JWT-based session management
- User model: `id, email, name, tier (free/pro), created_at`
- Database: PostgreSQL (or SQLite for MVP, upgrade later)

### 7.2 — Pro tier features

Free tier includes:
- All existing analysis features
- Paste-and-parse input
- Song library (local storage)
- Basic playback

Pro tier adds:
- Music sheet scanning (Phase 8)
- LLM narrative analysis (currently requires user API key — pro tier includes it)
- Cloud song library (sync across devices)
- Reharmonization mode
- Priority chord sheet source access
- Export features (PDF, ChordPro, MIDI)

### 7.3 — Backend: Auth middleware

- FastAPI dependency injection for auth
- Rate limiting per tier
- API key management for pro users

### 7.4 — Frontend: Auth UI

- Login/signup modal
- Account settings page
- Pro badge / upgrade CTA
- Graceful degradation for free users (show feature but prompt upgrade)

### Files touched:
- New: `src/caspian/auth/` (module)
- `src/caspian/api.py` (auth middleware)
- New: `frontend/src/components/AuthModal.tsx`
- New: `frontend/src/lib/auth.ts`
- Database migrations

---

## Phase 8: Input Method 4 — Music Sheet Scanning (AI-Powered, Pro Only)

**Goal:** Allow users to photograph or upload a music sheet and extract chords from it using AI.

### 8.1 — Research phase (CRITICAL — do this first)

This is the most uncertain feature. Research areas:
- **Optical Music Recognition (OMR):** Libraries like Audiveris, OMR-datasets, SheetVision
- **AI/ML approaches:**
  - Vision models (Claude vision API, GPT-4V) for direct sheet-to-chord extraction
  - Specialized OMR models (e.g., MUSCIMA++, DeepScores)
  - Hybrid: OMR for note detection → custom logic for chord identification
- **Scope questions:**
  - Lead sheets (melody + chord symbols) — easier, chord symbols are text
  - Full scores (piano/guitar) — harder, need to identify simultaneous notes
  - Handwritten vs. printed
- **Accuracy expectations:** What error rate is acceptable? Need human-in-the-loop correction?
- **Cost analysis:** Vision API calls per sheet, processing time, storage

### 8.2 — MVP: Chord symbol extraction from lead sheets

Start with the simplest case:
- User uploads a photo of a lead sheet
- Sheet has chord symbols written above the staff (e.g., "Am", "F7")
- Use Claude Vision API to extract: section structure, chord symbols, approximate bar positions
- Convert to `SongInput` with bars

Prompt engineering for Claude Vision:
```
Analyze this music sheet image. Extract:
1. Song title and key signature
2. Time signature
3. For each bar: list the chord symbols in order with their beat positions
4. Section markers (verse, chorus, bridge, etc.)
Return as structured JSON.
```

### 8.3 — Advanced: Full score chord extraction

Later iteration:
- Detect notes on the staff using OMR
- Group simultaneous notes into chords
- Identify chord quality from the note set (reuse existing `chord_parser.py` logic)
- Handle inversions (bass note detection from lowest note)

### 8.4 — Human-in-the-loop correction UI

After AI extraction:
- Show the original image alongside the extracted chords
- Highlight uncertain detections
- Allow user to click and correct individual chords
- Save corrections to improve future results (if we build our own model)

### 8.5 — Backend architecture

```python
# sources/sheet_scanner.py
class SheetScanner:
    async def scan(self, image: bytes, format: str = "lead_sheet") -> SongInput:
        """Extract chords from a music sheet image."""
        # 1. Send to vision API
        # 2. Parse structured response
        # 3. Convert to SongInput with bars
        # 4. Return with confidence scores per chord
```

New API endpoint:
```python
@app.post("/api/scan-sheet")
async def scan_sheet(file: UploadFile, format: str = "lead_sheet") -> AnalyzeResponse:
    # Pro-only check
    # Process image → SongInput → analyze
```

### 8.6 — Frontend: Upload & correction UI

New components:
- `SheetUpload.tsx` — drag-and-drop or camera capture
- `SheetCorrectionView.tsx` — side-by-side image + extracted chords
- Integration with existing analysis flow

### Files touched:
- New: `src/caspian/sources/sheet_scanner.py`
- `src/caspian/api.py` (new endpoint, pro gate)
- New: `frontend/src/components/SheetUpload.tsx`
- New: `frontend/src/components/SheetCorrectionView.tsx`
- Research document: `docs/sheet-scanning-research.md`

---

## Phase 9: Database & Cloud Storage

**Goal:** Move from localStorage to a real database for song persistence, cloud sync, and cached chord sheets.

### 9.1 — Backend database

- SQLite for development, PostgreSQL for production
- ORM: SQLAlchemy or raw SQL with migrations (Alembic)
- Tables:
  - `users` (id, email, tier, ...)
  - `songs` (id, user_id, title, artist, key, input_text, analysis_json, created_at, updated_at)
  - `chord_sheet_cache` (id, source, source_url, raw_data, normalized_data, fetched_at, ttl)
  - `user_corrections` (id, user_id, song_id, field, original_value, corrected_value)

### 9.2 — API: CRUD endpoints

```python
GET    /api/songs              # list user's songs
POST   /api/songs              # save a song
GET    /api/songs/{id}         # get a song
PUT    /api/songs/{id}         # update a song
DELETE /api/songs/{id}         # delete a song
```

### 9.3 — Frontend: Cloud library

- Replace or augment localStorage-based `SongLibrary` with API-backed version
- Sync indicator (cloud icon, last synced timestamp)
- Offline support with localStorage fallback

### Files touched:
- New: `src/caspian/db/` (models, migrations, repository)
- `src/caspian/api.py` (CRUD endpoints)
- `frontend/src/lib/songLibrary.ts` (cloud adapter)
- `frontend/src/components/SongLibrary.tsx` (cloud UI)

---

## Implementation Priority & Dependencies

```
Phase 1 (Bar Model) ──────────────────────────────► Foundation for everything
    │
    ├── Phase 2 (Web Scraping) ──────────────────► Independent, high value
    │
    ├── Phase 3 (Better Parsing) ────────────────► Independent, incremental
    │
    ├── Phase 4 (Lyrics + Chord Editor) ─────────► Needs Phase 1 bars
    │       │
    │       └── Phase 5 (Playback) ──────────────► Needs Phase 1 + 4
    │               │
    │               └── Phase 6 (Songwriting) ───► Needs Phase 5
    │
    ├── Phase 7 (Users & Pro) ───────────────────► Independent, needed for Phase 8
    │       │
    │       └── Phase 8 (Sheet Scanning) ────────► Needs Phase 7 (pro gate) + Phase 1 (bars)
    │
    └── Phase 9 (Database) ─────────────────────► Needed for Phase 2 cache + Phase 7 users
```

### Suggested execution order:
1. **Phase 1** — Bar data model (foundation)
2. **Phase 3** — Better parsing (quick wins, improves daily usage)
3. **Phase 2** — Web scraping (high user value)
4. **Phase 9** — Database (needed for caching and users)
5. **Phase 4** — Lyrics + chord editor (core UX innovation)
6. **Phase 5** — Playback engine (killer feature)
7. **Phase 7** — User accounts & pro tier (monetization)
8. **Phase 6** — Songwriting mode (pro-level feature)
9. **Phase 8** — Sheet scanning (research-heavy, pro-only)

---

## Technical Decisions to Make

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Database | SQLite / PostgreSQL / both | SQLite for now, migrate to PG later |
| Auth | Self-hosted / Firebase / Auth0 | Auth0 or Supabase for speed |
| Sheet scanning AI | Claude Vision / GPT-4V / dedicated OMR | Start with Claude Vision for MVP |
| Playback synthesis | Web Audio API / Tone.js / pre-recorded samples | Tone.js (already a good fit) |
| Bar editor UI | Custom canvas / SVG / DOM-based | DOM-based with CSS grid (simpler) |
| Scraping strategy | Direct fetch / headless browser / API proxy | Research UG's internal API first |
| ChordPro support | Full spec / subset | Subset (most common directives) |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| UG blocks scraping | High — primary chord source | Cache aggressively; add multiple source adapters; consider official API if available |
| Sheet scanning accuracy too low | Medium — poor UX | Keep human-in-the-loop correction; start with lead sheets only |
| Bar model too complex for casual users | High — UX regression | Keep legacy (flat chord) mode as default; bar mode is opt-in |
| Hebrew source quality | Medium — core audience | Allow user corrections; build community quality layer over time |
| Scope creep | High — never ships | Strict phase gates; each phase delivers standalone value |

---

## Success Metrics

- **Phase 1:** All existing tests pass with new model; bar data flows end-to-end
- **Phase 2:** Can search and fetch from UG; 80%+ of top-rated songs parse correctly
- **Phase 3:** 50% fewer parse failures on user-pasted input
- **Phase 4:** Users can build a complete chord sheet from lyrics in under 5 minutes
- **Phase 5:** Playback matches song timing within 1 beat accuracy
- **Phase 6:** Substitution suggestions are musically valid 90%+ of the time
- **Phase 7:** Users can sign up, save songs, and access pro features
- **Phase 8:** Lead sheet scanning extracts chords with 85%+ accuracy
- **Phase 9:** Zero data loss on browser clear; sub-100ms song load times
