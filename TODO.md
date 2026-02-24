# Caspian Grand Plan - Implementation TODO (SSOT)

**Last Updated:** 2026-02-24
**Current Branch:** story/3.5-paste-preview
**Current Story Point:** 3.5 Complete - Ready for Phase 4

---

## Overview

This is the **Single Source of Truth (SSOT)** for all implementation tasks for the Caspian Grand Plan.

### Workflow Rules:
1. **One branch per story point** - Create a new branch for each story point (e.g., `story/1.1-bar-data-models`)
2. **One commit per task** - Commit each completed task individually with descriptive messages
3. **Push regularly** - Push commits after each task to ensure progress is saved
4. **No task skipping** - Complete tasks in order within each story point
5. **Update this file** - Mark tasks as complete (`[x]`) and update the "Current Story Point" section above

### Task Status Legend:
- `[ ]` - Not started
- `[>]` - In progress
- `[x]` - Completed
- `[!]` - Blocked (note blocker in task)
- `[-]` - Skipped/Deferred

---

## Phase 1: Bar & Timing Data Model

**Branch Pattern:** `story/1.x-<description>`
**Goal:** Introduce bars as universal content containers without breaking existing functionality

### Story Point 1.1: Backend Bar Data Models ✅ COMPLETED
**Branch:** `story/1.1-bar-data-models` (pushed to remote)
**Tests:** 483 passing (57 new tests added)
**Commits:** 12 (one per task)

- [x] Task 1.1.1: Create `BeatPosition` model in `models/input.py`
- [x] Task 1.1.2: Create `BarChord` model in `models/input.py`
- [x] Task 1.1.3: Create `BarNote` model in `models/input.py`
- [x] Task 1.1.4: Create `TabNote` model in `models/input.py`
- [x] Task 1.1.5: Create `BarContent` model in `models/input.py`
- [x] Task 1.1.6: Create `Bar` model in `models/input.py`
- [x] Task 1.1.7: Update `SectionInput` model to include `bars` field and `tempo_bpm`
- [x] Task 1.1.8: Write unit tests for all new models
- [x] Task 1.1.9: Create `BarAnalysis` model in `models/analysis.py`
- [x] Task 1.1.10: Update `SectionAnalysis` to include `bars: list[BarAnalysis]`
- [x] Task 1.1.11: Write unit tests for analysis models
- [x] Task 1.1.12: Run full test suite to ensure backward compatibility

### Story Point 1.2: Dual-Path Analysis Pipeline ✅ COMPLETED
**Branch:** `story/1.2-dual-path-analysis` (pushed to remote)
**Tests:** 499 passing (483 original + 16 new integration tests)
**Commits:** 2 (implementation + tests)

- [x] Task 1.2.1: Add bar-aware detection logic to `analyzer.py`
- [x] Task 1.2.2: Implement legacy path handler (section.chords exists)
- [x] Task 1.2.3: Implement bar-aware path handler (section.bars exists)
- [x] Task 1.2.4: Create `analyze_bar()` function for individual bar analysis
- [x] Task 1.2.5: Implement harmonic rhythm detection per bar
- [x] Task 1.2.6: Implement syncopation pattern detection
- [x] Task 1.2.7: Update `analyze_section()` to route to correct path
- [x] Task 1.2.8: Write integration tests for legacy path
- [x] Task 1.2.9: Write integration tests for bar-aware path
- [x] Task 1.2.10: Test dual-path with ground truth examples (yom_shishi.txt)
- [x] Task 1.2.11: Run full test suite

### Story Point 1.3: Frontend Types & API Contract ✅ COMPLETED
**Branch:** `story/1.3-frontend-types` (merged to develop)

- [x] Task 1.3.1: Create `BeatPosition` interface in `frontend/src/types.ts`
- [x] Task 1.3.2: Create `BarChord` interface in `frontend/src/types.ts`
- [x] Task 1.3.3: Create `BarNote` interface in `frontend/src/types.ts`
- [x] Task 1.3.4: Create `TabNote` interface in `frontend/src/types.ts`
- [x] Task 1.3.5: Create `BarContent` interface in `frontend/src/types.ts`
- [x] Task 1.3.6: Create `Bar` interface in `frontend/src/types.ts`
- [x] Task 1.3.7: Create `BarAnalysis` interface in `frontend/src/types.ts`
- [x] Task 1.3.8: Update `Section` interface to include optional `bars` field
- [x] Task 1.3.9: Update API client types to match backend models
- [x] Task 1.3.10: Add TypeScript compilation check to CI/build

