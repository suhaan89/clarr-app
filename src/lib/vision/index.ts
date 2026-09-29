/**
 * Öffentliche API der On-Device-Bilderkennung.
 *
 * Der Rest der App importiert NUR aus dieser Datei. Das Modell kommt aus
 * Supabase (`modelStore.ts`); ist keins da oder ist die Prüfung per Flag aus,
 * wirft `analyzePhoto` einen `VisionDisabledError` und der Melde-Flow läuft
 * ohne Hinweis ganz normal weiter.
 *
 * WICHTIG: Das Ergebnis berät nur. Es entscheidet nichts, blockiert nichts
 * und vergibt keine Punkte. Score und Modellversion gehen mit der Meldung an
 * den Server, der sie höchstens als zusätzliches, nur verschärfendes Signal
 * nutzt (siehe docs/vision-ondevice.md).
 */

import { classify, preload } from './classifier';
import { getLocalModel } from './modelStore';
import type { VisionResult } from './types';
import { VisionDisabledError } from './types';
import { deriveVerdict } from './verdict';

export type { VisionResult, VisionVerdict } from './types';
export { VisionDisabledError, VisionUnavailableError } from './types';
export { useVision } from './useVision';
export type { UseVision, VisionStatus } from './useVision';
export { clearModelCache, refreshModel as refreshVisionModel } from './modelStore';

/** Lädt das aktuelle Modell vorab (idempotent). Ohne Modell passiert nichts. */
export async function warmUpVision(): Promise<void> {
  const local = await getLocalModel();
  if (local) await preload(local);
}

/**
 * Analysiert ein Foto (lokale file://-URI) und liefert ein Advisory-Urteil.
 * Wirft `VisionDisabledError`, wenn nicht geprüft werden soll, und
 * `VisionUnavailableError`, wenn die Prüfung technisch nicht klappt.
 */
export async function analyzePhoto(photoUri: string): Promise<VisionResult> {
  const local = await getLocalModel();
  if (!local) throw new VisionDisabledError();
  const score = await classify(photoUri, local);
  return deriveVerdict(score, local.manifest);
}
