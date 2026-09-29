<!--
  ============================================================
  HOSTBARE FASSUNG der Datenschutzerklärung. Beide App-Stores verlangen eine
  ÖFFENTLICH erreichbare Datenschutz-URL ohne Login; diese Datei ist die
  Quelle dafür (Rendering siehe hosting-checkliste.md).

  WICHTIG: Der Text muss WORTGLEICH zu src/app/legal/datenschutz.tsx sein.
  Wer eine Fassung ändert, ändert beide und erhöht POLICY_VERSION in
  src/constants/legal.ts sowie den Default in einer neuen Migration.

  [ANWALT PRÜFEN] markiert die Stellen, deren Bewertung eine fachkundige
  Person bestätigen muss. Sie sind bewusst ausformuliert und in Betrieb, nicht
  offen gelassen. [BETREIBER EINTRAGEN] markiert Angaben, die dieses Repo
  nicht kennt (siehe FRAGEN.md).
  ============================================================
-->

# Datenschutzerklärung – CLAR

**Fassung:** 2026-09-28-v1 · **Stand:** 28.09.2026

Änderung gegenüber 2026-09-23-v1: eigenes On-Device-Modell (Abschnitt 8),
freiwilliges KI-Training (neuer Abschnitt 8a), Tabellen in 3 und 9 ergänzt.

## 1. Wer ist verantwortlich

Verantwortlich für die Verarbeitung deiner Daten im Sinne der DSGVO ist der
Anbieter von CLAR. Die vollständigen Angaben (Name, ladungsfähige Anschrift,
Kontakt) stehen im Impressum dieser App.

Fragen zum Datenschutz, Auskunft, Löschung, Widerspruch:
[BETREIBER EINTRAGEN: Datenschutz-E-Mail].

## 2. Der Grundsatz: Müll melden, keine Personen

CLAR dokumentiert illegal abgelagerten Müll. Wir erheben so wenig über dich wie
möglich: kein Klarname, kein Geburtsdatum, keine Werbe- oder Hardware-IDs,
keine Bewegungsprofile. Es gibt kein Feld für einen „Verursacher".

Es gibt in CLAR keine Werbung, kein Tracking über App-Grenzen hinweg und keinen
Verkauf von Daten. Es ist kein Analyse- oder Absturzberichts-SDK eingebaut.

## 3. Welche Daten wir verarbeiten

| Kategorie | Zweck | Rechtsgrundlage |
|---|---|---|
| E-Mail-Adresse, Passwort-Hash, Bestätigungsstatus | Login, Missbrauchsschutz | Art. 6 (1) b DSGVO |
| Meldungen: Koordinaten, Zeitpunkt, Beschreibung, Abfallart, Status | Müllkarte, Weitergabe an die zuständige Stelle | Art. 6 (1) b DSGVO |
| Fotos: Original privat, anonymisierte Kopie öffentlich | Beleg der Meldung, öffentliche Darstellung des Fundorts | Art. 6 (1) b und f DSGVO |
| Punkte, Level, Abzeichen | kosmetisches Feedback | Art. 6 (1) b DSGVO |
| Einwilligungen inkl. Altersbestätigung und KI-Training, mit Zeitpunkt und Fassung | Nachweisbarkeit | Art. 7 (1), Art. 5 (2) DSGVO |
| Ergebnis der Vorab-Erkennung: Score 0 bis 1 und Modellversion, an der Meldung | Qualitätskontrolle, zusätzliches Prüfsignal | Art. 6 (1) f DSGVO |
| Trainingsdaten (nur mit Einwilligung): Verweis auf die verpixelte Kopie, Prüfergebnis, Score | Training der eigenen Erkennung | Art. 6 (1) a DSGVO |
| Geräte- und IP-Prüfsummen (SHA-256, nie Klartext) | Rate-Limit, Spam-Schutz | Art. 6 (1) f DSGVO |
| Inhaltsmeldungen und Überprüfungsanfragen | Moderation | Art. 6 (1) c DSGVO iVm DSA |
| Kosten- und Sicherheitsprotokolle | Kostendeckel, Sicherheit | Art. 6 (1) f DSGVO |
| Auf dem Gerät: verschlüsselte Sitzung, Offline-Queue, Sprachwahl, Tour-Stand | Betrieb der App | § 25 (2) Nr. 2 TDDDG, unbedingt erforderlich |