### Story Point 1.4: API Response Updates ✅ COMPLETED
**Branch:** `story/1.4-api-response-updates` (merged to develop)

- [x] Task 1.4.1: Update `AnalyzeResponse` model in `api.py` to include bars
- [x] Task 1.4.2: Update `/analyze` endpoint to return bar data when present
- [x] Task 1.4.3: Ensure backward compatibility for clients not using bars
- [x] Task 1.4.4: Add API integration tests for bar-aware responses
- [x] Task 1.4.5: Add API integration tests for legacy responses
- [x] Task 1.4.6: Update API documentation/OpenAPI schema
- [x] Task 1.4.7: Test end-to-end flow (frontend → API → analysis → frontend)

---

## Phase 2: Ultimate Guitar / Web Scraping

**Branch Pattern:** `story/2.x-<description>`
**Goal:** Fetch and convert chord sheets from external sources

### Story Point 2.1: Research Source Landscape ✅ COMPLETED
**Branch:** `story/2.1-source-research` (merged to develop)

- [x] Task 2.1.1: Research Ultimate Guitar internal API structure
- [x] Task 2.1.2: Document UG rate limiting and auth requirements
- [x] Task 2.1.3: Research Tab4u.com structure and API (if any)
- [x] Task 2.1.4: Research shironet.co.il structure
- [x] Task 2.1.5: Document legal considerations for scraping
- [x] Task 2.1.6: Create `docs/source-research.md` with findings
- [x] Task 2.1.7: Design source prioritization strategy
- [x] Task 2.1.8: Create list of test URLs for each source

### Story Point 2.2: Backend Chord Sheet Fetcher Service ✅ COMPLETED
**Branch:** `story/2.2-fetcher-service` (merged to develop)

- [x] Task 2.2.1: Create `src/caspian/sources/` package structure
- [x] Task 2.2.2: Create `base.py` with `ChordSheetSource` abstract class
- [x] Task 2.2.3: Create `SearchResult` model in `base.py`
- [x] Task 2.2.4: Create `RawChordSheet` model in `base.py`
- [x] Task 2.2.5: Create `RawSection` model in `base.py`
- [x] Task 2.2.6: Write unit tests for base models
- [x] Task 2.2.7: Create `ultimate_guitar.py` with stub implementation
- [x] Task 2.2.8: Implement UG search method
- [x] Task 2.2.9: Implement UG fetch method
- [x] Task 2.2.10: Write integration tests for UG adapter (use VCR for HTTP mocking)
- [x] Task 2.2.11: Create `tab4u.py` adapter
- [x] Task 2.2.12: Implement Tab4u search method
- [x] Task 2.2.13: Implement Tab4u fetch method
- [x] Task 2.2.14: Write integration tests for Tab4u adapter
- [x] Task 2.2.15: Create `cache.py` for simple disk caching
- [x] Task 2.2.16: Implement cache with TTL support
- [x] Task 2.2.17: Write tests for cache layer

### Story Point 2.3: Backend Conversion Pipeline ✅ COMPLETED
**Branch:** `story/2.3-conversion-pipeline` (merged to develop)

- [x] Task 2.3.1: Create `src/caspian/sources/converter.py`
- [x] Task 2.3.2: Implement `convert_raw_to_song_input()` function
- [x] Task 2.3.3: Add bar line detection from UG format
- [x] Task 2.3.4: Add chord position mapping to bars
- [x] Task 2.3.5: Integrate tab4u_normalize for Tab4u sources
- [x] Task 2.3.6: Integrate RTL handling for Hebrew sources
- [x] Task 2.3.7: Write conversion tests with UG examples
- [x] Task 2.3.8: Write conversion tests with Tab4u examples
- [x] Task 2.3.9: Test end-to-end: fetch → convert → analyze

### Story Point 2.4: Backend API Endpoints ✅ COMPLETED
**Branch:** `story/2.4-api-endpoints` (merged to develop)

