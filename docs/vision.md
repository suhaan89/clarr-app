# Vision-Pipeline + Kill-Switch (Paket 4)

## Schluessel-Handling

`ANTHROPIC_API_KEY` existiert ausschliesslich als **Supabase Function Secret**
(`supabase secrets set ANTHROPIC_API_KEY=...`). Er steht nie im Client, nie im
Repo, und Fehler-Logs geben nur `error.message` aus, nie Request-Details.

## Aufrufkette

`submit-report` (alle Pruefungen, Paket 3) → Client erhaelt `report_id` →
`analyze-photo` mit dieser `report_id`. Die Funktion akzeptiert nur Reports,
die (a) dem Aufrufer gehoeren, (b) im Zustand `gemeldet` sind und (c) noch
kein KI-Ergebnis haben — solche Reports entstehen ausschliesslich ueber die
bestandene submit-report-Pruefung. Doppelaufrufe sind idempotent (409
`already_analyzed`).

## Doppelter Budgetdeckel, race-sicher

`reserve_vision_budget()` (Migration 005):

* **Ein** Advisory-Lock (`vision_budget`) serialisiert alle Reservierungen.
* Pessimistische Reservierung ($0.015) wird VOR dem API-Call als Zeile in
  `vision_usage` eingetragen und zaehlt sofort in beide Tagessummen —
  parallele Requests koennen den Deckel nicht durchbrechen.
* Deckel: `vision_user_daily_usd` (Default $0.50/Nutzer/Tag) und
  `vision_global_daily_usd` (Default $5.00/Tag) in `system_settings`.
* Nach dem Call ersetzt `finalize_vision_usage()` die Schaetzung durch echte
  Token-Kosten; bei API-Fehlern bleibt die Schaetzung pessimistisch stehen.

## KILL-SWITCH

`system_settings.vision_kill_switch = true` (nur Service-Role setzbar) stoppt
sofort alle Vision-Calls. Ebenso wirkt ein erschoepftes Globalbudget. In
beiden Faellen: **kein** API-Call, die Meldung geht **unklassifiziert in die
Review-Queue** (`status = in_pruefung`, `vision_skipped = true`) — die App
bleibt voll nutzbar.

**Alert ab 80 %**: Beim Ueberschreiten von `vision_alert_threshold` (0.8)
schreibt die Reservierung einmal pro Tag einen `vision_budget_alert` ins
`audit_log`. (Betreiber-Benachrichtigung z. B. per Log-Drain/Dashboard —
bewusst kein E-Mail-Versand aus der DB.)

## Bildverarbeitung

Das Bild wird vor dem API-Call serverseitig auf max. 1024 px verkleinert und
als JPEG (q75) re-encodiert (ImageScript) — senkt Kosten und entfernt
Metadaten aus dem API-Payload.

## Ergebnis-Routing (`apply_vision_result()`, zentral in SQL)

| Ergebnis | Wirkung |
|---|---|
| Gewalt/Nacktheit (`unsafeContent`) | `abgelehnt`, Audit-Eintrag, **nie oeffentlich**, keine Details in der API-Antwort |
| kein Muell | `abgelehnt` |
| Confidence < 0.6 | `in_pruefung` (Review-Queue) |
| ok, aber `location_suspect` | `in_pruefung` trotz guter KI-Bewertung |
| ok | `verification = ki_verifiziert`, `status = veroeffentlicht` |

Die alte Funktion `verify-waste` wird vom Client nicht mehr aufgerufen und
kann nach der Umstellung des DEV-Projekts geloescht werden (nicht Teil der
additiven Pakete).
