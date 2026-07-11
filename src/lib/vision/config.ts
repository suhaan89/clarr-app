/**
 * Feste Parameter der On-Device-Erkennung. Zentral, damit Modellwechsel und
 * Feintuning der Schwellen an EINER Stelle passieren.
 */

/** Kantenlänge, auf die Fotos vor der Inferenz verkleinert werden (px). */
export const INPUT_SIZE = 224;

/** Wie viele Top-Vorhersagen der Classifier zurückgibt. */
export const TOP_K = 5;

/**
 * Normalisierung der Pixel für float32-Modelle: `(pixel - mean) / std`.
 * Standard passt zu Keras-MobileNet (Wertebereich [-1, 1]). Erwartet ein
 * müll-spezifisches Modell [0, 1], hier `mean = 0, std = 255` setzen.
 * Für uint8-quantisierte Modelle wird die Normalisierung übersprungen.
 */
export const Preprocess = {
  pixelMean: 127.5,
  pixelStd: 127.5,
} as const;

/**
 * Entscheidungs-Schwellen für `deriveVerdict`. Bewusst konservativ:
 * MobileNet ist NICHT müll-spezifisch, deshalb lieber „unsicher" als ein
 * falsches Ja/Nein. Alle Werte sind Wahrscheinlichkeiten (0..1).
 */
export const Thresholds = {
  /** Ab hier gilt ein erkanntes Müll-Label als klarer Treffer. */
  trashConfident: 0.3,
  /** Schwaches Müll-Signal: reicht nur für „unsicher", nicht für „Müll". */
  trashMaybe: 0.12,
  /**
   * Erkennt das Modell insgesamt nichts deutlich (Top-Wahrscheinlichkeit
   * darunter), lautet das Urteil „unsicher" statt „kein Müll".
   */
  sceneMin: 0.2,
} as const;
