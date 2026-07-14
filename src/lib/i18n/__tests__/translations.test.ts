import { translate } from '@/lib/i18n/translate';
import { CATALOGS, de, LANGUAGES } from '@/lib/i18n/translations';

describe('LANGUAGES / CATALOGS', () => {
  it('hat fuer jeden LANGUAGES-Code einen CATALOGS-Eintrag', () => {
    for (const lang of LANGUAGES) {
      expect(CATALOGS[lang.code]).toBeDefined();
    }
  });

  it('de ist die Referenz und traegt beta: false', () => {
    const deLang = LANGUAGES.find((l) => l.code === 'de');
    expect(deLang?.beta).toBe(false);
  });
});

describe('translate: Fallback auf Deutsch', () => {
  it('nutzt den Katalog der gewaehlten Sprache, wenn der Schluessel dort existiert', () => {
    expect(translate('en', 'tabs.home')).toBe('Home');
  });

  it('faellt auf Deutsch zurueck, wenn ein Schluessel in der Zielsprache fehlt', () => {
    // gsw ist absichtlich unvollstaendig (Paket H.33) — ein Schluessel, den
    // es dort nicht gibt, muss den deutschen Text liefern, nicht "undefined".
    const key = 'moderation.title' as const; // nur in `de` gepflegt
    expect(CATALOGS.gsw[key]).toBeUndefined();
    expect(translate('gsw', key)).toBe(de[key]);
  });

  it('gibt bei einem unbekannten Schluessel wenigstens den Schluessel selbst zurueck (kein Absturz)', () => {
    // @ts-expect-error absichtlich ein nicht existierender Schluessel
    expect(translate('de', 'does.not.exist')).toBe('does.not.exist');
  });
});

describe('translate: Platzhalter-Interpolation', () => {
  it('ersetzt ein einzelnes Platzhalter-Muster', () => {
    expect(translate('de', 'level.badge', { level: 3 })).toBe('Level 3');
  });

  it('ersetzt mehrere Platzhalter im selben Text', () => {
    const result = translate('de', 'map.legend_summary', { total: 12, closed: 5 });
    expect(result).toBe('12 Meldungen · 5 erledigt');
  });

  it('laesst ein Muster unangetastet, wenn kein passender Parameter uebergeben wurde', () => {
    expect(translate('de', 'level.badge', {})).toBe('Level {level}');
  });

  it('gibt den Text unveraendert zurueck, wenn keine Parameter erwartet werden', () => {
    expect(translate('de', 'tabs.home')).toBe('Start');
  });
});
