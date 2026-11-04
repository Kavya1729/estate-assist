import { useEffect, useMemo, useState } from 'react';

import { LanguageContext } from './language';
import { STRINGS } from './strings';

const KEY = 'estate-assist.language';

function initialLanguage() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && STRINGS[saved]) return saved;
  } catch {
    // Storage unavailable: fall back to the browser language.
  }
  const browser = navigator.language?.slice(0, 2);
  return STRINGS[browser] ? browser : 'en';
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(initialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem(KEY, language);
    } catch {
      // Not saved; the choice still applies for this visit.
    }
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t: STRINGS[language] }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
