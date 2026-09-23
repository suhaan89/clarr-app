<!--
  ============================================================
  ENTWURF — JURISTISCH PRÜFEN — NICHT OHNE ANWALTLICHE/DATENSCHUTZ-
  RECHTLICHE PRÜFUNG VERÖFFENTLICHEN.
  ============================================================
  Dies ist ein hostbares Dokument (nicht der In-App-Screen). Beide Stores
  verlangen eine ÖFFENTLICH erreichbare Datenschutz-URL — diese Datei ist die
  Vorlage dafür. Sie basiert auf docs/legal/data-flows.md (der geprüften
  Mechanik) und ist BEWUSST als Entwurf formuliert. Alle [PLATZHALTER] muss
  der Betreiber füllen; alle Rechtsgrundlagen/AVV/Drittland-Aussagen muss eine
  fachkundige Person (Datenschutzbeauftragte:r / Anwalt) prüfen.

  Sonderkontext (ERHÖHTES RISIKO):
   - Zielgruppe ist TEILWEISE MINDERJÄHRIG (Art. 8 DSGVO, KJM, ggf. COPPA).
   - Betreiber sind mutmaßlich selbst minderjährig — KEINE private Wohnadresse
     ohne Beratung veröffentlichen (siehe impressum.md).
  ============================================================
-->

# Datenschutzerklärung – CLAR

**Stand:** [DATUM EINSETZEN] · **Version:** 1.0 (Entwurf)

> ⚠️ **ENTWURF – JURISTISCH PRÜFEN.** Dieser Text ist noch keine
> rechtsverbindliche Datenschutzerklärung.

## 1. Verantwortlicher

Verantwortlich für die Datenverarbeitung im Sinne der DSGVO ist:

- **Anbieter:** [NAME/ORGANISATION – JURISTISCH PRÜFEN]
- **Anschrift:** [LADUNGSFÄHIGE ANSCHRIFT – JURISTISCH PRÜFEN; bei
  minderjährigen Betreibern Alternative prüfen, z. B. Trägerverein/Schule/
  c-o-Adresse]
- **Kontakt Datenschutz:** [E-MAIL – JURISTISCH PRÜFEN]
- **Datenschutzbeauftragte:r:** [falls benannt/erforderlich – JURISTISCH PRÜFEN]

## 2. Grundprinzip: Datenminimierung

CLAR meldet **Müll, keine Personen**. Wir erheben bewusst so wenig wie möglich:
**kein Klarname, kein Geburtsdatum, keine Werbe- oder Hardware-IDs, keine
Standort-Bewegungsprofile.** Es gibt kein „Verursacher"-Feld.

## 3. Welche Daten wir verarbeiten und warum

| Datenkategorie | Zweck | Rechtsgrundlage (JURISTISCH PRÜFEN) |
|---|---|---|
| E-Mail-Adresse, Passwort-Hash, E-Mail-Bestätigungsstatus | Konto/Login, Verifikation | Art. 6 (1) b DSGVO (Vertrag) |
| Meldungen: Standort (Lat/Lng), Zeitpunkt, Beschreibung, Abfallart | Kernfunktion (Müllkarte) | Art. 6 (1) b DSGVO |
| Fotos: Original (privat) + anonymisierte, geblurrte Kopie (öffentlich) | Beleg der Meldung; öffentlich nur anonymisiert | Art. 6 (1) b / (1) f DSGVO |
| Punkte-/Level-Historie | spielerisches Feedback (kosmetisch) | Art. 6 (1) b DSGVO |
| Einwilligungen (Journal: Kamera, Standort, Behörden-Weitergabe, Altersbestätigung) | Nachweis erteilter Einwilligungen | Art. 6 (1) c / Art. 7 DSGVO |
| Geräte-/IP-**Hashes** (SHA-256, nie im Klartext) | Missbrauchs-/Spam-Schutz (Rate-Limit) | Art. 6 (1) f DSGVO (berechtigtes Interesse) |
| Push-Token (nur bei Opt-in) | Benachrichtigung bei Fallabschluss | Art. 6 (1) a DSGVO (Einwilligung) |
| Audit-/Kostenzähler-Zeilen (nach Löschung ohne Personenbezug) | Sicherheit, Kostenkontrolle | Art. 6 (1) f DSGVO |