- [x] Task 2.4.1: Design REST API endpoints (`/api/search-songs`, `/api/fetch-sheet`)
- [x] Task 2.4.2: Create request/response models for search endpoint
- [x] Task 2.4.3: Create request/response models for fetch endpoint
- [x] Task 2.4.4: Implement `GET /api/search-songs` endpoint
- [x] Task 2.4.5: Add source parameter handling (all/ug/tab4u)
- [x] Task 2.4.6: Implement `GET /api/fetch-sheet` endpoint
- [x] Task 2.4.7: Add error handling for failed fetches
- [x] Task 2.4.8: Add rate limiting middleware
- [x] Task 2.4.9: Write API endpoint tests
- [x] Task 2.4.10: Update OpenAPI documentation

### Story Point 2.5: Frontend Song Search UI ✅ COMPLETED
**Branch:** `story/2.5-song-search-ui` (merged to develop)

- [x] Task 2.5.1: Create `SongSearch.tsx` component skeleton
- [x] Task 2.5.2: Implement search bar with source selector
- [x] Task 2.5.3: Create search results list component
- [x] Task 2.5.4: Add result item with title, artist, rating, source badge
- [x] Task 2.5.5: Implement click-to-fetch functionality
- [x] Task 2.5.6: Add loading states and error handling
- [x] Task 2.5.7: Implement sorting by rating (weighted by count)
- [x] Task 2.5.8: Add debouncing to search input
- [x] Task 2.5.9: Integrate with existing analysis flow
- [x] Task 2.5.10: Add responsive design for mobile
- [x] Task 2.5.11: Write component tests

### Story Point 2.6: Hebrew Song Strategy
**Branch:** `story/2.6-hebrew-strategy` ✅ **COMPLETED**

- [x] Task 2.6.1: Analyze Tab4u quality distribution
- [x] Task 2.6.2: Design user correction flow
- [x] Task 2.6.3: Create correction UI mockups
- [x] Task 2.6.4: Implement local correction storage
- [x] Task 2.6.5: Document Hebrew source limitations
- [x] Task 2.6.6: Plan for future community corrections (Phase 7+)

### Story Point 2.7: Caching Layer ✅ COMPLETED
**Branch:** `story/2.7-caching-layer` (merged to develop)

- [x] Task 2.7.1: Design cache document structure
- [x] Task 2.7.2: Implement JSON file cache (MVP approach)
- [x] Task 2.7.3: Add cache key generation (title + artist hash)
- [x] Task 2.7.4: Implement TTL expiration logic
- [x] Task 2.7.5: Add cache hit/miss logging
- [x] Task 2.7.6: Write cache tests
- [x] Task 2.7.7: Document cache strategy for Phase 9 DB migration

---

## Phase 3: Improved Paste Parsing

**Branch Pattern:** `story/3.x-<description>`
**Goal:** Make paste-and-parse smarter and more robust

### Story Point 3.1: Smarter Website Paste Detection ✅ COMPLETED
**Branch:** `story/3.1-smart-paste-detection` (merged to develop)
**Tests:** 585 passing (47 new tests added)

- [x] Task 3.1.1: Audit current `website_normalizer.py` capabilities
- [x] Task 3.1.2: Add Ultimate Guitar HTML paste detection
- [x] Task 3.1.3: Add Tab4u HTML paste detection
- [x] Task 3.1.4: Improve spacing normalization (tabs vs spaces)
- [x] Task 3.1.5: Add more Hebrew section markers (פזמון/בית/גשר variants)
- [x] Task 3.1.6: Add bar line detection in pasted text
- [x] Task 3.1.7: Write tests for new detection patterns
- [x] Task 3.1.8: Test with real-world paste examples

### Story Point 3.2: Multi-Format Parser Registry ✅ COMPLETED
**Branch:** `story/3.2-parser-registry` (pushed to remote)
**Tests:** 621 passing (36 new registry tests added)
**Commits:** 5 (one per task group)

- [x] Task 3.2.1: Create `parsing/registry.py`
- [x] Task 3.2.2: Design `FormatDetector` class
- [x] Task 3.2.3: Implement format detection heuristics
- [x] Task 3.2.4: Add format enum (format_a, website_paste, ug_html, tab4u_html, etc.)
- [x] Task 3.2.5: Create parser interface/protocol
- [x] Task 3.2.6: Register existing parsers in registry
- [x] Task 3.2.7: Write format detection tests
- [x] Task 3.2.8: Update `input_parser.py` to use registry

### Story Point 3.3: Bar Line Detection
**Branch:** `story/3.3-bar-line-detection`

