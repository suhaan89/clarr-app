# Offene Fragen / bewusst gestoppte Fixes

Hier stehen Änderungen, die ich NICHT blind umgesetzt habe, weil sie eine
funktionierende Funktion ernsthaft gefährden könnten und eine Entscheidung
bzw. einen Test am Gerät brauchen (siehe AGENTS-Regel).

## 1. Auth-Token in SecureStore statt AsyncStorage (Security-Review Runde 2, F-Token)

**Fund:** `src/lib/supabase.ts` speichert die Supabase-Session (u. a. das
Refresh-Token) über `AsyncStorage`. AsyncStorage ist **unverschlüsselt**
(App-privater Klartext-Speicher). Auf gerooteten/jailbroken Geräten oder über
Geräte-Backups kann das Token ausgelesen werden. Für eine App mit teils
minderjähriger Zielgruppe und sensiblen Daten ist verschlüsselte Ablage
(Keychain/Keystore via `expo-secure-store`) die empfohlene Härtung.

**Warum gestoppt statt umgesetzt:**
- Ein fehlerhafter Storage-Adapter loggt beim nächsten Start ALLE Nutzer aus
  bzw. verliert die Session — ein stiller, breit wirkender Funktionsbruch.
- `expo-secure-store` hat ein 2048-Byte-Limit pro Wert; Supabase-Sessions sind
  größer → es braucht einen **chunkenden** Adapter. Den kann ich hier nicht
  am Gerät verifizieren (kein iOS/Android-Build in dieser Umgebung).
- `expo-secure-store` ist ein natives Modul → Dev-Build nötig (ist vorhanden),
  aber Migration bestehender Sessions (AsyncStorage → SecureStore) muss getestet
  werden, damit eingeloggte Nutzer nicht rausfliegen.

**Vorgeschlagene Umsetzung (nach Geräte-Test aktivieren):**
1. `npx expo install expo-secure-store`
2. Chunkenden Adapter bauen (Wert in ~2000-Byte-Stücke splitten, Schlüssel
   `sb-session-0`, `sb-session-1`, …; beim Lesen zusammensetzen).
3. In `createClient(..., { auth: { storage: secureAdapter, ... } })` einsetzen.
4. Einmalige Migration: beim ersten Start vorhandene AsyncStorage-Session lesen,
   in SecureStore schreiben, AsyncStorage-Schlüssel löschen — auf echtem Gerät
   testen (frisch eingeloggt + Update-Fall).

**Bis dahin akzeptiertes Restrisiko:** dokumentiert in
`docs/security-review.md` (Runde 2). App-Sandbox schützt auf nicht-gerooteten
Geräten; das Restrisiko betrifft gerootete Geräte / unverschlüsselte Backups.

**JURISTISCH/EXTERN PRÜFEN:** ob für die Zielgruppe (teils minderjährig) die
verschlüsselte Token-Ablage verpflichtend einzustufen ist.

---

# Offene Fragen aus dem Legal-Compliance-Audit (2026-09-23)

Diese Fragen lassen sich aus dem Repo nicht beantworten. Sie sind NICHT
geraten worden. Alles Uebrige aus dem Audit ist umgesetzt; der Bericht steht
in `docs/legal/audit-2026-09-23.md`.

## 2. Wer ist der Verantwortliche, und unter welcher Anschrift?

Impressum (§ 5 DDG) und Datenschutzerklaerung (Art. 13 (1) a DSGVO) brauchen
Name und ladungsfaehige Anschrift. Die Screens und Dokumente sind fertig
gebaut; die Felder sind als `[BETREIBER EINTRAGEN]` markiert.

**Besonderheit:** Ist der Betreiber selbst minderjaehrig, sollte keine private
Wohnanschrift veroeffentlicht werden. Ueblich sind ein Traegerverein, die
Schule oder ein Dienstleister mit ladungsfaehiger Adresse. Das ist zugleich
eine Frage der Geschaeftsfaehigkeit: ein Nutzungsvertrag mit beschraenkt
Geschaeftsfaehigen als Anbieter ist eigenstaendig zu pruefen.

**Gebraucht werden:** Name, Anschrift, vertretungsberechtigte Person,
allgemeine Kontaktadresse, Datenschutz-Adresse, Sicherheits-Adresse,
Melde-Adresse fuer Inhalte, Behoerden-Kontaktadresse.

## 3. Gibt es unterschriebene AV-Vertraege?

Fuer Supabase, Anthropic und Resend ist je ein Vertrag nach Art. 28 DSGVO
noetig. Ob sie abgeschlossen sind, steht nirgends im Repo. Ohne sie ist jede
Uebermittlung an diese Dienste ohne Rechtsgrundlage.

## 4. In welcher Region laeuft Supabase?

Entscheidet, ob ueberhaupt ein Drittlandtransfer vorliegt. Bei einer
EU-Region entfaellt fuer Supabase die Transferfrage weitgehend; bei einer
US-Region braucht es eine Grundlage. Die Angabe steht in `supabase/.temp/`
nicht und ist im Dashboard nachzusehen.

## 5. Gilt bei Anthropic Zero Data Retention?

Relevant fuer die Speicherdauer-Angabe in der Datenschutzerklaerung: wie
lange liegt das uebermittelte Foto beim Auftragsverarbeiter? Ohne Zusage ist
von der Standardaufbewahrung auszugehen, und die gehoert dann in Abschnitt 9.

## 6. Wird CLAR kommerziell betrieben?

Haengt an mehreren Stellen:

