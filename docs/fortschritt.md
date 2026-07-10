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

## Paket 2 — Auth ✅

- `supabase/migrations/003_auth.sql`: `user_verification_level`
  (neu → mail_verifiziert → aktiv), `reputation_score` (nur serverseitig via
  `adjust_reputation`), Trigger auf `auth.users.email_confirmed_at`,
  RPC `activate_account`; `user_profiles` für Clients read-only;
  Alters-/Einwilligung nur TODO „JURISTISCH PRUEFEN".
- `supabase/config.toml`: Rate-Limits für Registrierung/Mails (lokal);
  Dashboard-Checkliste für das DEV-Projekt in `docs/auth.md`
  (u. a. „Prevent email enumeration").

## Paket 3 — Meldungs-Backend ✅

- `supabase/functions/submit-report/`: einziger Schreibpfad für Meldungen
  (Clients haben kein INSERT auf `reports` mehr). Auth-Pflicht + Level
  `aktiv`, Geo/Zeit serverseitig, Quota 10/Tag pro Nutzer + globales Limit
  (atomar via `consume_report_quota`), Bündelung an offene Fälle im
  ~30-m-Umkreis (Geohash + Haversine, Advisory-Lock), Mock-Location/Speed
  ⇒ `location_suspect` + Reputationsabzug, Rate-Limit Konto/Gerät/IP
  (nur SHA-256-Hashes).
- `supabase/migrations/004_submit_report.sql`: Spalten/RPCs/Tabellen dafür.
- Doku: `docs/meldungs-backend.md`.

## Paket 4 — Vision + Kill-Switch ✅

- `supabase/functions/analyze-photo/`: KI-Prüfung nur serverseitig, nur für
  eigene Reports im Zustand `gemeldet` (also nur nach submit-report).
  Budgetdeckel pro Nutzer + global (race-sicher, pessimistische Reservierung
  unter Advisory-Lock), KILL-SWITCH bei Globallimit (Meldung → Review-Queue,
  App bleibt nutzbar), Alert ab 80 % ins audit_log, Bildverkleinerung vor dem
  Call, Confidence <0.6 → Review, Gewalt/Nacktheit → Block.
- `supabase/migrations/005_vision_budget.sql`: `system_settings`-Budgets,
  Reservierungs-RPCs, Kill-Switch-Zustand.
- Doku: `docs/vision.md`. Key nur als Supabase Secret.

## Paket 5 — Foto-Pipeline ✅

- `supabase/functions/process-photo/`: EXIF/GPS strippen, dHash (pHash)
  speichern, Gesichter/Kennzeichen pixelieren (Vision-Bounding-Boxes;
  FEHLBAR — im Code markiert, Review-Schritt davor), Ablage nach
  `public-blurred`; Fail-safe: ohne erfolgreichen Lauf bleibt das Foto privat.
- `supabase/migrations/006_photo_pipeline.sql`: Buckets `originals`
  (privat) + `public-blurred` (öffentlich, nur Service schreibt) inkl.
  Storage-Policies; Metadaten-Spalten auf `report_photos`.
- Löschung entfernt Original + Derivate; Signed URLs kurzlebig.
- Doku: `docs/foto-pipeline.md`.

## Paket 6 — Reward-Engine ✅

- `supabase/migrations/007_rewards.sql`: `award_points()` (nur Service-Role),
  idempotent per `booking_key`, Regeln: Meldung 10 / Bestätigung 3 /
  Fallabschluss mit Nachher-Foto 25, Degression (Halbierung je Wiederholung
  am selben Ort, 30 Tage), Tagesdeckel 50 mit Teilbuchung; Saldo/Level als
  View `points_level`. Keine Streaks, kein Zufall.
- `supabase/tests/rewards.test.sql` (pgTAP, `supabase test db`): Idempotenz,
  Tagesdeckel, „Client kann nicht buchen".
- Doku: `docs/rewards.md`. `user_profiles.credits` bleibt unangetastet.

## Offene Client-Tasks (neues Gerüst hat noch keine Screens)

- Auth-Screens (Login/Registrierung mit Anti-Enumeration-Verhalten)
- Melde-Flow (submit-report + process-photo aufrufen statt Direkt-Insert)
- Rewards-Anzeige (View `points_level` lesen, nicht `user_profiles.credits`)
