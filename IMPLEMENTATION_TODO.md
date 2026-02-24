# Caspian Grand Plan - Implementation TODO (SSOT)

> **Single Source of Truth** for all implementation tasks
>
> **Branching Strategy**: One branch per story point (format: `feature/phase-X-Y-description`)
> **Commit Strategy**: One commit per task with descriptive message
> **Current Phase**: Phase 1 - Bar & Timing Data Model

---

## Legend
- ⬜ Not started
- 🔄 In progress
- ✅ Completed
- 🚫 Blocked
- 📝 Needs research
- 🔍 Under review

---

## Phase 1: Bar & Timing Data Model
**Branch Strategy**: Each story point (1.1, 1.2, etc.) gets its own feature branch

### Story Point 1.1 — Backend: New Data Models
**Branch**: `feature/phase-1-1-bar-data-models`
**Goal**: Introduce bar-based data structures without breaking existing functionality

- ⬜ **Task 1.1.1**: Add `BeatPosition` model to `models/input.py`
  - Add beat (int) field
  - Add subdivision (int) field
  - Add validation (beat >= 1, subdivision >= 0)
  - Add docstring with examples

- ⬜ **Task 1.1.2**: Add `BarChord` model to `models/input.py`
  - Add symbol (str) field
  - Add beat_position (BeatPosition) field
  - Add duration_beats (float | None) field
  - Add validation and docstring

- ⬜ **Task 1.1.3**: Add `BarNote` model to `models/input.py`
  - Add pitch (str) field
  - Add octave (int) field with default=4
  - Add beat_position (BeatPosition) field
  - Add duration_beats (float) field with default=0.5
  - Add technique (str | None) field
  - Add validation for pitch names and octave range

- ⬜ **Task 1.1.4**: Add `TabNote` model to `models/input.py`
  - Add string (int) field with validation (1-6)
  - Add fret (int) field with validation (0-24)
  - Add beat_position (BeatPosition) field
  - Add duration_beats (float) field
  - Add technique (str | None) field

- ⬜ **Task 1.1.5**: Add `BarContent` model to `models/input.py`
  - Add chords (list[BarChord]) field with default_factory
  - Add notes (list[BarNote]) field with default_factory
  - Add tab (list[TabNote]) field with default_factory
  - Add label (str | None) field
  - Add helper method to check if expandable

- ⬜ **Task 1.1.6**: Add `Bar` model to `models/input.py`
  - Add time_signature (tuple[int, int]) field with default=(4,4)
  - Add content (BarContent) field
  - Add lyrics_fragment (str) field
  - Add is_expandable (bool) field
  - Add validation for time_signature

- ⬜ **Task 1.1.7**: Update `SectionInput` model to include bars
  - Add bars (list[Bar]) field with default_factory
  - Add tempo_bpm (float | None) field
  - Maintain backward compatibility with existing chords field
  - Add migration helper comment

- ⬜ **Task 1.1.8**: Write comprehensive unit tests for all new models
  - Test BeatPosition validation
  - Test BarChord creation and validation
  - Test BarNote with all techniques
  - Test TabNote string/fret validation
  - Test BarContent with mixed content types
  - Test Bar with expandable detection
  - Test SectionInput backward compatibility

- ⬜ **Task 1.1.9**: Add `BarAnalysis` model to `models/analysis.py`
  - Add bar_index (int) field
  - Add chord_analyses (list[ChordAnalysis]) field
  - Add harmonic_rhythm (str) field
  - Add has_riff (bool) field
  - Add riff_analysis (str | None) field

- ⬜ **Task 1.1.10**: Update `SectionAnalysis` to include bar analyses
  - Add bars (list[BarAnalysis]) field
  - Maintain backward compatibility
  - Add tests

### Story Point 1.2 — Backend: Dual-Path Analysis Pipeline
**Branch**: `feature/phase-1-2-dual-path-analysis`
**Goal**: Support both legacy (flat chords) and new (bars) analysis paths

- ⬜ **Task 1.2.1**: Create analysis path detection utility
  - Add function to detect if SectionInput uses bars or legacy chords
  - Handle edge case where both are present
  - Add comprehensive tests

- ⬜ **Task 1.2.2**: Extend analyzer.py with bar-aware path detection
  - Add _analyze_section_legacy() for existing flow
  - Add _analyze_section_bars() stub for new flow
  - Route based on detection utility
  - Ensure all existing tests pass

- ⬜ **Task 1.2.3**: Implement harmonic rhythm detection per bar
  - Analyze chord change frequency within bars
  - Classify as: static, half-bar, per-beat, syncopated
  - Add to BarAnalysis output
  - Write tests with various rhythmic patterns

- ⬜ **Task 1.2.4**: Implement syncopation pattern detection
  - Detect chords on off-beats (subdivisions > 0)
  - Flag common syncopation patterns
  - Add to BarAnalysis
  - Add tests

