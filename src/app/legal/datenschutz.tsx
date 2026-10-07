// Datenschutzerklaerung (Art. 13 DSGVO) als In-App-Screen.
//
// Der Text ist inhaltlich aus dem tatsaechlichen Code hergeleitet (Migrationen,
// Edge Functions, src/lib) und deckt sich mit docs/legal/datenschutzerklaerung.md
// und docs/legal/data-flows.md. Wer hier etwas aendert, aendert beides.
//
// [ANWALT PRÜFEN] Rechtsgrundlagen je Kategorie (Art. 6 (1) b vs. f vs. a),
// [ANWALT PRÜFEN] Drittlandtransfer Cloudflare (SCC/DPF), Aufbewahrungsfristen,
// [ANWALT PRÜFEN] Einordnung der automatisierten Entscheidung unter Art. 22 (2),
// [ANWALT PRÜFEN] Altersgrenze und Ausgestaltung der elterlichen Einwilligung.
// [ANWALT PRÜFEN] 8a: Einwilligung (Art. 6 (1) a) als Grundlage fuers Training,
// [ANWALT PRÜFEN] Art. 6 (1) f fuer den gespeicherten On-Device-Score.
// Die Punkte sind hier bewusst ausformuliert statt offen gelassen; die
// Bestaetigung durch eine fachkundige Person steht aus (siehe FRAGEN.md).
//
// Bewusst NUR auf Deutsch: Rechtstexte werden nicht maschinell uebersetzt.
// Der Hinweis darauf laeuft ueber i18n (`legal.german_only`) in DE und EN.

import { LegalDoc, type LegalSection } from '@/components';
import { POLICY_DATE } from '@/constants/legal';

