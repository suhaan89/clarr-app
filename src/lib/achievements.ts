/**
 * Abzeichen (Achievements) fuer echte Meilensteine. REIN ABGELEITET aus den
 * serverseitigen Zahlen (Punkte-Saldo, Anzahl bestaetigter Meldungen,
 * abgeschlossener Faelle, Event-Teilnahmen). Der Client vergibt nichts und
 * speichert nichts: ist die Bedingung erfuellt, gilt das Abzeichen als
 * verdient. Keine Zufalls-/Lootbox-Mechanik, kein Verlust, kein Geldwert,
 * nur sichtbare Anerkennung fuer reale Wirkung.
 *
 * Diese Datei ist bewusst frei von React/RN, damit sie testbar bleibt. Die
 * Anzeige (Icon, Farben, Texte) liegt in der Komponente bzw. im i18n-Katalog.
 */

export type AchievementInput = {
  /** Punkte-Saldo (View points_level). */
  balance: number;
  /** Anzahl verifizierter Meldungen (Ledger-Grund report_verified). */
  reportsVerified: number;
  /** Anzahl mitbestaetigter Faelle (Ledger-Grund case_confirmed). */
  casesConfirmed: number;
  /** Anzahl selbst abgeschlossener Faelle (Ledger-Grund case_closed_after). */
  casesClosed: number;
  /** Anzahl Event-Teilnahmen (cleanup_signups). */
  events: number;
};

export type Achievement = {
  id: string;
  /** Ionicons-Name (als String, damit die Lib RN-frei bleibt). */
  icon: string;
  earned: boolean;
  /** Fortschritt zum Abzeichen, fuer noch nicht verdiente Abzeichen sichtbar. */
  current: number;
  target: number;
};

type Rule = {
  id: string;
  icon: string;
  target: number;
  value: (i: AchievementInput) => number;
};

// Reihenfolge = Anzeige-Reihenfolge. Erst die fruehen, motivierenden
// Meilensteine, dann die groesseren. Werte spiegeln die Reward-Regeln
// (Migration 007), ohne sie zu aendern.
const RULES: Rule[] = [
  { id: 'first_report', icon: 'camera', target: 1, value: (i) => i.reportsVerified },
  { id: 'first_confirm', icon: 'people', target: 1, value: (i) => i.casesConfirmed },
  { id: 'first_close', icon: 'checkmark-done', target: 1, value: (i) => i.casesClosed },
  { id: 'first_event', icon: 'calendar', target: 1, value: (i) => i.events },
  { id: 'reports_5', icon: 'albums', target: 5, value: (i) => i.reportsVerified },
  { id: 'places_5', icon: 'sparkles', target: 5, value: (i) => i.casesClosed },
  { id: 'reports_25', icon: 'ribbon', target: 25, value: (i) => i.reportsVerified },
  { id: 'rank_bronze', icon: 'medal', target: 100, value: (i) => i.balance },
  { id: 'rank_silber', icon: 'medal', target: 250, value: (i) => i.balance },
  { id: 'rank_gold', icon: 'trophy', target: 500, value: (i) => i.balance },
];

/** Leitet die Abzeichen-Liste aus den Zahlen ab (Anzeige-Reihenfolge). */
export function computeAchievements(input: AchievementInput): Achievement[] {
  return RULES.map((r) => {
    const n = r.value(input);
    const raw = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    return {
      id: r.id,
      icon: r.icon,
      earned: raw >= r.target,
      current: Math.min(raw, r.target),
      target: r.target,
    };
  });
}

/** Anzahl bereits verdienter Abzeichen (fuer die Ueberschrift „3 von 10"). */
export function earnedCount(list: Achievement[]): number {
  return list.filter((a) => a.earned).length;
}
