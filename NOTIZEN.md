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
