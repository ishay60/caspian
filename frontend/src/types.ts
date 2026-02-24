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
  bass_line: BassNote[];
  chromatic_runs: ChromaticRun[];
  patterns: Pattern[];
  lines: ChordLyricsLine[];
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
  key: Key;
  sections: Section[];
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
