/**
 * Level- und Rang-Ableitung fuer die ANZEIGE. Spiegelt bewusst die
 * serverseitige View `points_level` (Migration 007):
 *
 *   level      = (balance / 100) + 1     (alle 100 Punkte eine Stufe)
 *   level_name = Starter (<100), Bronze (>=100), Silber (>=250), Gold (>=500)
 *
 * Der Client BUCHT nie und AENDERT nie Punkte. Diese Datei rechnet nur den
 * Saldo in Fortschritt um (z. B. fuer den Balken zur naechsten Stufe). Bleibt
 * die Server-Formel gleich, bleibt die Anzeige korrekt; aendert sie sich,
 * wird hier nachgezogen. Keine Streaks, kein Zufall, rein kosmetisch.
 */

/** Punkte pro Stufe (jede volle 100er-Marke ist eine neue Stufe). */
export const POINTS_PER_LEVEL = 100;

/** Rang-Schwellen (Name-Wechsel), aufsteigend. Spiegel der CASE-Logik oben. */
export const RANKS = [
  { key: 'starter', threshold: 0, name: 'Starter' },
  { key: 'bronze', threshold: 100, name: 'Bronze' },
  { key: 'silber', threshold: 250, name: 'Silber' },
  { key: 'gold', threshold: 500, name: 'Gold' },
] as const;

export type RankKey = (typeof RANKS)[number]['key'];

export type LevelProgress = {
  /** Aktuelle Stufe (1-basiert), wie in der View. */
  level: number;
  /** Punkte innerhalb der aktuellen Stufe (0 .. POINTS_PER_LEVEL - 1). */
  pointsIntoLevel: number;
  /** Noch fehlende Punkte bis zur naechsten Stufe (1 .. POINTS_PER_LEVEL). */
  pointsToNext: number;
  /** Fortschritt in der aktuellen Stufe, 0 .. 1 (fuer den Balken). */
  fraction: number;
};

/** Rechnet einen Saldo in Stufen-Fortschritt um (fuer den Level-Balken). */
export function levelProgress(balance: number): LevelProgress {
  const safe = Math.max(0, Math.floor(balance));
  const level = Math.floor(safe / POINTS_PER_LEVEL) + 1;
  const pointsIntoLevel = safe % POINTS_PER_LEVEL;
  const pointsToNext = POINTS_PER_LEVEL - pointsIntoLevel;
  return {
    level,
    pointsIntoLevel,
    pointsToNext,
    fraction: pointsIntoLevel / POINTS_PER_LEVEL,
  };
}

/** Der naechste Rang oberhalb des Saldos, oder null wenn der hoechste erreicht ist. */
export function nextRank(balance: number): { name: string; pointsAway: number } | null {
  const safe = Math.max(0, Math.floor(balance));
  const upcoming = RANKS.find((r) => r.threshold > safe);
  if (!upcoming) return null;
  return { name: upcoming.name, pointsAway: upcoming.threshold - safe };
}
