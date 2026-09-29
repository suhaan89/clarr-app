# Trust & Safety (Paket 8)

## Grundsaetze

* **CLAR meldet Muell, nie Personen.** Es gibt kein „Verursacher"-Feld —
  und es wurde bewusst keines ergaenzt.
* **Fail-safe**: Ein Flag nimmt eine oeffentliche Meldung SOFORT aus der
  Sichtbarkeit — Review passiert danach, nicht davor.
* **Privatgrund-/Wohnkontext-Meldungen werden nie oeffentlich.**

## Flag-Button (fail-safe)

Nutzer legen Flags ueber die bestehende Policy `flags_insert_own` an
(`moderation_flags`, nur eigene). Der Trigger `moderation_flags_fail_safe`:

1. setzt eine veroeffentlichte Meldung sofort auf `in_pruefung`
   (= unsichtbar, siehe Sichtbarkeits-Policy unten),
2. sperrt bei Foto-Flags zusaetzlich das Foto (`approved = FALSE`),
3. erzeugt einen `review_queue`-Eintrag (`geflaggt` bzw. `privatgrund`),
4. schreibt einen `audit_log`-Eintrag.

**Hinweis Client:** Der Flag-Button in der App-UI fehlt noch (HomeScreen hat
keine Report-Detailansicht) — Backend ist fertig, siehe NOTIZEN.md.

## Sichtbarkeit (Sicherheitsfix)

Die Altlast-Policy `reports_select_all` (SELECT true, Migration 001) wurde
ersetzt durch: sichtbar sind **veroeffentlichte** Meldungen, **eigene**
Meldungen und alles fuer **Moderatoren**. Ohne diese Verengung waere
„sofort unsichtbar" technisch unmoeglich gewesen. (Einzige nicht rein
additive Aenderung; seit Chunk 01 als offener Punkt dokumentiert.)

## Review-Queue — nur fuer diese Faelle

| Grund | Quelle |
|---|---|
| `geflaggt` | Flag-Button (Trigger) |
| `confidence` | KI-Confidence < 0.6 (analyze-photo), optional auch Widerspruch On-Device-Score vs. KI |
| `stichprobe` | ~5 % Zufalls-QA veroeffentlichter Meldungen (bleiben oeffentlich) |
| `privatgrund` | Privatgrund-/Wohnkontext-Verdacht (KI oder Flag) |
| `unklassifiziert` | Vision uebersprungen (Budget/Kill-Switch) |
| `personen_im_bild` | Foto-Pipeline hat Personen/Kennzeichen erkannt |
| `standort_suspekt` | Mock-Location/Speed-Verdacht |

Doppelte offene Eintraege pro Meldung+Grund verhindert ein partieller
Unique-Index.

## On-Device-Vorpruefung (Migration 023)

* Ein eigenes Modell auf dem Handy gibt vor dem Absenden einen Hinweis
  („Wir erkennen hier keinen Muell, trotzdem melden?“). Es **blockiert nie**
  und vergibt **nie** Punkte. Details: `docs/vision-ondevice.md`.
* **Nicht vertrauen:** Der Score kommt vom Client. Serverseitig darf er eine
  Meldung nur zusaetzlich in die Review-Queue schieben (Grund `confidence`,
  Audit `ondevice_disagreement`), und das nur, wenn
  `system_settings.ondevice_disagree_below` gesetzt ist. Ein gefaelschter
  hoher Score bewirkt nichts; ein gefaelschter niedriger schadet nur dem
  Absender (Review statt Sofort-Veroeffentlichung).
* **Transparenz fuer Nutzer:** Die staendig sichtbare Karte „Automatische
  Foto-Pruefung“ im Melde-Flow erklaert KI-Pruefung auf dem Server UND die
  Vorab-Erkennung auf dem Handy samt gespeichertem Score; Datenschutz-
  erklaerung Abschnitt 8 und 8a.
* **Fernschalter:** `vision_models.status = 'zurueckgezogen'` schaltet die
  Vorpruefung auf allen Geraeten beim naechsten Check ab.

## Trainingsdaten aus der Review-Queue

* Die Entscheidungen der Review-Queue sind die Labels fuer das naechste
  Modell (`vision_training_samples`). Menschliche Entscheidung schlaegt KI;
  eine Ablehnung ohne ausdrueckliches Label bleibt ungelabelt, weil
  „abgelehnt“ auch Duplikat o. Ae. heissen kann.
* Moderatoren koennen per `set_training_label(report_id, 'positiv'|'negativ'|NULL)`
  ein Label ausdruecklich setzen (auditiert).
* Nur mit Opt-in `ki_training`; Privatgrund, `privat` und unzulaessige
  Inhalte landen **nie** im Trainingsdatensatz.

## Moderation (rollen-geschuetzt + auditiert)

* Rolle `moderator` in `user_profiles.role` — vergibt nur die Service-Role
  (user_profiles ist fuer Clients read-only).
* `is_moderator()` (SECURITY DEFINER) traegt die RLS-Policies:
  Moderatoren sehen Queue, alle Flags und alle Meldungen.
* `moderate_report(report_id, decision)`:
  * `freigeben` → `veroeffentlicht`, `moderator_verifiziert`, Punkte
    (idempotent — nie doppelt zur KI-Buchung)
  * `ablehnen` → `abgelehnt`
  * `privat` → neuer Status `privat`: Meldung ist gueltig (Punkte ja),
    bleibt aber dauerhaft nicht-oeffentlich
  * loest offene Queue-Eintraege + Flags, schreibt `audit_log`.
* `approve_photo(photo_id, approve)` — Sichtfreigabe gepixelter Fotos
  (Pruefschritt der Foto-Pipeline), ebenfalls nur Moderator + Audit.

Ein Moderations-Frontend gibt es noch nicht; die RPCs sind aus jedem
Supabase-Client nutzbar (z. B. Dashboard/SQL oder spaeterer Admin-Screen).
