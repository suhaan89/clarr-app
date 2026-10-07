<!--
  Datenschutz-Folgenabschätzung nach Art. 35 DSGVO.
  Erstellt im Legal-Audit 2026-09-23. Dies ist ein vollständig ausgefülltes
  Gerüst auf Basis des verifizierten Code-Stands, KEINE anwaltliche Bewertung.

  [ANWALT PRÜFEN] Die Gesamtbewertung "kein verbleibendes hohes Risiko" und
  damit die Frage, ob eine vorherige Konsultation der Aufsichtsbehörde nach
  Art. 36 DSGVO nötig ist.
-->

# Datenschutz-Folgenabschätzung (Art. 35 DSGVO)

**Stand:** 23.09.2026 · **Verantwortlicher:** siehe `impressum.md`

## 1. Warum eine DSFA nötig ist

Art. 35 (3) DSGVO und die Muss-Liste des LfDI Baden-Württemberg greifen
mehrfach zugleich:

- **Systematische umfangreiche Verarbeitung von Standortdaten.**
- **Verarbeitung von Daten schutzbedürftiger Personen**, weil die Zielgruppe
  ausdrücklich auch Minderjährige umfasst.
- **Einsatz neuer Technologien**, hier ein KI-Bildmodell.
- **Verarbeitung von Daten Dritter ohne deren Wissen**: Personen, die zufällig
  auf einem Foto erscheinen, wissen von der Verarbeitung nichts.
- **Automatisierte Entscheidung** über die Sichtbarkeit eines Inhalts.
- **Öffentliche Zugänglichmachung** der Ergebnisse.

Jeder Punkt allein wäre diskutabel, die Kombination nicht. Die DSFA ist
deshalb zu führen.

## 2. Beschreibung der Verarbeitung

Siehe `verzeichnis-verarbeitungstaetigkeiten.md` (V1 bis V8) und
`data-flows.md`. Kern: eine Person fotografiert Müll im öffentlichen Raum, die
App bestimmt den Standort, ein KI-Modell prüft das Bild, eine anonymisierte
Kopie erscheint auf einer öffentlichen Karte, geprüfte Fälle gehen gesammelt
an die zuständige Stelle.

## 3. Notwendigkeit und Verhältnismäßigkeit

- **Zweckbindung:** jede erhobene Kategorie hat genau einen Zweck; es gibt
  keine Zweitverwertung, keine Werbung, keinen Verkauf.
- **Datenminimierung:** kein Klarname, kein Geburtsdatum, keine Hardware-IDs,
  kein Verursacherfeld, keine Bewegungsprofile, nur eine zufällige Install-ID
  und die auch nur als Hash.
- **Erforderlichkeit des Standorts:** ohne Ort ist eine Müllmeldung
  wertlos; die zuständige Stelle muss den Fund finden können. Öffentlich wird
  der Ort nur gerundet gezeigt.
- **Erforderlichkeit der KI:** manuelle Prüfung jedes Fotos ist bei einem
  ehrenamtlich betriebenen Dienst nicht leistbar, und ohne Vorabprüfung
  gelangten Gesichter und Kennzeichen ungefiltert an die Öffentlichkeit. Die
  KI senkt das Risiko, sie erhöht es nicht.

## 4. Risiken für die Betroffenen

| # | Risiko | Betroffene | Eintritt | Schwere | Brutto |
|---|---|---|---|---|---|
| R1 | Eine Person ist auf einem öffentlichen Foto erkennbar, weil die Verpixelung versagt | Dritte | mittel | hoch | **hoch** |
| R2 | Ein Kennzeichen bleibt lesbar und ermöglicht die Zuordnung eines Fahrzeugs | Dritte | mittel | mittel | mittel |
| R3 | Der Fundort liegt so, dass aus ihm auf die meldende Person geschlossen werden kann (etwa direkt vor ihrer Wohnung) | Meldende | mittel | mittel | mittel |
| R4 | Ein Foto zeigt Privatgrund und wird öffentlich | Dritte | gering | hoch | mittel |
| R5 | Eine Meldung wird automatisch zu Unrecht abgelehnt | Meldende | mittel | gering | gering |
| R6 | Minderjährige geben ohne wirksame Einwilligung Daten preis | Minderjährige | mittel | hoch | **hoch** |
| R7 | Kontoübernahme über ein entwendetes Refresh-Token | Meldende | gering | hoch | mittel |
| R8 | Übermittlung des Bildes in die USA ohne tragfähige Grundlage | alle | offen | mittel | offen |
| R9 | Missbrauch der App zur gezielten Beobachtung einer Person | Dritte | gering | hoch | mittel |
| R10 | Fotos (auch von Minderjährigen gemeldet, mit Dritten im Bild) werden für das Training weiterverwendet oder gelangen dabei zu Dritten | Meldende, Dritte | mittel | mittel | mittel |
| R11 | Ein manipulierter On-Device-Score beeinflusst Veröffentlichung oder Punkte | alle | mittel | gering | gering |