- ⬜ **Task 1.2.5**: Implement full bar-aware analysis flow
  - Convert bars to chronological chord sequence
  - Run existing analysis (key detection, roman numerals, etc.)
  - Map results back to BarAnalysis objects
  - Preserve beat position information

- ⬜ **Task 1.2.6**: Add riff detection to bar analysis
  - Check if BarContent has notes
  - Set has_riff flag
  - Add placeholder for riff_analysis (melodic analysis - future phase)

- ⬜ **Task 1.2.7**: Integration tests for dual-path analysis
  - Test legacy input → legacy output
  - Test bar input → bar output
  - Test mixed input handling
  - Verify all existing ground truth tests still pass

### Story Point 1.3 — Frontend: Types & API Contract
**Branch**: `feature/phase-1-3-frontend-types`
**Goal**: Create TypeScript types matching the new Python models

- ⬜ **Task 1.3.1**: Add BeatPosition interface to types.ts
  - Define beat: number
  - Define subdivision: number
  - Add JSDoc comments

- ⬜ **Task 1.3.2**: Add BarChord interface to types.ts
  - Define symbol: string
  - Define beat_position: BeatPosition
  - Define duration_beats: number | null

- ⬜ **Task 1.3.3**: Add BarNote interface to types.ts
  - Define pitch: string
  - Define octave: number
  - Define beat_position: BeatPosition
  - Define duration_beats: number
  - Define technique?: string

- ⬜ **Task 1.3.4**: Add TabNote interface to types.ts
  - Define string: number (1-6)
  - Define fret: number (0-24)
  - Define beat_position: BeatPosition
  - Define duration_beats: number
  - Define technique?: string

- ⬜ **Task 1.3.5**: Add BarContent interface to types.ts
  - Define chords: BarChord[]
  - Define notes: BarNote[]
  - Define tab: TabNote[]
  - Define label?: string

- ⬜ **Task 1.3.6**: Add Bar interface to types.ts
  - Define time_signature: [number, number]
  - Define content: BarContent
  - Define lyrics_fragment: string
  - Define is_expandable: boolean

- ⬜ **Task 1.3.7**: Add BarAnalysis interface to types.ts
  - Define bar_index: number
  - Define chord_analyses: ChordAnalysis[]
  - Define harmonic_rhythm: string
  - Define has_riff: boolean
  - Define riff_analysis?: string

- ⬜ **Task 1.3.8**: Update Section interface for bars
  - Add bars?: BarAnalysis[]
  - Maintain backward compatibility with existing fields

- ⬜ **Task 1.3.9**: Add type guards and validators
  - Add isBarBased() type guard
  - Add validateBar() helper
  - Add tests

### Story Point 1.4 — API Response Updates
**Branch**: `feature/phase-1-4-api-response-updates`
**Goal**: Update API responses to include bar data while maintaining backward compatibility

- ⬜ **Task 1.4.1**: Update AnalyzeResponse model in api.py
  - Ensure bars field is optional in response
  - Add serialization tests
  - Verify backward compatibility

- ⬜ **Task 1.4.2**: Update /analyze endpoint to handle bar input
  - Accept SongInput with bars
  - Pass through to analyzer
  - Return BarAnalysis in response
  - Test with both legacy and bar inputs

- ⬜ **Task 1.4.3**: Add API documentation for bar fields
  - Document BeatPosition structure
  - Document BarContent layers
  - Add example requests/responses
  - Update OpenAPI schema

- ⬜ **Task 1.4.4**: End-to-end integration tests
  - Test full flow: bar input → analysis → response
  - Test legacy flow still works
  - Test mixed scenarios
  - Verify response schema compliance

- ⬜ **Task 1.4.5**: Update frontend API client
  - Update analyzeSong() to handle bar responses
  - Add type safety for bar data
  - Update error handling

---

## Phase 2: Ultimate Guitar / Web Scraping
**Branch Strategy**: Each story point gets its own feature branch

### Story Point 2.1 — Research: Source Landscape
**Branch**: `feature/phase-2-1-source-research`
**Goal**: Research and document chord sheet sources and APIs

- 📝 **Task 2.1.1**: Research Ultimate Guitar API
  - Document internal JSON API structure
  - Test rate limiting behavior
  - Document authentication requirements
  - Create research document: `docs/sources/ultimate-guitar.md`

- 📝 **Task 2.1.2**: Research Hebrew chord sources
  - Document Tab4u.com structure and API (if any)
  - Research Shironet.co.il capabilities
  - Identify other Hebrew sources
  - Create research document: `docs/sources/hebrew-sources.md`

- 📝 **Task 2.1.3**: Legal and scraping considerations
  - Document robots.txt policies for each source
  - Research copyright implications
  - Document rate limiting strategies
  - Create legal guidance document: `docs/sources/legal-considerations.md`

- 📝 **Task 2.1.4**: Quality assessment framework
  - Define metrics for chord sheet quality
  - Research rating systems across sources
  - Document filtering strategies
  - Create quality framework doc: `docs/sources/quality-framework.md`

