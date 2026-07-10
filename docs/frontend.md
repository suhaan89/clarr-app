# Frontend (Paket 9)

Expo Router (SDK 54), Screens unter `src/app/`.

## Screens

- **Karte** (`(tabs)/index`): zeigt nur geprüfte/veröffentlichte Meldungen
  (RLS erzwingt das serverseitig); Fotos ausschließlich geblurrt aus
  `public-blurred`. Geschlossene Fälle grün hervorgehoben, offene rot.
- **Melden** (`(tabs)/melden`): In-App-Kamera = wertbar; Galerie = Meldung
  ohne Punkte (Hinweis im UI; durchgesetzt wird es SERVERSEITIG über
  `reports.points_eligible`). Standort inkl. `mocked`-Flag wird ehrlich
  mitgesendet — Bewertung macht der Server.
- **Fall-Detail** (`case/[id]`): Status, anonymisierte Fotos, Flag-Button
  (fail-safe: sofort unsichtbar bis Review), Abschluss mit frischem
  Nachher-Foto (Server prüft ≤ 100 m + vergibt Punkte idempotent).
- **Impact-Profil** (`(tabs)/profil`): zeigt den SERVER-Punktestand
  (`points_level`); der Client bucht nie. Keine Streaks, keine
  Zufallsbelohnung, kein Grind. Leaderboard: Opt-in, Pseudonym,
  Wochen-Reset (View `leaderboard_week`).
- **Events** (`(tabs)/events`): Liste + An-/Abmeldung (`cleanup_signups`).
- **Login** (`login`): Anti-Enumeration (neutrale Meldungen), Hinweis
  „kein Klarname nötig"; Alters-/Einwilligungslogik TODO JURISTISCH PRUEFEN.

## Offline-Erfassung

`src/lib/offline-queue.ts`: Meldungen (inkl. lokaler Foto-URIs) landen IMMER
zuerst in einer AsyncStorage-Queue, dann Sync-Versuch; NetInfo-Listener
synct automatisch, sobald Netz da ist. **Kein Doppel-Sync**: jede Meldung
trägt einen einmal erzeugten `clientKey`; der Server entdoppelt per
Unique-Index `(user_id, client_key)` (Migration 011) und antwortet auf
Wiederholungen idempotent.

## Barrierefreiheit (BFSG-Basis)

- `accessibilityLabel`/`accessibilityRole` auf allen interaktiven Elementen,
  `accessibilityLiveRegion` für Statusmeldungen.
- Touch-Ziele min. 44–48 dp (`minHeight: 44/48`).
- Dynamische Schrift: `allowFontScaling` überall aktiv.
- Kontraste: Primärgrün `#1B7A43` auf Weiß ≥ 4.5:1; Textfarben aus dem
  Theme (schwarz/weiß + `textSecondary`).
- Statusinfos nie nur über Farbe (Text „offen/erledigt" zusätzlich).

## Keine Dark Patterns

Kein Countdown/Verknappung, keine Streak-Angst, Leaderboard strikt Opt-in,
Galerie-Weg bleibt möglich (nur eben ohne Punkte), Abmelden/Abbrechen ist
immer gleichwertig sichtbar.
