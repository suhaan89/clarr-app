# Vision-Pipeline + Kill-Switch (Paket 4)

## Anbieter und Schluessel

Welche KI das Foto sieht, entscheidet `supabase/functions/_shared/vision.ts`
ueber das Function Secret `VISION_PROVIDER`. `analyze-photo` und
`process-photo` nutzen denselben Anbieter.

| `VISION_PROVIDER` | Anbieter | Secrets | Kosten |
|---|---|---|---|
| `cloudflare` (Standard) | Cloudflare Workers AI, Modell `@cf/mistralai/mistral-small-3.1-24b-instruct` (Apache 2.0) | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, optional `CLOUDFLARE_VISION_MODEL` | keine, solange im Cloudflare-Konto keine Zahlungsart hinterlegt ist (10 000 Neurons pro Tag, Reset 00:00 UTC) |
| `anthropic` | Claude Sonnet 4.6 | `ANTHROPIC_API_KEY` | pro Aufruf, gedeckelt durch das Budget unten |
| `none` | keiner | keine | keine |

Ohne Anbieter, ohne dessen Secrets und bei jedem Fehler des Anbieters (auch
"Tageskontingent verbraucht") gilt dasselbe wie beim Kill-Switch: die Meldung
geht ungeprueft in die Review-Queue, das Foto bleibt privat.

Die Secrets existieren ausschliesslich als **Supabase Function Secrets**
(`supabase secrets set ...`). Sie stehen nie im Client, nie im Repo, und
Fehler-Logs geben nur `error.message` aus, nie Request-Details.

Der Anbieter steht in der Datenschutzerklaerung. Wer ihn wechselt, zieht die
Rechtstexte und `POLICY_VERSION` mit. Offene Punkte: `FRAGEN.md` Nr. 17.

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
* Pessimistische Reservierung (Anthropic: $0.015, Cloudflare: $0) wird VOR dem API-Call als Zeile in
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

## On-Device-Schicht (vor dem Upload, nur Hinweis)

Vor dieser Pipeline läuft seit Migration 023 ein eigenes, kleines Modell
direkt auf dem Handy (Details: `docs/vision-ondevice.md`). Es zeigt beim
Fotografieren einen Hinweis und fängt offensichtliche Fehlfotos ab, bevor sie
hochgeladen werden. Nutzer können **immer** trotzdem melden.

Für diese Pipeline heißt das:

* Aufrufkette: App → `submit-report` (speichert `ondevice_score` +
  `ondevice_model_version`, nur für veröffentlichte Modellversionen) → App →
  `analyze-photo`.
* `analyze-photo` bleibt die verbindliche Prüfung. Der Handy-Score ist
  manipulierbar und wirkt deshalb **nur verschärfend**: bei „ok“ und einem
  Score unter `system_settings.ondevice_disagree_below` geht die Meldung an
  einen Menschen. Kein Einfluss auf Ablehnung, Kosten oder Punkte. Standard:
  aus (`null`).
* Selbstprüf-Fragen unten, beantwortet für die On-Device-Schicht:
  (1) berät nur; (2) ja, teils Minderjährige, daher Training nur per
  Opt-in; (3) Foto bleibt auf dem Gerät, nur Score + Version gehen an
  Supabase; (4) nicht nötig, weil nichts entschieden wird; (5) Modell,
  Version und Score werden gespeichert; (6) Hinweiskarte im Melde-Flow +
  Datenschutzerklärung 8/8a; (7) DSFA ergänzt (R10, R11).

## Rechtlicher Kontext: DSGVO Art. 22 statt AI Act Art. 50 (Zukunfts-Checkliste)

Der EU AI Act Art. 50 wird fuer diese Pipeline oft faelschlich als
einschlaegig angenommen. Er passt hier NICHT:

* Art. 50 (1) betrifft Chatbots (Offenlegung, dass man mit einer KI
  interagiert) — `HelpChat` ist regelbasiert, keine KI, siehe
  `src/components/HelpChat.tsx`.
* Art. 50 (2)/(4) betreffen KI-generierte Inhalte (Deepfake-/synthetische-
  Medien-Kennzeichnung) — CLAR generiert keine Inhalte, die Vision-Pipeline
  klassifiziert nur.

Tatsaechlich einschlaegig sind stattdessen:

* **Art. 22 DSGVO** — automatisierte Einzelfallentscheidung: die Pipeline
  entscheidet ohne menschliches Zutun ueber Sichtbarkeit (`veroeffentlicht`
  vs. `abgelehnt`), sobald `apply_vision_result()` den Outcome `ok`,
  `not_waste` oder `unsafe` verbucht.
* **Art. 17 DSA** — Begruendungspflicht bei Plattform-Entscheidungen
  (Ablehnung/Sichtbarkeitseinschraenkung) inkl. Hinweis auf den Einsatz
  automatisierter Mittel.

Das gilt nicht nur fuer diese Pipeline, sondern fuer JEDES kuenftige
Feature, bei dem ein KI-Output automatisch ueber Sichtbarkeit, Sperrung,
Punkte oder sonstige Vorteile entscheidet (nicht nur beraet). Vor dem Bau
eines solchen Features:

**Selbstpruef-Fragen**

1. Entscheidet das Feature, oder beraet es nur (wie `src/lib/vision`, das
   nie blockiert)? Nur Ersteres loest Art. 22/Art. 17 aus.
2. Sind Minderjaehrige betroffen (CLARs Zielgruppe ist es teils)?
3. Welche Daten verlassen das Geraet, an wen, in welches Land?
4. Gibt es einen menschlichen Ueberpruefungs-/Widerspruchsweg (Art. 22 (3))?
5. Ist die Entscheidung nachvollziehbar (Modell, Version, Konfidenz,
   Zeitstempel gespeichert — siehe offene TODOs in
   `docs/legal/datenschutzerklaerung.md`, Abschnitt 11)?
6. Ist die KI-Beteiligung auf den ersten Blick erkennbar (kein verstecktes
   Kleingedrucktes)?
7. Wird eine Datenschutz-Folgenabschaetzung (DSFA, Art. 35 DSGVO) noetig
   (automatisierte Entscheidung mit rechtlicher/aehnlich erheblicher
   Wirkung + teils minderjaehrige Betroffene sprechen dafuer)?