### Story Point 2.2 — Backend: Chord Sheet Fetcher Service
**Branch**: `feature/phase-2-2-fetcher-service`
**Goal**: Create abstraction layer for fetching from multiple sources

- ⬜ **Task 2.2.1**: Create sources module structure
  - Create `src/caspian/sources/__init__.py`
  - Create `src/caspian/sources/base.py`
  - Add module docstring and exports

- ⬜ **Task 2.2.2**: Define SearchResult model in base.py
  - Add source field
  - Add title, artist, url fields
  - Add rating, rating_count fields
  - Add has_bars boolean
  - Add validation

- ⬜ **Task 2.2.3**: Define RawChordSheet model in base.py
  - Add title, artist, key fields
  - Add sections list
  - Add source_url field
  - Add metadata fields

- ⬜ **Task 2.2.4**: Define ChordSheetSource abstract base class
  - Add abstract search() method
  - Add abstract fetch() method
  - Add common error handling
  - Add rate limiting decorator

- ⬜ **Task 2.2.5**: Implement UltimateGuitarSource
  - Create `src/caspian/sources/ultimate_guitar.py`
  - Implement search() with UG API
  - Implement fetch() with chord sheet retrieval
  - Add error handling and retries
  - Add comprehensive tests with mocked responses

- ⬜ **Task 2.2.6**: Implement Tab4uSource
  - Create `src/caspian/sources/tab4u.py`
  - Leverage existing tab4u_normalize.py
  - Implement search() if API available, else scraping
  - Implement fetch()
  - Add tests

- ⬜ **Task 2.2.7**: Implement caching layer
  - Create `src/caspian/sources/cache.py`
  - Add disk-based cache with TTL
  - Add cache invalidation logic
  - Add cache statistics
  - Add tests

### Story Point 2.3 — Backend: Conversion Pipeline
**Branch**: `feature/phase-2-3-conversion-pipeline`
**Goal**: Convert RawChordSheet to SongInput with bars

- ⬜ **Task 2.3.1**: Create converter module
  - Create `src/caspian/sources/converter.py`
  - Add RawChordSheet → SongInput converter
  - Handle bar line detection from raw data

- ⬜ **Task 2.3.2**: Implement bar line parser
  - Detect `|` delimiters in chord lines
  - Map chords to bars with beat positions
  - Handle different bar notation styles
  - Add tests with various formats

- ⬜ **Task 2.3.3**: Integrate tab4u normalization
  - Apply tab4u_normalize to Tab4u sources
  - Handle Hebrew RTL with existing rtl_handler
  - Preserve bar information through normalization

- ⬜ **Task 2.3.4**: Implement fallback to legacy format
  - When no bar info available, use ChordInput list
  - Maintain backward compatibility
  - Add conversion tests

- ⬜ **Task 2.3.5**: Add conversion quality metrics
  - Track successful vs failed conversions
  - Log parsing issues for debugging
  - Add telemetry

### Story Point 2.4 — Backend: API Endpoints
**Branch**: `feature/phase-2-4-search-fetch-endpoints`
**Goal**: Create REST endpoints for searching and fetching chord sheets

- ⬜ **Task 2.4.1**: Implement /api/search-songs endpoint
  - Add GET endpoint with query param
  - Add source filter (all/ultimate_guitar/tab4u)
  - Return list of SearchResult
  - Add pagination support
  - Add proper error handling
  - Add OpenAPI documentation

- ⬜ **Task 2.4.2**: Implement /api/fetch-sheet endpoint
  - Add GET endpoint with url param
  - Fetch from appropriate source
  - Convert to SongInput
  - Run analysis pipeline
  - Return full AnalyzeResponse
  - Add caching integration

- ⬜ **Task 2.4.3**: Add rate limiting middleware
  - Implement per-source rate limits
  - Add user-level rate limiting
  - Return appropriate HTTP 429 responses
  - Add retry-after headers

- ⬜ **Task 2.4.4**: Add comprehensive API tests
  - Test search with various queries
  - Test fetch with valid URLs
  - Test error cases (404, rate limit, invalid source)
  - Test caching behavior

### Story Point 2.5 — Frontend: Song Search UI
**Branch**: `feature/phase-2-5-song-search-ui`
**Goal**: Create user interface for searching and importing songs

- ⬜ **Task 2.5.1**: Create SongSearch component
  - Create `frontend/src/components/SongSearch.tsx`
  - Add search input with debouncing
  - Add source selector dropdown
  - Add loading states

- ⬜ **Task 2.5.2**: Implement search results display
  - Create SearchResultCard component
  - Display title, artist, rating, source badge
  - Add sorting options (rating, relevance)
  - Add hover states and interactions

- ⬜ **Task 2.5.3**: Implement result selection and import
  - Add click handler to fetch sheet
  - Auto-populate input form
  - Auto-trigger analysis
  - Show loading and error states

