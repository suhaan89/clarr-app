/**
 * Vorverarbeitung (Foto → Eingabe-Tensor) und Auswertung (Ausgabe → Score).
 *
 * REIN und getestet – keine nativen Imports. Ein „Tensor" ist hier einfach
 * ein flaches Zahlen-Array in der Form, die das Modell erwartet:
 * Höhe × Breite × 3 Farbkanäle (RGB), Zeile für Zeile.
 */

import type { ModelManifest } from './types';

/** Größtes mittiges Quadrat im Bild – so wird nichts verzerrt. */
export function centerCropRect(width: number, height: number) {
  const side = Math.min(width, height);
  return {
    originX: Math.floor((width - side) / 2),
    originY: Math.floor((height - side) / 2),
    width: side,
    height: side,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Baut aus RGBA-Pixeln (4 Byte pro Pixel, wie jpeg-js sie liefert) den
 * Eingabe-Tensor im Datentyp des Modells.
 *
 * * float32: `(pixel - mean) / std` je Kanal, laut Metadaten.
 * * int8/uint8: erst normalisieren, dann mit `inputQuant` in Ganzzahlen
 *   umrechnen. Ohne `inputQuant` bekommt ein uint8-Modell die rohen Pixel.
 */
export function buildInputTensor(
  rgba: Uint8Array,
  dataType: string,
  manifest: ModelManifest
): ArrayBuffer {
  const pixelCount = manifest.inputSize * manifest.inputSize;
  if (rgba.length < pixelCount * 4) {
    throw new Error('pixel_buffer_too_small');
  }
  const { mean, std } = manifest.normalization;
  const q = manifest.inputQuant;

  const normalized = (i: number, c: number) => (rgba[i * 4 + c] - mean[c]) / std[c];

  if (dataType === 'float32') {
    const buf = new Float32Array(pixelCount * 3);
    for (let i = 0; i < pixelCount; i++) {
      for (let c = 0; c < 3; c++) buf[i * 3 + c] = normalized(i, c);
    }
    return buf.buffer;
  }
  if (dataType === 'uint8') {
    const buf = new Uint8Array(pixelCount * 3);
    for (let i = 0; i < pixelCount; i++) {
      for (let c = 0; c < 3; c++) {
        buf[i * 3 + c] = q
          ? clamp(Math.round(normalized(i, c) / q.scale + q.zeroPoint), 0, 255)
          : rgba[i * 4 + c];
      }
    }
    return buf.buffer;
  }
  if (dataType === 'int8') {
    if (!q) throw new Error('int8_input_needs_quant_params');
    const buf = new Int8Array(pixelCount * 3);
    for (let i = 0; i < pixelCount; i++) {
      for (let c = 0; c < 3; c++) {
        buf[i * 3 + c] = clamp(Math.round(normalized(i, c) / q.scale + q.zeroPoint), -128, 127);
      }
    }
    return buf.buffer;
  }
  throw new Error(`unsupported_input_dtype:${dataType}`);
}

function softmax(values: number[]): number[] {
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/** Liest die Modell-Ausgabe als Zahlen (bei int8/uint8 dequantisiert). */
export function readOutputValues(
  output: ArrayBuffer,
  dataType: string,
  manifest: ModelManifest
): number[] {
  const q = manifest.outputQuant;
  if (dataType === 'float32') return Array.from(new Float32Array(output));
  if (dataType === 'uint8') {
    return Array.from(new Uint8Array(output), (v) => (q ? q.scale * (v - q.zeroPoint) : v / 255));
  }
  if (dataType === 'int8') {
    if (!q) throw new Error('int8_output_needs_quant_params');
    return Array.from(new Int8Array(output), (v) => q.scale * (v - q.zeroPoint));
  }
  throw new Error(`unsupported_output_dtype:${dataType}`);
}

/**
 * Wahrscheinlichkeit der Klasse „Müll" (0..1).
 *
 * Liefert das Modell nur Rohwerte („Logits", `outputActivation: 'none'`),
 * werden sie per Softmax in Wahrscheinlichkeiten umgerechnet; bei einem
 * einzelnen Ausgabewert per Sigmoid.
 */
export function scoreFromOutput(values: number[], manifest: ModelManifest): number {
  if (values.length === 0) throw new Error('empty_output');
  let probs = values;
  if (manifest.outputActivation === 'none') {
    probs = values.length === 1 ? [1 / (1 + Math.exp(-values[0]))] : softmax(values);
  }
  const raw = probs.length === 1 ? probs[0] : probs[manifest.positiveIndex];
  if (raw === undefined || !Number.isFinite(raw)) throw new Error('invalid_output');
  return clamp(raw, 0, 1);
}