## 5. Abhilfemaßnahmen und Restrisiko

| # | Maßnahme (umgesetzt, sofern nicht anders vermerkt) | Restrisiko |
|---|---|---|
| R1 | KI-Erkennung von Gesichtern mit 15 Prozent Polster, Pixelierung in 24-Pixel-Blöcken; bei erkannten Personen **immer** menschliche Freigabe vor der Veröffentlichung; schlägt die Erkennung fehl, bleibt das Foto unveröffentlicht; jede Person kann ein Foto ohne Konto per E-Mail melden, der Inhalt verschwindet sofort | gering bis mittel |
| R2 | wie R1, Kennzeichen werden im selben Durchgang erkannt und gepolstert verpixelt | gering |
| R3 | öffentliche Position auf eine Geohash-8-Zelle gerundet (etwa 20 bis 40 Meter), kein Melder-Bezug sichtbar, keine Meldehistorie öffentlich | gering |
| R4 | eigener KI-Prüfschritt auf Privatkontext; solche Meldungen werden nie automatisch veröffentlicht, sondern gehen an einen Menschen | gering |
| R5 | konkrete Begründung in der Fallansicht, Hinweis auf die Automatisierung, kostenloser Antrag auf menschliche Überprüfung, keine finanziellen Folgen (Punkte ohne Geldwert) | gering |
| R6 | Altersbestätigung mit Nachweis, Hinweis auf elterliche Einwilligung mit Kontaktweg, keine Werbung, kein Profiling, keine Dark Patterns, Bestenliste standardmäßig aus, Pseudonym statt Klarname; **kein** verifizierbares Alters-Gate | mittel, [ANWALT PRÜFEN] |
| R7 | Sitzung nativ AES-verschlüsselt, Schlüssel in SecureStore; offener Punkt: vollständige Ablage in SecureStore, siehe `FRAGEN.md` Abschnitt 1 | gering bis mittel |
| R8 | Standardvertragsklauseln beziehungsweise Data Privacy Framework, keine Nutzerkennung im Prompt; Vertragslage nicht im Repo belegt | offen, `FRAGEN.md` |
| R9 | kein Verursacherfeld, keine Personensuche, keine Historie je Ort, Meldeweg für Betroffene, Sperrmöglichkeit bei Missbrauch | gering |
| R10 | Opt-in `ki_training` (Standard aus), nur Meldungen nach Einwilligung, nur verpixelte UND freigegebene Kopien, Privatgrund und unzulässige Inhalte ausgeschlossen, kein Client-Zugriff, Training nur lokal (kein Colab/Cloud mit Nutzerfotos), Widerruf löscht sofort, Frist 24 Monate, Löschabgleich vor jedem Training, Neutraining spätestens alle 12 Monate | gering, [ANWALT PRÜFEN] Einwilligung 16/17-Jährige |
| R11 | Score wird nur gespeichert; serverseitig darf er ausschließlich eine Vorlage bei einem Menschen auslösen (standardmäßig aus), nie Veröffentlichung, Ablehnung oder Punkte | gering |

## 6. Ergebnis

Nach den Maßnahmen verbleibt nach hiesiger Einschätzung kein hohes Risiko, das
eine vorherige Konsultation der Aufsichtsbehörde nach Art. 36 DSGVO auslöst.
Zwei Punkte sind dafür jedoch vorher zu klären: die Wirksamkeit der
Einwilligung Minderjähriger (R6) und die Transfergrundlage für die
Bildübermittlung (R8). [ANWALT PRÜFEN]

**Nachtrag 28.09.2026:** Überprüfung wegen des eigenen On-Device-Modells und
des freiwilligen KI-Trainings (R10, R11). Die Gesamtbewertung ändert sich
nach hiesiger Einschätzung nicht. [ANWALT PRÜFEN]

**Nachtrag 07.10.2026:** Wechsel des KI-Anbieters für die serverseitige
Foto-Prüfung von Anthropic zu Cloudflare Workers AI (offenes Modell Mistral
Small 3.1). Neu zu bewerten sind R1 (ein kleineres Modell kann Gesichter und
Kennzeichen eher übersehen; die menschliche Freigabe bei jedem Treffer und
der Fail-safe bei Fehlern bleiben) und R8 (anderer Empfänger, Rechenzentren
weltweit). Diese Überprüfung steht aus, siehe `FRAGEN.md` Punkt 17.
[ANWALT PRÜFEN]

## 7. Überprüfung

Die DSFA wird überprüft, wenn sich die Verarbeitung ändert, mindestens aber
jährlich, und zwingend bei: Einführung von Push, Einführung von Analyse- oder
Absturzberichten, Wechsel oder Erweiterung des KI-Modells, jeder neuen
automatisierten Entscheidung, jeder Ausweitung der öffentlich sichtbaren
Daten. Die Selbstprüf-Fragen dafür stehen in `docs/vision.md`.
