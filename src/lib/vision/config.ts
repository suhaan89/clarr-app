/**
 * Feste Parameter der On-Device-Erkennung. Alles Modellspezifische
 * (Eingabegröße, Normalisierung, Schwellenwert, Labels) kommt NICHT von hier,
 * sondern aus den Modell-Metadaten in `public.vision_models`.
 */

import { Platform } from 'react-native';

/**
 * Build-Schalter. `EXPO_PUBLIC_ONDEVICE_VISION=0` schaltet die Prüfung im
 * Build komplett ab (kein Download, keine Analyse). Jeder andere Wert oder
 * ein fehlender Wert lässt die Entscheidung beim Server: ohne aktives Modell
 * in `vision_models` passiert ohnehin nichts. Im Web gibt es kein TFLite.
 */
export function isOnDeviceVisionEnabled(): boolean {
  return Platform.OS !== 'web' && process.env.EXPO_PUBLIC_ONDEVICE_VISION !== '0';
}

/** Storage-Bucket mit den Modelldateien (öffentlich lesbar, siehe Migration 023). */
export const MODEL_BUCKET = 'ml-models';

/** Höchstens so oft wird beim App-Start nach einer neuen Modellversion gefragt. */
export const MODEL_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Größere Dateien werden abgelehnt (Ziel: unter 5 MB, etwas Luft nach oben). */
export const MAX_MODEL_BYTES = 8 * 1024 * 1024;
