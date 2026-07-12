/**
 * Wochen-Hilfen. Die Woche startet Montag 00:00 (lokal), passend zum
 * Wochen-Reset der Bestenliste und zur Gemeinschafts-Challenge. Reine
 * Anzeige-Logik, keine Zeitdruck-Mechanik (kein Countdown, kein FOMO).
 */

/** Montag 00:00 (lokale Zeit) der Woche, in der `now` liegt. */
export function startOfIsoWeek(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const mondayOffset = (d.getDay() + 6) % 7; // So=0 -> 6, Mo=1 -> 0, ...
  d.setDate(d.getDate() - mondayOffset);
  return d;
}
