<!--
  Verzeichnis von Verarbeitungstätigkeiten nach Art. 30 DSGVO.
  Erstellt im Legal-Audit 2026-09-23 aus dem verifizierten Code-Stand.

  [ANWALT PRÜFEN] Ob die Ausnahme nach Art. 30 (5) DSGVO greift (weniger als
  250 Beschäftigte). Sie greift NICHT, wenn die Verarbeitung nicht nur
  gelegentlich erfolgt — und CLAR verarbeitet dauerhaft und systematisch.
  Das Verzeichnis ist deshalb Pflicht und hier geführt.
-->

# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)

**Stand:** 23.09.2026 · **Verantwortlicher:** siehe `impressum.md`
**Datenschutzbeauftragte:r:** [BETREIBER EINTRAGEN, falls benannt oder nach
§ 38 BDSG erforderlich]

## V1 Kontoverwaltung

- **Zweck:** Anmeldung, Zuordnung von Meldungen, Schutz vor Missbrauch.
- **Betroffene:** registrierte Nutzerinnen und Nutzer, teils minderjährig.
- **Datenkategorien:** E-Mail-Adresse, Passwort-Hash, Bestätigungsstatus,
  Pseudonym (optional), Rolle, Zeitpunkte.
- **Empfänger:** Supabase (Auftragsverarbeiter).
- **Drittland:** abhängig von der Supabase-Region, [BETREIBER EINTRAGEN].
- **Löschfrist:** mit der Kontolöschung.
- **Rechtsgrundlage:** Art. 6 (1) b DSGVO.
- **TOM:** TLS, Passwort-Hashing durch Supabase Auth, Row Level Security,
  verschlüsselte Sitzung auf dem Gerät.

## V2 Müllmeldungen und öffentliche Karte

- **Zweck:** Dokumentation von Fundstellen, öffentliche Karte,
  Weitergabe an die zuständige Stelle.
- **Betroffene:** meldende Personen; mittelbar Dritte, die zufällig auf einem
  Foto zu sehen sind.
- **Datenkategorien:** Koordinaten, Zeitpunkt, Beschreibung, Abfallart,
  Status, Fotos (Original privat, anonymisierte Kopie öffentlich).
- **Empfänger:** Supabase, Anthropic (nur Bild), zuständige Stelle (nur
  anonymisiert), Resend, Kartenanbieter.
- **Drittland:** Anthropic (USA), Grundlage siehe `datenschutzerklaerung.md`
  Abschnitt 6.
- **Löschfrist:** mit der Kontolöschung.
- **Rechtsgrundlage:** Art. 6 (1) b und f DSGVO.
- **TOM:** privater Bucket für Originale, EXIF-Entfernung vor dem Upload und
  erneut serverseitig, Verpixelung von Gesichtern und Kennzeichen,
  menschliche Freigabe bei erkannten Personen, gerundete öffentliche Position.

## V3 Automatisierte Foto-Prüfung

- **Zweck:** Erkennung von Müll, unzulässigen Inhalten, Privatkontext und von
  Gesichtern und Kennzeichen zwecks Anonymisierung.
- **Betroffene:** meldende Personen; abgebildete Dritte.
- **Datenkategorien:** verkleinertes Bild, Ergebnis (Konfidenz, Abfallart,
  Grund-Code), Kosten- und Modellprotokoll.
- **Empfänger:** Anthropic (Auftragsverarbeiter).
- **Drittland:** USA.
- **Löschfrist:** Ergebnis mit dem Report; Kostenprotokoll bis 24 Monate, nach
  Kontolöschung ohne Personenbezug.
- **Rechtsgrundlage:** Art. 6 (1) b DSGVO, Art. 22 (2) DSGVO
  [ANWALT PRÜFEN: welcher Buchstabe].
- **TOM:** kein Nutzerbezug im Prompt, Budget- und Kostendeckel,
  Kill-Switch, Fail-safe (ohne Ergebnis keine Veröffentlichung).

## V4 Moderation und Inhaltsmeldungen

- **Zweck:** Umsetzung der Pflichten aus dem Digital Services Act.
- **Betroffene:** meldende Personen, beanstandete Personen.
- **Datenkategorien:** Grund, Notiz, Zeitpunkt, Entscheidung, prüfende Person.
- **Empfänger:** Supabase.
- **Löschfrist:** mit der Kontolöschung; Entscheidungsprotokoll im
  `audit_log` ohne Personenbezug.
- **Rechtsgrundlage:** Art. 6 (1) c DSGVO iVm Verordnung (EU) 2022/2065.

## V5 Missbrauchsschutz

- **Zweck:** Begrenzung von Spam und automatisierten Massenmeldungen.
- **Datenkategorien:** SHA-256-Prüfsummen von Install-ID und IP-Adresse,
  Aktion, Zeitpunkt.
- **Löschfrist:** 30 Tage.
- **Rechtsgrundlage:** Art. 6 (1) f DSGVO.
- **TOM:** nur Hashes, nie Klartext; keine Client-Leserechte.

## V6 Punkte und Abzeichen

- **Zweck:** kosmetisches Feedback.
- **Datenkategorien:** Buchungen mit Grund und Zeitpunkt, Saldo, Level.
- **Löschfrist:** mit der Kontolöschung.
- **Rechtsgrundlage:** Art. 6 (1) b DSGVO.
- **Besonderheit:** kein Geldwert, keine Verlosung, keine Streaks.

## V7 Einwilligungsjournal

- **Zweck:** Nachweis erteilter und widerrufener Einwilligungen.
- **Datenkategorien:** Schlüssel, Wert, Zeitpunkt, Fassung der Erklärung.
- **Löschfrist:** mit der Kontolöschung.
  [ANWALT PRÜFEN] Ob eine anonymisierte Nachweiskopie über die Löschung
  hinaus zulässig oder geboten ist.
- **Rechtsgrundlage:** Art. 7 (1), Art. 5 (2) DSGVO.

## V8 Behörden-Digest

- **Zweck:** Weitergabe geprüfter Fälle an die zuständige Stelle.
- **Datenkategorien:** Falltitel, exakte Koordinaten des Fundorts,
  anonymisiertes Foto, Einmal-Link. **Keine** Daten der meldenden Person.
- **Empfänger:** zuständige Stelle, Resend.
- **Löschfrist:** Einmal-Link 30 Tage; Versandprotokoll dauerhaft ohne
  Personenbezug.
- **Rechtsgrundlage:** Art. 6 (1) f DSGVO.
