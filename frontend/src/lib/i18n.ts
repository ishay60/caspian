/** Lightweight i18n system for Caspian. */

export type Language = 'en' | 'he';

export interface LanguageDef {
  id: Language;
  label: string;
  /** Native name shown in picker */
  native: string;
  dir: 'ltr' | 'rtl';
}

export const languages: LanguageDef[] = [
  { id: 'en', label: 'English', native: 'English', dir: 'ltr' },
  { id: 'he', label: 'Hebrew', native: 'עברית', dir: 'rtl' },
];

const en = {
  // App header
  appName: 'Caspian',
  appSubtitle: 'Harmonic Analysis',
  tuner: 'Tuner',
  loadingTuner: 'Loading tuner...',

  // Color legend
  diatonic: 'Diatonic',
  secDom: 'Sec. Dom',
  borrowed: 'Borrowed',
  dim: 'Dim',
  deceptive: 'Deceptive',

  // Input modes
  pasteText: 'Paste Text',
  lyricsFirst: 'Lyrics-First',
  searchOnline: 'Search Online',
  pasteChordSheet: 'Paste Chord Sheet',
  lyricsFirstMode: 'Lyrics-First Mode',
  lyricsFirstDesc: 'Enter lyrics, then click to add chords above each word',
  searchOnlineSheets: 'Search Online Chord Sheets',

  // Settings bar
  view: 'View',
  theme: 'Theme',
  language: 'Lang',
  viewAll: 'All',
  viewStaff: 'Staff',
  viewPiano: 'Piano',
  viewGuitar: 'Guitar',
  toolboxOpen: 'Open toolbox',
  toolboxClose: 'Close toolbox',
  toolboxOn: 'on',
  toolboxOff: 'off',
  notationTypes: 'Notation types',
  toolboxHint: 'Toggle each type on or off. Hidden types stay out of the way until you need them.',

  // Analysis view
  untitled: 'Untitled',
  key: 'Key',
  generating: 'Generating...',
  generateNarrative: 'Generate Harmonic Narrative',
  fretboard: 'Fretboard',
  fretboardExplorer: 'Fretboard Explorer',
  showScaleOnly: 'Show scale only',

  // Mode labels
  natural_minor: 'Natural Minor',
  harmonic_minor: 'Harmonic Minor',
  melodic_minor: 'Melodic Minor',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  phrygian_dominant: 'Phrygian Dominant',
  major: 'Major',
  mixolydian: 'Mixolydian',

  // Section view
  edited: 'edited',
  play: 'Play',
  practice: 'Practice',
  analysisDetails: 'Analysis Details',
  nonDiatonicEvents: 'Non-diatonic Events',
  deceptiveResolutions: 'Deceptive Resolutions',
  chromaticMotion: 'Chromatic Motion',
  pair: 'pair',
  run: 'run',
  apply: 'Apply',
  analyzing: 'Analyzing...',
  cancel: 'Cancel',

  // Chord detail panel
  nonDiatonic: 'Non-diatonic',
  inBass: 'in bass',
  piano: 'Piano',
  guitar: 'Guitar',
  bassMotion: 'Bass motion',
  commonTonesPrev: 'Common tones with prev',
  commonTonesNext: 'Common tones with next',
  interpretations: 'Interpretations',

  // Interpretation types
  chromatic_approach_from: 'Chromatic approach',
  chromatic_approach_to: 'Chromatic approach',
  rootless_dom7b9: 'Rootless dom7♭9',
  common_tone_dim: 'Common-tone dim',
  borrowedChord: 'Borrowed chord',
  secondary_dominant: 'Secondary dominant',

  // Bass line
  bassLine: 'Bass Line',

  // Transpose bar
  reset: 'Reset',
  capo: 'Capo',
  noCap: 'No capo',
  capoFret: 'Capo: fret',

  // Song library & search
  savedSongs: 'Saved Songs',
  saveCurrent: 'Save Current',
  noSavedSongs: 'No saved songs yet.',
  analyzeSave: 'Analyze a song and save it here.',
  searchPlaceholder: 'Search chords, keys, songs...',
  filterSecDom: 'Sec. Dom',
  filterBorrowed: 'Borrowed',
  filterDeceptive: 'Deceptive',
  filterDim: 'Dim',
  noResults: 'No songs match your search.',
  library: 'Library',
};

export type TranslationKeys = keyof typeof en;
export type Translations = Record<TranslationKeys, string>;

