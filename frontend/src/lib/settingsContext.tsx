import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { themes, type Theme, type VizMode } from './themes';
import { languages, getTranslations, type Language, type Translations } from './i18n';

interface Settings {
  theme: Theme;
  vizMode: VizMode;
  language: Language;
  dir: 'ltr' | 'rtl';
  t: Translations;
  setTheme: (id: string) => void;
  setVizMode: (mode: VizMode) => void;
  setLanguage: (lang: Language) => void;
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
    loadSetting('caspian-theme', 'midnight', (v): v is string => typeof v === 'string' && themes.some(t => t.id === v))
  );
  const [vizMode, setVizModeState] = useState<VizMode>(() =>
    loadSetting('caspian-viz', 'all', (v): v is VizMode => typeof v === 'string' && ['staff', 'piano', 'guitar', 'all'].includes(v))
  );
  const [language, setLanguageState] = useState<Language>(() =>
    loadSetting('caspian-lang', 'en' as Language, (v): v is Language => typeof v === 'string' && languages.some(l => l.id === v))
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

  function setVizMode(mode: VizMode) {
    setVizModeState(mode);
    localStorage.setItem('caspian-viz', JSON.stringify(mode));
  }

  function setLanguage(lang: Language) {
    setLanguageState(lang);
    localStorage.setItem('caspian-lang', JSON.stringify(lang));
  }

  return (
    <SettingsContext.Provider value={{ theme, vizMode, language, dir: langDef.dir, t, setTheme, setVizMode, setLanguage }}>
      {children}
    </SettingsContext.Provider>
  );
}