- ⬜ **Task 2.5.4**: Add search API integration
  - Update `frontend/src/api.ts` with searchSongs()
  - Update with fetchSheet()
  - Add TypeScript types
  - Add error handling

- ⬜ **Task 2.5.5**: Integrate with main app
  - Add SongSearch to App.tsx
  - Add tab or modal for search
  - Connect to analysis flow
  - Add navigation

### Story Point 2.6 — Hebrew Song Strategy
**Branch**: `feature/phase-2-6-hebrew-song-strategy`
**Goal**: Handle Hebrew-specific challenges

- ⬜ **Task 2.6.1**: Implement quality scoring for Hebrew sources
  - Add heuristics for Tab4u quality
  - Flag potential issues
  - Add user feedback mechanism

- ⬜ **Task 2.6.2**: Add correction workflow
  - Allow users to edit fetched sheets
  - Save corrections locally
  - Track correction metadata

- ⬜ **Task 2.6.3**: Hebrew-specific normalization
  - Extend tab4u_normalize for more cases
  - Handle mixed Hebrew/English text
  - Add tests with real Hebrew songs

### Story Point 2.7 — Caching Layer
**Branch**: `feature/phase-2-7-caching-layer`
**Goal**: Implement robust caching for fetched sheets

- ⬜ **Task 2.7.1**: Design cache schema
  - Define document structure
  - Add TTL and invalidation strategy
  - Add deduplication by title+artist

- ⬜ **Task 2.7.2**: Implement disk-based cache
  - Use JSON files for MVP
  - Add indexing for lookups
  - Add cleanup for expired entries

- ⬜ **Task 2.7.3**: Add cache management API
  - Add endpoint to clear cache
  - Add endpoint to view cache stats
  - Add cache warming utilities

---

## Phase 3: Improved Paste Parsing
**Branch Strategy**: Each story point gets its own feature branch

### Story Point 3.1 — Smarter Website Paste Detection
**Branch**: `feature/phase-3-1-paste-detection`

- ⬜ **Task 3.1.1**: Extend website_normalizer detection
  - Detect Ultimate Guitar HTML paste
  - Detect Tab4u HTML paste
  - Detect generic chord-above-lyrics
  - Add confidence scoring

- ⬜ **Task 3.1.2**: Improve spacing and formatting normalization
  - Handle mixed tabs/spaces
  - Normalize inconsistent line breaks
  - Preserve intentional formatting

- ⬜ **Task 3.1.3**: Better Hebrew section detection
  - Detect more פזמון/בית/גשר variants
  - Handle numbered sections (פזמון 1, פזמון 2)
  - Add tests with real Hebrew songs

### Story Point 3.2 — Multi-Format Parser Registry
**Branch**: `feature/phase-3-2-parser-registry`

- ⬜ **Task 3.2.1**: Create FormatDetector class
  - Create `src/caspian/parsing/registry.py`
  - Implement format detection heuristics
  - Return format identifier string
  - Add tests

- ⬜ **Task 3.2.2**: Create parser registry
  - Register all parser types
  - Add lookup by format name
  - Add fallback chain

- ⬜ **Task 3.2.3**: Integrate with existing parsers
  - Refactor input_parser to use registry
  - Update website_normalizer integration
  - Maintain backward compatibility

### Story Point 3.3 — Bar Line Detection in Pasted Text
**Branch**: `feature/phase-3-3-bar-line-detection`

- ⬜ **Task 3.3.1**: Implement bar notation parser
  - Create `src/caspian/parsing/bar_notation_parser.py`
  - Detect `| chord chord |` patterns
  - Convert to Bar objects with beat positions
  - Add tests

- ⬜ **Task 3.3.2**: Infer beat positions from bar structure
  - Distribute chords evenly across beats
  - Handle common patterns (2 chords = beats 1 & 3)
  - Add heuristics for different time signatures

### Story Point 3.4 — ChordPro Format Support
**Branch**: `feature/phase-3-4-chordpro-support`

- ⬜ **Task 3.4.1**: Create ChordPro parser
  - Create `src/caspian/parsing/chord_pro_parser.py`
  - Parse {title}, {key}, {time} directives
  - Parse [chord]lyrics inline format
  - Convert to SongInput

- ⬜ **Task 3.4.2**: Handle ChordPro sections
  - Parse {start_of_verse}, {chorus}, etc.
  - Map to SectionInput
  - Add tests with real ChordPro files

### Story Point 3.5 — Frontend: Paste Preview & Format Detection
**Branch**: `feature/phase-3-5-paste-preview`

- ⬜ **Task 3.5.1**: Add format detection indicator
  - Update InputForm.tsx
  - Show detected format badge
  - Show confidence level

- ⬜ **Task 3.5.2**: Add parse preview
  - Show parsed structure before analysis
  - Allow format override
  - Add manual format selector

---

## Phase 4: Chord Sheet View & Bar Editor