- [ ] Task 3.3.1: Create `parsing/bar_notation_parser.py`
- [ ] Task 3.3.2: Implement bar line pattern detection (`| chord | chord |`)
- [ ] Task 3.3.3: Map chords to beat positions within bars
- [ ] Task 3.3.4: Handle multiple chords per bar
- [ ] Task 3.3.5: Create `Bar` objects from detected patterns
- [ ] Task 3.3.6: Write parser tests
- [ ] Task 3.3.7: Integrate with format registry

### Story Point 3.4: ChordPro Format Support
**Branch:** `story/3.4-chordpro-support`

- [ ] Task 3.4.1: Research ChordPro format specification
- [ ] Task 3.4.2: Create `parsing/chord_pro_parser.py`
- [ ] Task 3.4.3: Parse metadata directives (`{title:}`, `{key:}`)
- [ ] Task 3.4.4: Parse inline chord notation (`[Am]lyrics`)
- [ ] Task 3.4.5: Map to `SongInput` with chord-lyrics alignment
- [ ] Task 3.4.6: Handle section markers
- [ ] Task 3.4.7: Write ChordPro parser tests
- [ ] Task 3.4.8: Add ChordPro examples to test fixtures

### Story Point 3.5: Frontend Paste Preview ✅ COMPLETED
**Branch:** `story/3.5-paste-preview` (pushed to remote)
**Commits:** 3 (UI mockup + implementation + tests)

- [x] Task 3.5.1: Design paste preview UI mockup
- [x] Task 3.5.2: Update `InputForm.tsx` to show detected format
- [x] Task 3.5.3: Add format indicator badge
- [x] Task 3.5.4: Show preview of parsed structure before analysis
- [x] Task 3.5.5: Add format selector dropdown (override auto-detection)
- [x] Task 3.5.6: Add format switch handler
- [x] Task 3.5.7: Write component tests

---

## Phase 4: Chord Sheet View & Bar Editor

**Branch Pattern:** `story/4.x-<description>`
**Goal:** Build the visual chord sheet view and editing capabilities

### Story Point 4.1: Chord Sheet View (Read-Only)
**Branch:** `story/4.1-chord-sheet-view`

- [ ] Task 4.1.1: Design Chord Sheet View component architecture
- [ ] Task 4.1.2: Create `ChordSheetView.tsx` skeleton
- [ ] Task 4.1.3: Implement bar rendering (collapsed view)
- [ ] Task 4.1.4: Add chord positioning above lyrics
- [ ] Task 4.1.5: Implement vertical bar separators (`|`)
- [ ] Task 4.1.6: Add expand/collapse per bar
- [ ] Task 4.1.7: Implement expanded view (show riffs, notes)
- [ ] Task 4.1.8: Add RTL support for Hebrew lyrics
- [ ] Task 4.1.9: Implement responsive bar wrapping
- [ ] Task 4.1.10: Add print CSS styles
- [ ] Task 4.1.11: Add click handlers for interactive features
- [ ] Task 4.1.12: Write component tests
- [ ] Task 4.1.13: Test with ground truth examples

### Story Point 4.2: Lyrics-First Input Mode
**Branch:** `story/4.2-lyrics-input`

- [ ] Task 4.2.1: Create `LyricsChordEditor.tsx` component
- [ ] Task 4.2.2: Implement plain lyrics input step
- [ ] Task 4.2.3: Display lyrics line by line
- [ ] Task 4.2.4: Add click-to-place-chord functionality
- [ ] Task 4.2.5: Integrate chord autocomplete API
- [ ] Task 4.2.6: Implement chord position snapping to characters
- [ ] Task 4.2.7: Render chords above lyrics using Chord Sheet View
- [ ] Task 4.2.8: Add chord removal functionality
- [ ] Task 4.2.9: Add section marker insertion
- [ ] Task 4.2.10: Write component tests

### Story Point 4.3: Bar Overlay Mode
**Branch:** `story/4.3-bar-overlay`

- [ ] Task 4.3.1: Create `BarOverlay.tsx` component
- [ ] Task 4.3.2: Implement bar line insertion UI (click between chords)
- [ ] Task 4.3.3: Add auto-suggest bar lines algorithm
- [ ] Task 4.3.4: Implement time signature selector per section
- [ ] Task 4.3.5: Add beat position assignment within bars
- [ ] Task 4.3.6: Implement drag-to-adjust beat positions
- [ ] Task 4.3.7: Add validation for bar consistency
- [ ] Task 4.3.8: Write component tests

