/**
 * AUTOMATISCH von scripts/fetch-vision-model.js erzeugt.
 * Verweist auf das gebündelte On-Device-Modell und seine Labels.
 * Zum Zurücksetzen: Datei auf `null`-Exporte stellen (siehe git history).
 */

export const MODEL_ASSET: number | null = require('./model.tflite');
export const LABELS: string[] | null = require('./labels.json');