### Story Point 4.1 — Chord Sheet View (Read-Only Display)
**Branch**: `feature/phase-4-1-chord-sheet-view`

- ⬜ **Task 4.1.1**: Create ChordSheetView component
  - Create `frontend/src/components/ChordSheetView.tsx`
  - Render bars above lyrics
  - Support collapsed view (chord symbols only)

- ⬜ **Task 4.1.2**: Implement bar rendering
  - Render bar lines (`|`)
  - Position chords at correct syllables
  - Handle RTL for Hebrew lyrics

- ⬜ **Task 4.1.3**: Implement expandable bars
  - Add expand/collapse toggle per bar
  - Show riffs and notes in expanded view
  - Show tablature layer when available

- ⬜ **Task 4.1.4**: Add print/export mode
  - Strip interactivity for clean printing
  - Optimize for PDF export
  - Add CSS for print media

### Story Point 4.2 — Lyrics-First Input Mode
**Branch**: `feature/phase-4-2-lyrics-editor`

- ⬜ **Task 4.2.1**: Create LyricsChordEditor component
  - Create `frontend/src/components/LyricsChordEditor.tsx`
  - Accept plain lyrics input
  - Display line by line

- ⬜ **Task 4.2.2**: Implement chord placement
  - Click above word/syllable to place chord
  - Autocomplete from chord-completions API
  - Position tracking

- ⬜ **Task 4.2.3**: Render chords above lyrics
  - Use ChordSheetView format
  - Real-time update
  - Drag to reposition

### Story Point 4.3 — Bar Overlay Mode
**Branch**: `feature/phase-4-3-bar-overlay`

- ⬜ **Task 4.3.1**: Create BarOverlay component
  - Allow drawing bar lines between chords
  - Visual bar line indicators

- ⬜ **Task 4.3.2**: Implement auto-bar suggestion
  - Suggest bar placements
  - Based on chord spacing
  - Allow user confirmation

- ⬜ **Task 4.3.3**: Add time signature control
  - Per-section time signature
  - Default 4/4
  - Update beat grid accordingly

### Story Point 4.4 — Inline Riff/Instrumental Editor
**Branch**: `feature/phase-4-4-riff-editor`

- ⬜ **Task 4.4.1**: Create RiffEditor component
  - Beat range selection within bar
  - Note entry interface
  - Quick text entry (type note names)

- ⬜ **Task 4.4.2**: Implement tab entry mode
  - String/fret selection
  - Visual fretboard
  - Convert to TabNote objects

- ⬜ **Task 4.4.3**: Add riff labeling
  - Label input for collapsed view
  - Common label suggestions

### Story Point 4.5 — Beat Grid Editor
**Branch**: `feature/phase-4-5-beat-grid`

- ⬜ **Task 4.5.1**: Create BeatGrid component
  - Visual grid per bar
  - Beat and subdivision display
  - Click to place/remove chords

- ⬜ **Task 4.5.2**: Add syncopation support
  - 8th and 16th subdivision clicks
  - Visual indication of harmonic rhythm

- ⬜ **Task 4.5.3**: Show notes/riffs on grid
  - Smaller indicators for notes
  - Differentiate from chords

### Story Point 4.6 — Backend: Lyrics-to-SongInput Converter
**Branch**: `feature/phase-4-6-lyrics-converter`

- ⬜ **Task 4.6.1**: Create lyrics converter endpoint
  - Accept lyrics + chord placements
  - Convert to SongInput with bars
  - Return structured data

- ⬜ **Task 4.6.2**: Handle riff data
  - Accept RiffPlacement objects
  - Convert to BarContent.notes
  - Validate beat positions

### Story Point 4.7 — Auto-Bar Detection Heuristic
**Branch**: `feature/phase-4-7-auto-bar-detection`

- ⬜ **Task 4.7.1**: Implement bar detection heuristic
  - Analyze chord spacing patterns
  - Detect repeated chords (full bar)
  - Suggest bar boundaries

- ⬜ **Task 4.7.2**: Add user confirmation UI
  - Show suggested bars
  - Allow adjustment
  - Apply to SongInput

---

## Phase 5: Playback Engine

### Story Point 5.1 — Frontend: Audio Synthesis
**Branch**: `feature/phase-5-1-audio-synthesis`

- ⬜ **Task 5.1.1**: Extend ChordPlayer for sequential playback
  - Update `frontend/src/components/ChordPlayer.tsx`
  - Add playback mode (single vs sequential)
  - BPM control UI

- ⬜ **Task 5.1.2**: Implement Web Audio scheduling
  - Create `frontend/src/lib/playbackEngine.ts`
  - Schedule chords at precise beat positions
  - Handle timing accuracy

- ⬜ **Task 5.1.3**: Add metronome click track
  - Create `frontend/src/lib/metronome.ts`
  - Synthesize click sound
  - Synchronize with playback

