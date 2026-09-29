# CLAR — Datenflüsse (Stand Paket 11)

MECHANIK-Dokumentation für die juristische Prüfung — keine Rechtstexte.
Alle Bewertungen (Rechtsgrundlage, AVV, Drittlandtransfer): JURISTISCH PRUEFEN.

## Übersicht

```
App (Expo)
 ├─ Supabase Auth        E-Mail + Passwort-Hash, email_confirmed_at
 ├─ Supabase DB          Meldungen (Geo+Zeit), Punkte, Consents, Flags, Audit
 ├─ Supabase Storage     originals (privat) / public-blurred (anonymisiert)
 ├─ Edge Functions       submit-report, analyze-photo, process-photo,
 │                       close-case, close-event-cases, export-my-data,
 │                       delete-account, authority-digest, confirm-case-done
 ├─ Anthropic API        Foto (verkleinert) zur Müll-/PII-Erkennung
 ├─ On-Device (TFLite)   Foto bleibt auf dem Gerät; nur Score + Modellversion
 │                       gehen mit der Meldung an submit-report. Modell wird
 │                       aus vision_models / Bucket ml-models geladen.
 ├─ training/ (lokal)    NICHT Teil der App: Betreiber-Rechner zieht per
 │                       Service-Role verpixelte Fotos MIT Einwilligung
 │                       (vision_training_export), kein Upload an Dritte
 ├─ Kartenanbieter       Google Maps (Android) / Apple Maps (iOS):
 │                       Kartenkacheln, implizit der angesehene Ausschnitt
 └─ E-Mail (Resend)      Behörden-Digest: anonymisierte Fallinfos

NICHT aktiv: Push. Die Spalten `user_profiles.push_token` /
`notify_case_closed` und die RPC `set_push_preferences` existieren, aber die
App hat kein `expo-notifications`, fordert keine Push-Berechtigung an und
setzt nie ein Token. Es fließt also nichts an Expo Push. Solange das so ist,
darf Push in Datenschutzerklärung und Store-Angaben NICHT auftauchen (Art. 13
DSGVO: keine Verarbeitung angeben, die nicht stattfindet). Wird Push gebaut,
sind beide Dokumente und `store-angaben.md` zuerst zu ergänzen.
```

## Datenkategorien je Empfänger

| Empfänger | Daten | Zweck | Hinweise |
|---|---|---|---|
| Supabase (Hosting) | E-Mail, Passwort-Hash, Meldungen (Lat/Lng, Zeit, Text), Fotos, Punkte, Consents, Gerät-/IP-HASHES (Rate-Limit), Audit | Betrieb der App | Auftragsverarbeiter [JURISTISCH PRUEFEN: Region/AVV] |
| Anthropic (Vision) | verkleinertes Foto, KEIN Name/Account-Bezug im Prompt | Müll-Klassifikation, Gesichter/Kennzeichen-Erkennung fürs Blurring | Nur serverseitig, Budget/Kill-Switch; [JURISTISCH PRUEFEN: AVV, Drittland] |
| Behörde (E-Mail-Digest) | Fall-Titel, Fallort, GEBLURRTES Foto, Erledigt-Link | Beseitigung | KEINE Melder-Daten, keine Originale |
| Google Maps (Android) / Apple Maps (iOS) | angesehener Kartenausschnitt | Kartendarstellung über `react-native-maps` | eigenständig Verantwortliche, Art. 6 (1) f DSGVO |
| Resend (Mail) | Behörden-Adresse, Digest-Inhalt | Digest-Versand | optional; ohne Key nur Protokoll |

## Speicherung & Löschung

- **Original-Fotos**: privater Bucket `originals`, nie öffentlich, Zugriff
  nur Eigentümer (RLS) bzw. kurzlebige Signed URLs (Export: 1 h). Bereits
  **vor dem Upload** werden EXIF-/GPS-Metadaten entfernt (`stripMetadata()`
  in `src/lib/api.ts` kodiert das Bild lokal neu) — es landet also auch im
  privaten Bucket kein Aufnahmeort und keine Geräte-Seriennummer.
