import { isValidDisplayName, isValidEmail, isValidPassword } from '@/lib/validation';

describe('Auth-Validierung', () => {
  test('akzeptiert normale E-Mail-Adressen', () => {
    expect(isValidEmail('mia@example.org')).toBe(true);
    expect(isValidEmail('  mia@example.org  ')).toBe(true); // trimmt
  });

  test('lehnt kaputte E-Mail-Adressen ab', () => {
    for (const bad of ['', 'mia', 'mia@', '@example.org', 'a b@example.org', 'mia@example']) {
      expect(isValidEmail(bad)).toBe(false);
    }
  });

  test('Passwort: Mindestlaenge 8, keine Komplexitaets-Pflicht', () => {
    expect(isValidPassword('1234567')).toBe(false);
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword('nur kleinbuchstaben aber lang')).toBe(true);
  });
});

describe('Leaderboard-Pseudonym', () => {
  test('erlaubt harmlose Namen (2-24 Zeichen)', () => {
    expect(isValidDisplayName('Mia')).toBe(true);
    expect(isValidDisplayName('Müll-Jäger 42')).toBe(true);
    expect(isValidDisplayName('ab')).toBe(true);
  });

  test('lehnt zu kurz/zu lang/Sonderzeichen ab', () => {
    expect(isValidDisplayName('x')).toBe(false);
    expect(isValidDisplayName('a'.repeat(25))).toBe(false);
    expect(isValidDisplayName('<script>')).toBe(false);
    expect(isValidDisplayName('name@mail')).toBe(false); // keine E-Mail preisgeben
  });
});