### Story Point 4.4: Inline Riff/Instrumental Editor
**Branch:** `story/4.4-riff-editor`

- [ ] Task 4.4.1: Create `RiffEditor.tsx` component
- [ ] Task 4.4.2: Implement beat range selection within bar
- [ ] Task 4.4.3: Add "Add riff" button UI
- [ ] Task 4.4.4: Implement note entry on beat grid
- [ ] Task 4.4.5: Add quick entry mode (type note names)
- [ ] Task 4.4.6: Implement auto-spacing of notes
- [ ] Task 4.4.7: Add tab view switcher
- [ ] Task 4.4.8: Implement string+fret position input
- [ ] Task 4.4.9: Add riff label input
- [ ] Task 4.4.10: Update collapsed view to show riff indicator
- [ ] Task 4.4.11: Write component tests

### Story Point 4.5: Beat Grid Editor
**Branch:** `story/4.5-beat-grid`

- [ ] Task 4.5.1: Create `BeatGrid.tsx` component
- [ ] Task 4.5.2: Render beat grid per bar (4/4 default)
- [ ] Task 4.5.3: Add click-to-place chords on grid
- [ ] Task 4.5.4: Implement 8th and 16th subdivision support
- [ ] Task 4.5.5: Add visual indication of harmonic rhythm
- [ ] Task 4.5.6: Show notes/riffs as smaller dots
- [ ] Task 4.5.7: Add drag-to-reposition functionality
- [ ] Task 4.5.8: Write component tests

### Story Point 4.6: Backend Lyrics-to-SongInput Converter
**Branch:** `story/4.6-lyrics-converter`

- [ ] Task 4.6.1: Design lyrics input API schema
- [ ] Task 4.6.2: Create request model for lyrics + chord placements
- [ ] Task 4.6.3: Implement converter function
- [ ] Task 4.6.4: Map chord placements to bars
- [ ] Task 4.6.5: Include riff placements in bars
- [ ] Task 4.6.6: Create API endpoint
- [ ] Task 4.6.7: Write converter tests
- [ ] Task 4.6.8: Write API endpoint tests

### Story Point 4.7: Auto-Bar Detection Heuristic
**Branch:** `story/4.7-auto-bar-detection`

- [ ] Task 4.7.1: Research common bar patterns in chord sheets
- [ ] Task 4.7.2: Implement 2-chords-per-line heuristic
- [ ] Task 4.7.3: Implement chord duration heuristic
- [ ] Task 4.7.4: Add pattern matching for repeated chords
- [ ] Task 4.7.5: Create confidence scoring system
- [ ] Task 4.7.6: Add user confirmation UI
- [ ] Task 4.7.7: Write heuristic tests
- [ ] Task 4.7.8: Test with various song examples

---

## Phase 5: Playback Engine

**Branch Pattern:** `story/5.x-<description>`
**Goal:** Enable rhythm-aware playback

### Story Point 5.1: Frontend Audio Synthesis
**Branch:** `story/5.1-audio-synthesis`

- [ ] Task 5.1.1: Audit existing `ChordPlayer.tsx`
- [ ] Task 5.1.2: Add sequential playback mode
- [ ] Task 5.1.3: Implement Web Audio API scheduling
- [ ] Task 5.1.4: Add BPM control UI
- [ ] Task 5.1.5: Implement tap tempo functionality
- [ ] Task 5.1.6: Add metronome click track option
- [ ] Task 5.1.7: Write playback engine tests

### Story Point 5.2: Playback with Bar Awareness
**Branch:** `story/5.2-bar-playback`

- [ ] Task 5.2.1: Create `playbackEngine.ts` library
- [ ] Task 5.2.2: Read bars data from analysis
- [ ] Task 5.2.3: Schedule chords at exact beat positions
- [ ] Task 5.2.4: Handle time signature changes
- [ ] Task 5.2.5: Support syncopated rhythms
- [ ] Task 5.2.6: Add visual cursor for current position
- [ ] Task 5.2.7: Implement bar-by-bar highlighting
- [ ] Task 5.2.8: Write playback tests

### Story Point 5.3: Practice Mode Enhancements
**Branch:** `story/5.3-practice-mode`

- [ ] Task 5.3.1: Update `PracticeMode.tsx`
- [ ] Task 5.3.2: Add section/bar range looping
- [ ] Task 5.3.3: Implement tempo slow-down (no pitch change)
- [ ] Task 5.3.4: Add count-in before playback
- [ ] Task 5.3.5: Highlight current and next bar
- [ ] Task 5.3.6: Add playback controls (play/pause/stop)
- [ ] Task 5.3.7: Write component tests