[ANWALT PRÜFEN] Zuordnung der Rechtsgrundlagen je Zeile, insbesondere ob die
öffentliche Kartendarstellung auf Art. 6 (1) b oder f zu stützen ist und ob für
Art. 6 (1) f eine dokumentierte Interessenabwägung beizulegen ist.

## 4. Was wir bewusst nicht tun

Wir erstellen kein Profil über dich, bewerten dein Verhalten nicht und setzen
keine Werbe-Identifikatoren. Die Bestenliste ist standardmäßig aus; wenn du sie
einschaltest, erscheint nur ein frei gewähltes Pseudonym, nie deine
E-Mail-Adresse.

Aus deinem Foto lesen wir keine Metadaten aus. Im Gegenteil: bevor ein Foto
dein Gerät verlässt, werden EXIF- und GPS-Daten entfernt, indem das Bild neu
gespeichert wird. Der Ort einer Meldung stammt ausschließlich aus der
Standortbestimmung, die du beim Absenden erlaubst.

## 5. Wer deine Daten bekommt

| Empfänger | Übermittelte Daten | Rolle |
|---|---|---|
| **Supabase** | alle Konto- und Meldungsdaten, Fotos | Auftragsverarbeiter, Art. 28 DSGVO |
| **Anthropic** | nur das verkleinerte Foto, kein Name, keine E-Mail, keine Konto-ID | Auftragsverarbeiter, Art. 28 DSGVO |
| **Zuständige Stelle** (Gemeinde, Bauhof) | Falltitel, Fundort, anonymisiertes Foto, Einmal-Link | eigenständig Verantwortliche |
| **Resend** | Behörden-Adresse, Inhalt des Berichts | Auftragsverarbeiter, Art. 28 DSGVO |
| **Google Maps** (Android) bzw. **Apple Maps** (iOS) | technisch der angezeigte Kartenausschnitt | eigenständig Verantwortliche, Art. 6 (1) f DSGVO |

An die zuständige Stelle gehen **keine** Daten über dich: kein Name, keine
E-Mail-Adresse, keine Konto-ID, kein Originalfoto.

[ANWALT PRÜFEN] AV-Verträge je Dienstleister, Einordnung der Kartenanbieter,
Einordnung der Behörde als eigenständig Verantwortliche.

## 6. Übermittlung in Drittländer

Anthropic hat seinen Sitz in den Vereinigten Staaten. Die Prüfung deines Fotos
findet daher außerhalb der EU statt. Grundlage der Übermittlung sind die
Standardvertragsklauseln der EU-Kommission beziehungsweise, soweit der Anbieter
zertifiziert ist, das EU-US Data Privacy Framework.

Übermittelt wird ausschließlich das verkleinerte Bild. Wenn auf deinem Foto
zufällig Menschen zu sehen sind, werden deren Abbildungen mitübermittelt, um
sie anschließend unkenntlich machen zu können.

Für Supabase und Resend gilt: ob und in welchem Umfang eine Verarbeitung
außerhalb der EU stattfindet, hängt von der gewählten Region ab.
[BETREIBER EINTRAGEN: Region und Transfergrundlage je Dienst].

[ANWALT PRÜFEN] Welche Transfergrundlage tatsächlich trägt und ob ein
Transfer Impact Assessment zu dokumentieren ist.

## 7. Was öffentlich sichtbar wird

- Nur eine anonymisierte Kopie des Fotos: Metadaten entfernt, erkannte
  Gesichter und Kennzeichen großflächig verpixelt.
- Der Ort nur gerundet (Zelle von etwa 20 bis 40 Metern), nicht als exakter
  Punkt.
- Meldungen, die nach privatem Grundstück oder Wohnumfeld aussehen, werden nie
  automatisch veröffentlicht.
- Dein Name, deine E-Mail-Adresse und deine Konto-ID erscheinen nirgends.
- Die automatische Erkennung kann Bereiche übersehen. Deshalb sieht bei
  erkannten Personen zusätzlich ein Mensch das Foto an, bevor es öffentlich
  wird. Schlägt die Erkennung fehl, wird das Foto gar nicht veröffentlicht.

## 8. Automatisierte Prüfung deiner Meldung

Dein Foto wird nach dem Absenden automatisch geprüft. Ein KI-Modell beurteilt,
ob Müll zu sehen ist, wie sicher es sich dabei ist, ob der Inhalt unzulässig
ist (Gewalt, Nacktheit) und ob der Ort nach Privatgrund aussieht.