const SECTIONS: LegalSection[] = [
  {
    heading: '1. Wer ist verantwortlich',
    paragraphs: [
      'Verantwortlich für die Verarbeitung deiner Daten im Sinne der DSGVO ist der Anbieter von CLAR. Die vollständigen Angaben (Name, ladungsfähige Anschrift, Kontakt) stehen im Impressum dieser App.',
      'Fragen zum Datenschutz, Auskunft, Löschung, Widerspruch: [BETREIBER EINTRAGEN: Datenschutz-E-Mail].',
    ],
  },
  {
    heading: '2. Der Grundsatz: Müll melden, keine Personen',
    paragraphs: [
      'CLAR dokumentiert illegal abgelagerten Müll. Wir erheben so wenig über dich wie möglich: kein Klarname, kein Geburtsdatum, keine Werbe- oder Hardware-IDs, keine Bewegungsprofile. Es gibt kein Feld für einen „Verursacher".',
      'Es gibt in CLAR keine Werbung, kein Tracking über App-Grenzen hinweg und keinen Verkauf von Daten. Es ist kein Analyse- oder Absturzberichts-SDK eingebaut.',
    ],
  },
  {
    heading: '3. Welche Daten wir verarbeiten',
    paragraphs: [
      'Konto: E-Mail-Adresse, Passwort (nur als Hash), Bestätigungsstatus der E-Mail. Zweck: Login und Schutz vor Missbrauch. Grundlage: Art. 6 (1) b DSGVO (Erfüllung des Nutzungsvertrags).',
      'Meldungen: Standort der Fundstelle (Breiten- und Längengrad), Zeitpunkt, freiwillige Beschreibung, erkannte Abfallart, Status. Zweck: die Müllkarte und die Weitergabe an die zuständige Stelle. Grundlage: Art. 6 (1) b DSGVO.',
      'Fotos: das Original liegt in einem privaten Speicher, auf den nur du und die Server-Prozesse zugreifen können. Veröffentlicht wird ausschließlich eine anonymisierte Kopie. Grundlage: Art. 6 (1) b DSGVO für die Meldung, Art. 6 (1) f DSGVO für die öffentliche Darstellung des Fundorts.',
      'Punkte und Level: Buchungen mit Grund und Zeitpunkt. Sie sind rein kosmetisch und haben keinen Geldwert. Grundlage: Art. 6 (1) b DSGVO.',
      'Einwilligungen: jede Änderung an den Schaltern „Kamera", „Standort", „Weitergabe an Behörden", „KI-Training" und die Altersbestätigung werden mit Zeitpunkt und Fassung dieser Erklärung protokolliert. Zweck: Nachweisbarkeit. Grundlage: Art. 7 (1), Art. 5 (2) DSGVO.',
      'Ergebnis der Vorab-Erkennung: eine Zahl zwischen 0 und 1 und die Version des Modells auf deinem Gerät, gespeichert mit der Meldung. Zweck: Qualitätskontrolle der Erkennung und ein zusätzliches Prüfsignal (siehe 8). Grundlage: Art. 6 (1) f DSGVO.',
      'Trainingsdaten, nur wenn du es einschaltest: Verweis auf die verpixelte Kopie deines Fotos, das Prüfergebnis und das Ergebnis der Vorab-Erkennung (siehe 8a). Grundlage: Art. 6 (1) a DSGVO.',
      'Missbrauchsschutz: von deinem Gerät und deiner IP-Adresse speichern wir nur Prüfsummen (SHA-256), nie die Werte selbst, zusammen mit der ausgeführten Aktion. Zweck: Begrenzung von Spam und automatisierten Massenmeldungen. Grundlage: Art. 6 (1) f DSGVO.',
      'Moderation: wenn du einen Inhalt meldest oder eine Überprüfung anforderst, speichern wir deine Meldung mit Grund und Zeitpunkt. Grundlage: Art. 6 (1) c DSGVO in Verbindung mit dem Digital Services Act.',
      'Kosten- und Sicherheitsprotokolle: welches KI-Modell wann wie viel gekostet hat, und sicherheitsrelevante Vorgänge. Diese Zeilen überleben eine Kontolöschung, verlieren dabei aber jeden Personenbezug. Grundlage: Art. 6 (1) f DSGVO.',
      'Auf deinem Gerät: die Anmeldesitzung (verschlüsselt), noch nicht gesendete Meldungen samt Fotos, deine Sprachwahl und der Stand der Einführungstour. Diese Daten sind für den Betrieb der App unbedingt erforderlich und verlassen dein Gerät nicht von selbst (§ 25 (2) Nr. 2 TDDDG).',
    ],
  },
  {
    heading: '4. Was wir bewusst nicht tun',
    paragraphs: [
      'Wir erstellen kein Profil über dich, bewerten dein Verhalten nicht und setzen keine Werbe-Identifikatoren. Deine Bestenlisten-Teilnahme ist standardmäßig aus; wenn du sie einschaltest, erscheint nur ein frei gewähltes Pseudonym, nie deine E-Mail-Adresse.',
      'Aus deinem Foto lesen wir keine Metadaten aus. Im Gegenteil: bevor ein Foto dein Gerät verlässt, werden EXIF- und GPS-Daten entfernt, indem das Bild neu gespeichert wird. Der Ort einer Meldung stammt ausschließlich aus der Standortbestimmung, die du beim Absenden erlaubst.',
    ],
  },
  {
    heading: '5. Wer deine Daten bekommt',
    paragraphs: [
      'Supabase: Hosting, Datenbank, Anmeldung und Dateispeicher. Dort liegen alle oben genannten Konto- und Meldungsdaten. Auftragsverarbeiter nach Art. 28 DSGVO.',
      'Cloudflare: stellt das KI-Modell bereit, das dein Foto automatisch auf Müll prüft und Gesichter und Kennzeichen erkennt, damit wir sie unkenntlich machen können. Cloudflare nutzt die Bilder nach eigenen Angaben nicht zum Training von KI-Modellen. Übermittelt wird nur eine verkleinerte Kopie des Bildes, ohne deinen Namen, deine E-Mail-Adresse oder deine Konto-Nummer. Auftragsverarbeiter nach Art. 28 DSGVO.',
      'Zuständige Stelle (Gemeinde, Bauhof, Behörde): erhält einen wöchentlichen Sammel-Bericht mit Falltitel, Fundort, dem anonymisierten Foto und einem einmaligen Link, um den Fall als erledigt zu melden. Es gehen keine Daten über dich mit: kein Name, keine E-Mail-Adresse, keine Konto-Nummer, kein Originalfoto.',
      'Resend: versendet diesen Bericht per E-Mail. Auftragsverarbeiter nach Art. 28 DSGVO.',
      'Kartenanbieter: die Karte in der App wird auf Android von Google Maps und auf iPhone und iPad von Apple Maps dargestellt. Beim Laden der Kartenausschnitte erfahren diese Anbieter technisch bedingt, welchen Bereich du ansiehst. Grundlage: Art. 6 (1) f DSGVO.',
      'Darüber hinaus geben wir nichts weiter, außer wir sind gesetzlich dazu verpflichtet.',
    ],
  },
  {
    heading: '6. Übermittlung in Drittländer',
    paragraphs: [
      'Cloudflare hat seinen Sitz in den Vereinigten Staaten und betreibt Rechenzentren weltweit. Die Prüfung deines Fotos kann daher außerhalb der EU stattfinden. Grundlage der Übermittlung sind die Standardvertragsklauseln der EU-Kommission beziehungsweise, soweit der Anbieter zertifiziert ist, das EU-US Data Privacy Framework.',
      'Übermittelt wird ausschließlich das verkleinerte Bild. Wenn auf deinem Foto zufällig Menschen zu sehen sind, werden deren Abbildungen mitübermittelt, um sie anschließend unkenntlich machen zu können.',
      'Für Supabase und Resend gilt: ob und in welchem Umfang eine Verarbeitung außerhalb der EU stattfindet, hängt von der gewählten Region ab. [BETREIBER EINTRAGEN: Region und Transfergrundlage je Dienst].',
    ],
  },
  {
    heading: '7. Was öffentlich sichtbar wird',
    paragraphs: [
      'Veröffentlichte Meldungen erscheinen auf einer Karte, die jede und jeder sehen kann. Dabei gilt: es wird nur eine anonymisierte Kopie des Fotos gezeigt, bei der Metadaten entfernt und erkannte Gesichter und Kennzeichen großflächig verpixelt sind.',
      'Der Ort wird öffentlich nur gerundet angezeigt (eine Zelle von etwa 20 bis 40 Metern), nicht als exakter Punkt.',
      'Meldungen, die nach einem privaten Grundstück oder einem Wohnumfeld aussehen, werden nie automatisch veröffentlicht.',
      'Dein Name, deine E-Mail-Adresse und deine Konto-Nummer erscheinen nirgends öffentlich.',
      'Die automatische Erkennung von Gesichtern und Kennzeichen kann Bereiche übersehen. Deshalb wird jedes Foto, auf dem Personen erkannt wurden, zusätzlich von einem Menschen angesehen, bevor es öffentlich wird. Schlägt die Erkennung fehl, wird das Foto gar nicht veröffentlicht.',
    ],
  },
  {
    heading: '8. Automatisierte Prüfung deiner Meldung',
    paragraphs: [
      'Dein Foto wird nach dem Absenden automatisch geprüft. Ein KI-Modell beurteilt, ob Müll zu sehen ist, wie sicher es sich dabei ist, ob der Inhalt unzulässig ist (Gewalt, Nacktheit) und ob der Ort nach Privatgrund aussieht.',
      'Daraus ergibt sich unmittelbar, was mit deiner Meldung passiert: sie wird veröffentlicht, sie wird abgelehnt, oder sie geht an einen Menschen zur Prüfung. Bei geringer Sicherheit, bei Verdacht auf Privatgrund, bei erkannten Personen und in einer Stichprobe schaut immer ein Mensch drauf.',
      'Das ist eine automatisierte Entscheidung im Sinne von Art. 22 DSGVO. Du hast das Recht, dass ein Mensch sie überprüft, deinen Standpunkt darzulegen und die Entscheidung anzufechten. In der App findest du dafür in der Fallansicht den Knopf „Überprüfung anfordern". Das kostet nichts und hat keine Nachteile für dich.',
      'Wird deine Meldung abgelehnt, siehst du in der Fallansicht den Grund und den Hinweis, ob die Entscheidung automatisch getroffen wurde. Eine Ablehnung führt dazu, dass es für diese Meldung keine Punkte gibt. Punkte sind kosmetisch und haben keinen Geldwert.',
      'Vor dem Absenden läuft zusätzlich eine kleine, von uns trainierte Vorab-Erkennung direkt auf deinem Gerät. Sie gibt dir einen unverbindlichen Hinweis, etwa „Wir erkennen hier keinen Müll, trotzdem melden?". Du kannst immer trotzdem melden. Für diese Erkennung verlässt dein Foto das Gerät nicht.',
      'Mit der Meldung speichern wir das Ergebnis dieser Vorab-Erkennung (eine Zahl zwischen 0 und 1) und die Modellversion. Beides entscheidet nichts und bringt keine Punkte. Es kann höchstens dazu führen, dass zusätzlich ein Mensch auf deine Meldung schaut. Das Modell lädt die App von unseren Servern; dabei werden außer den technisch nötigen Verbindungsdaten keine Daten über dich gesendet.',
      'Der Hilfe-Chat in der App ist keine KI. Er besteht aus einer festen Liste von Fragen mit jeweils einer festen Antwort.',
    ],
  },
  {
    heading: '8a. Training unserer eigenen Erkennung (freiwillig)',
    paragraphs: [
      'Wir verbessern die Vorab-Erkennung mit echten Meldungen. Dafür nutzen wir Fotos nur, wenn du das im Profil unter „Datenschutz" ausdrücklich einschaltest („KI-Training"). Der Schalter ist von Anfang an aus. Ohne ihn funktioniert CLAR genauso, auch Punkte hängen nicht davon ab. Grundlage: deine Einwilligung, Art. 6 (1) a DSGVO.',
      'Genutzt wird nur die verpixelte Kopie deines Fotos, und nur wenn sie freigegeben ist, also keine Person erkannt wurde oder ein Mensch sie geprüft hat. Dazu das Prüfergebnis (Müll ja oder nein) und das Ergebnis der Vorab-Erkennung. Nicht genutzt werden das Originalfoto, der Standort, deine Beschreibung, dein Name, deine E-Mail-Adresse. Meldungen mit Verdacht auf Privatgrund oder unzulässigen Inhalten kommen nie in den Trainingsdatensatz. Es zählen nur Meldungen, die du nach dem Einschalten abschickst.',
      'Das Training findet nur bei uns statt, auf eigenen Rechnern. Wir laden die Fotos dafür bei keinem anderen Dienst hoch, geben sie nicht weiter und verkaufen sie nicht.',
      'Du kannst die Einwilligung jederzeit im Profil widerrufen. Dann werden deine Fotos sofort aus dem Trainingsdatensatz entfernt, ebenso wenn eine Meldung oder dein Konto gelöscht wird. Lokale Kopien auf unseren Trainingsrechnern werden vor jedem Training abgeglichen und gelöscht. Ein schon trainiertes Modell enthält keine Fotos, sondern daraus gelernte Zahlen. Wir trainieren regelmäßig neu, spätestens alle 12 Monate, damit auch diese Spuren verschwinden.',
    ],
  },
  {
    heading: '9. Wie lange wir speichern',
    paragraphs: [
      'Kontodaten, Meldungen, Fotos, Punkte und Einwilligungen: bis du dein Konto löschst. Danach werden sie entfernt.',
      'Prüfsummen für den Missbrauchsschutz: 30 Tage.',
      'Einmal-Links für die zuständige Stelle: 30 Tage ab Versand, danach ungültig.',
      'Kosten- und Sicherheitsprotokolle: bis zu 24 Monate, nach einer Kontolöschung ohne jeden Bezug zu dir.',
      'Öffentlich gezeigte, anonymisierte Fotos werden zusammen mit deinem Konto gelöscht.',
      'Ergebnis der Vorab-Erkennung: so lange wie die Meldung.',
      'Trainingsdaten (nur mit Einwilligung): bis zum Widerruf, bis zur Löschung der Meldung oder des Kontos, höchstens aber 24 Monate.',
      '[BETREIBER EINTRAGEN: abweichende Fristen, falls gesetzliche Aufbewahrungspflichten bestehen].',
    ],
  },
  {
    heading: '10. Deine Rechte',
    paragraphs: [
      'Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21). Einwilligungen kannst du jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 (3)).',
      'Auskunft und Übertragbarkeit: Profil, „Meine Daten exportieren". Du bekommst alle zu deinem Konto gespeicherten Daten als JSON, inklusive zeitlich begrenzter Links auf deine Originalfotos.',
      'Löschung: Profil, „Konto löschen". Das entfernt deine Fotos samt Kopien aus dem Speicher und danach dein Konto; über die Datenbank werden Profil, Meldungen, Foto-Daten, Punkte, Einwilligungen, Meldungen an die Moderation und Anmeldungen zu Aktionen mitgelöscht. Unabhängig davon kannst du die Löschung auch ohne die App beantragen: [BETREIBER EINTRAGEN: Web-Lösch-URL].',
      'Widerruf: Profil, Bereich „Datenschutz".',
      'Beschwerderecht: du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren. Zuständig ist für uns der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg, Lautenschlagerstraße 20, 70173 Stuttgart.',
    ],
  },
  {
    heading: '11. Junge Nutzerinnen und Nutzer',
    paragraphs: [
      'CLAR richtet sich ausdrücklich auch an junge Menschen. Bei der Anmeldung bestätigst du, dass du mindestens 16 Jahre alt bist. Wir fragen bewusst kein Geburtsdatum ab.',
      'In Deutschland kannst du ab 16 Jahren selbst in die Verarbeitung deiner Daten einwilligen. Bist du jünger, brauchen wir die Zustimmung deiner Eltern oder Erziehungsberechtigten. Schreib uns in dem Fall zusammen mit ihnen an [BETREIBER EINTRAGEN: Datenschutz-E-Mail], bevor du ein Konto anlegst.',
      'Für alle gilt: es gibt keine Werbung, keine Profilbildung, keine Streaks und keine Zufallsbelohnungen. Die Bestenliste ist von Anfang an ausgeschaltet, und wenn du sie einschaltest, siehst du dort nur Pseudonyme.',
      'Wenn Eltern oder Erziehungsberechtigte die Löschung des Kontos eines Kindes wünschen, genügt eine Nachricht an die oben genannte Adresse.',
    ],
  },
  {
    heading: '12. Sicherheit',
    paragraphs: [
      'Die Verbindung zur App ist durchgehend mit TLS verschlüsselt. Deine Anmeldesitzung liegt auf dem Gerät verschlüsselt. Der Zugriff auf die Datenbank ist zeilenweise abgesichert, sodass jedes Konto ausschließlich eigene Daten sieht. Originalfotos liegen in einem privaten Speicher und sind nicht über eine öffentliche Adresse erreichbar.',
      'Wenn du eine Sicherheitslücke findest, melde sie bitte an [BETREIBER EINTRAGEN: Sicherheits-E-Mail]. Wir behandeln solche Hinweise vertraulich.',
    ],
  },
  {
    heading: '13. Änderungen',
    paragraphs: [
      'Wenn sich die Verarbeitung ändert, passen wir diese Erklärung an. Die jeweils aktuelle Fassung findest du hier in der App und unter [BETREIBER EINTRAGEN: Datenschutz-URL]. Welche Fassung du bestätigt hast, speichern wir zusammen mit deinen Einwilligungen.',
    ],
  },
];

export default function DatenschutzScreen() {
  return (
    <LegalDoc title="Datenschutzerklärung" updatedAt={POLICY_DATE} sections={SECTIONS} />
  );
}
