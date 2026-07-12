/**
 * Konkrete On-Device-Implementierung mit `react-native-fast-tflite`.
 *
 * Diese Datei ist der EINZIGE Ort mit nativen/modell-spezifischen Details.
 * Alles Native wird bewusst LAZY (dynamisch) geladen und in try/catch gekapselt:
 * Fehlt der Dev-Build, das native Modul oder das gebündelte Modell, wird ein
 * `VisionUnavailableError` geworfen – der Rest der App (und die Meldung) bleibt
 * unberührt.
 *
 * Modelltausch: siehe `assets/vision/model.assets.ts` und
 * docs/vision-ondevice.md. Solange die öffentliche `VisionClassifier`-
 * Schnittstelle erfüllt ist, ändert sich außerhalb dieser Datei nichts.
 */

/* Native/optionale Module werden bewusst lazy via require() geladen, damit die
   App ohne Dev-Build/Modell nicht bricht, sondern sauber degradiert. */
/* eslint-disable @typescript-eslint/no-require-imports */
import { decode as base64ToArrayBuffer } from 'base64-arraybuffer';

import { LABELS, MODEL_ASSET } from '@/assets/vision/model.assets';

import { INPUT_SIZE, Preprocess, TOP_K } from './config';
import type { Prediction, VisionClassifier } from './types';
import { VisionUnavailableError } from './types';

// Minimal-Typen der lazy geladenen Module (nur was wir nutzen).
type TfliteTensor = { dataType: string; shape: number[] };
type TfliteModel = {
  inputs: TfliteTensor[];
  outputs: TfliteTensor[];
  run(input: ArrayBuffer[]): Promise<ArrayBuffer[]>;
};

let modelPromise: Promise<TfliteModel> | null = null;
let loadedModel: TfliteModel | null = null;

/** Lädt das TFLite-Modell einmalig und cachet es. */
async function ensureModel(): Promise<TfliteModel> {
  if (loadedModel) return loadedModel;
  if (!modelPromise) {
    modelPromise = (async () => {
      if (MODEL_ASSET == null) {
        throw new VisionUnavailableError('model_not_bundled');
      }
      let loadTensorflowModel: (source: number, delegates: string[]) => Promise<TfliteModel>;
      try {
        // Dynamischer Require: bricht nichts, wenn das native Modul fehlt.
        ({ loadTensorflowModel } = require('react-native-fast-tflite'));
      } catch (e) {
        throw new VisionUnavailableError('native_module_missing', e);
      }
      try {
        // Leere Delegate-Liste = CPU (maximal kompatibel). GPU/Core-ML optional,
        // siehe docs/vision-ondevice.md.
        const model = await loadTensorflowModel(MODEL_ASSET, []);
        loadedModel = model;
        return model;
      } catch (e) {
        // Nächster Versuch darf neu laden.
        modelPromise = null;
        throw new VisionUnavailableError('model_load_failed', e);
      }
    })();
  }
  return modelPromise;
}

/** Verkleinert das Foto und liefert die RGBA-Rohpixel (Uint8Array). */
async function decodePixels(photoUri: string): Promise<{ data: Uint8Array; width: number; height: number }> {
  let ImageManipulator: typeof import('expo-image-manipulator').ImageManipulator;
  let SaveFormat: typeof import('expo-image-manipulator').SaveFormat;
  let decodeJpeg: typeof import('jpeg-js').decode;
  try {
    ({ ImageManipulator, SaveFormat } = require('expo-image-manipulator'));
    ({ decode: decodeJpeg } = require('jpeg-js'));
  } catch (e) {
    throw new VisionUnavailableError('native_module_missing', e);
  }

  const image = await ImageManipulator.manipulate(photoUri)
    .resize({ width: INPUT_SIZE, height: INPUT_SIZE })
    .renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, base64: true, compress: 1 });
  if (!result.base64) throw new VisionUnavailableError('resize_failed');

  const bytes = new Uint8Array(base64ToArrayBuffer(result.base64));
  const decoded = decodeJpeg(bytes, { useTArray: true });
  return { data: decoded.data, width: decoded.width, height: decoded.height };
}

/** Baut den Eingabe-Tensor passend zum Datentyp des Modells. */
function buildInput(pixels: Uint8Array, dataType: string): ArrayBuffer {
  const pixelCount = INPUT_SIZE * INPUT_SIZE;
  if (dataType === 'uint8') {
    const buf = new Uint8Array(pixelCount * 3);
    for (let i = 0; i < pixelCount; i++) {
      buf[i * 3] = pixels[i * 4];
      buf[i * 3 + 1] = pixels[i * 4 + 1];
      buf[i * 3 + 2] = pixels[i * 4 + 2];
    }
    return buf.buffer;
  }
  if (dataType === 'float32') {
    const buf = new Float32Array(pixelCount * 3);
    const { pixelMean, pixelStd } = Preprocess;
    for (let i = 0; i < pixelCount; i++) {
      buf[i * 3] = (pixels[i * 4] - pixelMean) / pixelStd;
      buf[i * 3 + 1] = (pixels[i * 4 + 1] - pixelMean) / pixelStd;
      buf[i * 3 + 2] = (pixels[i * 4 + 2] - pixelMean) / pixelStd;
    }
    return buf.buffer;
  }
  throw new VisionUnavailableError(`unsupported_input_dtype:${dataType}`);
}

/** Liest die Modell-Ausgabe als Wahrscheinlichkeits-Array. */
function readOutput(output: ArrayBuffer, dataType: string): number[] {
  if (dataType === 'uint8') {
    // Quantisierte Ausgabe grob dequantisieren (0..255 → 0..1).
    return Array.from(new Uint8Array(output), (v) => v / 255);
  }
  if (dataType === 'float32') {
    return Array.from(new Float32Array(output));
  }
  throw new VisionUnavailableError(`unsupported_output_dtype:${dataType}`);
}

/** Wandelt den Ausgabevektor in die Top-k-Vorhersagen. */
function toTopK(probs: number[], labels: string[]): Prediction[] {
  return probs
    .map((probability, index) => ({ label: labels[index] ?? `#${index}`, probability }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, TOP_K);
}

export const tfliteClassifier: VisionClassifier = {
  get isLoaded() {
    return loadedModel !== null;
  },

  async load() {
    await ensureModel();
  },

  async classify(photoUri: string): Promise<Prediction[]> {
    const model = await ensureModel();
    if (!LABELS) throw new VisionUnavailableError('labels_not_bundled');

    const pixels = await decodePixels(photoUri);
    const input = buildInput(pixels.data, model.inputs[0]?.dataType ?? 'float32');
    const outputs = await model.run([input]);
    const probs = readOutput(outputs[0], model.outputs[0]?.dataType ?? 'float32');
    return toTopK(probs, LABELS);
  },
};