## 4. Empfänger / Auftragsverarbeiter

Wir setzen folgende Dienstleister ein. Für jeden ist ein Auftrags-
verarbeitungsvertrag (AVV, Art. 28 DSGVO) und – bei Drittlandbezug – eine
Transfergrundlage (z. B. Standardvertragsklauseln) erforderlich. **[Region,
AVV-Status und Drittlandtransfer je Dienst: JURISTISCH PRÜFEN.]**

| Empfänger | Übermittelte Daten | Zweck |
|---|---|---|
| **Supabase** (Hosting, Datenbank, Auth, Storage) | alle o. g. Konto-/Meldungsdaten | Betrieb der App |
| **Anthropic** (KI-Foto-Prüfung) | nur verkleinertes Foto, **kein** Name/Account-Bezug | Müll-Klassifikation + Erkennung von Gesichtern/Kennzeichen fürs Blurring |
| **Behörde** (E-Mail-Digest) | Fall-Titel, Fallort, **geblurrtes** Foto, Erledigt-Link – **keine** Melder-Daten | Beseitigung des Mülls |
| **Resend** (E-Mail-Versand) | Behörden-Adresse, Digest-Inhalt | Versand des Behörden-Digests |
| **Expo Push** (nur bei Opt-in) | Push-Token, Benachrichtigungstext | Abschluss-Benachrichtigung |

Es findet **kein Verkauf** von Daten und **keine Werbung** statt.

## 5. Öffentlich sichtbare Inhalte

Veröffentlichte Meldungen erscheinen auf einer öffentlichen Karte. Dabei:

- werden **nur anonymisierte, geblurrte** Fotos gezeigt (EXIF/GPS entfernt,
  Gesichter/Kennzeichen pixeliert; ein Review-Schritt geht der Veröffentlichung
  voraus),
- werden Kartenkoordinaten **gerundet** (Geohash-8-Zelle, ~20–40 m) angezeigt,
  nicht die exakte Position,
- werden Meldungen aus Privatgrund-/Wohnkontext **nie** öffentlich gestellt,
- ist **kein** Melder-Name oder -Konto sichtbar.

## 6. Speicherdauer & Löschung

- **Original-Fotos** liegen in einem privaten Speicher (`originals`), nie
  öffentlich, Zugriff nur durch die/den Eigentümer:in.
- **Konto-Löschung** (in der App unter *Profil → Konto löschen* sowie über die
  Web-Löschseite, siehe Abschnitt 9) entfernt Speicher-Objekte (Original +
  Kopien) und anschließend das Konto; per Datenbank-Kaskade werden Profil,
  Meldungen, Foto-Metadaten, Punkte, Einwilligungen, Flags und Anmeldungen
  gelöscht. Reine Kostenzähler-/Audit-Zeilen bleiben **ohne Personenbezug**
  (`user_id = NULL`) erhalten.
- **[Konkrete Aufbewahrungsfristen** je Kategorie – JURISTISCH PRÜFEN.]

