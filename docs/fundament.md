# CLAR — Fundament: Schema & RLS (Migration 002)

Stand: 2026-07-08 · Quelle der Wahrheit: `supabase/migrations/002_fundament.sql`
(additiv zu `001_schema.sql`; Ist-Zustand davor siehe `docs/schema-ist.md`).

## Namens-Mapping (Ziel → Ist)

| Ziel-Tabelle | Umsetzung |
|---|---|
| profiles | existiert als `user_profiles` (unverändert) |
| events | existiert als `cleanup_events` (unverändert) |
| event_participants | existiert als `cleanup_signups` (unverändert) |
| reports | bestand schon; additiv erweitert um `status`, `verification`, `case_id` |
| report_photos, cases, points_ledger, moderation_flags, vision_usage, audit_log | neu in Migration 002 |

## Enums

| Enum | Werte |
|---|---|
| `report_status` | gemeldet · in_pruefung · veroeffentlicht · abgelehnt · erledigt |
| `case_status` | gemeldet · geprueft · weitergeleitet · erledigt · geschlossen |
| `photo_kind` | before · after |
| `verification_level` | unverifiziert · ki_verifiziert · moderator_verifiziert |
| `flag_reason` | personenbezogene_daten · unangemessener_inhalt · spam · falschmeldung · duplikat · sonstiges |

## Neue Tabellen

### `cases`
Bündelt mehrere Reports zu einem Fall (z. B. für Weiterleitung an die Kommune).
`reports.case_id → cases.id` (SET NULL). `created_by` ist SET NULL, damit Fälle
eine Account-Löschung überleben — Fall-Daten sind nicht personenbezogen.

### `report_photos`
Ein Datensatz pro Foto mit Metadaten: `kind` (before/after), `storage_path`
(kein öffentlicher URL — Originale werden nie direkt verlinkt), `exif_stripped`,
`faces_blurred`, `approved`. Kaskadiert über `report_id` bzw. `user_id`:
Nutzerlöschung entfernt die Fotodatensätze mit.

Das bestehende `reports.photo_urls`-Array bleibt unverändert (Bestandscode);
Neuentwicklung soll `report_photos` verwenden.

### `points_ledger` (append-only)
Journal aller Punktebewegungen: `user_id`, `delta` (≠ 0), `reason`, optional
`report_id`/`event_id` (SET NULL — Historie überlebt das Löschen der Referenz),
`metadata`, `created_at`. `user_id` kaskadiert: Löschung des Nutzers entfernt
seine Punktehistorie (DSGVO-freundlich).

**Append-only wird dreifach abgesichert:**
1. **RLS:** nur `ledger_select_own` (SELECT eigener Zeilen). Keine
   INSERT/UPDATE/DELETE-Policies → für Clients default-deny.
2. **REVOKE:** `INSERT, UPDATE, DELETE` sind `anon`/`authenticated` grundsätzlich
   entzogen (unabhängig von RLS).
3. **Trigger:** `points_ledger_no_update_delete` wirft bei UPDATE/DELETE eine
   Exception — das gilt auch für die Service-Role, die RLS sonst umgeht.
   Einträge können also nur eingefügt, nie verändert werden.

Schreiben ausschließlich serverseitig (Edge Function mit Service-Role).

**Guthaben-Berechnung:** Das Guthaben ist die Summe der Deltas:

```sql
SELECT COALESCE(SUM(delta), 0) FROM points_ledger WHERE user_id = :uid;
```

Dafür existiert die View `points_balance` (`user_id`, `balance`,
`last_entry_at`). Sie ist mit `security_invoker = true` angelegt: die RLS des
Ledgers gilt durch die View hindurch, jeder Nutzer sieht nur den eigenen Saldo.
`user_profiles.credits` bleibt als unveränderte Cache-Spalte bestehen; ein
späterer Chunk kann den Cache aus dem Ledger befüllen bzw. abgleichen.

