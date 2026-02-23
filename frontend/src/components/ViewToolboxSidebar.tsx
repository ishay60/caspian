import { useState } from 'react';
import { useSettings } from '../lib/settingsContext';
import { themes } from '../lib/themes';
import { languages, type Language } from '../lib/i18n';

const SIDEBAR_WIDTH = 260;
const STRIP_WIDTH = 52;

export function ViewToolboxSidebar() {
  const { theme, notation, setNotation, language, setLanguage, setTheme, t } = useSettings();
  const [open, setOpen] = useState(false);

  const notationItems: { key: 'showStaff' | 'showPiano' | 'showGuitar'; label: string; icon: string }[] = [
    { key: 'showStaff', label: t.viewStaff, icon: '♩' },
    { key: 'showPiano', label: t.viewPiano, icon: '♫' },
    { key: 'showGuitar', label: t.viewGuitar, icon: '🎸' },
  ];

  return (
    <div className="fixed top-0 right-0 z-40 flex h-full">
      {/* Icon strip — always visible, no slide. Each icon reflects state; click opens panel or toggles. */}
      <div
        className="flex flex-col shrink-0 border-l"
        style={{
          width: STRIP_WIDTH,
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
        role="toolbar"
        aria-label={t.notationTypes}
      >
        {notationItems.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setNotation({ [key]: !notation[key] })}
            className="flex flex-col items-center justify-center py-2.5 w-full cursor-pointer border-b last:border-b-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: notation[key] ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
              color: notation[key] ? 'var(--color-accent)' : 'var(--color-neutral)',
            }}
            title={`${label}: ${notation[key] ? t.toolboxOn : t.toolboxOff}`}
            aria-pressed={notation[key]}
            aria-label={`${label}, ${notation[key] ? 'on' : 'off'}. Click to toggle.`}
          >
            <span className="text-lg leading-none" aria-hidden>{icon === '🎸' ? 'G' : icon}</span>
            <span className="sr-only">{label}</span>
          </button>
        ))}
        <div className="flex-1 min-h-[8px]" style={{ borderColor: 'var(--color-border)', borderBottomWidth: '1px' }} />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex flex-col items-center justify-center py-2.5 w-full cursor-pointer mt-auto shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset"
          style={{
            backgroundColor: open ? 'var(--color-surface-2)' : 'transparent',
            color: 'var(--color-accent)',
          }}
          title={open ? t.toolboxClose : t.toolboxOpen}
          aria-expanded={open}
          aria-label={open ? t.toolboxClose : t.toolboxOpen}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
          <span className="text-[9px] font-semibold mt-0.5 uppercase" style={{ color: 'var(--color-neutral)' }}>{t.view}</span>
        </button>
      </div>

      {/* Panel — appears without width animation (instant show/hide) */}
      {open && (
        <div
          className="overflow-y-auto border-l flex flex-col"
          style={{
            width: SIDEBAR_WIDTH,
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.2)',
          }}
          role="dialog"
          aria-label={t.notationTypes}
        >
          <div className="p-4 space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-neutral)' }} id="notation-types-label">
                {t.notationTypes}
              </h3>
              <div className="space-y-2" role="group" aria-labelledby="notation-types-label">
                {notationItems.map(({ key, label, icon }) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 py-2 px-3 rounded-xl border cursor-pointer transition-colors"
                    style={{
                      borderColor: notation[key] ? 'var(--color-accent)' : 'var(--color-border)',
                      backgroundColor: notation[key] ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={notation[key]}
                      onChange={(e) => setNotation({ [key]: e.target.checked })}
                      className="w-4 h-4 rounded cursor-pointer"
                      style={{ accentColor: 'var(--color-accent)' }}
                      aria-label={label}
                    />
                    <span className="text-lg" aria-hidden>{icon === '🎸' ? 'G' : icon}</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{label}</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] mt-2" style={{ color: 'var(--color-neutral)' }}>
                {t.toolboxHint}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-neutral)' }} id="theme-label">{t.theme}</h3>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="theme-label">
                {themes.map(th => (
                  <button
                    key={th.id}
                    onClick={() => setTheme(th.id)}
                    title={`${th.name} — ${th.desc}`}
                    className="w-8 h-8 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                    style={{
                      backgroundColor: th.vars['--color-bg'],
                      borderColor: theme.id === th.id ? th.vars['--color-accent'] : th.vars['--color-border'],
                      boxShadow: theme.id === th.id ? `0 0 0 2px ${th.vars['--color-accent']}50` : 'none',
                    }}
                    aria-label={`Theme ${th.name}, ${th.desc}`}
                    aria-pressed={theme.id === th.id}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: th.vars['--color-diatonic'] }} aria-hidden />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-neutral)' }} id="lang-label">{t.language}</h3>
              <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--color-border)' }} role="group" aria-labelledby="lang-label">
                {languages.map(l => (
                  <button
                    key={l.id}
                    onClick={() => setLanguage(l.id as Language)}
                    className="flex-1 px-2 py-2 text-xs font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset"
                    style={{
                      backgroundColor: language === l.id ? 'var(--color-accent)' : 'var(--color-surface-2)',
                      color: language === l.id ? '#fff' : 'var(--color-neutral)',
                    }}
                    aria-pressed={language === l.id}
                    aria-label={`Language ${l.native}`}
                  >
                    {l.native}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
