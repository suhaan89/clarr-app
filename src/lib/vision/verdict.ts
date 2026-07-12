/**
 * Übersetzt Modell-Rohvorhersagen in ein nutzerfreundliches, ehrliches Urteil.
 *
 * REIN und testbar – keine nativen Imports. Kern der Advisory-Logik: lieber
 * „unsicher" als ein falsches Ja/Nein, weil das Basismodell nicht müll-
 * spezifisch ist. Das Ergebnis ist ein HINWEIS und blockiert nie die Meldung.
 */

import { Thresholds } from './config';
import { matchedTrashKeyword } from './labels';
import type { Prediction, VisionResult } from './types';

/**
 * Leitet aus den Top-k-Vorhersagen ein `VisionResult` ab.
 *
 * Regeln (in dieser Reihenfolge):
 *  1. Kein bestes müll-relevantes Label über `trashConfident` → prüfe Signal.
 *  2. Starkes Müll-Signal (≥ trashConfident) → „Müll erkannt".
 *  3. Schwaches Müll-Signal (≥ trashMaybe) → „unsicher" (nicht sicher genug).
 *  4. Erkennt das Modell insgesamt nichts Deutliches (< sceneMin) → „unsicher".
 *  5. Sonst → „kein Müll erkannt".
 */
export function deriveVerdict(predictions: Prediction[]): VisionResult {
  const sorted = [...predictions].sort((a, b) => b.probability - a.probability);
  const top = sorted[0];

  if (!top) {
    return { verdict: 'uncertain', confidence: 0, trashLabel: null, predictions: sorted };
  }

  // Bestes müll-relevantes Label und dessen Wahrscheinlichkeit finden.
  let trashLabel: string | null = null;
  let trashScore = 0;
  for (const p of sorted) {
    if (matchedTrashKeyword(p.label) && p.probability > trashScore) {
      trashScore = p.probability;
      trashLabel = p.label;
    }
  }

  if (trashScore >= Thresholds.trashConfident) {
    return { verdict: 'trash', confidence: trashScore, trashLabel, predictions: sorted };
  }
  if (trashScore >= Thresholds.trashMaybe) {
    // Etwas deutet auf Müll hin, aber nicht sicher genug.
    return { verdict: 'uncertain', confidence: trashScore, trashLabel, predictions: sorted };
  }
  if (top.probability < Thresholds.sceneMin) {
    // Modell erkennt gar nichts deutlich – ehrlich „unsicher".
    return { verdict: 'uncertain', confidence: top.probability, trashLabel: null, predictions: sorted };
  }
  // Etwas Nicht-Müll wurde klar erkannt.
  return { verdict: 'no-trash', confidence: top.probability, trashLabel: null, predictions: sorted };
}