- **Veröffentlichte Fotos**: nur anonymisierte Kopien in `public-blurred`
  (EXIF gestrippt, Gesichter/Kennzeichen pixeliert — fehlbar, darum
  Review-Gate davor).
- **Konto-Löschung** (`delete-account`): entfernt Storage-Objekte
  (Original + Derivate), dann `auth.users` → CASCADE löscht Profil,
  Meldungen, Fotos-Metadaten, Punkte, Consents, Flags, Anmeldungen.
  `vision_usage`/`audit_log` behalten inhaltslose Zeilen mit
  `user_id = NULL` (Kostendeckel/Audit-Trail).
- **Datenexport** (`export-my-data`): nur eigener Account (User-ID aus dem
  JWT, kein Fremdzugriff möglich).
- **Consents**: append-only-Journal (`consents`), jede Änderung neue Zeile
  mit Zeitstempel + Policy-Version → nachweisbar. Granular:
  `kamera`, `standort`, `behoerden_weitergabe`, `altersbestaetigung`
  (Migration 021) und `ki_training` (Migration 023, Opt-in, Widerruf löscht
  Trainingszeilen sofort). Die Policy-Version ist seit Migration 022 die echte
  Fassung aus `src/constants/legal.ts`, nicht mehr ein Platzhalter.
  Liefert `signUp()` wegen E-Mail-Bestätigung noch keine Session, wird die
  Altersbestätigung lokal vorgemerkt und beim ersten Login nachgetragen
  (`src/lib/consent.ts`).

- **Entscheidungs-Metadaten**: `reports.decision_reason` (stabiler Code),
  `decision_automated` und `decided_at` halten fest, warum und wie über eine
  Meldung entschieden wurde (Art. 17 DSA, Art. 22 DSGVO).

- **On-Device-Score** (Migration 023): `reports.ondevice_score` +
  `ondevice_model_version`, von `submit-report` nur übernommen, wenn die
  Version in `vision_models` veröffentlicht ist. Löschung mit der Meldung.
- **Trainingsdaten** (Migration 023): `vision_training_samples`, nur mit
  aktueller Einwilligung `ki_training` und nur für Meldungen nach der
  Einwilligung. Kein Client-Zugriff. Löschung: Widerruf (Trigger, sofort),
  Meldung/Konto (Kaskade), 24 Monate (`purge_expired_training_samples` via
  `storage-cleanup`), lokale Kopien per `training/sync_dataset.py` vor jedem
  Training. Im Datenexport enthalten.

## Was CLAR bewusst NICHT erhebt

Kein Klarname, kein Geburtsdatum, keine Werbe-/Hardware-IDs (nur zufällige
Install-ID, serverseitig gehasht), kein „Verursacher"-Feld, keine
Standort-Tracks (nur Punkt je Meldung).

## Offene juristische Punkte

Stand nach dem Legal-Audit 2026-09-23. Erledigte Punkte sind gestrichen.

1. ~~Datenschutzerklärung + Impressum (Screens sind Entwürfe)~~ — erledigt:
   `src/app/legal/*` enthält jetzt ausformulierte Texte, zusätzlich AGB,
   DSA-Kontaktstelle und Lizenzen.
2. Alters-/Einwilligungslogik Minderjährige (Art. 8 DSGVO): Selbstauskunft
   und Nachweis funktionieren, ein verifizierbares Alters-Gate gibt es
   bewusst nicht. JURISTISCH PRUEFEN.
3. Ob `behoerden_weitergabe`-Consent die Digest-Aufnahme technisch gaten
   muss (derzeit: Digest enthält keine personenbezogenen Daten; Consent
   wird erhoben und gespeichert, aber nicht als Filter durchgesetzt).
4. Anonymisierte Nachweiskopie der Consents nach Konto-Löschung.
5. Web-Löschroute und öffentliche Datenschutz-URL hosten (Betreiberaufgabe,
   `hosting-checkliste.md`, `FRAGEN.md`).
6. KI-Training mit Nutzerfotos (Datenschutzerklärung 8a): Einwilligung als
   Grundlage, Umgang mit trainierten Modellen nach Widerruf, AGPL-Lizenz von
   Ultralytics (`FRAGEN.md`).
