import { deriveVerdict } from '../verdict';
import { makeManifest } from '../__fixtures__/manifest';

describe('deriveVerdict', () => {
  it('Score über dem Schwellenwert → „könnte Müll sein"', () => {
    const r = deriveVerdict(0.8, makeManifest({ threshold: 0.6 }));
    expect(r).toEqual({ verdict: 'trash', score: 0.8, threshold: 0.6, modelVersion: 'test-1' });
  });

  it('Score genau auf dem Schwellenwert zählt als Müll', () => {
    expect(deriveVerdict(0.6, makeManifest({ threshold: 0.6 })).verdict).toBe('trash');
  });

  it('Score darunter → freundlicher Hinweis „kein Müll erkannt"', () => {
    expect(deriveVerdict(0.2, makeManifest({ threshold: 0.6 })).verdict).toBe('no-trash');
  });
});
