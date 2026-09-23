// Nutzungsbedingungen. Erfuellt zugleich Art. 14 DSA: die Bedingungen muessen
// klar und in leicht verstaendlicher Sprache erklaeren, nach welchen Regeln
// Inhalte moderiert werden, einschliesslich des Einsatzes automatisierter
// Mittel. Wegen der teils minderjaehrigen Zielgruppe ist der Ton bewusst
// einfach gehalten (Art. 14 (3) DSA).
//
// [ANWALT PRÜFEN] Umfang der Rechteeinraeumung an den Fotos, Haftung und
// [ANWALT PRÜFEN] Gewaehrleistung gegenueber Verbrauchern, Kuendigungs- und
// [ANWALT PRÜFEN] Sperrregeln, Rechtswahl und Gerichtsstand, Wirksamkeit von
// [ANWALT PRÜFEN] Vertraegen mit beschraenkt Geschaeftsfaehigen (§§ 107 ff. BGB).
// Alles ist hier ausformuliert und eingebunden, die Pruefung steht aus.
//
// Bewusst NUR auf Deutsch: Rechtstexte werden nicht maschinell uebersetzt.

import { LegalDoc, type LegalSection } from '@/components';
import { POLICY_DATE } from '@/constants/legal';

const SECTIONS: LegalSection[] = [
  {
    heading: '1. Worum es geht',
    paragraphs: [
      'CLAR ist eine App, mit der du illegal abgelagerten Müll melden kannst. Deine Meldung landet auf einer Karte und wird gesammelt an die zuständige Stelle weitergegeben, damit der Müll wegkommt.',
      'Diese Bedingungen gelten zwischen dir und dem Anbieter, der im Impressum steht. Mit der Anmeldung stimmst du ihnen zu.',
      'CLAR ist kostenlos. Es gibt keine Abos, keine Käufe in der App und keine Werbung.',
    ],
  },
  {
    heading: '2. Wer mitmachen darf',
    paragraphs: [
      'Du kannst CLAR ab 16 Jahren selbst nutzen. Bist du jünger, brauchst du die Zustimmung deiner Eltern oder Erziehungsberechtigten. Bei der Anmeldung bestätigst du dein Alter selbst.',
      'Pro Person ein Konto. Konten weiterzugeben oder Konten für andere anzulegen, ist nicht erlaubt.',
    ],
  },
  {
    heading: '3. Was du melden darfst und was nicht',
    paragraphs: [
      'Melde Müll, keine Menschen. Es gibt in CLAR bewusst kein Feld für einen „Verursacher", und du sollst auch keinen in die Beschreibung schreiben.',
      'Fotografiere nicht gezielt Personen, Kennzeichen, Hausnummern, Klingelschilder oder Fenster. Betritt kein fremdes Grundstück, um ein Foto zu machen.',
      'Verboten sind außerdem: rechtswidrige Inhalte, Beleidigungen, Hassrede, Gewalt- oder Sexualdarstellungen, Werbung, erfundene Meldungen und das wiederholte Melden desselben Fundes, um Punkte zu sammeln.',
      'Lade nur Fotos hoch, die du selbst aufgenommen hast.',
      'Deine Sicherheit geht vor: fotografiere nicht im Straßenverkehr, nicht an gefährlichen Stellen und fass gefährliche Abfälle nicht an.',
    ],
  },
  {
    heading: '4. Was mit deinen Fotos passiert',
    paragraphs: [
      'Das Rechtebild bleibt bei dir: deine Fotos gehören dir. Du räumst uns ein einfaches, räumlich unbeschränktes und nicht ausschließliches Recht ein, deine Meldung und die anonymisierte Kopie deines Fotos für den Zweck der App zu nutzen. Das heißt konkret: Anzeige auf der öffentlichen Karte, Weitergabe an die zuständige Stelle und Verwendung in anonymisierter Form zur Auswertung, wie viel Müll wo gemeldet wird.',
      'Wir verkaufen deine Fotos nicht und geben sie nicht zu Werbezwecken weiter.',
      'Löschst du dein Konto, löschen wir deine Fotos und deren Kopien. Dass ein Fall existiert hat und erledigt wurde, kann als Eintrag ohne Bezug zu dir bestehen bleiben.',
    ],
  },
  {
    heading: '5. Wie wir moderieren',
    paragraphs: [
      'Jedes Foto wird nach dem Absenden automatisch geprüft. Dabei schaut ein KI-Modell, ob Müll zu sehen ist, ob unzulässige Inhalte darauf sind und ob Gesichter oder Kennzeichen erkennbar sind.',
      'Je nach Ergebnis wird deine Meldung automatisch veröffentlicht, automatisch abgelehnt oder einem Menschen zur Prüfung vorgelegt. Ein Mensch schaut immer dann drauf, wenn die Erkennung unsicher ist, wenn der Ort nach Privatgrund aussieht, wenn Personen im Bild erkannt wurden, wenn jemand den Inhalt gemeldet hat und zusätzlich bei einer Stichprobe.',
      'Erkannte Gesichter und Kennzeichen werden verpixelt, bevor ein Foto öffentlich wird. Klappt die Erkennung nicht, wird das Foto gar nicht öffentlich gezeigt.',
      'Meldet jemand einen Inhalt, verschwindet er sofort aus der Öffentlichkeit, bis ein Mensch ihn geprüft hat. Das ist eine Vorsichtsmaßnahme und noch keine Entscheidung gegen dich.',
      'Wenn wir eine Meldung ablehnen oder entfernen, sagen wir dir in der Fallansicht warum, ob das automatisch entschieden wurde und wie du dagegen vorgehen kannst.',
      'Bei wiederholten oder schweren Verstößen können wir einzelne Inhalte entfernen, die Punktevergabe aussetzen oder ein Konto sperren. Vorher informieren wir dich, außer es ist wegen eines offensichtlich rechtswidrigen Inhalts nicht vertretbar.',
    ],
  },
  {
    heading: '6. Wenn du mit einer Entscheidung nicht einverstanden bist',
    paragraphs: [
      'Du kannst jede Ablehnung anfechten. In der Fallansicht gibt es dafür den Knopf „Überprüfung anfordern". Danach schaut ein Mensch die Entscheidung noch einmal an. Das kostet nichts.',
      'Du kannst dich außerdem jederzeit an die Kontaktstelle wenden, die in dieser App unter „Inhalte melden und Kontaktstelle" steht.',
      'Deine Rechte vor Gericht und dein Recht, dich bei einer Aufsichtsbehörde zu beschweren, bleiben davon unberührt.',
    ],
  },
  {
    heading: '7. Punkte, Level und Abzeichen',
    paragraphs: [
      'Punkte, Level und Abzeichen sind ein Dankeschön und sonst nichts. Sie haben keinen Geldwert, lassen sich nicht auszahlen, nicht übertragen und nicht eintauschen. Es gibt keine Verlosung und keine Gewinnspiele.',
      'Punkte vergibt ausschließlich der Server, nie die App auf deinem Gerät. Für Fotos aus der Galerie gibt es bewusst keine Punkte, weil Ort und Zeitpunkt dort nicht überprüfbar sind.',
      'Wir können das Punktesystem jederzeit ändern oder einstellen. Ein Anspruch auf Punkte besteht nicht.',
    ],
  },
  {
    heading: '8. Verfügbarkeit und Haftung',
    paragraphs: [
      'CLAR wird kostenlos bereitgestellt. Wir geben uns Mühe, dass alles läuft, können aber keine ununterbrochene Verfügbarkeit zusichern.',
      'Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder Gesundheit. Bei einfacher Fahrlässigkeit haften wir nur, wenn eine Pflicht verletzt wird, auf deren Erfüllung du vertrauen darfst, und nur in Höhe des vorhersehbaren, typischen Schadens. Die Haftung nach dem Produkthaftungsgesetz bleibt unberührt.',
      'Für Inhalte, die andere Nutzerinnen und Nutzer hochladen, haften wir nach Maßgabe der Art. 6 und 8 der Verordnung (EU) 2022/2065.',
      'Ob und wann die zuständige Stelle gemeldeten Müll beseitigt, entscheidet sie selbst. Darauf haben wir keinen Einfluss.',
    ],
  },
  {
    heading: '9. Konto beenden',
    paragraphs: [
      'Du kannst dein Konto jederzeit und ohne Angabe von Gründen löschen: im Profil unter „Konto löschen" oder ohne die App über [BETREIBER EINTRAGEN: Web-Lösch-URL].',
      'Wir können den Nutzungsvertrag mit einer Frist von 14 Tagen kündigen; bei schweren Verstößen auch sofort.',
    ],
  },
  {
    heading: '10. Änderungen dieser Bedingungen',
    paragraphs: [
      'Wir dürfen diese Bedingungen ändern, wenn sich die App oder die Rechtslage ändert. Über wesentliche Änderungen informieren wir dich in der App, bevor sie gelten. Bist du nicht einverstanden, kannst du dein Konto löschen.',
    ],
  },
  {
    heading: '11. Schlussbestimmungen',
    paragraphs: [
      'Es gilt deutsches Recht. Wenn du Verbraucherin oder Verbraucher bist, bleiben die zwingenden Schutzvorschriften des Staates, in dem du wohnst, davon unberührt.',
      'Sollte eine Regelung unwirksam sein, bleibt der Rest wirksam.',
      'Datenschutz regelt die Datenschutzerklärung in dieser App.',
    ],
  },
];

export default function AgbScreen() {
  return <LegalDoc title="Nutzungsbedingungen" updatedAt={POLICY_DATE} sections={SECTIONS} />;
}
