// Fassung der Rechtstexte, die in der App angezeigt werden.
//
// Muss mit dem Default von `consents.policy_version` (Migration 022)
// uebereinstimmen: das Einwilligungs-Journal haelt fest, WELCHER Fassung
// zugestimmt wurde. Wer die Texte in src/app/legal/* inhaltlich aendert,
// erhoeht diesen Wert UND legt eine Migration nach, die den Default mitzieht.
export const POLICY_VERSION = '2026-09-23-v1';

/** Anzeigedatum der aktuellen Fassung (Rechtstexte sind Deutsch). */
export const POLICY_DATE = '23.09.2026';