## 7. Ihre Rechte

Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung
(Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und
Widerspruch (Art. 21) sowie das Recht, erteilte Einwilligungen jederzeit zu
widerrufen (Art. 7 (3)).

- **Auskunft/Export:** *Profil → Meine Daten exportieren* (JSON).
- **Löschung:** *Profil → Konto löschen* bzw. Web-Löschseite (Abschnitt 9).
- **Widerruf:** *Profil → Datenschutz-Einstellungen*.
- **Beschwerderecht** bei einer Aufsichtsbehörde: [ZUSTÄNDIGE AUFSICHTSBEHÖRDE
  EINSETZEN – JURISTISCH PRÜFEN].

## 8. Minderjährige (Art. 8 DSGVO)

CLAR richtet sich auch an junge Menschen. Bei der Registrierung ist eine
Selbstauskunft „Ich bin 16 Jahre oder älter" erforderlich; der Zeitpunkt wird
als Einwilligungs-Nachweis gespeichert (kein Geburtsdatum).

> ⚠️ **JURISTISCH PRÜFEN (kritisch):** Altersgrenze (16 als Annahme für DE nach
> Art. 8 DSGVO), Notwendigkeit und Ausgestaltung einer **elterlichen
> Einwilligung** unter der Altersgrenze, Vorgaben der KJM/des JMStV sowie – bei
> Verfügbarkeit in den USA – **COPPA** (< 13 Jahre). Die aktuelle Fassung
> setzt **keine** serverseitige Sperre unter 16 durch (nur Hinweistext). Ob das
> ausreicht bzw. wie ein Alters-Gate auszugestalten ist, muss vor Release
> geklärt werden (siehe docs/legal/minderjaehrige-und-loeschung.md).

## 9. Web-Löschseite (Google-Play-Anforderung)

Unabhängig von der In-App-Löschung stellen wir eine öffentlich erreichbare
Möglichkeit zur Kontolöschung bereit unter: **[LÖSCH-URL EINSETZEN]**. Dort
können Sie die Löschung Ihres Kontos und der zugehörigen Daten beantragen bzw.
durchführen. [Ausgestaltung – JURISTISCH/TECHNISCH PRÜFEN, siehe
hosting-checkliste.md.]

## 10. Änderungen dieser Erklärung

Wir passen diese Erklärung an, wenn sich die Verarbeitung ändert. Die jeweils
aktuelle Version ist unter [DATENSCHUTZ-URL] abrufbar.

<!-- Entwurf, juristisch nicht geprüft, Stand 2026-08-14 -->

## 11. Automatisierte Entscheidungen bei der Foto-Prüfung

Fotos zu gemeldetem Müll werden serverseitig automatisiert geprüft
(Auftragsverarbeiter: **Anthropic**, siehe Abschnitt 4). Diese Prüfung
entscheidet in vielen Fällen unmittelbar über die Sichtbarkeit deiner
Meldung – das ist eine automatisierte Entscheidung im Sinne von Art. 22
DSGVO.

**Grundlogik:** Ein KI-Modell bewertet das Foto (Müll ja/nein, Sicherheit,
Hinweise auf Privatgrund-/Wohnkontext) und gibt eine Konfidenz (Sicherheit
der Einschätzung) aus. Bei niedriger Konfidenz oder Verdacht auf
Privatgrund geht die Meldung automatisch in eine manuelle Prüfung durch
unser Team, statt automatisch veröffentlicht oder abgelehnt zu werden.

**Auswirkung:** Je nach Ergebnis wird deine Meldung automatisch
veröffentlicht, automatisch abgelehnt oder zur menschlichen Prüfung
vorgemerkt.

**Menschliche Überprüfung & Widerspruch (Art. 22 (3) DSGVO):** Du kannst bei
jeder automatisierten Entscheidung eine menschliche Überprüfung anfordern
und Widerspruch einlegen – kostenlos und ohne Nachteile für dich. In der
App: Fallansicht → „Überprüfung anfordern" (siehe auch Abschnitt 7, „Ihre
Rechte").

> ⚠️ **TODO(legal):** Rechtsgrundlage der automatisierten Entscheidung (Art.
> 22 (2) DSGVO – welcher Buchstabe greift: Vertrag, ausdrückliche
> Einwilligung oder gesetzliche Erlaubnis?); Drittlandübermittlung an
> Anthropic (Serverstandort, Standardvertragsklauseln?); konkrete
> Speicherdauer des Prüfergebnisses (Konfidenzwert, Modellname/-version,
> Zeitstempel – aktuell nicht durchgehend gespeichert, siehe
> docs/vision.md); Umgang mit erkennbaren Dritten im Bild (Gesichter,
> Kennzeichen) – Blurring-Zeitpunkt und -Zuverlässigkeit; ob EXIF-/GPS-Daten
> auch in der öffentlich sichtbaren (geblurrten) Foto-Kopie entfernt werden
> (die an Anthropic gesendete Kopie wird laut docs/vision.md serverseitig
> neu kodiert, was Metadaten bereits entfernt – für die öffentliche Kopie
> ist das hier nicht verifiziert); ob aus der öffentlichen (gerundeten)
> Kartenposition auf die meldende Person rückgeschlossen werden kann;
> Kontaktweg für Rückfragen zu automatisierten Entscheidungen.
