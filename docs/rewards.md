# Reward-Engine (Paket 6)

## Grundsaetze

* Punkte sind **rein kosmetisch** (Status/Impact) — nicht einloesbar.
* **Keine Streaks, keine Zufalls-Belohnungen** (Zielgruppe teils
  minderjaehrig; bewusst keine Sucht-Mechaniken).
* Buchung **nur serverseitig**: `points_ledger` hat keine Client-Grants,
  `award_points()` ist nur fuer die Service-Role ausfuehrbar, UPDATE/DELETE
  blockiert ein Trigger sogar fuer die Service-Role (append-only;
  Korrekturen = Gegenbuchung).
* `user_profiles.credits` bleibt unveraendert als Alt-Cache stehen; Quelle
  der Wahrheit ist das Ledger.

## Regeln (`award_points`)

| Anlass | kind | Punkte |
|---|---|---|
| Verifizierte Meldung (veroeffentlicht) | `report_verified` | 10 |
| Bestaetigung eines offenen Falls | `case_confirmed` | 3 |
| Fallabschluss mit Nachher-Foto (Paket 7) | `case_closed_after` | 25 |

* **Degressiv am selben Ort**: gleiche Buchungsart desselben Nutzers im
  selben Geohash-7 (~150 m) innerhalb von 30 Tagen halbiert sich pro
  Wiederholung (10 → 5 → 2 → 1 → 0).
* **Tagesdeckel**: max. 50 Pluspunkte pro Nutzer/Tag
  (`system_settings.points_daily_cap`), race-sicher (Advisory-Lock pro
  Nutzer), Teilbuchung bis zum Deckel.
* **Idempotent**: jede Buchung ist an einen eindeutigen `booking_key`
  gebunden (z. B. `report_verified:<report_id>`), abgesichert doppelt:
  Schnellpfad-Check + partieller Unique-Index (faengt Races ab).

## Verdrahtung

`apply_vision_result('ok')` vergibt beim Veroeffentlichen automatisch
`report_verified` bzw. `case_confirmed` (wenn die Meldung einen offenen Fall
bestaetigt). Suspekte Meldungen (`location_suspect`) gehen in die Review und
werden erst bei manueller Freigabe verbucht (Paket 8). `case_closed_after`
kommt mit der Fall-Statusmaschine (Paket 7).

## Saldo & Level

* `points_balance` (View, Migration 002): Summe des Ledgers.
* `points_level` (View): Level = `balance/100 + 1`, Namen
  Starter/Bronze (100)/Silber (250)/Gold (500).
* Beide Views laufen mit `security_invoker` — Clients sehen nur den eigenen
  Saldo (Ledger-RLS). RewardsScreen liest jetzt `points_level`.

## Tests

`supabase/tests/rewards.test.sql` (pgTAP, `supabase test db`):

1. **Client kann nicht buchen** — keine Table-/Function-Privilegien fuer
   anon/authenticated; UPDATE/DELETE am Ledger wirft (append-only-Trigger).
2. **Idempotenz** — gleicher `booking_key` bucht genau einmal.
3. **Tagesdeckel** — Tagessumme bleibt bei 50, weitere Buchung vergibt 0.
