# CLAR – Leitfaden für Agenten

CLAR ist eine Expo-/React-Native-App zum Melden illegaler Müllablagerungen
(Foto, Karte, gemeinsames Aufräumen) mit Supabase-Backend. Oberfläche,
Kommentare und Commit-Nachrichten sind auf Deutsch.

## Versionen

**Expo SDK 57** (React Native 0.86, expo-router 57, React 19.2). Bei Fragen zu
Expo-APIs die versionierten Docs lesen: https://docs.expo.dev/versions/v57.0.0/
Navigations-Hooks kommen aus `expo-router/react-navigation`, nicht direkt aus
`@react-navigation/native`.

## Befehle

```bash
npx expo start        # Dev-Server; Karte/Kamera/TFLite brauchen einen Dev-Build
npm test              # Jest (jest-expo), Tests in __tests__-Ordnern unter src/
npm run typecheck     # tsc --noEmit, muss sauber sein
npm run lint          # ESLint, muss ohne Fehler sein
```

Vor jedem Commit alle drei laufen lassen. Edge Functions typprüfen mit

```bash
cd supabase/functions && npx deno check --node-modules-dir=none */index.ts
```

Supabase-CLI und Docker fehlen auf diesem Rechner: Functions lassen sich
nicht ausführen, pgTAP-Tests (`supabase/tests`) nicht laufen lassen. Im
Bericht sagen, dass solche Änderungen nur typgeprüft sind.

## Arbeitsregel: nichts Funktionierendes blind umbauen

Änderungen, die eine laufende Funktion brechen könnten und einen Gerätetest
oder eine Entscheidung brauchen (Auth-Speicher, Rechtstexte, Einwilligungen,
Datenmodell), nicht einfach umsetzen. Stattdessen in `FRAGEN.md` festhalten:
Fund, warum gestoppt, Vorschlag.

## Architektur

- **Routing:** `src/app` (expo-router). Tabs in `src/app/(tabs)`, Auth-Gate in
  `(tabs)/_layout.tsx`. Rechtstexte unter `src/app/legal` liegen bewusst
  außerhalb des Gates.
- **Backend:** Client nur mit anon-Key (`src/lib/supabase.ts`). Alles
  Schreibende geht über RLS, RPCs oder Edge Functions (`src/lib/api.ts`);
  der Client schreibt nie direkt in `reports` oder `points_ledger`.
- **Edge Functions:** Functions, die die App mit Nutzer-JWT aufruft, starten
  mit `serveUserFunction` aus `supabase/functions/_shared/http.ts` (CORS,
  JWT-Prüfung, Service-Client, 500-Behandlung). Nicht erneut kopieren.
- **Große Screens:** Daten in einen Hook unter `src/lib` (z. B.
  `useProfilData.ts`), Abschnitte als Komponenten unter
  `src/components/<screen>/` (z. B. `src/components/profil`).
- **Meldungen:** immer erst in die Offline-Queue (`src/lib/offline-queue.ts`),
  dann Sync. Der `clientKey` entdoppelt Retries serverseitig. Fotos werden vor
  dem Upload neu kodiert (EXIF/GPS weg).
- **On-Device-Erkennung:** `src/lib/vision` (Modell kommt zur Laufzeit aus
  `vision_models`). Das Ergebnis berät nur: es blockiert nie das Absenden und
  vergibt keine Punkte. Die verbindliche Prüfung macht `analyze-photo`.
  Training in `training/` (Python), siehe `docs/vision-ondevice.md`.
- **i18n:** `src/lib/i18n/translations.ts`. `de` ist vollständig, andere
  Sprachen fallen auf Deutsch zurück. Neue Strings immer mindestens in `de`
  und `en` (ein Test prüft das).
- **UI:** Tokens aus `src/constants/theme.ts` (`Spacing`, `Type`, `Radius`,
  `useThemeColors`), Bausteine aus `src/components` (Barrel `index.ts`).
  Drückbares immer mit `PressableScale`, nie rohes `Pressable`. Status nie nur
  über Farbe (Icon + Text, siehe `src/constants/status.ts`).
- **NativeWind / `src/components/ui`:** eingerichtet (Tailwind, Babel, Metro,
  `global.css`), aber bisher von keinem Screen benutzt. Neue UI weiter mit
  `StyleSheet` + Theme-Tokens bauen, bis entschieden ist, ob migriert oder
  entfernt wird.
- **Karte:** `react-native-maps` nur nativ; Import immer über
  `src/components/AppMap` (Web-Platzhalter `AppMap.web.tsx`).
- **Onboarding-Tour:** `useFocusTour` aus `src/lib/tour.ts`; startet bei jedem
  Fokus und ist per AsyncStorage idempotent.

## Datenbank

- Migrationen in `supabase/migrations`, fortlaufend `NNN_name.sql`, nur
  additiv (kein DROP/RENAME von Bestand). Details: `docs/ops.md`.
- `supabase/seed.sql` ist synthetisch (nur dev/staging, `example.com`).
- Rechtstexte in `src/app/legal/*` inhaltlich geändert? Dann
  `POLICY_VERSION` in `src/constants/legal.ts` erhöhen und per Migration den
  Default von `consents.policy_version` nachziehen.

## Produktregeln

- Zielgruppe teils minderjährig: keine Streaks, kein Zeitdruck, keine
  Zufallsbelohnungen, Datenminimierung. Punkte berechnet nur der Server.
- Automatisierte Entscheidungen immer erkennbar machen und Widerspruch
  ermöglichen (Art. 22 DSGVO, Art. 17 DSA), siehe `case/[id].tsx`.

## Doku

| Datei | Inhalt |
| --- | --- |
| `FRAGEN.md` | offene Entscheidungen und bewusst gestoppte Fixes |
| `NOTIZEN.md` | Annahmen und Entscheidungen der Backend-Pakete (Juli 2026) |
| `docs/fortschritt.md` | was gebaut ist, was deployed werden muss |
| `docs/ops.md` | Migrationen und Functions ausrollen |
| `docs/schema-ist.md`, `docs/fundament.md` | Datenmodell |
| `docs/auth.md`, `docs/trust-safety.md`, `docs/security-review.md` | Auth, Moderation, Sicherheit |
| `docs/vision.md`, `docs/vision-ondevice.md`, `docs/foto-pipeline.md` | Foto-Prüfung und Anonymisierung |
| `docs/design-notes.md` | Designentscheidungen |
| `docs/legal/` | Datenschutz, AGB, DSFA, Audit-Bericht |
| `docs/archiv/` | erledigte Arbeitsaufträge früherer Runden |
