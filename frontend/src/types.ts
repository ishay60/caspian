// Task 1.3.1: BeatPosition interface
export interface BeatPosition {
  beat: number;          // 1-based beat number
  subdivision: number;   // 0 = on beat, 1 = "and", 2 = "e", 3 = "a"
}

// Task 1.3.2: BarChord interface
export interface BarChord {
  symbol: string;
  beat_position: BeatPosition;
  duration_beats: number | null;
}

// Task 1.3.3: BarNote interface
export interface BarNote {
  pitch: string;                    // e.g., "A", "C#"
  octave: number;                   // default 4
  beat_position: BeatPosition;
  duration_beats: number;           // default 0.5
  technique?: string;               // optional
}

// Task 1.3.4: TabNote interface
export interface TabNote {
  string: number;                   // 1-6 (1 = high E)
  fret: number;                     // 0-24
  beat_position: BeatPosition;
  duration_beats: number;
  technique?: string;
}

// Task 1.3.5: BarContent interface
export interface BarContent {
  chords: BarChord[];
  notes: BarNote[];
  tab: TabNote[];
  label?: string;
}

// Task 1.3.6: Bar interface
export interface Bar {
  time_signature: [number, number];  // tuple as array
  content: BarContent;
  lyrics_fragment: string;
  is_expandable: boolean;
}

// Task 1.3.7: BarAnalysis interface
export interface BarAnalysis {
  bar_index: number;
  chord_analyses: ChordAnalysis[];  // references ChordAnalysis below
  harmonic_rhythm: string;           // "static" | "half-bar" | "per-beat" | "syncopated"
  has_riff: boolean;
  riff_analysis?: string;
}

export interface Interpretation {
  type: string;
  detail: string;
  confidence: number;
}

export interface ChordAnalysis {
  symbol: string;
  root_name: string;
  root: number;
  quality: string;
  bass_name: string;
  bass: number;
  pitches: number[];
  is_inverted: boolean;
  roman_numeral: string;
  is_diatonic: boolean;
  diatonic_in_scales: string[];
  interpretations: Interpretation[];
  bass_motion_from_previous: string | null;
  common_tones_with_previous: string[];
  common_tones_with_next: string[];
  deceptive_resolution: string | null;
  secondary_dominant: string | null;
}

export interface BassNote {
  pitch: number;
  name: string;
  chord_symbol: string;
  position: number;
  motion_from_previous: string | null;
}

export interface ChromaticRun {
  notes: string[];
  direction: string;
  start_position: number;
  length: number;
}

export interface Pattern {
  type: string;
  detail: string;
  positions: number[];
}

export interface ChordLyricsLine {
  chords: [number, string][];  // [column_position, chord_symbol]
  lyrics: string;
}

export interface Section {
  name: string;
  chords: ChordAnalysis[];
  bass_line?: BassNote[];
  chromatic_runs?: ChromaticRun[];
  patterns?: Pattern[];
  lines?: ChordLyricsLine[];
  bars?: BarAnalysis[];  // Task 1.3.8: optional for backward compatibility
}

export interface Key {
  root_name: string;
  root: number;
  mode: string;
  scale_pitches: number[];
}

export interface ChordLyricPair {
  chords: string;
  lyrics: string;
}

export interface AnalysisResult {
  title: string;
  artist: string;
  key: Key | null;
  sections?: Section[];
  segmentation_suggested?: boolean;
  pairs?: ChordLyricPair[];
}

export interface LlmSectionNarrative {
  name: string;
  narrative: string;
}

export interface LlmAnalysisResult {
  sections: LlmSectionNarrative[];
  overall_summary: string;
}

export interface SearchResult {
  title: string;
  artist: string;
  source: 'ultimate_guitar' | 'tab4u';
  url: string;
  rating: number;
  rating_count: number;
}

export interface PreviewSection {
  name: string;
  chord_count: number;
  first_chords: string[];
}

export interface FormatPreview {
  key?: string;
  title?: string;
  artist?: string;
  sections: PreviewSection[];
}

export interface DetectFormatResponse {
  format: string;
  confidence: 'high' | 'medium' | 'low';
  preview?: FormatPreview;
  error?: string;
}

export interface ChordSubstitution {
  symbol: string;
  sub_type: string;
  reasoning: string;
  confidence: number;
  voice_leading_distance: number;
  common_tone_count: number;
}
