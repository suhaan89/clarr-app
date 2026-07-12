import { computeAchievements, earnedCount, type AchievementInput } from '@/lib/achievements';

const empty: AchievementInput = {
  balance: 0,
  reportsVerified: 0,
  casesConfirmed: 0,
  casesClosed: 0,
  events: 0,
};

describe('computeAchievements', () => {
  it('vergibt bei leeren Zahlen kein Abzeichen, zeigt aber Fortschritt 0/target', () => {
    const list = computeAchievements(empty);
    expect(earnedCount(list)).toBe(0);
    expect(list.every((a) => a.current === 0)).toBe(true);
    expect(list.find((a) => a.id === 'first_report')?.target).toBe(1);
  });

  it('vergibt „erste Meldung" ab einer verifizierten Meldung', () => {
    const list = computeAchievements({ ...empty, reportsVerified: 1 });
    expect(list.find((a) => a.id === 'first_report')?.earned).toBe(true);
    expect(list.find((a) => a.id === 'reports_5')?.earned).toBe(false);
  });

  it('kappt den angezeigten Fortschritt beim Ziel', () => {
    const list = computeAchievements({ ...empty, reportsVerified: 99 });
    const five = list.find((a) => a.id === 'reports_5');
    expect(five?.current).toBe(5);
    expect(five?.earned).toBe(true);
  });

  it('leitet Raenge aus dem Saldo ab (Bronze/Silber/Gold)', () => {
    expect(computeAchievements({ ...empty, balance: 100 }).find((a) => a.id === 'rank_bronze')?.earned).toBe(true);
    expect(computeAchievements({ ...empty, balance: 100 }).find((a) => a.id === 'rank_silber')?.earned).toBe(false);
    expect(computeAchievements({ ...empty, balance: 500 }).find((a) => a.id === 'rank_gold')?.earned).toBe(true);
  });

  it('behandelt negative/kaputte Werte defensiv', () => {
    const list = computeAchievements({ ...empty, reportsVerified: -3, balance: Number.NaN });
    expect(earnedCount(list)).toBe(0);
    expect(list.every((a) => a.current >= 0)).toBe(true);
  });
});
