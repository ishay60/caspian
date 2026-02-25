# Caspian

Hebrew harmonic analysis tool for Israeli song chord progressions. Paste a chord sheet, get deep harmonic analysis — key detection, roman numerals, borrowed chords, diminished interpretations, deceptive resolutions, bass line analysis, and more.

## Features

**Analysis Engine**
- Automatic key detection with enharmonic-aware voting
- Roman numeral analysis with modal context
- Secondary dominant detection (V/x)
- Borrowed chord identification across parallel modes (Dorian, Mixolydian, etc.)
- Diminished chord interpretation (rootless dom7b9, chromatic approach, common-tone) with confidence scores
- Deceptive resolution detection
- Bass line motion analysis (chromatic runs, pedal tones)
- Pattern recognition (sequences, turnarounds)

**Multi-Format Input**
- Paste from any chord sheet site (auto-detected)
- Format A: `chords | lyrics` (Hebrew standard)
- Chord-above-lyrics format
- ChordPro (.cho/.chopro/.crd)
- Bar notation: `| Am | F | G | C |`
- Song search from external sources (Ultimate Guitar, Tab4u)
- RTL-aware: Hebrew lyrics auto-detected, chord order normalized

**Interactive Frontend**
- Chord Sheet View with proportional bar rectangles and collapsible sections
- Lyrics-First Editor: paste lyrics, click to place chords, draw bar lines
- Bar Overlay editor for restructuring bar boundaries
- Fretboard explorer (click any chord to see it on the neck)
- Transpose bar (shift key up/down, all analysis updates)
- Practice mode with chord playback (Web Audio)
- Guitar chord diagrams
- LLM narrative analysis (Claude or OpenAI, bring your own key)

## Quick Start

### Backend

```bash
# Install dependencies (requires Python 3.11+)
uv sync

# Run the API server
uv run uvicorn caspian.api:app --reload --port 8000

# Or use the CLI
uv run caspian examples/yom_shishi.txt
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the frontend proxies API calls to port 8000.

### Tests

```bash
# Backend (826+ tests)
uv run pytest

# Frontend
cd frontend && npm test
```

## Project Structure

```
src/caspian/
  models/         # Data models (input, analysis, bars)
  parsing/        # Multi-format parsers (Format A, ChordPro, website paste)
  theory/         # Music theory (chord parser, key detection, scales)
  analysis/       # Harmonic analysis pipeline
  completion/     # Chord completion/suggestion engine
  sources/        # External chord sheet fetchers (UG, Tab4u)
  output/         # Terminal output formatting
  api.py          # FastAPI server
  cli.py          # CLI entry point

frontend/src/
  components/     # React components (AnalysisView, ChordSheetView, BarDisplay, etc.)
  lib/            # Utilities (transpose, chord colors, settings, playback)
  types.ts        # TypeScript type definitions

examples/         # Sample chord sheets for testing
tests/            # Backend test suite
```

## Architecture

The analysis pipeline:

```
Input text → Format detection → Parser → SongInput (sections + chords + bars)
  → Key detection → Chord analysis → Roman numerals, borrowing, diminished, deceptive
  → Bass line analysis → Pattern recognition → AnalysisResult
```

Bars are the fundamental unit of musical time. Each bar holds chords at specific beat positions, optional riffs/notes, and lyrics fragments. The frontend renders bars as proportional rectangles with draggable chord durations.

## Dependencies

- **Runtime:** pydantic, fastapi, uvicorn, httpx, beautifulsoup4, lxml
- **Optional:** anthropic, openai (for LLM narrative)
- **Frontend:** React 19, Vite, TypeScript, Lucide icons

## License

Private — all rights reserved.
