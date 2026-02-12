import { useSettings } from '../lib/settingsContext';
import { themes, vizModes } from '../lib/themes';

export function SettingsBar() {
  const { theme, vizMode, setTheme, setVizMode } = useSettings();

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Visualization mode */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-[--color-neutral] uppercase tracking-wider font-medium">
          View
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
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Theme picker */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-[--color-neutral] uppercase tracking-wider font-medium">
          Theme
        </label>
        <div className="flex gap-1">
          {themes.map(t => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              title={`${t.name} — ${t.desc}`}
              className="w-6 h-6 rounded-full border-2 transition-all cursor-pointer"
              style={{
                backgroundColor: t.vars['--color-bg'],
                borderColor: theme.id === t.id ? t.vars['--color-accent'] : t.vars['--color-border'],
                boxShadow: theme.id === t.id
                  ? `0 0 0 2px ${t.vars['--color-accent']}40`
                  : 'none',
              }}
            >
              <span
                className="block w-2.5 h-2.5 rounded-full mx-auto"
                style={{ backgroundColor: t.vars['--color-diatonic'] }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