### `moderation_flags`
Nutzer melden **Inhalte, nie Personen**: genau ein Ziel pro Flag
(`report_id` XOR `photo_id` XOR `event_id`, per CHECK erzwungen), `reason`
(Enum), optionale `note`, `resolved_at`. Auflösung nur serverseitig.

### `vision_usage`
Serverseitiges Kosten-Log pro Vision-API-Aufruf (`model`, Token-Zahlen,
`estimated_cost_usd`, `success`). Grundlage für den globalen Kostendeckel und
Kill-Switch (spätere Chunks: Edge Function `verify-waste` schreibt hier vor/nach
jedem Aufruf und verweigert bei überschrittenem Deckel).
`user_id`/`report_id` sind SET NULL: Kostendaten müssen Löschungen überleben,
sonst stimmt der globale Deckel nicht mehr.

### `audit_log`
Append-Trail für sicherheitsrelevante Aktionen (`actor_user_id` SET NULL,
`action`, `entity_type`/`entity_id`, `details` JSONB). Nur Service-Role.

## RLS-Entscheidungen (alle neuen Tabellen: RLS aktiv, default-deny)

| Tabelle | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `cases` | alle (`true`) | — (nur Server) | — | — |
| `report_photos` | Eigentümer, sonst nur `approved` **und** Report `veroeffentlicht` | eigener Report + eigene Zeile | — (Metadaten setzt der Server) | Eigentümer |
| `points_ledger` | nur eigene Zeilen | — | — (Trigger blockt auch Server) | — (Trigger blockt auch Server) |
| `moderation_flags` | nur eigene Flags | nur eigene | — | — |
| `vision_usage` | — (nur Server) | — | — | — |
| `audit_log` | — (nur Server) | — | — | — |

Begründungen:
- **`cases` öffentlich lesbar:** enthält keine personenbezogenen Daten und macht
  den Bearbeitungsstand transparent (Civic-Tech-Ziel).
- **`report_photos` restriktiv:** Fotos sind das größte Datenschutzrisiko
  (Gesichter, Kennzeichen). Öffentlich sichtbar erst nach Freigabe (`approved`)
  und Veröffentlichung der Meldung — doppeltes Gate.
- **`vision_usage`/`audit_log` komplett zu:** reine Betriebs-/Sicherheitsdaten,
  Clients haben dort nichts zu suchen. Keine Policies = niemand außer
  Service-Role kommt ran.
- **Melde-Flags nur für den Melder sichtbar**, damit niemand auslesen kann, wer
  was gemeldet hat.

## ON-DELETE-Verhalten (Nutzerlöschung)

| Verweis | Verhalten | Grund |
|---|---|---|
| `report_photos.user_id`, `points_ledger.user_id`, `moderation_flags.user_id` | CASCADE | persönliche Daten verschwinden mit dem Account |
| `cases.created_by`, `vision_usage.user_id`, `audit_log.actor_user_id` | SET NULL | Fall-, Kosten- und Audit-Daten müssen die Löschung überleben (nicht personenbezogen bzw. betriebsnotwendig) |
| `points_ledger.report_id`/`event_id`, `vision_usage.report_id` | SET NULL | Historie bleibt konsistent, wenn das referenzierte Objekt gelöscht wird |

## Bekannte Altlasten (bewusst NICHT in diesem Chunk angefasst)

- `reports_select_all` (SELECT `true`) aus Migration 001 bleibt bestehen —
  damit sind auch unveröffentlichte Meldungen weiter öffentlich lesbar
  (Kartenanzeige des Bestandscodes). Empfehlung für einen späteren Chunk:
  Policy auf `status = 'veroeffentlicht' OR auth.uid() = user_id` verengen,
  sobald der Moderations-Flow steht.
- `user_profiles.credits` bleibt mutable Cache (feste Vorgabe dieses Chunks).
- Storage-Bucket/Policies für `report-photos` kommen in einem späteren Chunk.
