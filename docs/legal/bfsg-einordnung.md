<!--
  Einordnung zum Barrierefreiheitsstärkungsgesetz (BFSG). Erstellt im
  Legal-Audit 2026-09-23. Keine anwaltliche Bewertung.
-->

# BFSG: Einordnung und Selbstverpflichtung

**Stand:** 23.09.2026

## 1. Ist das BFSG anwendbar?

Das BFSG gilt seit dem 28. Juni 2025 für bestimmte Produkte und
Dienstleistungen, die Verbraucherinnen und Verbrauchern **auf dem Markt
bereitgestellt** werden. Erfasst sind unter anderem Dienstleistungen im
elektronischen Geschäftsverkehr, Bankdienstleistungen, E-Books, Telefon- und
Messenger-Dienste und der Personenverkehr.

Für CLAR spricht gegen eine Anwendbarkeit:

- **Kein elektronischer Geschäftsverkehr.** § 2 Nr. 26 BFSG setzt einen
  Vertragsabschluss über einen Online-Shop oder ein vergleichbares Angebot
  voraus. CLAR verkauft nichts, hat keine Käufe in der App, kein Abo und keine
  Zahlungsfunktion.
- **Keine der anderen aufgezählten Dienstleistungen.** CLAR ist weder ein
  Kommunikationsdienst im Sinne des TKG noch ein Bank-, Verkehrs- oder
  Mediendienst.
- **Kleinstunternehmerausnahme.** Für Dienstleistungen gilt § 3 (3) BFSG:
  Anbieter mit weniger als zehn Beschäftigten und höchstens zwei Millionen
  Euro Jahresumsatz sind ausgenommen. Das dürfte hier zutreffen.
  [BETREIBER EINTRAGEN: tatsächliche Größe.]

**Ergebnis:** Das BFSG ist nach hiesiger Einschätzung **nicht anwendbar**.
[ANWALT PRÜFEN], insbesondere falls CLAR später kommerzialisiert wird oder
eine Zahlungsfunktion erhält. Das BITV-Regime für öffentliche Stellen greift
ebenfalls nicht, solange CLAR nicht von einer öffentlichen Stelle betrieben
wird.

## 2. Warum trotzdem barrierefrei

Die App richtet sich an die Allgemeinheit einschließlich junger Menschen und
lebt davon, dass möglichst viele mitmachen. Barrierefreiheit ist hier
Produktqualität, nicht Pflichterfüllung. Der bestehende Stand ist bereits
deutlich besser als das Übliche:

- Jede druckbare Fläche hat `accessibilityRole` und ein beschreibendes
  `accessibilityLabel`, Mindestgröße 44 Punkt.
- `allowFontScaling` durchgehend, damit Systemschriftgrößen greifen.
- Statusmeldungen mit `accessibilityLiveRegion`, damit Screenreader sie
  vorlesen.
- `useReducedMotion` wird respektiert, Animationen sind abschaltbar
  (`src/lib/accessibility.ts`).
- Farben werden nie als alleiniger Bedeutungsträger eingesetzt: Status trägt
  immer zusätzlich ein Icon und Text.

## 3. Selbstverpflichtung

Bis zu einer anderslautenden rechtlichen Bewertung orientieren wir uns
freiwillig an WCAG 2.1 Stufe AA für die Kernabläufe Anmelden, Melden, Karte,
Fall ansehen und Konto löschen. Neue Bildschirme werden mit aktiviertem
Screenreader und mit der größten Systemschriftgröße gegengeprüft, bevor sie
zusammengeführt werden.