### Story Point 5.2 — Playback with Bar Awareness
**Branch**: `feature/phase-5-2-bar-aware-playback`

- ⬜ **Task 5.2.1**: Read bars data for playback
  - Parse BarAnalysis
  - Extract beat positions
  - Build playback timeline

- ⬜ **Task 5.2.2**: Handle time signature changes
  - Detect time signature changes between sections
  - Adjust beat scheduling
  - Update metronome

- ⬜ **Task 5.2.3**: Support syncopated rhythms
  - Schedule off-beat chords
  - Maintain timing accuracy

- ⬜ **Task 5.2.4**: Add visual playback cursor
  - Highlight current bar
  - Follow playback through chord sheet
  - Scroll automatically

### Story Point 5.3 — Practice Mode Enhancements
**Branch**: `feature/phase-5-3-practice-mode`

- ⬜ **Task 5.3.1**: Add section/bar looping
  - Update `frontend/src/components/PracticeMode.tsx`
  - Select loop range
  - Repeat playback

- ⬜ **Task 5.3.2**: Add tempo control
  - Slow down without pitch change
  - Tap tempo input

- ⬜ **Task 5.3.3**: Add count-in
  - Configurable count-in bars
  - Visual count display
  - Metronome clicks

- ⬜ **Task 5.3.4**: Add bar highlighting
  - Highlight current and next bar
  - Practice mode focus view

---

## Phase 6: Songwriting / Harmony Exploration

### Story Point 6.1 — Chord Substitution Suggestions
**Branch**: `feature/phase-6-1-substitutions`

- ⬜ **Task 6.1.1**: Create SubstitutionPanel component
  - Create `frontend/src/components/SubstitutionPanel.tsx`
  - Show suggestions on chord click
  - Categories: diatonic, tritone, modal interchange

- ⬜ **Task 6.1.2**: Extend chord-completions API
  - Expand `src/caspian/completion/chord_completion.py`
  - Add substitution logic
  - Include roman numerals and voice leading info

- ⬜ **Task 6.1.3**: Add preview playback
  - Play original vs substitution
  - Side-by-side comparison

### Story Point 6.2 — Reharmonization Mode
**Branch**: `feature/phase-6-2-reharmonization`

- ⬜ **Task 6.2.1**: Create ReharmonizeModal component
  - Create `frontend/src/components/ReharmonizeModal.tsx`
  - Select bar range
  - Style options (jazzier, simpler, modal, chromatic)

- ⬜ **Task 6.2.2**: Implement reharmonization engine
  - Create `src/caspian/analysis/reharmonize.py`
  - Generate alternative progressions
  - Score by voice leading and function

- ⬜ **Task 6.2.3**: Add LLM explanation
  - Use existing LLM integration
  - Explain reharmonization choices
  - Educational mode

### Story Point 6.3 — Blank Canvas Mode
**Branch**: `feature/phase-6-3-blank-canvas`

- ⬜ **Task 6.3.1**: Create blank canvas UI
  - Start with empty bars
  - Set key and time signature
  - Build progression from scratch

- ⬜ **Task 6.3.2**: Add AI-assisted suggestions
  - "What comes next?" feature
  - Based on existing progression
  - Context-aware suggestions

- ⬜ **Task 6.3.3**: Add export functionality
  - Export as ChordPro
  - Export as Caspian format
  - Save to library

---

## Phase 7: User Accounts & Pro Tier

### Story Point 7.1 — Authentication System
**Branch**: `feature/phase-7-1-auth-system`

- ⬜ **Task 7.1.1**: Set up auth module
  - Create `src/caspian/auth/` module
  - Choose auth provider (Auth0/Supabase/custom)
  - Add dependencies

- ⬜ **Task 7.1.2**: Implement user model
  - User schema (id, email, name, tier, created_at)
  - Database table/collection
  - Migrations

- ⬜ **Task 7.1.3**: Implement JWT session management
  - Token generation
  - Token validation
  - Refresh token flow

- ⬜ **Task 7.1.4**: Add OAuth integration
  - Google OAuth
  - Email/password fallback

### Story Point 7.2 — Pro Tier Features
**Branch**: `feature/phase-7-2-pro-tier`

- ⬜ **Task 7.2.1**: Define tier feature matrix
  - Document free vs pro features
  - Create feature flags
  - Add tier checking utilities

- ⬜ **Task 7.2.2**: Implement tier gates
  - Check tier in relevant endpoints
  - Return appropriate errors
  - Add upgrade prompts

### Story Point 7.3 — Backend: Auth Middleware
**Branch**: `feature/phase-7-3-auth-middleware`

- ⬜ **Task 7.3.1**: Implement auth middleware
  - FastAPI dependency injection
  - JWT validation
  - User context injection

- ⬜ **Task 7.3.2**: Add rate limiting
  - Per-tier rate limits
  - Per-user tracking
  - HTTP 429 responses

- ⬜ **Task 7.3.3**: Add API key management
  - Generate API keys for pro users
  - Key validation
  - Key rotation

