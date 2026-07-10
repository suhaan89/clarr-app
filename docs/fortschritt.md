# Fortschritt — Backend-Pakete (Lauf 2026-07-10)

Dieses Repo (`clarr-app`) ist das neue App-Gerüst. Das Supabase-Backend wird
paketweise aus `clar-app2` übernommen (geprüfter Stand, Commit `1ac7ec8` dort);
Details und Annahmen in `NOTIZEN.md`.

## Paket 1 — Fundament ✅

- `supabase/migrations/001_schema.sql`: Bestandsschema der DEV-DB
  (user_profiles, reports, cleanup_events, cleanup_signups, Storage-Bucket
  `report-photos`) — Referenz, in DEV bereits angewendet.
- `supabase/migrations/002_fundament.sql`: additiv — Enums (`report_status`,
  `case_status`, `photo_kind`, `verification_level`, `flag_reason`), neue
  Tabellen `cases`, `report_photos`, `points_ledger` (append-only inkl.
  Trigger gegen UPDATE/DELETE), `moderation_flags`, `vision_usage`,
  `audit_log`; additive Spalten auf `reports`; RLS default-deny + explizite
  Policies; View `points_balance` (security_invoker).
- `user_profiles.credits` bleibt unverändert (Cache); Quelle der Wahrheit
  wird `points_ledger`.
- Doku: `docs/fundament.md`, Bestandsaufnahme `docs/schema-ist.md`.

## Offene Client-Tasks (neues Gerüst hat noch keine Screens)

- Auth-Screens (Login/Registrierung mit Anti-Enumeration-Verhalten)
- Melde-Flow (submit-report + process-photo aufrufen statt Direkt-Insert)
- Rewards-Anzeige (View `points_level` lesen, nicht `user_profiles.credits`)
