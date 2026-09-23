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
 ├─ Expo Push (Opt-in)   Push-Token, Abschluss-Benachrichtigung
 └─ E-Mail (Resend)      Behörden-Digest: anonymisierte Fallinfos
```

## Datenkategorien je Empfänger

| Empfänger | Daten | Zweck | Hinweise |
|---|---|---|---|
| Supabase (Hosting) | E-Mail, Passwort-Hash, Meldungen (Lat/Lng, Zeit, Text), Fotos, Punkte, Consents, Gerät-/IP-HASHES (Rate-Limit), Audit | Betrieb der App | Auftragsverarbeiter [JURISTISCH PRUEFEN: Region/AVV] |
| Anthropic (Vision) | verkleinertes Foto, KEIN Name/Account-Bezug im Prompt | Müll-Klassifikation, Gesichter/Kennzeichen-Erkennung fürs Blurring | Nur serverseitig, Budget/Kill-Switch; [JURISTISCH PRUEFEN: AVV, Drittland] |
| Behörde (E-Mail-Digest) | Fall-Titel, Fallort, GEBLURRTES Foto, Erledigt-Link | Beseitigung | KEINE Melder-Daten, keine Originale |
| Expo Push | Push-Token, Benachrichtigungstext | Abschluss-Info (Opt-in) | Token löschbar via RPC |
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
  `kamera`, `standort`, `behoerden_weitergabe`.

## Was CLAR bewusst NICHT erhebt

Kein Klarname, kein Geburtsdatum, keine Werbe-/Hardware-IDs (nur zufällige
Install-ID, serverseitig gehasht), kein „Verursacher"-Feld, keine
Standort-Tracks (nur Punkt je Meldung).

## Offene juristische Punkte (Platzhalter im Produkt)

1. Datenschutzerklärung + Impressum (Screens sind Entwürfe).
2. Alters-/Einwilligungslogik Minderjährige (Art. 8 DSGVO).
3. Ob `behoerden_weitergabe`-Consent die Digest-Aufnahme technisch gaten
   muss (derzeit: Digest enthält keine personenbezogenen Daten; Consent
   wird erhoben und gespeichert, aber nicht als Filter durchgesetzt).
4. Anonymisierte Nachweiskopie der Consents nach Konto-Löschung.
