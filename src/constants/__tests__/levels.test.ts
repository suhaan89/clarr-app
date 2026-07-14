import { levelProgress, nextRank, POINTS_PER_LEVEL } from '@/constants/levels';

describe('levelProgress', () => {
  it('startet bei Saldo 0 auf Stufe 1 mit leerem Fortschritt', () => {
    const p = levelProgress(0);
    expect(p.level).toBe(1);
    expect(p.pointsIntoLevel).toBe(0);
    expect(p.pointsToNext).toBe(POINTS_PER_LEVEL);
    expect(p.fraction).toBe(0);
  });

  it('rechnet einen Saldo mitten in einer Stufe korrekt um', () => {
    const p = levelProgress(150);
    expect(p.level).toBe(2);
    expect(p.pointsIntoLevel).toBe(50);
    expect(p.pointsToNext).toBe(50);
    expect(p.fraction).toBeCloseTo(0.5);
  });

  it('steigt genau auf der 100er-Marke eine Stufe auf', () => {
    expect(levelProgress(99).level).toBe(1);
    expect(levelProgress(100).level).toBe(2);
  });

  it('behandelt einen negativen Saldo wie 0 (nie negative Stufe)', () => {
    const p = levelProgress(-50);
    expect(p.level).toBe(1);
    expect(p.pointsIntoLevel).toBe(0);
    expect(p.fraction).toBe(0);
  });

  it('rundet einen Bruchteil-Saldo ab, bevor gerechnet wird', () => {
    expect(levelProgress(99.9).level).toBe(1);
    expect(levelProgress(100.9).level).toBe(2);
  });
});

describe('nextRank', () => {
  it('zeigt Bronze als naechsten Rang bei Saldo 0', () => {
    const r = nextRank(0);
    expect(r?.name).toBe('Bronze');
    expect(r?.pointsAway).toBe(100);
  });

  it('zeigt Silber als naechsten Rang zwischen Bronze und Silber', () => {
    const r = nextRank(150);
    expect(r?.name).toBe('Silber');
    expect(r?.pointsAway).toBe(100);
  });

  it('gibt null zurueck, sobald der hoechste Rang (Gold) erreicht ist', () => {
    expect(nextRank(500)).toBeNull();
    expect(nextRank(10000)).toBeNull();
  });

  it('behandelt einen negativen Saldo wie 0', () => {
    expect(nextRank(-10)?.name).toBe('Bronze');
  });
});