### Story Point 7.4 — Frontend: Auth UI
**Branch**: `feature/phase-7-4-auth-ui`

- ⬜ **Task 7.4.1**: Create AuthModal component
  - Create `frontend/src/components/AuthModal.tsx`
  - Login/signup forms
  - OAuth buttons

- ⬜ **Task 7.4.2**: Create account settings page
  - Profile management
  - Tier display
  - API key management

- ⬜ **Task 7.4.3**: Add auth context
  - Create `frontend/src/lib/auth.ts`
  - Auth state management
  - Token storage

- ⬜ **Task 7.4.4**: Add pro badge and upgrade CTA
  - Pro badge in UI
  - Feature-locked prompts
  - Upgrade flow

---

## Phase 8: Music Sheet Scanning (AI-Powered, Pro Only)

### Story Point 8.1 — Research Phase
**Branch**: `feature/phase-8-1-sheet-scanning-research`

- 📝 **Task 8.1.1**: Research OMR libraries
  - Audiveris evaluation
  - OMR-datasets review
  - SheetVision testing
  - Create `docs/sheet-scanning-research.md`

- 📝 **Task 8.1.2**: Evaluate AI/ML approaches
  - Claude Vision API testing
  - GPT-4V comparison
  - MUSCIMA++ and DeepScores review
  - Cost analysis

- 📝 **Task 8.1.3**: Define scope and accuracy targets
  - Lead sheets vs full scores
  - Handwritten vs printed
  - Acceptable error rates
  - Document decisions

### Story Point 8.2 — MVP: Chord Symbol Extraction
**Branch**: `feature/phase-8-2-mvp-chord-extraction`

- ⬜ **Task 8.2.1**: Implement sheet scanner service
  - Create `src/caspian/sources/sheet_scanner.py`
  - Integrate with vision API
  - Parse structured response

- ⬜ **Task 8.2.2**: Design vision API prompts
  - Prompt engineering for chord extraction
  - Test with sample lead sheets
  - Iterate for accuracy

- ⬜ **Task 8.2.3**: Convert vision output to SongInput
  - Parse JSON response
  - Map to bars
  - Add confidence scores

### Story Point 8.3 — Advanced: Full Score Chord Extraction
**Branch**: `feature/phase-8-3-full-score-extraction`

- ⬜ **Task 8.3.1**: Integrate OMR for note detection
  - Use selected OMR library
  - Extract notes from staff

- ⬜ **Task 8.3.2**: Implement chord identification from notes
  - Group simultaneous notes
  - Identify chord quality
  - Detect inversions

- ⬜ **Task 8.3.3**: Handle edge cases
  - Polyphonic passages
  - Ornaments and articulations
  - Add tests

### Story Point 8.4 — Human-in-the-Loop Correction UI
**Branch**: `feature/phase-8-4-correction-ui`

- ⬜ **Task 8.4.1**: Create SheetCorrectionView component
  - Create `frontend/src/components/SheetCorrectionView.tsx`
  - Side-by-side image and chords
  - Highlight uncertain detections

- ⬜ **Task 8.4.2**: Implement correction interface
  - Click to correct chords
  - Edit bar boundaries
  - Save corrections

### Story Point 8.5 — Backend Architecture
**Branch**: `feature/phase-8-5-backend-architecture`

- ⬜ **Task 8.5.1**: Create /api/scan-sheet endpoint
  - Add to api.py
  - Pro-only gate
  - File upload handling
  - Return AnalyzeResponse

- ⬜ **Task 8.5.2**: Add confidence scoring
  - Per-chord confidence
  - Overall scan quality
  - Uncertainty indicators

### Story Point 8.6 — Frontend: Upload & Correction UI
**Branch**: `feature/phase-8-6-upload-ui`

- ⬜ **Task 8.6.1**: Create SheetUpload component
  - Create `frontend/src/components/SheetUpload.tsx`
  - Drag-and-drop upload
  - Camera capture (mobile)

- ⬜ **Task 8.6.2**: Integrate with analysis flow
  - Upload → scan → correction → analysis
  - Progress indicators
  - Error handling

---

## Phase 9: Document Database & Cloud Storage

### Story Point 9.1 — Database Research & Decision
**Branch**: `feature/phase-9-1-db-research`

- 📝 **Task 9.1.1**: Document why document DB
  - Create `docs/database-decision.md`
  - Compare with relational approach
  - Document trade-offs

- 📝 **Task 9.1.2**: Evaluate Firestore
  - Test Firestore for song documents
  - Evaluate pricing
  - Test offline support

- 📝 **Task 9.1.3**: Evaluate MongoDB Atlas
  - Test MongoDB for song documents
  - Evaluate query capabilities
  - Compare pricing

- 📝 **Task 9.1.4**: Make final decision
  - Document choice and rationale
  - Create migration plan

