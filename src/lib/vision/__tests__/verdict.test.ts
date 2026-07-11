import { deriveVerdict } from '../verdict';

describe('deriveVerdict', () => {
  it('erkennt Müll bei starkem Müll-Label', () => {
    const r = deriveVerdict([
      { label: 'water bottle', probability: 0.72 },
      { label: 'pop bottle, soda bottle', probability: 0.1 },
    ]);
    expect(r.verdict).toBe('trash');
    expect(r.confidence).toBeCloseTo(0.72);
    expect(r.trashLabel).toBe('water bottle');
  });

  it('urteilt „unsicher" bei schwachem Müll-Signal', () => {
    const r = deriveVerdict([
      { label: 'park bench', probability: 0.25 },
      { label: 'plastic bag', probability: 0.18 }, // > trashMaybe (0.12), < trashConfident (0.3)
    ]);
    expect(r.verdict).toBe('uncertain');
    expect(r.trashLabel).toBe('plastic bag');
  });

  it('urteilt „unsicher", wenn das Modell nichts Deutliches erkennt', () => {
    const r = deriveVerdict([
      { label: 'park bench', probability: 0.11 },
      { label: 'lakeside', probability: 0.09 },
    ]);
    expect(r.verdict).toBe('uncertain');
  });

  it('erkennt „kein Müll" bei klarem Nicht-Müll-Objekt', () => {
    const r = deriveVerdict([
      { label: 'golden retriever', probability: 0.88 },
      { label: 'Labrador retriever', probability: 0.05 },
    ]);
    expect(r.verdict).toBe('no-trash');
    expect(r.trashLabel).toBeNull();
    expect(r.confidence).toBeCloseTo(0.88);
  });

  it('nimmt das stärkste Müll-Label, auch wenn es nicht Top-1 ist', () => {
    const r = deriveVerdict([
      { label: 'sandbar', probability: 0.35 },
      { label: 'pop bottle, soda bottle', probability: 0.44 },
    ]);
    expect(r.verdict).toBe('trash');
    expect(r.trashLabel).toBe('pop bottle, soda bottle');
    expect(r.confidence).toBeCloseTo(0.44);
  });

  it('ist bei leerer Eingabe robust', () => {
    const r = deriveVerdict([]);
    expect(r.verdict).toBe('uncertain');
    expect(r.confidence).toBe(0);
  });
});
