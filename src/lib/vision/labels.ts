/**
 * Zuordnung „erkanntes Label → Müll?".
 *
 * Das Basismodell (MobileNet, ImageNet) kennt KEINE Müll-Klasse. Es erkennt
 * Alltagsobjekte wie „pop bottle", „plastic bag" oder „tin can". Wir behandeln
 * eine kuratierte Auswahl solcher Klassen als „müll-typisch". Die Zuordnung
 * geschieht über Schlüsselwörter, weil ImageNet-Labels oft mehrere Synonyme
 * enthalten (z. B. „pop bottle, soda bottle").
 *
 * Diese Datei ist REIN (keine nativen Imports) und vollständig testbar. Sie
 * arbeitet auf Label-Strings – egal, aus welchem Modell sie stammen. Bei einem
 * müll-spezifischen Modell (siehe docs/vision-ondevice.md) kann diese Heuristik
 * entfallen oder durch die dortigen Klassennamen ersetzt werden.
 */

/**
 * Schlüsselwörter, die in einem Label auf typischen (Wegwerf-)Müll hindeuten.
 * Bewusst fokussiert auf Verpackungen/Gebinde, die im öffentlichen Raum als
 * Abfall liegen. Jeder Eintrag wird als Teilstring im (klein geschriebenen)
 * Label gesucht.
 */
export const TRASH_LABEL_KEYWORDS: readonly string[] = [
  // Flaschen
  'pop bottle',
  'water bottle',
  'beer bottle',
  'wine bottle',
  'bottle',
  // Dosen / Behälter
  'tin can',
  'milk can',
  'beer can',
  // Mülleimer selbst (jemand fotografiert eine überquellende Tonne)
  'ashcan',
  'trash can',
  'garbage can',
  'wastebin',
  'dustbin',
  // Verpackungen / Papier
  'plastic bag',
  'paper towel',
  'carton',
  'packet',
  'wrapper',
  'six-pack',
  // Becher / Gläser (häufiger Coffee-to-go-Abfall)
  'cup',
  'coffee mug',
  'beer glass',
] as const;

/**
 * Sicherheits-Ausschlüsse: Labels, die eines der Schlüsselwörter enthalten,
 * aber KEIN Müll sind (Fehlalarm vermeiden). Wird zuerst geprüft.
 */
const NON_TRASH_LABELS: readonly string[] = [
  'hot pot', // enthält „pot", aber kein Müll-Keyword – Beispiel für künftige Fälle
] as const;

/** Normalisiert ein Label für den Vergleich. */
function normalize(label: string): string {
  return label.toLowerCase().trim();
}

/**
 * Liefert das passende Müll-Schlüsselwort zu einem Label oder `null`.
 * Nützlich, um dem Nutzer/Debug zu zeigen, WARUM etwas als Müll gilt.
 */
export function matchedTrashKeyword(label: string): string | null {
  const norm = normalize(label);
  if (NON_TRASH_LABELS.some((exc) => norm.includes(exc))) return null;
  // Längste Keywords zuerst, damit „pop bottle" vor „bottle" greift.
  for (const keyword of [...TRASH_LABEL_KEYWORDS].sort((a, b) => b.length - a.length)) {
    if (norm.includes(keyword)) return keyword;
  }
  return null;
}

/** Ob ein Label als müll-typisch gilt. */
export function isTrashLabel(label: string): boolean {
  return matchedTrashKeyword(label) !== null;
}
