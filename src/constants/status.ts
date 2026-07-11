/**
 * Zentrales Status-System für Fälle/Meldungen.
 *
 * Grundregel (Barrierefreiheit): Status wird NIE nur über Farbe kommuniziert.
 * Jeder Zustand hat ein aussagekräftiges Icon + ein Text-Label + einen Farbton.
 * Rot/Grün allein reicht nicht (Farbfehlsichtigkeit) — deshalb immer Icon + Wort.
 *
 * Die DB-Statuswerte (`gemeldet`, `geprueft`, …) sind Backend und bleiben
 * unverändert; hier wird nur die ANZEIGE zugeordnet.
 */

import Ionicons from '@expo/vector-icons/Ionicons';

import type { TranslationKey } from '@/lib/i18n';

export type StatusTone = 'success' | 'danger' | 'warning' | 'neutral';

export type StatusMeta = {
  icon: keyof typeof Ionicons.glyphMap;
  tone: StatusTone;
  labelKey: TranslationKey;
};

/** Bekannte Fall-Status → Icon, Ton, Label-Schlüssel. */
export const CASE_STATUS_META: Record<string, StatusMeta> = {
  gemeldet: { icon: 'alert-circle', tone: 'danger', labelKey: 'case.status.gemeldet' },
  geprueft: { icon: 'shield-checkmark', tone: 'warning', labelKey: 'case.status.geprueft' },
  weitergeleitet: { icon: 'paper-plane', tone: 'warning', labelKey: 'case.status.weitergeleitet' },
  erledigt: { icon: 'checkmark-done-circle', tone: 'success', labelKey: 'case.status.erledigt' },
  geschlossen: { icon: 'archive', tone: 'neutral', labelKey: 'case.status.geschlossen' },
};

/** Gilt ein Fall als „offen" (noch nicht aufgeräumt)? */
export function isOpenStatus(status: string): boolean {
  return status === 'gemeldet' || status === 'geprueft' || status === 'weitergeleitet';
}

/**
 * Anzeige-Infos für einen Status. Unbekannte (künftige) Server-Status fallen
 * neutral und mit ihrem Rohwert als Label aus, statt die UI zu brechen.
 */
export function getCaseStatus(
  status: string,
  t: (key: TranslationKey) => string
): { icon: keyof typeof Ionicons.glyphMap; tone: StatusTone; label: string } {
  const meta = CASE_STATUS_META[status];
  if (meta) return { icon: meta.icon, tone: meta.tone, label: t(meta.labelKey) };
  return { icon: 'ellipse-outline', tone: 'neutral', label: status };
}
