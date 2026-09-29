/**
 * On-Device-Bilderkennung – öffentliche Typen.
 *
 * Diese Datei enthält KEINE nativen Imports und ist damit frei test- und
 * importierbar. Das Modell ist ein binärer Klassifikator („illegale
 * Müllablagerung ja/nein"), dessen Datei und Metadaten zur Laufzeit aus
 * Supabase geladen werden (siehe `modelStore.ts`, docs/vision-ondevice.md).
 */

/** Quantisierungsparameter eines int8/uint8-Tensors: `real = scale * (q - zeroPoint)`. */
export type QuantParams = {
  scale: number;
  zeroPoint: number;
};

/**
 * Metadaten eines Modells, wie sie in `public.vision_models` stehen.
 * Alles, was die App zum Vorverarbeiten und Auswerten braucht, kommt von
 * hier – nichts davon ist im App-Code fest verdrahtet.
 */
export type ModelManifest = {
  /** Eindeutige Version, z. B. „2026-10-01-a". */
  version: string;
  /** Pfad der .tflite-Datei im Storage-Bucket `ml-models`. */
  storagePath: string;
  /** SHA-256 der Datei (hex, klein), wird nach dem Download geprüft. */
  sha256: string;
  sizeBytes: number;
  /** Kantenlänge des quadratischen Eingabebilds in Pixeln. */
  inputSize: number;
  /** Klassennamen in Reihenfolge der Modell-Ausgabe. */
  labels: string[];
  /** Index der Klasse „illegale Müllablagerung" in `labels`. */
  positiveIndex: number;
  /** Ab diesem Score gilt ein Foto als „wahrscheinlich Müll". */
  threshold: number;
  /** Pro Farbkanal (R, G, B): `(pixel - mean) / std` auf Pixelwerte 0..255. */
  normalization: { mean: [number, number, number]; std: [number, number, number] };
  /** Quantisierung des Eingangs, falls das Modell int8/uint8 erwartet. */
  inputQuant: QuantParams | null;
  /** Quantisierung des Ausgangs, falls das Modell int8/uint8 liefert. */
  outputQuant: QuantParams | null;
  /** Ob die Ausgabe schon Wahrscheinlichkeiten sind (`softmax`) oder Rohwerte (`none`). */
  outputActivation: 'softmax' | 'none';
};

/**
 * Das für den Nutzer sichtbare Urteil. Bewusst nur zweiwertig: das Modell
 * beantwortet genau eine Frage. Die Formulierung in der UI bleibt vorsichtig
 * („könnte Müll sein"), weil ein Modell keine Gewissheit hat.
 */
export type VisionVerdict = 'trash' | 'no-trash';

/** Ergebnis einer Analyse – reiner Datencontainer, UI-unabhängig. */
export type VisionResult = {
  verdict: VisionVerdict;
  /** Wahrscheinlichkeit für „Müll", 0..1. Wird mit der Meldung gespeichert. */
  score: number;
  /** Schwellenwert, mit dem das Urteil gebildet wurde. */
  threshold: number;
  /** Version des Modells, das den Score geliefert hat. */
  modelVersion: string;
};

/** Ein Modell, das lokal auf dem Gerät liegt und geprüft wurde. */
export type LocalModel = {
  manifest: ModelManifest;
  /** file://-URI der geprüften .tflite-Datei. */
  fileUri: string;
};

/**
 * Die Prüfung ist bewusst aus: Feature Flag aus, kein aktives Modell auf dem
 * Server oder noch nichts heruntergeladen. Kein Fehler – die Meldung läuft
 * ganz normal weiter.
 */
export class VisionDisabledError extends Error {
  constructor(message = 'vision_disabled') {
    super(message);
    this.name = 'VisionDisabledError';
  }
}

/** Fehler, wenn das Modell/die native Umgebung nicht verfügbar ist. */
export class VisionUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'VisionUnavailableError';
  }
}