const he: Translations = {
  // App header
  appName: 'כספיאן',
  appSubtitle: 'ניתוח הרמוני',
  tuner: 'מכוון',
  loadingTuner: 'טוען מכוון...',

  // Color legend
  diatonic: 'דיאטוני',
  secDom: 'דומ. משנית',
  borrowed: 'שאול',
  dim: 'דימ',
  deceptive: 'מטעה',

  // Input modes
  pasteText: 'הדבק טקסט',
  lyricsFirst: 'מילים תחילה',
  searchOnline: 'חפש באינטרנט',
  pasteChordSheet: 'הדבק תרשים אקורדים',
  lyricsFirstMode: 'מצב מילים תחילה',
  lyricsFirstDesc: 'הזן מילים, ואז לחץ להוספת אקורדים מעל כל מילה',
  searchOnlineSheets: 'חפש תרשימי אקורדים באינטרנט',

  // Settings bar
  view: 'תצוגה',
  theme: 'ערכה',
  language: 'שפה',
  viewAll: 'הכל',
  viewStaff: 'תווים',
  viewPiano: 'פסנתר',
  viewGuitar: 'גיטרה',
  toolboxOpen: 'פתח סרגל כלים',
  toolboxClose: 'סגור סרגל כלים',
  toolboxOn: 'פועל',
  toolboxOff: 'כבוי',
  notationTypes: 'סוגי תיווי',
  toolboxHint: 'הפעל או כבה כל סוג. סוגים כבויים נשארים מחוץ לדרך עד שתצטרך אותם.',

  // Analysis view
  untitled: 'ללא שם',
  key: 'סולם',
  generating: 'מייצר...',
  generateNarrative: 'צור סיפור הרמוני',
  fretboard: 'לוח גריפים',
  fretboardExplorer: 'סייר לוח גריפים',
  showScaleOnly: 'הצג סולם בלבד',

  // Mode labels
  natural_minor: 'מינור טבעי',
  harmonic_minor: 'מינור הרמוני',
  melodic_minor: 'מינור מלודי',
  dorian: 'דוריאן',
  phrygian: 'פריגי',
  phrygian_dominant: 'פריגי דומיננטי',
  major: 'מז\'ור',
  mixolydian: 'מיקסולידי',

  // Section view
  edited: 'נערך',
  play: 'נגן',
  practice: 'תרגול',
  analysisDetails: 'פרטי ניתוח',
  nonDiatonicEvents: 'אירועים לא-דיאטוניים',
  deceptiveResolutions: 'פתרונות מטעים',
  chromaticMotion: 'תנועה כרומטית',
  pair: 'זוג',
  run: 'רצף',
  apply: 'החל',
  analyzing: 'מנתח...',
  cancel: 'בטל',

  // Chord detail panel
  nonDiatonic: 'לא-דיאטוני',
  inBass: 'בבס',
  piano: 'פסנתר',
  guitar: 'גיטרה',
  bassMotion: 'תנועת בס',
  commonTonesPrev: 'צלילים משותפים עם הקודם',
  commonTonesNext: 'צלילים משותפים עם הבא',
  interpretations: 'פרשנויות',

  // Interpretation types
  chromatic_approach_from: 'גישה כרומטית',
  chromatic_approach_to: 'גישה כרומטית',
  rootless_dom7b9: 'דומ7♭9 ללא יסוד',
  common_tone_dim: 'דימ צליל משותף',
  borrowedChord: 'אקורד שאול',
  secondary_dominant: 'דומיננטה משנית',

  // Bass line
  bassLine: 'קו בס',

  // Transpose bar
  reset: 'איפוס',
  capo: 'קאפו',
  noCap: 'ללא קאפו',
  capoFret: 'קאפו: סוגר',

  // Song library & search
  savedSongs: 'שירים שמורים',
  saveCurrent: 'שמור נוכחי',
  noSavedSongs: 'אין שירים שמורים.',
  analyzeSave: 'נתח שיר ושמור אותו כאן.',
  searchPlaceholder: 'חפש אקורדים, סולמות, שירים...',
  filterSecDom: 'דומ. משנית',
  filterBorrowed: 'שאול',
  filterDeceptive: 'מטעה',
  filterDim: 'דימ',
  noResults: 'לא נמצאו שירים תואמים.',
  library: 'ספרייה',
};

const translationMap: Record<Language, Translations> = { en, he };

export function getTranslations(lang: Language): Translations {
  return translationMap[lang] ?? translationMap.en;
}
