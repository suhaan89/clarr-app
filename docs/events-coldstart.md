# Events + Cold-Start (Paket 10)

## Events

- **Anlegen nur Team/Partner** (RLS-Policy `events_insert_team_partner`,
  Migration 012). Die alte Policy `events_insert_own` (jeder Angemeldete)
  wurde ersetzt — dokumentierte Ausnahme vom Additiv-Prinzip: Events sind
  öffentliche Treffpunkte mit teils minderjähriger Zielgruppe und brauchen
  eine verantwortliche Organisation.
- **Anmeldung** durch Nutzer wie gehabt (`cleanup_signups`, RLS aus 001:
  eigene anlegen/löschen).
- **Gebündelter Abschluss**: Edge Function `close-event-cases`
  (Team-/Partner-Rolle) ordnet Fälle dem Event zu (`cases.event_id`) und
  schließt sie über `close_event_cases_tx` → intern `close_case_tx` pro
  Fall. **Punkte idempotent**: booking_key `case_closed_after:<case_id>` —
  ein zweiter Aufruf (Retry, Doppelklick) bucht nichts doppelt.

## Cold-Start (Admin-Seeding)

`scripts/seed-admin.mjs` pflegt echte Start-Inhalte ein:

- Inhalte kommen aus einer JSON-Datei (Begehungs-Funde, echte Termine) —
  nichts ist im Skript hardcodiert, keine Fake-Inhalte/-Nutzer.
- Alles ist als `is_seed = TRUE` markiert (ehrliche Kennzeichnung,
  auswertbar/filterbar); Seed-Meldungen sind `points_eligible = FALSE`.
- Läuft NUR mit `SUPABASE_SERVICE_ROLE_KEY` aus der Umgebung des
  Betreiber-Rechners (nie im Repo/Client); URLs mit „prod" werden
  verweigert (Seeding nur dev/staging).
- Seed-Meldungen starten im Status `gemeldet` und laufen durch dieselbe
  Prüfung wie alle anderen.
