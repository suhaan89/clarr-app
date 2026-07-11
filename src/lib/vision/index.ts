/**
 * Öffentliche API der On-Device-Bilderkennung.
 *
 * Der Rest der App importiert NUR aus dieser Datei (`analyzePhoto`,
 * `warmUpVision`, der `useVision`-Hook und die Typen). Welche Modell-
 * Implementierung dahintersteht, ist hier an EINER Stelle austauschbar:
 * `classifier`. Ein müll-spezifisches Modell wird über dieselbe
 * `VisionClassifier`-Schnittstelle eingehängt, ohne Screen/Hook zu ändern.
 */

import { tfliteClassifier } from './classifier';
import type { VisionClassifier, VisionResult } from './types';
import { deriveVerdict } from './verdict';

export type { Prediction, VisionResult, VisionVerdict } from './types';
export { VisionUnavailableError } from './types';
export { useVision } from './useVision';
export type { UseVision, VisionStatus } from './useVision';

/** Aktive Modell-Implementierung — hier tauschbar. */
const classifier: VisionClassifier = tfliteClassifier;

/**
 * Lädt das Modell vorab (idempotent). Optional beim Betreten des Melde-Flows,
 * damit die erste Analyse schneller ist. Wirft `VisionUnavailableError`, wenn
 * das Modell nicht verfügbar ist — Aufrufer behandeln das als „Analyse aus".
 */
export async function warmUpVision(): Promise<void> {
  await classifier.load();
}

/** Ob das Modell bereits geladen ist. */
export function isVisionReady(): boolean {
  return classifier.isLoaded;
}

/**
 * Analysiert ein Foto (lokale file://-URI) und liefert ein Advisory-Urteil.
 * Wirft `VisionUnavailableError`, wenn keine Analyse möglich ist.
 */
export async function analyzePhoto(photoUri: string): Promise<VisionResult> {
  const predictions = await classifier.classify(photoUri);
  return deriveVerdict(predictions);
}
