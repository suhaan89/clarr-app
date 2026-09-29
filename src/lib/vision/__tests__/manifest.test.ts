import { bytesToHex, isCheckDue, parseManifest, type ModelRow } from '../manifest';

function row(overrides: Partial<ModelRow> = {}): ModelRow {
  return {
    version: '2026-10-01-a',
    storage_path: 'models/2026-10-01-a.tflite',
    sha256: 'ab'.repeat(32),
    size_bytes: 1_500_000,
    input_size: 224,
    labels: ['negativ', 'positiv'],
    positive_index: 1,
    threshold: 0.55,
    norm_mean: [0, 0, 0],
    norm_std: [255, 255, 255],
    input_quant: null,
    output_quant: null,
    output_activation: 'softmax',
    ...overrides,
  };
}

describe('parseManifest', () => {
  it('übersetzt eine gültige Zeile', () => {
    const m = parseManifest(row({ input_quant: { scale: 0.0039, zero_point: -128 } }));
    expect(m).not.toBeNull();
    expect(m!.inputSize).toBe(224);
    expect(m!.positiveIndex).toBe(1);
    expect(m!.inputQuant).toEqual({ scale: 0.0039, zeroPoint: -128 });
    expect(m!.outputQuant).toBeNull();
  });

  it('lehnt fehlende Zeile ab (kein aktives Modell)', () => {
    expect(parseManifest(null)).toBeNull();
  });

  it.each<[string, Partial<ModelRow>]>([
    ['Pfad mit ..', { storage_path: 'models/../originals/x.jpg' }],
    ['Pfad mit URL', { storage_path: 'https://evil.example/x.tflite' }],
    ['kaputte Prüfsumme', { sha256: 'xyz' }],
    ['Schwellenwert 1', { threshold: 1 }],
    ['Schwellenwert 0', { threshold: 0 }],
    ['Index außerhalb der Labels', { positive_index: 2 }],
    ['nur ein Label', { labels: ['positiv'] }],
    ['std mit 0', { norm_std: [255, 0, 255] }],
    ['Normalisierung mit 2 Werten', { norm_mean: [0, 0] }],
    ['unbekannte Aktivierung', { output_activation: 'sigmoid' }],
    ['Quant ohne scale', { input_quant: { zero_point: 0 } }],
    ['riesige Eingabe', { input_size: 4096 }],
    ['Version mit Leerzeichen', { version: 'v 1' }],
  ])('lehnt ab: %s', (_name, overrides) => {
    expect(parseManifest(row(overrides))).toBeNull();
  });
});

describe('isCheckDue', () => {
  const DAY = 24 * 60 * 60 * 1000;
  it('prüft beim ersten Start', () => expect(isCheckDue(null, 1000, DAY)).toBe(true));
  it('prüft nicht innerhalb des Intervalls', () =>
    expect(isCheckDue(1000, 1000 + DAY - 1, DAY)).toBe(false));
  it('prüft nach Ablauf des Intervalls', () => expect(isCheckDue(1000, 1000 + DAY, DAY)).toBe(true));
  it('prüft, wenn die Uhr zurückgestellt wurde', () => expect(isCheckDue(5000, 1000, DAY)).toBe(true));
});

describe('bytesToHex', () => {
  it('liefert kleingeschriebenes, zweistelliges Hex', () => {
    expect(bytesToHex(new Uint8Array([0, 15, 16, 255]))).toBe('000f10ff');
  });
});
