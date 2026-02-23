/** Theme definitions for Caspian. Each theme defines CSS custom property values. */

export interface Theme {
  id: string;
  name: string;
  /** Short preview description */
  desc: string;
  vars: Record<string, string>;
}

export const themes: Theme[] = [
  {
    id: 'manuscript',
    name: 'Manuscript',
    desc: 'Warm score paper & ink',
    vars: {
      '--color-bg': '#1c1914',
      '--color-surface': '#252219',
      '--color-surface-2': '#322d22',
      '--color-border': '#4a4235',
      '--color-text': '#eae6dd',
      '--color-text-secondary': '#d4cfc4',
      '--color-diatonic': '#7cb87a',
      '--color-secondary-dom': '#c9a0dc',
      '--color-borrowed': '#e8b84a',
      '--color-diminished': '#e07a6a',
      '--color-deceptive': '#6ecad4',
      '--color-neutral': '#9c9588',
      '--color-staff-line': '#5c5548',
      '--color-accent': '#c9a227',
      '--color-primary': '#c9a227',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    desc: 'Deep dark blue',
    vars: {
      '--color-bg': '#0a0e1a',
      '--color-surface': '#111827',
      '--color-surface-2': '#1e293b',
      '--color-border': '#334155',
      '--color-text': '#e2e8f0',
      '--color-text-secondary': '#cbd5e1',
      '--color-diatonic': '#22c55e',
      '--color-secondary-dom': '#e879f9',
      '--color-borrowed': '#fbbf24',
      '--color-diminished': '#f87171',
      '--color-deceptive': '#22d3ee',
      '--color-neutral': '#94a3b8',
      '--color-staff-line': '#475569',
      '--color-accent': '#6366f1',
      '--color-primary': '#6366f1',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    desc: 'Cool teal tones',
    vars: {
      '--color-bg': '#042f2e',
      '--color-surface': '#0d3d3b',
      '--color-surface-2': '#134e4a',
      '--color-border': '#2dd4bf33',
      '--color-text': '#f0fdfa',
      '--color-text-secondary': '#ccfbf1',
      '--color-diatonic': '#34d399',
      '--color-secondary-dom': '#c084fc',
      '--color-borrowed': '#fde68a',
      '--color-diminished': '#fb923c',
      '--color-deceptive': '#67e8f9',
      '--color-neutral': '#99f6e4',
      '--color-staff-line': '#5eead4',
      '--color-accent': '#14b8a6',
      '--color-primary': '#14b8a6',
    },
  },
  {
    id: 'warm',
    name: 'Ember',
    desc: 'Warm amber glow',
    vars: {
      '--color-bg': '#1c1412',
      '--color-surface': '#292018',
      '--color-surface-2': '#3d2e1e',
      '--color-border': '#78350f55',
      '--color-text': '#fef3c7',
      '--color-text-secondary': '#fde68a',
      '--color-diatonic': '#a3e635',
      '--color-secondary-dom': '#f0abfc',
      '--color-borrowed': '#fbbf24',
      '--color-diminished': '#ef4444',
      '--color-deceptive': '#38bdf8',
      '--color-neutral': '#d6d3d1',
      '--color-staff-line': '#78716c',
      '--color-accent': '#f59e0b',
      '--color-primary': '#f59e0b',
    },
  },
  {
    id: 'light',
    name: 'Paper',
    desc: 'Light & clean',
    vars: {
      '--color-bg': '#f8fafc',
      '--color-surface': '#ffffff',
      '--color-surface-2': '#f1f5f9',
      '--color-border': '#e2e8f0',
      '--color-text': '#1e293b',
      '--color-text-secondary': '#334155',
      '--color-diatonic': '#16a34a',
      '--color-secondary-dom': '#a855f7',
      '--color-borrowed': '#d97706',
      '--color-diminished': '#dc2626',
      '--color-deceptive': '#0891b2',
      '--color-neutral': '#64748b',
      '--color-staff-line': '#94a3b8',
      '--color-accent': '#4f46e5',
      '--color-primary': '#4f46e5',
    },
  },
];

export type VizMode = 'staff' | 'piano' | 'guitar' | 'all';

export const vizModes: { id: VizMode; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'staff', label: 'Staff' },
  { id: 'piano', label: 'Piano' },
  { id: 'guitar', label: 'Guitar' },
];
