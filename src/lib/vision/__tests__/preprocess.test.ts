import { buildInputTensor, centerCropRect, readOutputValues, scoreFromOutput } from '../preprocess';
import { makeManifest } from '../__fixtures__/manifest';

// 2 × 2 Pixel RGBA: Rot, Grün, Blau, Weiß
const RGBA = new Uint8Array([
  255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
]);

describe('centerCropRect', () => {
  it('schneidet Querformat mittig zu', () => {
    expect(centerCropRect(400, 300)).toEqual({ originX: 50, originY: 0, width: 300, height: 300 });
  });
  it('schneidet Hochformat mittig zu', () => {
    expect(centerCropRect(300, 401)).toEqual({ originX: 0, originY: 50, width: 300, height: 300 });
  });
});

describe('buildInputTensor', () => {
  it('float32: normalisiert laut Metadaten auf 0..1 und lässt Alpha weg', () => {
    const t = new Float32Array(buildInputTensor(RGBA, 'float32', makeManifest()));
    expect(Array.from(t)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1]);
  });

  it('float32: Mittelwert und Standardabweichung werden je Kanal angewendet', () => {
    const m = makeManifest({
      normalization: { mean: [127.5, 127.5, 127.5], std: [127.5, 127.5, 127.5] },
    });
    const t = new Float32Array(buildInputTensor(RGBA, 'float32', m));
    expect(t[0]).toBeCloseTo(1);
    expect(t[1]).toBeCloseTo(-1);
  });

  it('int8: quantisiert mit scale/zeroPoint und begrenzt auf -128..127', () => {
    const m = makeManifest({ inputQuant: { scale: 1 / 255, zeroPoint: -128 } });
    const t = new Int8Array(buildInputTensor(RGBA, 'int8', m));
    expect(Array.from(t.slice(0, 3))).toEqual([127, -128, -128]);
  });

  it('int8 ohne Quantisierungsparameter ist ein Fehler, kein stilles Raten', () => {
    expect(() => buildInputTensor(RGBA, 'int8', makeManifest())).toThrow(
      'int8_input_needs_quant_params'
    );
  });

  it('uint8 ohne Quantisierung bekommt rohe Pixel', () => {
    const t = new Uint8Array(buildInputTensor(RGBA, 'uint8', makeManifest()));
    expect(Array.from(t.slice(0, 6))).toEqual([255, 0, 0, 0, 255, 0]);
  });

  it('zu kleiner Pixelpuffer wird erkannt', () => {
    expect(() => buildInputTensor(new Uint8Array(4), 'float32', makeManifest())).toThrow();
  });
});

describe('Ausgabe → Score', () => {
  it('float32-Softmax: nimmt die Wahrscheinlichkeit der positiven Klasse', () => {
    const m = makeManifest();
    const values = readOutputValues(new Float32Array([0.3, 0.7]).buffer, 'float32', m);
    expect(scoreFromOutput(values, m)).toBeCloseTo(0.7);
  });

  it('respektiert positiveIndex (Klassenreihenfolge aus dem Training)', () => {
    const m = makeManifest({ labels: ['positiv', 'negativ'], positiveIndex: 0 });
    expect(scoreFromOutput([0.9, 0.1], m)).toBeCloseTo(0.9);
  });

  it('Rohwerte (Logits) werden per Softmax umgerechnet', () => {
    const m = makeManifest({ outputActivation: 'none' });
    expect(scoreFromOutput([0, 0], m)).toBeCloseTo(0.5);
    expect(scoreFromOutput([0, 10], m)).toBeGreaterThan(0.99);
  });

  it('ein einzelner Logit wird per Sigmoid umgerechnet', () => {
    const m = makeManifest({ outputActivation: 'none' });
    expect(scoreFromOutput([0], m)).toBeCloseTo(0.5);
  });

  it('int8-Ausgang wird dequantisiert', () => {
    const m = makeManifest({ outputQuant: { scale: 1 / 256, zeroPoint: -128 } });
    const values = readOutputValues(new Int8Array([-128, 127]).buffer, 'int8', m);
    expect(values[0]).toBeCloseTo(0);
    expect(scoreFromOutput(values, m)).toBeCloseTo(255 / 256);
  });

  it('leere Ausgabe ist ein Fehler', () => {
    expect(() => scoreFromOutput([], makeManifest())).toThrow('empty_output');
  });
});
