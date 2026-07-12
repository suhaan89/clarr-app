# Ops: Migrationen, Tests, Umgebungen (Paket 12)

## Grundsätze

- **Migrationen sind die Quelle der Wahrheit** (`supabase/migrations/`,
  fortlaufend `NNN_name.sql`). Kein Schema-Gefummel im Dashboard — was
  nicht als Migration im Repo liegt, existiert nicht.
- **Nur additiv**: neue Tabellen/Spalten/Funktionen; niemals DROP/RENAME
  von Bestand. Die zwei dokumentierten Policy-Ausnahmen stehen in
  NOTIZEN.md (Paket 8: `reports_select_all`, Paket 10: `events_insert_own`).
- **Umgebungen**: dev → staging → prod, immer in dieser Reihenfolge,
  immer per Migration. Automatische Läufe migrieren NUR dev.

## Workflow

```
# 1. Neue Migration schreiben
supabase/migrations/014_beschreibung.sql   # naechste freie Nummer

# 2. Lokal testen (Docker noetig)
supabase start                # spielt Migrationen + seed.sql ein
supabase test db              # pgTAP: supabase/tests/*.test.sql
npm test                      # Jest: Client-Logik (Offline-Queue, Validierung)

# 3. Gegen DEV ausrollen
supabase link --project-ref <DEV-REF>
supabase db push              # wendet ausstehende Migrationen an

# 4. Edge Functions deployen
supabase functions deploy submit-report analyze-photo process-photo \
  close-case close-event-cases export-my-data delete-account authority-digest
supabase functions deploy confirm-case-done --no-verify-jwt   # Behoerden-Link ohne Login

# 5. Secrets (nur Dashboard/CLI, NIE im Repo)
supabase secrets set ANTHROPIC_API_KEY=... RESEND_API_KEY=... DIGEST_FROM_EMAIL=...
```

## Tests

| Ebene | Werkzeug | Was |
|---|---|---|
| DB/Rewards/Auth | pgTAP (`supabase test db`) | Idempotenz, Tagesdeckel, „Client kann nicht buchen", Verifikations-Level, reputation-Grenzen, Consents append-only |
| Client-Logik | Jest (`npm test`) | Offline-Queue (kein Doppel-Sync), Auth-/Pseudonym-Validierung |
| Typen | `npx tsc --noEmit` | App-Code (supabase/ ist Deno, ausgenommen) |

## Seeds

- `supabase/seed.sql`: SYNTHETISCHE Daten für lokale Entwicklung/Staging
  (example.com-Nutzer, SEED-markierte Fälle/Events). Läuft automatisch bei
  `supabase start`/`db reset`. Niemals in prod einspielen.
- `scripts/seed-admin.mjs`: ECHTE Cold-Start-Inhalte (Paket 10), nur vom
  Betreiber mit service_role aus der Umgebung; verweigert prod-URLs.

## Scheduling

- `authority-digest` wöchentlich (Dashboard → Edge Functions → Schedules
  oder pg_cron + pg_net) mit `Authorization: Bearer <service_role>`.

## Was NIE passieren darf

- service_role-Key im Repo, im Client oder in Logs.
- Migration direkt gegen staging/prod aus einem automatischen Lauf.
- Schema-Änderungen am Dashboard vorbei an den Migrationen.
