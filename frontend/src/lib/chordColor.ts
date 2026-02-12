import type { ChordAnalysis } from '../types';

/** Get the theme color for a chord based on its analysis properties. */
export function getChordColor(chord: ChordAnalysis): string {
  if (chord.deceptive_resolution) return 'var(--color-deceptive)';
  if (chord.interpretations.some(i => i.type === 'secondary_dominant')) return 'var(--color-secondary-dom)';
  if (chord.interpretations.some(i =>
    ['chromatic_approach_from', 'chromatic_approach_to', 'rootless_dom7b9', 'common_tone_dim'].includes(i.type)
  )) return 'var(--color-diminished)';
  if (chord.interpretations.some(i => i.type === 'borrowed')) return 'var(--color-borrowed)';
  if (chord.is_diatonic) return 'var(--color-diatonic)';
  return 'var(--color-neutral)';
}
