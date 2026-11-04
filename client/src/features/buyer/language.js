import { createContext, useContext } from 'react';

export const LanguageContext = createContext(null);

/** `{ language, setLanguage, t }` where `t` holds the buyer copy in the chosen language. */
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return context;
}