---

## Phase 6: Songwriting / Harmony Exploration

**Branch Pattern:** `story/6.x-<description>`
**Goal:** Tools for harmonic exploration and songwriting

### Story Point 6.1: Chord Substitution Suggestions
**Branch:** `story/6.1-substitutions`

- [ ] Task 6.1.1: Create `SubstitutionPanel.tsx` component
- [ ] Task 6.1.2: Design click-chord interaction
- [ ] Task 6.1.3: Implement suggestion modal
- [ ] Task 6.1.4: Add substitution categories (diatonic, tritone, modal, chromatic)
- [ ] Task 6.1.5: Show roman numerals for each suggestion
- [ ] Task 6.1.6: Add common tones indicator
- [ ] Task 6.1.7: Implement preview playback (original vs substitution)
- [ ] Task 6.1.8: Expand `chord_completion.py` for substitution logic
- [ ] Task 6.1.9: Create API endpoint for substitutions
- [ ] Task 6.1.10: Write tests

### Story Point 6.2: Reharmonization Mode
**Branch:** `story/6.2-reharmonization`

- [ ] Task 6.2.1: Create `ReharmonizeModal.tsx` component
- [ ] Task 6.2.2: Implement bar range selection
- [ ] Task 6.2.3: Add reharmonization style options (Jazzier, Simpler, Modal, Chromatic)
- [ ] Task 6.2.4: Create `analysis/reharmonize.py` module
- [ ] Task 6.2.5: Implement alternative progression generator
- [ ] Task 6.2.6: Add voice leading smoothness scoring
- [ ] Task 6.2.7: Add functional coherence scoring
- [ ] Task 6.2.8: Integrate LLM explanation (optional)
- [ ] Task 6.2.9: Create API endpoint
- [ ] Task 6.2.10: Write tests

### Story Point 6.3: Blank Canvas Mode
**Branch:** `story/6.3-blank-canvas`

- [ ] Task 6.3.1: Create blank canvas UI
- [ ] Task 6.3.2: Implement empty bar initialization
- [ ] Task 6.3.3: Add key selector
- [ ] Task 6.3.4: Integrate beat grid editor
- [ ] Task 6.3.5: Add AI-assisted next chord suggestions
- [ ] Task 6.3.6: Implement "what chord works after..." API
- [ ] Task 6.3.7: Add export to ChordPro
- [ ] Task 6.3.8: Add export to Caspian format
- [ ] Task 6.3.9: Write tests

---

## Phase 7: User Accounts & Pro Tier

**Branch Pattern:** `story/7.x-<description>`
**Goal:** Authentication and monetization

### Story Point 7.1: Authentication System
**Branch:** `story/7.1-auth-system`

- [ ] Task 7.1.1: Research Auth0 vs Supabase vs self-hosted
- [ ] Task 7.1.2: Choose and set up auth provider
- [ ] Task 7.1.3: Create user model (id, email, name, tier, created_at)
- [ ] Task 7.1.4: Implement JWT-based session management
- [ ] Task 7.1.5: Create auth module (`src/caspian/auth/`)
- [ ] Task 7.1.6: Write auth tests
- [ ] Task 7.1.7: Set up database for users (see Phase 9)

### Story Point 7.2: Pro Tier Features
**Branch:** `story/7.2-pro-tier`

- [ ] Task 7.2.1: Document free vs pro feature matrix
- [ ] Task 7.2.2: Implement tier checking logic
- [ ] Task 7.2.3: Add pro gates to LLM analysis
- [ ] Task 7.2.4: Add pro gates to cloud library
- [ ] Task 7.2.5: Add pro gates to reharmonization
- [ ] Task 7.2.6: Add pro gates to export features
- [ ] Task 7.2.7: Plan for sheet scanning (Phase 8)

### Story Point 7.3: Backend Auth Middleware
**Branch:** `story/7.3-auth-middleware`

- [ ] Task 7.3.1: Create FastAPI auth dependency
- [ ] Task 7.3.2: Implement JWT validation
- [ ] Task 7.3.3: Add rate limiting per tier
- [ ] Task 7.3.4: Add API key management for pro users
- [ ] Task 7.3.5: Create protected route decorators
- [ ] Task 7.3.6: Write middleware tests

