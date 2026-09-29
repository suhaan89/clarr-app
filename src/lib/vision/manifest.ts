/**
 * Prüft und übersetzt Modell-Metadaten aus `public.vision_models`.
 *
 * REIN und getestet. Was hier nicht sauber validiert, wird nie geladen:
 * lieber keine Prüfung als eine mit falscher Vorverarbeitung, die still
 * Unsinn liefert.
 */

import type { ModelManifest, QuantParams } from './types';

/** Zeile aus `vision_models`, wie Supabase sie liefert (snake_case). */
export type ModelRow = {
  version?: unknown;
  storage_path?: unknown;
  sha256?: unknown;
  size_bytes?: unknown;
  input_size?: unknown;
  labels?: unknown;
  positive_index?: unknown;
  threshold?: unknown;
  norm_mean?: unknown;
  norm_std?: unknown;
  input_quant?: unknown;
  output_quant?: unknown;
  output_activation?: unknown;
};

/** Spalten, die der Client liest (für `.select(...)`). */
export const MODEL_COLUMNS =
  'version, storage_path, sha256, size_bytes, input_size, labels, positive_index, threshold, ' +
  'norm_mean, norm_std, input_quant, output_quant, output_activation';

const VERSION_RE = /^[A-Za-z0-9._-]{1,64}$/;
const PATH_RE = /^[A-Za-z0-9._/-]{1,200}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function parseTriple(v: unknown): [number, number, number] | null {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isFiniteNumber)) return null;
  return [v[0], v[1], v[2]];
}

function parseQuant(v: unknown): QuantParams | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'object') return undefined;
  const { scale, zero_point } = v as { scale?: unknown; zero_point?: unknown };
  if (!isFiniteNumber(scale) || scale <= 0 || !isFiniteNumber(zero_point)) return undefined;
  return { scale, zeroPoint: zero_point };
}

/** Liefert ein geprüftes Manifest oder `null`, wenn irgendetwas nicht passt. */
export function parseManifest(row: ModelRow | null | undefined): ModelManifest | null {
  if (!row) return null;
  const {
    version,
    storage_path,
    sha256,
    size_bytes,
    input_size,
    labels,
    positive_index,
    threshold,
    output_activation,
  } = row;

  if (typeof version !== 'string' || !VERSION_RE.test(version)) return null;
  if (typeof storage_path !== 'string' || !PATH_RE.test(storage_path) || storage_path.includes('..')) {
    return null;
  }
  if (typeof sha256 !== 'string' || !SHA256_RE.test(sha256)) return null;
  if (!isFiniteNumber(size_bytes) || size_bytes <= 0) return null;
  if (!isFiniteNumber(input_size) || !Number.isInteger(input_size) || input_size < 32 || input_size > 640) {
    return null;
  }
  if (!Array.isArray(labels) || labels.length < 2 || !labels.every((l) => typeof l === 'string')) {
    return null;
  }
  if (!isFiniteNumber(positive_index) || !Number.isInteger(positive_index)) return null;
  if (positive_index < 0 || positive_index >= labels.length) return null;
  if (!isFiniteNumber(threshold) || threshold <= 0 || threshold >= 1) return null;

  const mean = parseTriple(row.norm_mean);
  const std = parseTriple(row.norm_std);
  if (!mean || !std || std.some((s) => s === 0)) return null;

  const inputQuant = parseQuant(row.input_quant);
  const outputQuant = parseQuant(row.output_quant);
  if (inputQuant === undefined || outputQuant === undefined) return null;

  if (output_activation !== 'softmax' && output_activation !== 'none') return null;

  return {
    version,
    storagePath: storage_path,
    sha256,
    sizeBytes: size_bytes,
    inputSize: input_size,
    labels: labels as string[],
    positiveIndex: positive_index,
    threshold,
    normalization: { mean, std },
    inputQuant,
    outputQuant,
    outputActivation: output_activation,
  };
}

/** Ob seit der letzten Prüfung genug Zeit vergangen ist. */
export function isCheckDue(lastCheckedAt: number | null, now: number, intervalMs: number): boolean {
  if (lastCheckedAt === null || !Number.isFinite(lastCheckedAt)) return true;
  // Uhr zurückgestellt → lieber neu prüfen.
  if (now < lastCheckedAt) return true;
  return now - lastCheckedAt >= intervalMs;
}

/** Bytes als Hex-String (klein), z. B. für den SHA-256-Vergleich. */
export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}
