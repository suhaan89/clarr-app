// Kontaktstelle und Melde-Weg nach dem Digital Services Act.
//
// Deckt ab:
//   Art. 11 DSA  einheitliche Kontaktstelle fuer Behoerden,
//   Art. 12 DSA  Kontaktstelle fuer Nutzerinnen und Nutzer, leicht zugaenglich,
//   Art. 16 DSA  Melde- und Abhilfeverfahren, das JEDE Person nutzen kann,
//                auch ohne Konto — deshalb steht der E-Mail-Weg hier und
//                nicht nur der Flag-Knopf, den nur angemeldete Nutzer sehen.
//   Art. 20 DSA  internes Beschwerdemanagement.
//
// [ANWALT PRÜFEN] Ob CLAR als Kleinst- oder Kleinunternehmen nach Art. 19 DSA
// von Art. 20 bis 28 ausgenommen ist. Das haengt an Mitarbeiterzahl und
// Umsatz und damit daran, ob CLAR kommerziell betrieben wird (FRAGEN.md).
// Der Beschwerdeweg ist unabhaengig davon eingerichtet, weil er ohnehin
// existiert (Review-Queue) und nichts kostet.
//
// [ANWALT PRÜFEN] Ob zusaetzlich eine Meldung des Dienstes an die
// Bundesnetzagentur als Koordinator fuer digitale Dienste noetig ist.
//
// Bewusst NUR auf Deutsch: Rechtstexte werden nicht maschinell uebersetzt.

import { LegalDoc, type LegalSection } from '@/components';
import { POLICY_DATE } from '@/constants/legal';

const SECTIONS: LegalSection[] = [
  {
    heading: 'Einen Inhalt melden',
    paragraphs: [
      'Wenn dir auf der Karte oder in einem Fall etwas auffällt, das rechtswidrig ist oder gegen unsere Regeln verstößt, melde es uns. Das geht auf zwei Wegen.',
      'In der App: öffne den Fall und tippe unten auf „Inhalt melden". Wähle einen Grund aus. Der Inhalt verschwindet sofort aus der Öffentlichkeit, bis ein Mensch ihn geprüft hat.',
      'Ohne Konto, per E-Mail: schreib an [BETREIBER EINTRAGEN: Melde-E-Mail]. Damit wir schnell handeln können, schreib bitte dazu, um welchen Fall es geht (Link oder Beschreibung des Ortes), was genau du beanstandest und warum du den Inhalt für rechtswidrig hältst. Eine Kontaktadresse von dir hilft uns, dir das Ergebnis mitzuteilen, ist aber keine Bedingung.',
      'Du bekommst eine Bestätigung des Eingangs und, sobald entschieden ist, eine Mitteilung über das Ergebnis mit Begründung und den möglichen Rechtsbehelfen.',
      'Besonders wichtig: Wenn auf einem Foto ein Gesicht, ein Kennzeichen oder ein privates Grundstück zu erkennen ist, melde es bitte sofort. Unsere automatische Verpixelung ist gut, aber nicht fehlerfrei.',
    ],
  },
  {
    heading: 'Was mit deiner Meldung passiert',
    paragraphs: [
      'Jede Meldung landet in einer Prüfliste, die ein Mensch abarbeitet. Bis dahin ist der gemeldete Inhalt nicht mehr öffentlich sichtbar.',
      'Wir entscheiden zügig und, wenn es um Gefahren für Leib und Leben oder um Abbildungen von Personen geht, vorrangig.',
      'Missbrauch des Meldewegs, also wiederholt offensichtlich unbegründete Meldungen, kann dazu führen, dass wir Meldungen von diesem Konto vorübergehend nicht mehr bearbeiten.',
    ],
  },
  {
    heading: 'Beschwerde gegen unsere Entscheidung',
    paragraphs: [
      'Bist du mit einer Entscheidung nicht einverstanden, weil dein Inhalt entfernt oder deine Meldung abgelehnt wurde, kannst du das kostenlos anfechten.',
      'In der App: Fallansicht, „Überprüfung anfordern".',
      'Per E-Mail: [BETREIBER EINTRAGEN: Melde-E-Mail], Stichwort „Beschwerde".',
      'Die Beschwerde prüft ein Mensch, nicht dieselbe Automatik, die entschieden hat. Du bekommst eine begründete Antwort.',
      'Unabhängig davon steht dir der Rechtsweg offen, und du kannst dich an eine nach Art. 21 DSA zertifizierte außergerichtliche Streitbeilegungsstelle wenden.',
    ],
  },
  {
    heading: 'Kontaktstelle für Nutzerinnen und Nutzer (Art. 12 DSA)',
    paragraphs: [
      'E-Mail: [BETREIBER EINTRAGEN: Melde-E-Mail]',
      'Sprachen: Deutsch und Englisch.',
      'Die Kommunikation läuft per E-Mail; ein vollautomatisiertes Verfahren setzen wir dabei nicht ein.',
    ],
  },
  {
    heading: 'Kontaktstelle für Behörden (Art. 11 DSA)',
    paragraphs: [
      'Für Behörden der Mitgliedstaaten, die Kommission und das Gremium für digitale Dienste:',
      'E-Mail: [BETREIBER EINTRAGEN: Behörden-Kontakt-E-Mail]',
      'Postanschrift: siehe Impressum.',
      'Sprachen: Deutsch und Englisch.',
    ],
  },
  {
    heading: 'Datenschutz-Aufsichtsbehörde',
    paragraphs: [
      'Geht es um deine personenbezogenen Daten, kannst du dich auch direkt an die Aufsichtsbehörde wenden: Landesbeauftragter für den Datenschutz und die Informationsfreiheit Baden-Württemberg, Lautenschlagerstraße 20, 70173 Stuttgart.',
    ],
  },
];

export default function KontaktScreen() {
  return (
    <LegalDoc
      title="Inhalte melden und Kontaktstelle"
      updatedAt={POLICY_DATE}
      sections={SECTIONS}
    />
  );
}
