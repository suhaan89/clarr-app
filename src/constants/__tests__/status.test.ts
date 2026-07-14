import { getCaseStatus, isOpenStatus } from '@/constants/status';
import type { TranslationKey } from '@/lib/i18n';

// Einfacher Stub statt echtem I18n-Context: gibt den Schluessel selbst
// zurueck, damit Tests unabhaengig vom Uebersetzungskatalog bleiben.
const t = (key: TranslationKey) => key;

describe('isOpenStatus', () => {
  it('gilt gemeldet/geprueft/weitergeleitet als offen', () => {
    expect(isOpenStatus('gemeldet')).toBe(true);
    expect(isOpenStatus('geprueft')).toBe(true);
    expect(isOpenStatus('weitergeleitet')).toBe(true);
  });

  it('gilt erledigt/geschlossen NICHT als offen', () => {
    expect(isOpenStatus('erledigt')).toBe(false);
    expect(isOpenStatus('geschlossen')).toBe(false);
  });

  it('gilt ein unbekannter Status nicht als offen (sicherer Default)', () => {
    expect(isOpenStatus('irgendwas_neues')).toBe(false);
  });
});

describe('getCaseStatus', () => {
  it('liefert Icon/Ton/Label fuer einen bekannten Status', () => {
    const s = getCaseStatus('erledigt', t);
    expect(s.tone).toBe('success');
    expect(s.icon).toBe('checkmark-done-circle');
    expect(s.label).toBe('case.status.erledigt');
  });

  it('faellt bei unbekanntem Status auf neutral + Rohwert als Label zurueck (bricht die UI nicht)', () => {
    const s = getCaseStatus('zukuenftiger_status', t);
    expect(s.tone).toBe('neutral');
    expect(s.icon).toBe('ellipse-outline');
    expect(s.label).toBe('zukuenftiger_status');
  });

  it('behandelt einen leeren String wie jeden anderen unbekannten Status', () => {
    const s = getCaseStatus('', t);
    expect(s.tone).toBe('neutral');
    expect(s.label).toBe('');
  });
});
