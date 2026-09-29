/**
 * Übersetzt den Modell-Score in ein Urteil für die UI.
 *
 * REIN und testbar. Das Ergebnis ist ein HINWEIS und blockiert nie die
 * Meldung; die verbindliche Prüfung passiert serverseitig (analyze-photo).
 */

import type { ModelManifest, VisionResult } from './types';

/** Score ≥ Schwellenwert → „könnte Müll sein", sonst freundlicher Hinweis. */
export function deriveVerdict(score: number, manifest: ModelManifest): VisionResult {
  return {
    verdict: score >= manifest.threshold ? 'trash' : 'no-trash',
    score,
    threshold: manifest.threshold,
    modelVersion: manifest.version,
  };
}
