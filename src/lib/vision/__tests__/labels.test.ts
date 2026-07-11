import { isTrashLabel, matchedTrashKeyword } from '../labels';

describe('isTrashLabel', () => {
  it('erkennt typische Müll-/Verpackungs-Labels', () => {
    expect(isTrashLabel('pop bottle, soda bottle')).toBe(true);
    expect(isTrashLabel('water bottle')).toBe(true);
    expect(isTrashLabel('plastic bag')).toBe(true);
    expect(isTrashLabel('tin can')).toBe(true);
    expect(isTrashLabel('ashcan, trash can, garbage can, wastebin')).toBe(true);
    expect(isTrashLabel('carton')).toBe(true);
  });

  it('ist unabhängig von Groß-/Kleinschreibung und Leerraum', () => {
    expect(isTrashLabel('  POP Bottle ')).toBe(true);
  });

  it('markiert eindeutige Nicht-Müll-Objekte nicht als Müll', () => {
    expect(isTrashLabel('golden retriever')).toBe(false);
    expect(isTrashLabel('mountain bike, all-terrain bike')).toBe(false);
    expect(isTrashLabel('robin, American robin')).toBe(false); // enthält „bin", ist aber Vogel
    expect(isTrashLabel('street sign')).toBe(false);
  });
});

describe('matchedTrashKeyword', () => {
  it('bevorzugt das spezifischste (längste) Schlüsselwort', () => {
    expect(matchedTrashKeyword('pop bottle, soda bottle')).toBe('pop bottle');
  });

  it('liefert null ohne Treffer', () => {
    expect(matchedTrashKeyword('tabby cat')).toBeNull();
  });
});
