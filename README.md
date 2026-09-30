# CLAR

App zum Melden illegaler Müllablagerungen: Foto aufnehmen, Fall auf der
Karte verfolgen, gemeinsam aufräumen. Expo SDK 54 (React Native 0.81,
expo-router) mit Supabase als Backend.

## Loslegen

```bash
npm install
cp .env.example .env      # EXPO_PUBLIC_SUPABASE_URL + ANON_KEY eintragen
npx expo start
```

Karte, Kamera und die On-Device-Foto-Prüfung brauchen einen **Dev-Build**
(`npm run build:android:dev`), nicht Expo Go. Im Web läuft die App mit
Karten-Platzhalter.

## Prüfen

```bash
npm test              # Jest
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
```

## Wo steht was

| Pfad | Inhalt |
| --- | --- |
| `src/app` | Screens (dateibasiertes Routing) |
| `src/components` | wiederverwendbare UI-Bausteine |
| `src/lib` | Supabase, Offline-Queue, i18n, On-Device-Erkennung (`vision/`) |
| `supabase/migrations` | Datenbankschema, fortlaufend nummeriert |
| `supabase/functions` | Edge Functions (Meldung, Foto-Pipeline, Konto) |
| `training/` | Python-Skripte für das On-Device-Modell |
| `docs/` | Architektur- und Betriebsnotizen, `docs/legal/` für Rechtstexte |
| `FRAGEN.md` | offene Entscheidungen, die nicht im Code lösbar sind |

Deployment von Migrationen und Functions: `docs/ops.md`.
Hinweise für KI-Agenten: `AGENTS.md`.