### Story Point 9.2 — Document Structure Design
**Branch**: `feature/phase-9-2-document-structure`

- ⬜ **Task 9.2.1**: Design song document schema
  - Define complete structure
  - Add metadata fields
  - Add indexing strategy

- ⬜ **Task 9.2.2**: Design chord sheet cache schema
  - Define cache document structure
  - Add TTL fields
  - Add deduplication keys

- ⬜ **Task 9.2.3**: Create schema validation
  - Add Pydantic models for documents
  - Add validation tests

### Story Point 9.3 — Backend: Repository Pattern
**Branch**: `feature/phase-9-3-repository-pattern`

- ⬜ **Task 9.3.1**: Create repository abstraction
  - Create `src/caspian/db/` module
  - Define SongRepository abstract class
  - Define ChordSheetCacheRepository

- ⬜ **Task 9.3.2**: Implement Firestore/MongoDB repository
  - Implement concrete repository
  - Add connection management
  - Add error handling

- ⬜ **Task 9.3.3**: Implement JSON file repository (fallback)
  - File-based implementation for MVP
  - Index file for lookups
  - Migration path to cloud DB

### Story Point 9.4 — API: CRUD Endpoints
**Branch**: `feature/phase-9-4-crud-endpoints`

- ⬜ **Task 9.4.1**: Implement GET /api/songs
  - List user's songs
  - Add filtering
  - Add pagination

- ⬜ **Task 9.4.2**: Implement POST /api/songs
  - Save new song
  - Validate input
  - Return created song with ID

- ⬜ **Task 9.4.3**: Implement GET /api/songs/{id}
  - Fetch single song
  - Check ownership
  - Return full document

- ⬜ **Task 9.4.4**: Implement PUT /api/songs/{id}
  - Full document replace
  - Ownership check
  - Validation

- ⬜ **Task 9.4.5**: Implement PATCH /api/songs/{id}
  - Partial update
  - Merge with existing data

- ⬜ **Task 9.4.6**: Implement DELETE /api/songs/{id}
  - Soft or hard delete
  - Ownership check

- ⬜ **Task 9.4.7**: Add comprehensive API tests
  - Test all CRUD operations
  - Test permissions
  - Test error cases

### Story Point 9.5 — Frontend: Cloud Library
**Branch**: `feature/phase-9-5-cloud-library`

- ⬜ **Task 9.5.1**: Update songLibrary.ts for cloud
  - Add API-backed methods
  - Replace/augment localStorage
  - Add sync logic

- ⬜ **Task 9.5.2**: Update SongLibrary component
  - Update `frontend/src/components/SongLibrary.tsx`
  - Add cloud sync indicator
  - Show last synced timestamp

- ⬜ **Task 9.5.3**: Implement offline support
  - localStorage fallback
  - Sync queue for offline changes
  - Conflict resolution (last-write-wins for MVP)

- ⬜ **Task 9.5.4**: Add cloud library UI features
  - Search across all songs
  - Filter by tags, artist, key
  - Sort options

### Story Point 9.6 — Migration & Testing
**Branch**: `feature/phase-9-6-migration-testing`

- ⬜ **Task 9.6.1**: Create migration script
  - Migrate localStorage songs to cloud
  - Preserve metadata
  - Add migration UI

- ⬜ **Task 9.6.2**: Add integration tests
  - Test full CRUD flow
  - Test offline/online sync
  - Test conflict resolution

- ⬜ **Task 9.6.3**: Performance testing
  - Load time tests
  - Large library handling
  - Optimize queries

---

## Status Tracking

### Current Sprint
**Phase**: Phase 1 - Bar & Timing Data Model
**Story Point**: Not started
**Branch**: N/A
**Last Commit**: N/A
**Status**: Ready to begin

### Completion Metrics
- **Total Story Points**: 50+
- **Completed Story Points**: 0
- **Total Tasks**: 300+
- **Completed Tasks**: 0
- **Current Phase Progress**: 0%
- **Overall Progress**: 0%

### Recent Commits
_Will be updated as we progress_

---

## Notes & Guidelines

### Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: feat, fix, docs, style, refactor, test, chore
**Example**: `feat(models): add BeatPosition model with validation`

### Branch Naming Convention
```
feature/phase-<phase>-<story-point>-<short-description>
```
**Example**: `feature/phase-1-1-bar-data-models`

### PR Process
1. Complete all tasks in story point
2. Ensure all tests pass
3. Create PR from feature branch to develop
4. Review and merge
5. Delete feature branch
6. Move to next story point

### Testing Requirements
- All new models must have unit tests
- All new endpoints must have API tests
- All new components must have component tests
- Integration tests for full flows
- Maintain 80%+ code coverage

### Documentation Requirements
- Update relevant docs/ files
- Add inline code comments for complex logic
- Update API documentation (OpenAPI)
- Add examples for new features

---

**Last Updated**: 2024-02-24
**Maintained By**: Development Team
**Review Frequency**: After each story point completion
