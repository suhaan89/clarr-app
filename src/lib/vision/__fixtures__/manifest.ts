import type { ModelManifest } from '../types';

/** Gültiges Test-Manifest wie aus einem Export ohne Quantisierung (float32-Ein-/Ausgang, Werte 0..1). */
export function makeManifest(overrides: Partial<ModelManifest> = {}): ModelManifest {
  return {
    version: 'test-1',
    storagePath: 'models/test-1.tflite',
    sha256: 'a'.repeat(64),
    sizeBytes: 1000,
    inputSize: 2,
    labels: ['negativ', 'positiv'],
    positiveIndex: 1,
    threshold: 0.5,
    normalization: { mean: [0, 0, 0], std: [255, 255, 255] },
    inputQuant: null,
    outputQuant: null,
    outputActivation: 'softmax',
    ...overrides,
  };
}