* **Cyber Resilience Act:** greift nur bei Bereitstellung im Rahmen einer
  Geschaeftstaetigkeit.
* **DSA Art. 19:** die Ausnahme von Art. 20 bis 28 gilt fuer Kleinst- und
  Kleinunternehmen. Ein nicht kommerzielles Projekt faellt ohnehin anders.
* **BFSG:** Kleinstunternehmerausnahme, siehe `bfsg-einordnung.md`.
* **§ 5 DDG:** die Anbieterkennzeichnung trifft geschaeftsmaessige Angebote.
* **KI-Verordnung Art. 3 Nr. 4:** Betreiberpflichten gelten bei Nutzung im
  Rahmen einer beruflichen Taetigkeit.

## 7. Unter welcher Domain werden Datenschutz-URL und Web-Loeschroute gehostet?

Beide Stores verlangen eine oeffentlich erreichbare Datenschutz-URL, Google
Play zusaetzlich eine Web-Loeschroute ohne App. Die Inhalte sind fertig
(`docs/legal/datenschutzerklaerung.md`, `hosting-checkliste.md`), die Domain
und die Entscheidung zwischen Web-Self-Service und Loeschformular fehlen.

## 8. Wer ist die zustaendige Stelle fuer den Behoerden-Digest?

`system_settings.authority_digest_email` ist leer, solange nichts eingetragen
ist; dann laeuft der Digest gar nicht. Wenn er laeuft, geht der exakte
Fundort hinaus. Das ist gewollt, sollte aber mit der Stelle abgestimmt sein.

## 9. Ist eine Datenschutzbeauftragte oder ein Datenschutzbeauftragter noetig?

§ 38 BDSG knuepft an die Zahl der staendig mit Verarbeitung beschaeftigten
Personen an; unabhaengig davon kann Art. 37 (1) b DSGVO greifen, wenn die
Kerntaetigkeit in umfangreicher regelmaessiger Beobachtung besteht. Fuer CLAR
ist das diskutabel, weil Standortdaten systematisch verarbeitet werden.

## 10. Wie soll die elterliche Einwilligung konkret ablaufen?

Umgesetzt ist: Altersbestaetigung ab 16 mit Nachweis, Hinweistext mit
Kontaktweg fuer Erziehungsberechtigte, keine Werbung, kein Profiling, sichere
Voreinstellungen. NICHT umgesetzt ist ein verifizierbares Alters-Gate.

Bewusste Entscheidung im Audit: ein Gate, das ein Ausweisdokument oder eine
Zahlungskarte verlangt, wuerde deutlich mehr Daten von Minderjaehrigen
erheben als der jetzige Zustand und waere damit die datenschutzUNfreundlichere
Variante. Ob die Selbstauskunft genuegt, ist zu klaeren. Wenn nicht, ist die
Ausgestaltung vorzugeben, bevor ein Gate gebaut wird.

## 11. Anonymisierte Nachweiskopie der Einwilligungen?

`consents` haengt per CASCADE am Konto: mit der Loeschung verschwindet auch
der Nachweis, dass eingewilligt wurde. Das ist datenschutzfreundlich, koennte
aber der Rechenschaftspflicht aus Art. 5 (2) DSGVO zuwiderlaufen. Bisher
bewusst nicht geaendert, weil das Aufbewahren nach einer Loeschung die
schwerer zu rechtfertigende Richtung ist.

---

# Offene Fragen: eigenes On-Device-Modell (2026-09-28)

Umgesetzt ist alles, was sich ohne diese Entscheidungen bauen laesst
(Branch `ondevice-model`, `docs/vision-ondevice.md`).

## 12. Ultralytics YOLO steht unter AGPL-3.0

Das Training in `training/` nutzt, wie gewuenscht, Ultralytics YOLO11n-cls.
Ultralytics vertritt, dass auch damit trainierte und in einer App
ausgelieferte Modelle unter die AGPL fallen, sofern keine Enterprise-Lizenz
besteht. Fuer eine nicht quelloffene App ist das ein Risiko.

Optionen: (a) CLAR quelloffen unter AGPL, (b) Lizenz kaufen, (c) Training auf
ein Apache-2.0-Modell umstellen (MobileNetV3/EfficientNet-Lite mit Keras).
Fuer (c) aendert sich in der App nichts: sie liest nur `.tflite` plus
Metadaten aus `vision_models`. VOR dem ersten Release mit ausgeliefertem
Modell entscheiden.

## 13. KI-Training mit Nutzerfotos: Einwilligung ausreichend?

Umgesetzt ist ein Opt-in (`consents.ki_training`, Standard aus), nur fuer
Meldungen nach der Einwilligung, nur verpixelte und freigegebene Kopien,
Widerruf loescht sofort, Frist 24 Monate, Training nur lokal. Zu pruefen:
Einwilligung von 16- und 17-Jaehrigen fuer diesen Zweck, Umgang mit bereits
trainierten Modellen nach Widerruf (derzeit: Neutraining spaetestens alle
12 Monate), ob abgebildete Dritte trotz Verpixelung zu beruecksichtigen sind.

## 14. Rechtsgrundlage fuer den gespeicherten On-Device-Score

Gewaehlt: Art. 6 (1) f DSGVO (Qualitaetskontrolle, zusaetzliches Pruefsignal).
Der Score darf serverseitig nur eine Vorlage bei einem Menschen ausloesen
und das auch nur, wenn `system_settings.ondevice_disagree_below` gesetzt ist
(Standard: aus).
