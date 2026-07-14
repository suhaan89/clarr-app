/**
 * Leichtgewichtiges i18n ohne Zusatz-Dependency: React-Context + AsyncStorage.
 * Standard ist Deutsch; fehlende Schlüssel fallen auf Deutsch zurück.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { LANGUAGES, type LanguageCode, type TranslationKey } from './translations';
import { translate } from './translate';

export { LANGUAGES, translate, type LanguageCode, type TranslationKey };

const STORAGE_KEY = 'clar.language';

type Params = Record<string, string | number>;

type I18nContextValue = {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  /** Übersetzt einen Schlüssel; {platzhalter} werden ersetzt. */
  t: (key: TranslationKey, params?: Params) => string;
  /** BCP-47-Tag für Datums-/Zahlenformatierung (toLocaleString etc.). */
  dateLocale: string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>('de');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && LANGUAGES.some((l) => l.code === stored)) {
        setLangState(stored as LanguageCode);
      }
    });
  }, []);

  const setLang = useCallback((next: LanguageCode) => {
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Nicht kritisch: Sprache gilt dann nur für diese Sitzung.
    });
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const dateLocale = LANGUAGES.find((l) => l.code === lang)?.dateLocale ?? 'de-DE';
    return {
      lang,
      setLang,
      t: (key, params) => translate(lang, key, params),
      dateLocale,
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n muss innerhalb von I18nProvider verwendet werden');
  return ctx;
}
