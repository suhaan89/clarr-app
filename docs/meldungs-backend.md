# Meldungs-Backend: submit-report (Paket 3)

## Grundsatz

Der Client schreibt **nie** direkt in `reports`. Migration 004 entzieht
`anon`/`authenticated` die INSERT/UPDATE/DELETE-Grants (die alten Policies aus
001 bleiben additiv stehen, laufen aber ins Leere). Einziger Schreibpfad ist
die Edge Function `submit-report` → RPC `submit_report_tx()` (SECURITY
DEFINER, nur Service-Role).

## Pruefkette in submit-report

1. **Auth-Pflicht** — JWT noetig, sonst 401.
2. **Nur `aktiv` wertbar** — `verification_level` muss `aktiv` sein
   (Mail bestaetigt + Regeln akzeptiert, siehe docs/auth.md), sonst 403
   `not_active`.
3. **Rate-Limit Konto+Geraet/IP** — `check_and_log_rate_limit()`:
   5 Einreichungen / 10 min, Sliding Window, atomar (Advisory-Lock).
   Gespeichert werden nur SHA-256-Hashes von Install-ID und IP, nie Rohdaten.
   Die Install-ID ist eine zufaellige App-lokale ID (keine Hardware-ID).
4. **Plausibilitaet** —
   * Mock-Location-Flag (Android): Meldung wird angenommen, aber
     `location_suspect = true` und `reputation_score -10`.
   * Geschwindigkeit seit letzter Meldung > 200 km/h: `location_suspect`,
     `reputation_score -5`.
   Suspekte Meldungen landen spaeter in der Review-Queue (Paket 8) statt
   sofort oeffentlich zu werden.
5. **Tagesquota** — `consume_report_quota()`: 10/Tag (konfigurierbar via
   `system_settings.report_daily_limit`), race-sicher als einzelnes
   bedingtes UPDATE (Row-Lock). Zaehlt jeden Versuch, auch wenn die
   KI-Pruefung spaeter scheitert.
6. **Globales Vision-Budget** — `vision_budget_status()` prueft
   `vision_usage` gegen `system_settings` (Kill-Switch, Tagesbudget global +
   pro Nutzer). In Paket 3 nur Vorpruefung (`vision_allowed` in der Antwort);
   hart durchgesetzt wird es in `analyze-photo` (Paket 4).

## Geo + Zeit serverseitig

* `created_at` = Server-`NOW()` (Spalten-Default, Insert passiert nur serverseitig).
* Koordinaten werden validiert (Wertebereiche); `geohash8` (~38 m Zelle)
  wird serverseitig berechnet (`geohash_encode()`, reines plpgsql).

## Cooldown / Buendelung (~30 m)

`submit_report_tx()` sucht den naechsten **offenen** Fall
(`gemeldet|geprueft|weitergeleitet`) im Umkreis von **40 m** (Haversine):

* Treffer → Meldung bekommt `case_id` des offenen Falls und
  `is_confirmation = true` — **kein neuer Fall**.
* Kein Treffer → neuer Fall mit Ort + Geohash.

Gleichzeitige Meldungen am selben Ort werden per
`pg_advisory_xact_lock` auf die Geohash-6-Zelle serialisiert — es kann keine
zwei parallel angelegten Faelle fuer denselben Ort geben.

## system_settings

Service-only Key-Value-Tabelle (RLS, keine Grants):
`vision_kill_switch`, `vision_global_daily_usd`, `vision_user_daily_usd`,
`vision_alert_threshold`, `report_daily_limit`.

## Client (ReportScreen)

Laedt Fotos hoch (noch Bucket `report-photos`; Paket 5 stellt auf
`originals`/`public-blurred` um) und ruft dann `submit-report` auf. Die
frueheren Client-Aufrufe von `check_and_increment_daily_reports`,
`verify-waste` und `award-credits` entfallen — alles serverseitig.