### Story Point 7.4: Frontend Auth UI
**Branch:** `story/7.4-auth-ui`

- [ ] Task 7.4.1: Create `AuthModal.tsx` component
- [ ] Task 7.4.2: Add login form
- [ ] Task 7.4.3: Add signup form
- [ ] Task 7.4.4: Add password reset flow
- [ ] Task 7.4.5: Create account settings page
- [ ] Task 7.4.6: Add pro badge/upgrade CTA
- [ ] Task 7.4.7: Implement graceful degradation for free users
- [ ] Task 7.4.8: Create `auth.ts` client library
- [ ] Task 7.4.9: Write component tests

---

## Phase 8: Music Sheet Scanning

**Branch Pattern:** `story/8.x-<description>`
**Goal:** AI-powered sheet music to chord conversion

### Story Point 8.1: Research Phase
**Branch:** `story/8.1-sheet-scanning-research`

- [ ] Task 8.1.1: Research OMR libraries (Audiveris, SheetVision)
- [ ] Task 8.1.2: Test Claude Vision API with sample sheets
- [ ] Task 8.1.3: Test GPT-4V with sample sheets
- [ ] Task 8.1.4: Research specialized OMR models
- [ ] Task 8.1.5: Compare lead sheet vs full score complexity
- [ ] Task 8.1.6: Test handwritten vs printed accuracy
- [ ] Task 8.1.7: Analyze cost per sheet (API calls)
- [ ] Task 8.1.8: Define acceptable error rate
- [ ] Task 8.1.9: Create `docs/sheet-scanning-research.md`

### Story Point 8.2: MVP Chord Symbol Extraction
**Branch:** `story/8.2-lead-sheet-extraction`

- [ ] Task 8.2.1: Create `sources/sheet_scanner.py`
- [ ] Task 8.2.2: Implement image upload handler
- [ ] Task 8.2.3: Design Claude Vision API prompt
- [ ] Task 8.2.4: Implement API call to Claude Vision
- [ ] Task 8.2.5: Parse structured JSON response
- [ ] Task 8.2.6: Convert to `SongInput` with bars
- [ ] Task 8.2.7: Add confidence scores per chord
- [ ] Task 8.2.8: Write scanner tests with sample images
- [ ] Task 8.2.9: Test with real lead sheets

### Story Point 8.3: Advanced Full Score Extraction
**Branch:** `story/8.3-full-score-extraction`

- [ ] Task 8.3.1: Integrate OMR library for note detection
- [ ] Task 8.3.2: Implement simultaneous note grouping
- [ ] Task 8.3.3: Reuse chord quality identification logic
- [ ] Task 8.3.4: Handle inversions from bass note
- [ ] Task 8.3.5: Write tests for full score extraction

### Story Point 8.4: Human-in-the-Loop Correction UI
**Branch:** `story/8.4-correction-ui`

- [ ] Task 8.4.1: Create `SheetCorrectionView.tsx`
- [ ] Task 8.4.2: Display original image alongside extracted chords
- [ ] Task 8.4.3: Highlight uncertain detections
- [ ] Task 8.4.4: Add click-to-correct individual chords
- [ ] Task 8.4.5: Implement correction save flow
- [ ] Task 8.4.6: Write component tests

### Story Point 8.5: Backend Architecture
**Branch:** `story/8.5-scanner-backend`

- [ ] Task 8.5.1: Create `/api/scan-sheet` endpoint
- [ ] Task 8.5.2: Add pro-only gate
- [ ] Task 8.5.3: Implement image processing pipeline
- [ ] Task 8.5.4: Add error handling for failed scans
- [ ] Task 8.5.5: Write API tests

### Story Point 8.6: Frontend Upload & Correction UI
**Branch:** `story/8.6-upload-ui`

- [ ] Task 8.6.1: Create `SheetUpload.tsx` component
- [ ] Task 8.6.2: Implement drag-and-drop upload
- [ ] Task 8.6.3: Add camera capture on mobile
- [ ] Task 8.6.4: Add upload progress indicator
- [ ] Task 8.6.5: Integrate with correction view
- [ ] Task 8.6.6: Integrate with analysis flow
- [ ] Task 8.6.7: Write component tests

---

## Phase 9: Document Database & Cloud Storage

**Branch Pattern:** `story/9.x-<description>`
**Goal:** Persistent storage with cloud sync

