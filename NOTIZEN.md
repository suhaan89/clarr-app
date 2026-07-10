# NOTIZEN — Entscheidungen aus automatischen Läufen

## Lauf 2026-07-10 — Backend-Pakete 1–6 in dieses Repo (clarr-app)

**Grundsatz-Entscheidung dieses Laufs (bitte prüfen):**
Der Arbeitsauftrag nennt „Projekt clar-app2/", die Session läuft aber im neuen
Repo `clarr-app/` (frisches Expo-Router-Gerüst, noch ohne Supabase). In
`clar-app2/` sind die Pakete 1–6 bereits fertig committet (Branch
`auto/claude-chunks`, Migrationen 001–007 + Edge Functions). Nochmaliges
„Abarbeiten" dort wäre ein No-Op. Entscheidung: Das geprüfte Supabase-Backend
aus `clar-app2` (Stand Ende Paket 6, Commit `1ac7ec8`) wird paketweise in
dieses neue Repo portiert — pro Paket ein Commit, Dateien beim Übernehmen
reviewt. Die Migrationen bleiben die Quelle der Wahrheit für die DEV-DB;
`001_schema.sql` bildet den Bestand ab (user_profiles, reports,
cleanup_events, …). Client-Anteile der alten Pakete (LoginScreen,
ReportScreen, RewardsScreen) existieren im neuen Gerüst nicht und werden NICHT
portiert — offene Client-Tasks, siehe docs/fortschritt.md.

Die inhaltlichen Annahmen der Pakete (aus clar-app2/NOTIZEN.md) gelten
unverändert; die wichtigsten sind unten je Paket wiederholt.

## Paket 1 — Fundament

1. `report_status`-Werte waren nicht vorgegeben. Gewählt:
   `gemeldet | in_pruefung | veroeffentlicht | abgelehnt | erledigt`.
2. `verification_level`: `unverifiziert | ki_verifiziert | moderator_verifiziert`.
3. `flag_reason`: `personenbezogene_daten | unangemessener_inhalt | spam |
   falschmeldung | duplikat | sonstiges`.
4. `events`/`event_participants`/`profiles` werden NICHT neu angelegt — sie
   existieren im Bestand als `cleanup_events`/`cleanup_signups`/`user_profiles`
   (siehe docs/schema-ist.md).
5. `reports` wird additiv erweitert (`status`, `verification`, `case_id`);
   Defaults machen die Migration für Bestandszeilen sicher.
6. Alte Policy `reports_select_all` (SELECT true, aus Migration 001) bleibt
   additiv stehen — Verengung auf „veröffentlicht ODER eigene" ist als
   späteres Paket dokumentiert (docs/fundament.md, Altlasten).
7. `points_ledger` zusätzlich per Trigger gegen UPDATE/DELETE gesichert —
   auch die Service-Role kann nur anfügen; Korrektur = Gegenbuchung.
8. `vision_usage.user_id` SET NULL statt CASCADE — Kostendaten müssen
   Account-Löschungen überleben (globaler Kostendeckel).
9. Migrations-Namen `NNN_name.sql` statt CLI-Zeitstempel — folgt dem
   Bestands-Schema aus `001_schema.sql`.
10. Kein `npm test` im Repo; Migrationen wurden nicht gegen eine Live-DB
    ausgeführt (Vorgabe: kein Live-DB-Zugriff).

## Paket 2 — Auth

1. Enum heißt `user_verification_level` (`neu | mail_verifiziert | aktiv`) —
   `verification_level` ist schon für die Report-Verifikation vergeben.
2. `aktiv` = Mail bestätigt UND Community-Regeln in der App bestätigt
   (`activate_account(true)`, speichert nur `rules_accepted_at`).
3. `user_profiles` für Clients komplett read-only (REVOKE INSERT/UPDATE/
   DELETE); alle Schreibpfade sind SECURITY-DEFINER-RPCs.
4. `reputation_score` INT 0–1000, Start 100, Änderung nur über
   `adjust_reputation()` (Service-Role only, auditiert).
5. Rate-Limits liegen in der Auth-Config: `supabase/config.toml` für lokal,
   Dashboard-Checkliste in docs/auth.md (im DEV-Projekt manuell setzen,
   insb. „Prevent email enumeration"). `project_id` auf `clarr-app` angepasst.
6. Alters-/Einwilligungslogik nur als TODO-Kommentar „JURISTISCH PRUEFEN"
   in der Migration — keine Umsetzung ohne juristische Klärung.
7. Client-Anteil (LoginScreen mit Anti-Enumeration-Meldungen) ist im neuen
   Gerüst noch nicht vorhanden — offener Client-Task (docs/fortschritt.md).
