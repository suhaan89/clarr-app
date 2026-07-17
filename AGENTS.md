# CLAR – Projektleitfaden für Agenten

CLAR ist eine Expo-/React-Native-App (Meldung & Karte von Müllfunden am
Bodensee) mit Supabase-Backend. Nutzeroberfläche und Kommentare sind auf
Deutsch.

## Expo-Version – WICHTIG

Dieses Projekt läuft auf **Expo SDK 54** (`expo@54.0.35`, React Native 0.81,
expo-router 6, React 19.1). Vor Code-Änderungen die passenden versionierten
Docs lesen: https://docs.expo.dev/versions/v54.0.0/ – **nicht** v57 (die
frühere Notiz hier war falsch).

## Befehle

```bash
npx expo start        # Dev-Server (Metro). --web / --android / --ios für Ziel
npm test              # Jest (jest-expo), Tests unter src/**/__tests__
npx tsc --noEmit      # Typecheck (muss sauber sein)
npx expo lint         # ESLint (eslint-config-expo)
```

`.env` (nicht im Repo) muss `EXPO_PUBLIC_SUPABASE_URL` und
`EXPO_PUBLIC_SUPABASE_ANON_KEY` setzen – Vorlage in `.env.example`. Nur der
anon-Key gehört in den Client, niemals der service_role-Key.

## Architektur (Kurzüberblick)

- **Routing:** expo-router (dateibasiert) unter `src/app`. Tabs in
  `src/app/(tabs)`, Auth-Gate in `(tabs)/_layout.tsx` (`useSession`).
- **Backend/Auth:** `src/lib/supabase.ts`. Alles Schreibende läuft über RLS bzw.
  Edge Functions. Session wird nativ AES-verschlüsselt in AsyncStorage
  gehalten (Schlüssel in SecureStore); auf **Web** übernimmt AsyncStorage
  direkt (SecureStore existiert dort nicht).
- **i18n:** `src/lib/i18n`. `de` ist die vollständige Referenz; andere Sprachen
  dürfen Lücken haben und fallen auf Deutsch zurück. Neue UI-Strings **immer**
  mindestens in `de` und `en` in `translations.ts` ergänzen (Test prüft das).
- **Design-System:** `src/constants/theme.ts` (Farben, `Spacing`, `Type`,
  `Radius`). UI baut auf wiederverwendbaren Komponenten in `src/components`
  (Barrel-Export `index.ts`). Druckbare Flächen: **`PressableScale`** (nicht
  rohes `Pressable`) – liefert Skalierung + Haptik.
- **Onboarding-Tour:** `src/lib/tour.ts` (Coachmarks via
  `@wrack/react-native-tour-guide`). Provider/Overlay in `src/app/_layout.tsx`.
  Pro Screen wird die Tour **bei Fokus** angestoßen (idempotent per
  AsyncStorage); Neustart über den Button in Profil (`useResetAllTours`).
- **Karte:** `react-native-maps` funktioniert **nur nativ**. Import läuft über
  `src/components/AppMap` mit `AppMap.web.tsx` als Web-Platzhalter, damit das
  Web-Bundle nicht bricht.

## Konventionen

- Kommentare/Strings auf Deutsch, im Ton der bestehenden Dateien.
- Keine Reward-/Punkte-Logik im Client – Punktestände kommen serverseitig.
- Zielgruppe teils minderjährig: keine Grind-/Dark-Patterns, Datenminimierung
  (siehe `docs/auth.md`, `docs/trust-safety.md`).
- Migrationen unter `supabase/migrations`; synthetischer Seed in
  `supabase/seed.sql` (nur dev/staging, `example.com`-Nutzer).

## Weiterführende Docs

`docs/` enthält Detailnotizen: `fundament.md`, `frontend.md`, `auth.md`,
`schema-ist.md`, `ops.md`, `design-notes.md` u. a.
