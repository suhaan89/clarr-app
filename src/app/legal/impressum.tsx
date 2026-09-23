// Anbieterkennzeichnung nach § 5 DDG (frueher § 5 TMG) und § 18 (2) MStV.
//
// [ANWALT PRÜFEN] Ob eine Anbieterkennzeichnung ueberhaupt pflichtig ist,
// haengt davon ab, ob CLAR geschaeftsmaessig angeboten wird; bei einem rein
// privaten, nicht kommerziellen Angebot entfaellt sie. Da das aus dem Repo
// nicht hervorgeht (siehe FRAGEN.md), wird die Kennzeichnung vorsorglich
// vollstaendig vorbereitet.
//
// [ANWALT PRÜFEN] Minderjaehrige Betreiber: die ladungsfaehige Anschrift muss
// eine echte, zustellfaehige Adresse sein. Eine private Wohnanschrift eines
// minderjaehrigen Betreibers sollte NICHT ohne Beratung veroeffentlicht
// werden; ueblich sind ein Traegerverein, die Schule oder ein
// Dienstleistungsangebot mit ladungsfaehiger Adresse. Die Felder bleiben
// deshalb als klar markierte Betreiberfelder stehen, statt geraten zu werden.
//
// Bewusst NUR auf Deutsch: Rechtstexte werden nicht maschinell uebersetzt.

import { LegalDoc, type LegalSection } from '@/components';
import { POLICY_DATE } from '@/constants/legal';

const SECTIONS: LegalSection[] = [
  {
    heading: 'Anbieter',
    paragraphs: [
      '[BETREIBER EINTRAGEN: Name der natürlichen oder juristischen Person, bei Vereinen zusätzlich die Rechtsform]',
      '[BETREIBER EINTRAGEN: Straße und Hausnummer]',
      '[BETREIBER EINTRAGEN: Postleitzahl und Ort]',
      'Deutschland',
    ],
  },
  {
    heading: 'Vertretungsberechtigt',
    paragraphs: [
      '[BETREIBER EINTRAGEN: vertretungsberechtigte Person; bei minderjährigen Betreibern die gesetzlichen Vertreter oder der Trägerverein]',
    ],
  },
  {
    heading: 'Kontakt',
    paragraphs: [
      'E-Mail: [BETREIBER EINTRAGEN: allgemeine Kontaktadresse]',
      'Datenschutz: [BETREIBER EINTRAGEN: Datenschutz-E-Mail]',
      'Sicherheitslücken: [BETREIBER EINTRAGEN: Sicherheits-E-Mail]',
      'Ein Telefonkontakt ist nicht zwingend, es muss aber ein zweiter, schneller Kommunikationsweg bestehen. [BETREIBER EINTRAGEN: Telefonnummer oder Kontaktformular-URL]',
    ],
  },
  {
    heading: 'Registereintrag und Umsatzsteuer',
    paragraphs: [
      '[BETREIBER EINTRAGEN: Registergericht und Registernummer, falls vorhanden, sonst „nicht vorhanden"]',
      '[BETREIBER EINTRAGEN: Umsatzsteuer-Identifikationsnummer nach § 27 a UStG, falls vorhanden, sonst „nicht vorhanden"]',
    ],
  },
  {
    heading: 'Verantwortlich für den Inhalt nach § 18 (2) MStV',
    paragraphs: [
      '[BETREIBER EINTRAGEN: Name und Anschrift der verantwortlichen Person]',
    ],
  },
  {
    heading: 'Kontaktstelle nach dem Digital Services Act',
    paragraphs: [
      'CLAR zeigt von Nutzerinnen und Nutzern hochgeladene Inhalte öffentlich an und ist damit ein Hostingdienst im Sinne der Verordnung (EU) 2022/2065. Die einheitliche Kontaktstelle für Behörden (Art. 11) und für Nutzerinnen und Nutzer (Art. 12) sowie der Weg, rechtswidrige Inhalte zu melden, stehen in dieser App unter „Inhalte melden und Kontaktstelle".',
    ],
  },
  {
    heading: 'Streitbeilegung',
    paragraphs: [
      'Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
    ],
  },
  {
    heading: 'Haftung für Inhalte und Links',
    paragraphs: [
      'Für eigene Inhalte sind wir nach den allgemeinen Gesetzen verantwortlich. Für von Nutzerinnen und Nutzern übermittelte Inhalte gelten die Haftungsprivilegien der Art. 6 und 8 der Verordnung (EU) 2022/2065: Wir überwachen die Inhalte nicht allgemein, entfernen aber rechtswidrige Inhalte unverzüglich, sobald wir davon Kenntnis erlangen.',
      'Für Inhalte externer Seiten, auf die wir verlinken, ist jeweils deren Anbieter verantwortlich.',
    ],
  },
];

export default function ImpressumScreen() {
  return <LegalDoc title="Impressum" updatedAt={POLICY_DATE} sections={SECTIONS} />;
}