### Story Point 9.1: Database Research & Decision
**Branch:** `story/9.1-db-research`

- [ ] Task 9.1.1: Compare Firestore vs MongoDB feature matrix
- [ ] Task 9.1.2: Analyze cost implications for both
- [ ] Task 9.1.3: Test Firestore with sample song documents
- [ ] Task 9.1.4: Test MongoDB with sample song documents
- [ ] Task 9.1.5: Evaluate offline sync capabilities
- [ ] Task 9.1.6: Make final database choice
- [ ] Task 9.1.7: Document decision rationale

### Story Point 9.2: Document Structure Design
**Branch:** `story/9.2-document-structure`

- [ ] Task 9.2.1: Design song document schema
- [ ] Task 9.2.2: Design chord_sheet_cache document schema
- [ ] Task 9.2.3: Design user document schema
- [ ] Task 9.2.4: Add indexes for common queries
- [ ] Task 9.2.5: Plan for schema versioning
- [ ] Task 9.2.6: Document structure in `docs/database-schema.md`

### Story Point 9.3: Backend Repository Pattern
**Branch:** `story/9.3-repository-pattern`

- [ ] Task 9.3.1: Create `db/` package structure
- [ ] Task 9.3.2: Create `SongRepository` abstract class
- [ ] Task 9.3.3: Create `ChordSheetCacheRepository` abstract class
- [ ] Task 9.3.4: Create `UserRepository` abstract class
- [ ] Task 9.3.5: Implement Firestore/MongoDB repository
- [ ] Task 9.3.6: Implement JSON file repository (fallback)
- [ ] Task 9.3.7: Write repository tests
- [ ] Task 9.3.8: Add dependency injection for repositories

### Story Point 9.4: API CRUD Endpoints
**Branch:** `story/9.4-crud-endpoints`

- [ ] Task 9.4.1: Design REST API for songs (GET/POST/PUT/PATCH/DELETE)
- [ ] Task 9.4.2: Create request/response models
- [ ] Task 9.4.3: Implement `GET /api/songs` (list)
- [ ] Task 9.4.4: Implement `POST /api/songs` (create)
- [ ] Task 9.4.5: Implement `GET /api/songs/{id}` (read)
- [ ] Task 9.4.6: Implement `PUT /api/songs/{id}` (update)
- [ ] Task 9.4.7: Implement `PATCH /api/songs/{id}` (partial update)
- [ ] Task 9.4.8: Implement `DELETE /api/songs/{id}` (delete)
- [ ] Task 9.4.9: Add auth checks (user can only access their songs)
- [ ] Task 9.4.10: Write API tests
- [ ] Task 9.4.11: Update OpenAPI documentation

### Story Point 9.5: Frontend Cloud Library
**Branch:** `story/9.5-cloud-library`

- [ ] Task 9.5.1: Create API-backed song library service
- [ ] Task 9.5.2: Update `SongLibrary.tsx` to use API
- [ ] Task 9.5.3: Add cloud sync indicator UI
- [ ] Task 9.5.4: Implement offline support with localStorage fallback
- [ ] Task 9.5.5: Add conflict resolution (last-write-wins)
- [ ] Task 9.5.6: Add "last synced" timestamp display
- [ ] Task 9.5.7: Write component tests

### Story Point 9.6: Migration & Testing
**Branch:** `story/9.6-db-migration`

- [ ] Task 9.6.1: Create migration script for localStorage → cloud
- [ ] Task 9.6.2: Add migration UI prompt for users
- [ ] Task 9.6.3: Test migration with sample data
- [ ] Task 9.6.4: Test full CRUD cycle end-to-end
- [ ] Task 9.6.5: Load test with 100+ songs
- [ ] Task 9.6.6: Verify sub-100ms load times

---

## Appendix: Quality Gates

Before merging any story point branch to `develop`:
- [ ] All tests pass (unit + integration)
- [ ] Code review completed (if team member available)
- [ ] API documentation updated (if API changes)
- [ ] Type checking passes (Python + TypeScript)
- [ ] No console errors in frontend
- [ ] Manual testing completed for user-facing features

---

## Notes

- Update this file after each task completion
- Create detailed commit messages for each task
- Push commits regularly (at minimum, after each task)
- If blocked, mark task as `[!]` and document blocker
- For research tasks, create a corresponding doc in `docs/` folder
- Maintain backward compatibility throughout all phases
