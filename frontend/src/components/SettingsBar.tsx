import { useState } from 'react';
import { useSettings } from '../lib/settingsContext';
import { themes } from '../lib/themes';
import { languages, type Language } from '../lib/i18n';

export function SettingsBar() {
  const { theme, language, t, anthropicApiKey, openaiApiKey, setTheme, setLanguage, setAnthropicApiKey, setOpenaiApiKey } = useSettings();
  const [showKeys, setShowKeys] = useState(false);
  const hasKey = Boolean(anthropicApiKey || openaiApiKey);

  return (
    <div className="flex flex-col gap-3">
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

        {/* API key toggle */}
        <button
          onClick={() => setShowKeys(s => !s)}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer"
          style={{
            borderColor: hasKey ? 'var(--color-accent)' : 'var(--color-border)',
            color: hasKey ? 'var(--color-accent)' : 'var(--color-neutral)',
            backgroundColor: hasKey
              ? 'color-mix(in srgb, var(--color-accent) 10%, var(--color-surface-2))'
              : 'var(--color-surface-2)',
          }}
        >
          {hasKey ? '✓ API key set' : 'API key'}
        </button>
      </div>

      {/* API key inputs (collapsible) */}
      {showKeys && (
        <div
          className="rounded-xl border p-4 space-y-3 text-sm"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}
        >
          <p className="text-xs" style={{ color: 'var(--color-neutral)' }}>
            Your key is stored only in your browser and sent directly to the backend for AI narrative generation. The server never stores it.
          </p>

          {/* Anthropic */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-widest font-semibold w-20 shrink-0" style={{ color: 'var(--color-neutral)' }}>
              Anthropic
            </label>
            <input
              type="password"
              placeholder="sk-ant-..."
              value={anthropicApiKey}
              onChange={e => setAnthropicApiKey(e.target.value)}
              className="flex-1 rounded-lg border px-3 py-1.5 text-xs font-mono bg-transparent outline-none"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
            {anthropicApiKey && (
              <button
                onClick={() => setAnthropicApiKey('')}
                className="text-xs px-2 py-1 rounded-lg border cursor-pointer"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-neutral)' }}
              >
                Clear
              </button>
            )}
          </div>

          {/* OpenAI */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-widest font-semibold w-20 shrink-0" style={{ color: 'var(--color-neutral)' }}>
              OpenAI
            </label>
            <input
              type="password"
              placeholder="sk-..."
              value={openaiApiKey}
              onChange={e => setOpenaiApiKey(e.target.value)}
              className="flex-1 rounded-lg border px-3 py-1.5 text-xs font-mono bg-transparent outline-none"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
            {openaiApiKey && (
              <button
                onClick={() => setOpenaiApiKey('')}
                className="text-xs px-2 py-1 rounded-lg border cursor-pointer"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-neutral)' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
