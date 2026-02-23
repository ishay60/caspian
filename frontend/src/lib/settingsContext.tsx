import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { themes, type Theme } from './themes';
import { languages, getTranslations, type Language, type Translations } from './i18n';

export interface NotationToggles {
  showStaff: boolean;
  showPiano: boolean;
  showGuitar: boolean;
}

interface Settings {
  theme: Theme;
  notation: NotationToggles;
  language: Language;
  dir: 'ltr' | 'rtl';
  t: Translations;
  anthropicApiKey: string;
  openaiApiKey: string;
  setTheme: (id: string) => void;
  setNotation: (next: Partial<NotationToggles>) => void;
  setLanguage: (lang: Language) => void;
  setAnthropicApiKey: (key: string) => void;
  setOpenaiApiKey: (key: string) => void;
}

const SettingsContext = createContext<Settings | null>(null);

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

function loadSetting<T>(key: string, fallback: T, validate: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (validate(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return fallback;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState(() =>
    loadSetting('caspian-theme', 'manuscript', (v): v is string => typeof v === 'string' && themes.some(t => t.id === v))
  );
  const [notation, setNotationState] = useState<NotationToggles>(() => {
    const stored = loadSetting('caspian-notation', null, (v): v is NotationToggles =>
      v !== null && typeof v === 'object' &&
      typeof (v as NotationToggles).showStaff === 'boolean' &&
      typeof (v as NotationToggles).showPiano === 'boolean' &&
      typeof (v as NotationToggles).showGuitar === 'boolean'
    );
    if (stored) return stored;
    const legacy = loadSetting('caspian-viz', 'all', (v): v is string =>
      typeof v === 'string' && ['staff', 'piano', 'guitar', 'all'].includes(v)
    );
    if (legacy === 'all') return { showStaff: true, showPiano: true, showGuitar: true };
    if (legacy === 'staff') return { showStaff: true, showPiano: false, showGuitar: false };
    if (legacy === 'piano') return { showStaff: false, showPiano: true, showGuitar: false };
    if (legacy === 'guitar') return { showStaff: false, showPiano: false, showGuitar: true };
    return { showStaff: true, showPiano: true, showGuitar: true };
  });
  const [language, setLanguageState] = useState<Language>(() =>
    loadSetting('caspian-lang', 'en' as Language, (v): v is Language => typeof v === 'string' && languages.some(l => l.id === v))
  );
  const [anthropicApiKey, setAnthropicApiKeyState] = useState(() =>
    loadSetting('caspian-anthropic-key', '', (v): v is string => typeof v === 'string')
  );
  const [openaiApiKey, setOpenaiApiKeyState] = useState(() =>
    loadSetting('caspian-openai-key', '', (v): v is string => typeof v === 'string')
  );

  const theme = themes.find(t => t.id === themeId) ?? themes[0];
  const langDef = languages.find(l => l.id === language) ?? languages[0];
  const t = getTranslations(language);

  // Apply theme CSS variables to document root
  useEffect(() => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme.vars)) {
      root.style.setProperty(key, value);
    }
  }, [theme]);

  // Apply document direction for RTL languages
  useEffect(() => {
    document.documentElement.dir = langDef.dir;
    document.documentElement.lang = language;
  }, [language, langDef.dir]);

  function setTheme(id: string) {
    setThemeIdState(id);
    localStorage.setItem('caspian-theme', JSON.stringify(id));
  }

  function setNotation(next: Partial<NotationToggles>) {
    setNotationState(prev => {
      const nextState = { ...prev, ...next };
      localStorage.setItem('caspian-notation', JSON.stringify(nextState));
      return nextState;
    });
  }

  function setLanguage(lang: Language) {
    setLanguageState(lang);
    localStorage.setItem('caspian-lang', JSON.stringify(lang));
  }

  function setAnthropicApiKey(key: string) {
    setAnthropicApiKeyState(key);
    localStorage.setItem('caspian-anthropic-key', JSON.stringify(key));
  }

  function setOpenaiApiKey(key: string) {
    setOpenaiApiKeyState(key);
    localStorage.setItem('caspian-openai-key', JSON.stringify(key));
  }

  return (
    <SettingsContext.Provider value={{ theme, notation, language, dir: langDef.dir, t, anthropicApiKey, openaiApiKey, setTheme, setNotation, setLanguage, setAnthropicApiKey, setOpenaiApiKey }}>
      {children}
    </SettingsContext.Provider>
  );
}
