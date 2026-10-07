# Offene Fragen / bewusst gestoppte Fixes

Hier stehen Änderungen, die ich NICHT blind umgesetzt habe, weil sie eine
funktionierende Funktion ernsthaft gefährden könnten und eine Entscheidung
bzw. einen Test am Gerät brauchen (siehe AGENTS-Regel).

## 0. ~~Konten werden nie 'aktiv'~~ (erledigt 2026-10-04)

Umgesetzt wie vorgeschlagen: nach dem ersten Login fuehrt die App einmal auf
`src/app/regeln.tsx` ("Community-Regeln"), der Knopf ruft
`activate_account(true)` auf. Der Melde-Flow erkennt `not_active` und leitet
auf denselben Screen. Als Nachweis dient `rules_accepted_at` aus der RPC; ein
eigener Eintrag im Einwilligungs-Journal wurde NICHT angelegt, weil die Regeln
Teil der Nutzungsbedingungen sind und keine Einwilligung. Falls das anders
gewuenscht ist: `record_consent` um einen Schluessel erweitern (Migration).

Offen: Test am Geraet gegen das echte Backend.

## 1. ~~Auth-Token in SecureStore statt AsyncStorage~~ (erledigt)

Umgesetzt in `src/lib/supabase.ts`: die Session liegt AES-verschluesselt in
AsyncStorage, der Schluessel in SecureStore (Supabase-Muster, umgeht das
2048-Byte-Limit). Auf Web bleibt es bei AsyncStorage. Offen ist nur noch der
Geraete-Test des Update-Falls (bestehende Sessions muessen sich einmal neu
anmelden, siehe Kommentar in der Datei).

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

Fuer Supabase, Cloudflare (seit 07.10.2026 statt Anthropic, siehe 17) und
Resend ist je ein Vertrag nach Art. 28 DSGVO
noetig. Ob sie abgeschlossen sind, steht nirgends im Repo. Ohne sie ist jede
Uebermittlung an diese Dienste ohne Rechtsgrundlage.

## 4. In welcher Region laeuft Supabase?

Entscheidet, ob ueberhaupt ein Drittlandtransfer vorliegt. Bei einer
EU-Region entfaellt fuer Supabase die Transferfrage weitgehend; bei einer
US-Region braucht es eine Grundlage. Die Angabe steht in `supabase/.temp/`
nicht und ist im Dashboard nachzusehen.

## 5. Wie lange liegt das Foto beim KI-Anbieter?

Seit 07.10.2026 ist der Anbieter Cloudflare Workers AI (siehe 17). Cloudflare
schreibt, Kundeninhalte nicht zum Training zu nutzen; eine Speicherdauer fuer
die Anfrage selbst ist dort nicht genannt und muss geklaert werden.

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

## 12. Lizenzen rund ums eigene Modell

**Erledigt (2026-10-07):** Das Training nutzt nicht mehr Ultralytics YOLO
(AGPL-3.0), sondern MobileNetV2 mit Keras/TensorFlow (Apache 2.0). An der App
hat sich dafuer nichts geaendert.

**Offen:** `training/fetch_taco.py` holt Startfotos aus dem Datensatz TACO.
Standardmaessig nur die Fotos ohne fremden Lizenzvermerk, die TACO nach
eigener Angabe unter CC BY 4.0 stellt (Namensnennung noetig, steht in
`training/README.md`). Weitere 785 Fotos tragen den Vermerk "ODBL (c)
OpenLitterMap" oder nur "CC" und werden ohne `--all-licenses` nicht geladen.
Zu pruefen vor einem Release mit einem damit trainierten Modell: ob die
Namensnennung im README genuegt oder in die Lizenzliste der App gehoert, und
ob die ODbL-Fotos gewerblich nutzbar sind.

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

---

# Offene Fragen aus dem Release-Durchgang (2026-10-04)

## 15. Push-Benachrichtigungen: in der App nicht gebaut

**Fund:** Das Backend ist vorbereitet (`set_push_preferences`, Versand in
`close-case` und `confirm-case-done` ueber den Expo-Push-Dienst). In der App
fehlen `expo-notifications`, das Opt-in und die Token-Registrierung.

