/**
 * Konkrete On-Device-Inferenz mit `react-native-fast-tflite`.
 *
 * Diese Datei ist der EINZIGE Ort mit nativen Modell-Details. Alles Native
 * wird LAZY geladen und in try/catch gekapselt: Fehlt der Dev-Build oder das
 * native Modul, wird ein `VisionUnavailableError` geworfen – die Meldung
 * bleibt davon unberührt.
 *
 * Nicht blockierend: `model.run()` rechnet nativ auf einem eigenen Thread.
 * Auf dem JS-Thread laufen nur das Dekodieren eines kleinen JPEGs (z. B.
 * 224 × 224) und das Umrechnen der Pixel, das dauert wenige Millisekunden.
 */

/* Native/optionale Module werden bewusst lazy via require() geladen, damit die
   App ohne Dev-Build nicht bricht, sondern sauber degradiert. */
/* eslint-disable @typescript-eslint/no-require-imports */
import { decode as base64ToArrayBuffer } from 'base64-arraybuffer';

import { buildInputTensor, centerCropRect, readOutputValues, scoreFromOutput } from './preprocess';
import type { LocalModel } from './types';
import { VisionUnavailableError } from './types';

// Minimal-Typen der lazy geladenen Module (nur was wir nutzen).
type TfliteTensor = { dataType: string; shape: number[] };
type TfliteModel = {
  inputs: TfliteTensor[];
  outputs: TfliteTensor[];
  run(input: ArrayBuffer[]): Promise<ArrayBuffer[]>;
};

let cached: { version: string; model: TfliteModel } | null = null;
let loading: { version: string; promise: Promise<TfliteModel> } | null = null;

/** Lädt die Modelldatei einmal pro Version und hält sie im Speicher. */
async function ensureModel(local: LocalModel): Promise<TfliteModel> {
  const { version } = local.manifest;
  if (cached?.version === version) return cached.model;
  if (loading?.version === version) return loading.promise;

  const promise = (async () => {
    let loadTensorflowModel: (source: { url: string }, delegates: string[]) => Promise<TfliteModel>;
    try {
      ({ loadTensorflowModel } = require('react-native-fast-tflite'));
    } catch (e) {
      throw new VisionUnavailableError('native_module_missing', e);
    }
    try {
      // Leere Delegate-Liste = CPU (maximal kompatibel).
      const model = await loadTensorflowModel({ url: local.fileUri }, []);
      cached = { version, model };
      return model;
    } catch (e) {
      throw new VisionUnavailableError('model_load_failed', e);
    } finally {
      loading = null;
    }
  })();
  loading = { version, promise };
  return promise;
}

/** Schneidet das Foto mittig quadratisch zu, verkleinert es und liefert RGBA-Pixel. */
async function decodePixels(photoUri: string, size: number): Promise<Uint8Array> {
  let ImageManipulator: typeof import('expo-image-manipulator').ImageManipulator;
  let SaveFormat: typeof import('expo-image-manipulator').SaveFormat;
  let decodeJpeg: typeof import('jpeg-js').decode;
  try {
    ({ ImageManipulator, SaveFormat } = require('expo-image-manipulator'));
    ({ decode: decodeJpeg } = require('jpeg-js'));
  } catch (e) {
    throw new VisionUnavailableError('native_module_missing', e);
  }

  const full = await ImageManipulator.manipulate(photoUri).renderAsync();
  const small = await ImageManipulator.manipulate(full)
    .crop(centerCropRect(full.width, full.height))
    .resize({ width: size, height: size })
    .renderAsync();
  const saved = await small.saveAsync({ format: SaveFormat.JPEG, base64: true, compress: 1 });
  if (!saved.base64) throw new VisionUnavailableError('resize_failed');

  const decoded = decodeJpeg(new Uint8Array(base64ToArrayBuffer(saved.base64)), { useTArray: true });
  if (decoded.width !== size || decoded.height !== size) {
    throw new VisionUnavailableError('unexpected_size');
  }
  return decoded.data;
}

/** Wahrscheinlichkeit „Müll" (0..1) für ein lokales Foto. */
export async function classify(photoUri: string, local: LocalModel): Promise<number> {
  const model = await ensureModel(local);
  const { manifest } = local;
  const pixels = await decodePixels(photoUri, manifest.inputSize);
  const input = buildInputTensor(pixels, model.inputs[0]?.dataType ?? 'float32', manifest);
  const outputs = await model.run([input]);
  const values = readOutputValues(outputs[0], model.outputs[0]?.dataType ?? 'float32', manifest);
  return scoreFromOutput(values, manifest);
}

/** Lädt das Modell vorab in den Speicher (optional, macht die erste Analyse schneller). */
export async function preload(local: LocalModel): Promise<void> {
  await ensureModel(local);
}