Daraus ergibt sich unmittelbar, was mit deiner Meldung passiert: Veröffentlichung,
Ablehnung oder Vorlage bei einem Menschen. Bei geringer Sicherheit, bei Verdacht
auf Privatgrund, bei erkannten Personen und in einer Stichprobe schaut immer ein
Mensch drauf.

Das ist eine automatisierte Entscheidung im Sinne von Art. 22 DSGVO. Du hast
das Recht, dass ein Mensch sie überprüft, deinen Standpunkt darzulegen und die
Entscheidung anzufechten: in der App in der Fallansicht über „Überprüfung
anfordern". Das kostet nichts und hat keine Nachteile für dich.

Wird deine Meldung abgelehnt, siehst du in der Fallansicht den Grund und den
Hinweis, ob automatisch entschieden wurde (gespeichert in
`reports.decision_reason` und `reports.decision_automated`). Eine Ablehnung
führt dazu, dass es für diese Meldung keine Punkte gibt. Punkte sind kosmetisch
und haben keinen Geldwert.

Vor dem Absenden läuft zusätzlich eine kleine, von uns trainierte
Vorab-Erkennung direkt auf deinem Gerät. Sie gibt dir einen unverbindlichen
Hinweis, etwa „Wir erkennen hier keinen Müll, trotzdem melden?". Du kannst
immer trotzdem melden. Für diese Erkennung verlässt dein Foto das Gerät nicht.

Mit der Meldung speichern wir das Ergebnis dieser Vorab-Erkennung (eine Zahl
zwischen 0 und 1) und die Modellversion. Beides entscheidet nichts und bringt
keine Punkte. Es kann höchstens dazu führen, dass zusätzlich ein Mensch auf
deine Meldung schaut. Das Modell lädt die App von unseren Servern; dabei
werden außer den technisch nötigen Verbindungsdaten keine Daten über dich
gesendet.

Der Hilfe-Chat in der App ist keine KI. Er besteht aus einer festen Liste von
Fragen mit jeweils einer festen Antwort.

[ANWALT PRÜFEN] Welcher Buchstabe des Art. 22 (2) DSGVO trägt (Vertrag,
ausdrückliche Einwilligung, gesetzliche Erlaubnis) und ob die Ablehnung einer
Meldung überhaupt eine „rechtliche Wirkung oder ähnlich erhebliche
Beeinträchtigung" ist, wenn die Punkte keinen Geldwert haben.

## 8a. Training unserer eigenen Erkennung (freiwillig)

Wir verbessern die Vorab-Erkennung mit echten Meldungen. Dafür nutzen wir
Fotos nur, wenn du das im Profil unter „Datenschutz" ausdrücklich einschaltest
(„KI-Training"). Der Schalter ist von Anfang an aus. Ohne ihn funktioniert
CLAR genauso, auch Punkte hängen nicht davon ab. Grundlage: deine
Einwilligung, Art. 6 (1) a DSGVO.

Genutzt wird nur die verpixelte Kopie deines Fotos, und nur wenn sie
freigegeben ist, also keine Person erkannt wurde oder ein Mensch sie geprüft
hat. Dazu das Prüfergebnis (Müll ja oder nein) und das Ergebnis der
Vorab-Erkennung. Nicht genutzt werden das Originalfoto, der Standort, deine
Beschreibung, dein Name, deine E-Mail-Adresse. Meldungen mit Verdacht auf
Privatgrund oder unzulässigen Inhalten kommen nie in den Trainingsdatensatz.
Es zählen nur Meldungen, die du nach dem Einschalten abschickst.

Das Training findet nur bei uns statt, auf eigenen Rechnern. Wir laden die
Fotos dafür bei keinem anderen Dienst hoch, geben sie nicht weiter und
verkaufen sie nicht.

Du kannst die Einwilligung jederzeit im Profil widerrufen. Dann werden deine
Fotos sofort aus dem Trainingsdatensatz entfernt, ebenso wenn eine Meldung
oder dein Konto gelöscht wird. Lokale Kopien auf unseren Trainingsrechnern
werden vor jedem Training abgeglichen und gelöscht. Ein schon trainiertes
Modell enthält keine Fotos, sondern daraus gelernte Zahlen. Wir trainieren
regelmäßig neu, spätestens alle 12 Monate, damit auch diese Spuren
verschwinden.

[ANWALT PRÜFEN] Einwilligung als Grundlage (statt berechtigtem Interesse),
Wirksamkeit der Einwilligung von 16- und 17-Jährigen für diesen Zweck,
Umgang mit bereits trainierten Modellen nach Widerruf (Art. 17), und ob
Personen im Hintergrund verpixelter Fotos als Dritte zusätzlich zu
berücksichtigen sind.

## 9. Wie lange wir speichern

| Kategorie | Dauer |
|---|---|
| Konto, Meldungen, Fotos, Punkte, Einwilligungen | bis zur Löschung des Kontos |
| Prüfsummen für den Missbrauchsschutz | 30 Tage |
| Einmal-Links für die zuständige Stelle | 30 Tage ab Versand |
| Kosten- und Sicherheitsprotokolle | bis zu 24 Monate, nach Kontolöschung ohne Personenbezug |
| Anonymisierte öffentliche Fotos | bis zur Löschung des Kontos |
| Ergebnis der Vorab-Erkennung | so lange wie die Meldung |
| Trainingsdaten (nur mit Einwilligung) | bis Widerruf, Löschung der Meldung oder des Kontos, höchstens 24 Monate |

[BETREIBER EINTRAGEN: abweichende Fristen, falls gesetzliche
Aufbewahrungspflichten bestehen.]

## 10. Deine Rechte

Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung
(Art. 18), Datenübertragbarkeit (Art. 20), Widerspruch (Art. 21), Widerruf von
Einwilligungen (Art. 7 (3)).

- **Auskunft und Übertragbarkeit:** Profil, „Meine Daten exportieren" (JSON,
  inklusive zeitlich begrenzter Links auf die Originalfotos).