**Warum gestoppt:** Der Push-Token geht an Expo (exp.host) und von dort an
Apple/Google. Dieser Empfaenger steht weder in der Datenschutzerklaerung noch
im Verzeichnis der Verarbeitungstaetigkeiten; das Opt-in ist eine neue
Einwilligung. Beides sind Rechtstext-Aenderungen (neue `POLICY_VERSION`).
Technisch braucht es ausserdem die EAS-`projectId` und FCM-Zugangsdaten, die
erst nach `eas init` existieren.

**Vorschlag:** Nach `eas init`: Abschnitt "Benachrichtigungen" in
Datenschutzerklaerung und VVT ergaenzen, dann einen Schalter im Profil
(Standard: aus), der erst beim Einschalten die Systemerlaubnis anfragt und
`set_push_preferences` aufruft.

## 16. Absturz- und Fehlerberichte: kein Dienst angebunden

**Fund:** Fehler landen nur in `console.error` (`ErrorBoundary.tsx`). Von
Abstuerzen bei echten Nutzern erfaehrt niemand.

**Warum gestoppt:** Ein Dienst wie Sentry ist ein weiterer
Auftragsverarbeiter (AV-Vertrag, Drittland, Datenschutzerklaerung). Die
Alternative ohne Dritten waere eine eigene Tabelle in Supabase, also eine
Aenderung am Datenmodell. Beides braucht eine Entscheidung.

**Vorschlag:** Eigene Tabelle `client_errors` mit RPC (nur Fehlermeldung,
Stack, App-Version, Plattform; kein Nutzerinhalt, Rate-Limit, Loeschung nach
30 Tagen), gestuetzt auf Art. 6 (1) f DSGVO, mit einem Absatz in der
Datenschutzerklaerung. Kein neuer Auftragsverarbeiter noetig.

---

# Offene Fragen: kostenlose Bild-KI auf dem Server (2026-10-07)

## 17. Cloudflare Workers AI statt Anthropic

**Umgesetzt:** `analyze-photo` und `process-photo` rufen die KI ueber
`supabase/functions/_shared/vision.ts` auf. Standard ist Cloudflare Workers
AI (Modell Mistral Small 3.1, Apache 2.0) im Gratis-Kontingent; `anthropic`
und `none` sind per Secret `VISION_PROVIDER` waehlbar. Die Rechtstexte nennen
jetzt Cloudflare (`POLICY_VERSION` 2026-10-07-v1, Migration 024).

**Nicht getestet:** Ein echter Aufruf gegen Cloudflare. Das Anfrageformat
(Bild als data-URL in `image_url`) folgt der Dokumentation und ist nur gegen
einen nachgebauten Server geprueft. Nach dem Anlegen des Kontos einmal eine
Meldung absenden und in `vision_usage` nachsehen, ob `success = true` steht.

**Zu klaeren:**

* **AV-Vertrag und Drittland:** Cloudflare sitzt in den USA und rechnet in
  Rechenzentren weltweit. Vertrag nach Art. 28 DSGVO, Transfergrundlage und
  Speicherdauer der Anfrage sind offen (siehe auch 3 und 5).
* **Reichweite des Gratis-Kontingents:** 10 000 "Neurons" pro Tag. Jede
  Meldung braucht zwei Aufrufe (Muell, Gesichter). Grob geschaetzt reicht das
  fuer einige Dutzend Meldungen am Tag; gemessen ist das nicht. Danach gehen
  Meldungen ungeprueft in die Review-Queue und Fotos bleiben privat.
* **Erkennung von Gesichtern und Kennzeichen:** Ein kleineres Modell
  uebersieht eher eine Person als das bisherige. Dann wuerde ein Foto ohne
  Verpixelung automatisch freigegeben. Strengere Variante, falls gewuenscht:
  jedes Foto erst nach Freigabe durch einen Menschen veroeffentlichen. Das
  braucht einen neuen Grund in `review_queue` (Datenmodell), deshalb nicht
  einfach umgesetzt.
* **Zurueck zu Anthropic:** geht per Secret, dann muessen aber die
  Rechtstexte wieder Anthropic nennen (neue `POLICY_VERSION`).
