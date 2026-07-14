// Reine Uebersetzungslogik — bewusst OHNE React/AsyncStorage-Abhaengigkeit,
// damit sie direkt (und ohne Mocks) testbar ist. `index.tsx` (der Provider)
// importiert von hier.

import { CATALOGS, de, type LanguageCode, type TranslationKey } from './translations';

type Params = Record<string, string | number>;

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

/**
 * Fallback-Kette: gewaehlte Sprache -> Deutsch -> Schluessel selbst
 * (letzteres nur bei Programmierfehlern, verhindert Abstuerze).
 */
export function translate(lang: LanguageCode, key: TranslationKey, params?: Params): string {
  const catalog = CATALOGS[lang];
  return interpolate(catalog[key] ?? de[key] ?? key, params);
}
