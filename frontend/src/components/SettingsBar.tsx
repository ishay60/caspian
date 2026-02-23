import { useSettings } from '../lib/settingsContext';
import { themes } from '../lib/themes';
import { languages, type Language } from '../lib/i18n';

export function SettingsBar() {
  const { theme, language, t, setTheme, setLanguage } = useSettings();

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* Language picker */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-[var(--color-neutral)] uppercase tracking-widest font-semibold">
          {t.language}
        </label>
        <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
          {languages.map(l => (
            <button
              key={l.id}
              onClick={() => setLanguage(l.id as Language)}
              className="px-3 py-1.5 text-xs font-medium transition-all cursor-pointer"
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

      {/* Theme picker */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-[var(--color-neutral)] uppercase tracking-widest font-semibold">
          {t.theme}
        </label>
        <div className="flex gap-1.5">
          {themes.map(th => (
            <button
              key={th.id}
              onClick={() => setTheme(th.id)}
              title={`${th.name} — ${th.desc}`}
              className="w-7 h-7 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center"
              style={{
                backgroundColor: th.vars['--color-bg'],
                borderColor: theme.id === th.id ? th.vars['--color-accent'] : th.vars['--color-border'],
                boxShadow: theme.id === th.id
                  ? `0 0 0 2px ${th.vars['--color-accent']}50`
                  : 'none',
              }}
            >
              <span
                className="block w-2 h-2 rounded-full"
                style={{ backgroundColor: th.vars['--color-diatonic'] }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
