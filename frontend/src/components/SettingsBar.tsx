import { useSettings } from '../lib/settingsContext';
import { themes, vizModes } from '../lib/themes';
import { languages, type Language } from '../lib/i18n';

const vizLabelKeys = {
  all: 'viewAll',
  staff: 'viewStaff',
  piano: 'viewPiano',
  guitar: 'viewGuitar',
} as const;

export function SettingsBar() {
  const { theme, vizMode, language, t, setTheme, setVizMode, setLanguage } = useSettings();

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Language picker */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-[--color-neutral] uppercase tracking-wider font-medium">
          {t.language}
        </label>
        <div className="flex rounded-lg overflow-hidden border border-[--color-border]">
          {languages.map(l => (
            <button
              key={l.id}
              onClick={() => setLanguage(l.id as Language)}
              className="px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: language === l.id ? 'var(--color-accent)' : 'var(--color-surface-2)',
                color: language === l.id ? '#fff' : 'var(--color-neutral)',
              }}
            >
              {l.native}
            </button>
          ))}
        </div>
      </div>

      {/* Visualization mode */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-[--color-neutral] uppercase tracking-wider font-medium">
          {t.view}
        </label>
        <div className="flex rounded-lg overflow-hidden border border-[--color-border]">
          {vizModes.map(m => (
            <button
              key={m.id}
              onClick={() => setVizMode(m.id)}
              className="px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: vizMode === m.id ? 'var(--color-accent)' : 'var(--color-surface-2)',
                color: vizMode === m.id ? '#fff' : 'var(--color-neutral)',
              }}
            >
              {t[vizLabelKeys[m.id]]}
            </button>
          ))}
        </div>
      </div>

      {/* Theme picker */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-[--color-neutral] uppercase tracking-wider font-medium">
          {t.theme}
        </label>
        <div className="flex gap-1">
          {themes.map(th => (
            <button
              key={th.id}
              onClick={() => setTheme(th.id)}
              title={`${th.name} — ${th.desc}`}
              className="w-6 h-6 rounded-full border-2 transition-all cursor-pointer"
              style={{
                backgroundColor: th.vars['--color-bg'],
                borderColor: theme.id === th.id ? th.vars['--color-accent'] : th.vars['--color-border'],
                boxShadow: theme.id === th.id
                  ? `0 0 0 2px ${th.vars['--color-accent']}40`
                  : 'none',
              }}
            >
              <span
                className="block w-2.5 h-2.5 rounded-full mx-auto"
                style={{ backgroundColor: th.vars['--color-diatonic'] }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