- **Löschung:** Profil, „Konto löschen". Entfernt Fotos samt Kopien und danach
  das Konto; per Datenbank-Kaskade auch Profil, Meldungen, Foto-Daten, Punkte,
  Einwilligungen, Inhaltsmeldungen und Anmeldungen zu Aktionen. Lokal auf dem
  Gerät werden dabei Offline-Queue und Install-ID gelöscht. Ohne die App:
  [BETREIBER EINTRAGEN: Web-Lösch-URL].
- **Widerruf:** Profil, Bereich „Datenschutz".
- **Beschwerde:** Landesbeauftragter für den Datenschutz und die
  Informationsfreiheit Baden-Württemberg, Lautenschlagerstraße 20,
  70173 Stuttgart.

## 11. Junge Nutzerinnen und Nutzer

CLAR richtet sich ausdrücklich auch an junge Menschen. Bei der Anmeldung
bestätigst du, dass du mindestens 16 Jahre alt bist. Wir fragen bewusst kein
Geburtsdatum ab.

In Deutschland kannst du ab 16 selbst einwilligen. Bist du jünger, brauchen wir
die Zustimmung deiner Eltern oder Erziehungsberechtigten. Schreib uns in dem
Fall zusammen mit ihnen an [BETREIBER EINTRAGEN: Datenschutz-E-Mail], bevor du
ein Konto anlegst.

Es gibt keine Werbung, keine Profilbildung, keine Streaks und keine
Zufallsbelohnungen. Die Bestenliste ist von Anfang an ausgeschaltet.

[ANWALT PRÜFEN] Altersgrenze 16 für Deutschland, ob eine Selbstauskunft
genügt oder ein technisches Alters-Gate nötig ist, Ausgestaltung einer
verifizierbaren elterlichen Einwilligung, Vorgaben JMStV und KJM, und bei
Verfügbarkeit in den USA COPPA.

## 12. Sicherheit

TLS auf allen Verbindungen, verschlüsselte Sitzung auf dem Gerät, zeilenweise
Zugriffskontrolle in der Datenbank (Row Level Security auf jeder Tabelle),
Originalfotos in einem privaten, nicht öffentlich adressierbaren Speicher.

Sicherheitslücken bitte an [BETREIBER EINTRAGEN: Sicherheits-E-Mail]. Wir
behandeln solche Hinweise vertraulich (Prozess: `docs/ops.md`).

## 13. Änderungen

Wenn sich die Verarbeitung ändert, passen wir diese Erklärung an. Die aktuelle
Fassung steht in der App und unter [BETREIBER EINTRAGEN: Datenschutz-URL].
Welche Fassung du bestätigt hast, speichern wir mit deinen Einwilligungen
(`consents.policy_version`).
