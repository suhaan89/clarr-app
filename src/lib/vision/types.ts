/**
 * On-Device-Bilderkennung — öffentliche Typen.
 *
 * Diese Datei enthält KEINE nativen Imports und ist damit frei test- und
 * importierbar. Die konkrete Modell-Implementierung (TensorFlow.js, siehe
 * `classifier.ts`) wird über das `VisionClassifier`-Interface angebunden und
 * kann später gegen ein müll-spezifisches Modell getauscht werden, ohne dass
 * der restliche Code (Hook, Screen, Verdict-Logik) sich ändert.
 */

/** Eine einzelne Modell-Vorhersage: Label + Wahrscheinlichkeit (0..1). */
export type Prediction = {
  /** Roh-Label des Modells, z. B. „pop bottle, soda bottle". */
  label: string;
  /** Wahrscheinlichkeit dieser Klasse, 0..1. */
  probability: number;
};

/**
 * Das für den Nutzer sichtbare Urteil. Bewusst dreiwertig — „unsicher" ist
 * ein eigener, ehrlicher Zustand und keine erzwungene Ja/Nein-Antwort.
 */
export type VisionVerdict = 'trash' | 'no-trash' | 'uncertain';

/** Ergebnis einer Analyse — reiner Datencontainer, UI-unabhängig. */
export type VisionResult = {
  verdict: VisionVerdict;
  /** Konfidenz in das gezeigte Urteil, 0..1. */
  confidence: number;
  /** Bestes müll-relevantes Label (für Debug/Telemetrie), falls vorhanden. */
  trashLabel: string | null;
  /** Top-k-Rohvorhersagen, absteigend sortiert (für Debug/Doku). */
  predictions: Prediction[];
};

/**
 * Austauschbare Modell-Schnittstelle. Eine Implementierung lädt EINMAL ihr
 * Modell (`load`) und liefert dann für Bilddaten Top-k-Vorhersagen
 * (`classify`). Die Zuordnung „Label → Müll" und die Schwellen liegen bewusst
 * NICHT hier, sondern in `labels.ts`/`verdict.ts` — so bleibt der Modelltausch
 * unabhängig von der Produktlogik.
 */
export interface VisionClassifier {
  /** Lädt das Modell (idempotent, cachet intern). Wirft bei Fehler. */
  load(): Promise<void>;
  /** Ob das Modell einsatzbereit ist. */
  readonly isLoaded: boolean;
  /**
   * Klassifiziert eine lokale Bilddatei (file://-URI) und gibt die Top-k
   * Vorhersagen zurück (absteigend nach Wahrscheinlichkeit).
   */
  classify(photoUri: string): Promise<Prediction[]>;
}

/** Fehler, wenn das Modell/die native Umgebung nicht verfügbar ist. */
export class VisionUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'VisionUnavailableError';
  }
}
