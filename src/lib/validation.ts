// Auth-/Eingabe-Validierung (Paket 12: testbar ausgelagert).

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Mindestlaenge 8 – Supabase-Default; bewusst keine Komplexitaets-Regeln
// (NIST: Laenge schlaegt Sonderzeichen-Zwang).
export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

// Pseudonym fuer das Leaderboard – muss zum Server-Check in Migration 011
// passen (set_leaderboard_prefs, per Migration 015 auf denselben
// Latin-Unicode-Bereich erweitert). Ein Rest-Risiko bleibt: Schriften
// ausserhalb von Latin (z. B. Kyrillisch, CJK) matchen \p{L} hier, aber
// nicht die servereseitige Zeichenklasse – profil.tsx zeigt in diesem
// Fall den RPC-Fehler an, statt ihn stillschweigend zu verwerfen.
export function isValidDisplayName(name: string): boolean {
  return /^[\p{L}\p{N} _\-.]{2,24}$/u.test(name);
}
