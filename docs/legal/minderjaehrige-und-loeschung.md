<!--
  ENTWURF / ANALYSE — JURISTISCH PRÜFEN. Keine Rechtsberatung, sondern eine
  Gegenüberstellung "Store-Anforderung ↔ aktueller Stand im Code" mit einer
  konkreten Lückenliste. Grundlage: docs/auth.md, docs/trust-safety.md,
  docs/legal/data-flows.md und der verifizierte Code-Stand (2026-07-20).
-->

# Minderjährige & Konto-Löschung — Store-Anforderungen vs. Ist-Stand

Zielgruppe ist **teilweise minderjährig** — der wichtigste Kontext für die
Freigabe. Dieses Dokument listet auf, was für App Store und Play Store fehlt.

## 1. Aktueller Ist-Stand (im Code verifiziert)

- **Alters-Selbstauskunft:** `src/app/login.tsx` zeigt bei der Registrierung
  einen Pflicht-Switch „Ich bin 16 Jahre oder älter"; ohne Bestätigung kein
  `signUp`. Die Bestätigung wird über `record_consent('altersbestaetigung',
  true)` (Migration 021) append-only gespeichert. **Kein Geburtsdatum**
  (Datenminimierung).
- **Keine serverseitige Sperre** unter 16: Wer den Switch aktiviert, kommt
  durch. Es gibt nur einen Hinweistext — bewusst offen gelassen bis zur
  rechtlichen Klärung (docs/auth.md).
- **Konto-Löschung (in-App):** `Profil → Konto löschen` ruft die Edge Function
  `delete-account` (JWT-basiert, nur eigenes Konto) — verifiziert.
- **Daten-Export (in-App):** `Profil → Meine Daten exportieren` ruft
  `export-my-data` (JWT-basiert, nur eigenes Konto) — verifiziert.
- **Datenschutz/Impressum:** seit dem Legal-Audit 2026-09-23 ausformulierte
  In-App-Screens (`src/app/legal/datenschutz.tsx`, `impressum.tsx`) plus
  Nutzungsbedingungen (`agb.tsx`), DSA-Kontaktstelle (`kontakt.tsx`) und
  Lizenzen (`lizenzen.tsx`). Datenschutz, Nutzungsbedingungen und Impressum
  sind jetzt auch **vor** der Registrierung vom Login-Screen aus erreichbar.
- **Nachweis der Altersbestätigung** funktioniert seit dem Audit auch bei
  eingeschalteter E-Mail-Bestätigung: er wird lokal vorgemerkt und beim ersten
  Login nachgetragen (`src/lib/consent.ts`). Vorher ging er in genau dieser
  Konfiguration verloren.
- **Lokale Daten bei Kontolöschung:** Offline-Queue samt kopierter Fotos und
  die Install-ID werden seit dem Audit mitgelöscht.

## 2. Apple App Store — Minderjährige

| Anforderung | Status | To-do |
|---|---|---|
| **Altersfreigabe (Age Rating)** korrekt setzen | offen | Fragebogen in App Store Connect (Entwurf: store-angaben.md) ausfüllen. Nutzergenerierte Inhalte + Karten/Standort ⇒ voraussichtlich **nicht** 4+. |
| **Kids Category?** | Entscheidung offen | Nur wählen, wenn gezielt < 13. Die **Kids Category** verbietet Datenweitergabe an Dritte und Standorterfassung in weiten Teilen — mit KI-Fotoanalyse (Anthropic) und Karte **kaum vereinbar**. Empfehlung: **nicht** in Kids Category, sondern reguläre Kategorie mit passender Altersfreigabe. JURISTISCH/STRATEGISCH PRÜFEN. |
| **App Privacy „Nutrition Label"** | Entwurf vorhanden | store-angaben.md übertragen. |
| **Elterliche Einwilligung** bei < Altersgrenze | fehlt | Siehe §5 – Konzept + ggf. technisches Gate erforderlich. |
| Guideline 1.3 / 5.1.4 (Kids, Datenschutz Minderjähriger) | zu prüfen | Reviewer achten bei Minderjährigen-Zielgruppe besonders auf Datensparsamkeit + Einwilligung. |

## 3. Google Play — Families / Minderjährige

| Anforderung | Status | To-do |
|---|---|---|
| **„Target audience and content"**-Fragebogen | offen | In Play Console ausfüllen. Wenn Kinder **mit** Zielgruppe: **Families-Policy** greift. |
| **Designed for Families / Teacher Approved** | Entscheidung offen | KI-Fotoanalyse + Standort erschweren Families-Programm-Teilnahme; wie bei Apple: reguläre Zielgruppe **ab Teenager** realistischer. JURISTISCH/STRATEGISCH PRÜFEN. |
| **Data Safety-Formular** | Entwurf vorhanden | store-angaben.md übertragen. |
| **Content Rating (IARC)** | Entwurf vorhanden | Fragebogen ausfüllen (store-angaben.md). |
| **Konto-Löschung: Web-Route** | **fehlt (Blocker)** | Play verlangt zusätzlich zur In-App-Löschung eine **öffentlich erreichbare Web-URL** zur Löschung — ohne App-Installation auffindbar. Siehe §4 + hosting-checkliste.md. |

## 4. Konto-Löschung — Web-Route (Google-Play-Pflicht)

Play-Policy „Data deletion": Apps mit Konto-Anlage müssen **beides** bieten:
1. Löschung **in der App** — ✅ vorhanden (`delete-account`).
2. Eine **im Web erreichbare** Möglichkeit, die Löschung zu beantragen bzw.
   auszulösen — ❌ fehlt.

**Optionen (eine wählen, JURISTISCH/TECHNISCH PRÜFEN):**

- **A – Web-Self-Service (sauberste Lösung):** Der bestehende Expo-**Web-Build**
  (SPA, `web.output: "single"`) enthält denselben Login + „Konto löschen"-Flow.
  Wird er öffentlich gehostet (siehe hosting-checkliste.md), erfüllt die
  Profil-Seite die Web-Löschanforderung. Vorteil: nutzt die schon geprüfte,
  JWT-basierte `delete-account`-Function; kein neuer Angriffspfad.
- **B – Löschformular/-Anfrage:** Eine statische Seite unter der Datenschutz-Domain
  („Konto löschen: schreib an [E-Mail] von deiner Registrierungs-Adresse; wir
  löschen binnen [X] Tagen"). Einfacher zu hosten, aber manueller Prozess +
  Identitätsnachweis nötig (Missbrauchsschutz gegen Fremd-Löschung).

Play verlangt, dass die Lösch-URL im Play-Console-Formular „Data deletion"
hinterlegt und in der Datenschutzerklärung genannt wird (Abschnitt 9 dort).

## 5. Konkrete Lückenliste (vor Release zu entscheiden)

1. **Alters-Strategie festlegen** (JURISTISCH): Zielaltersband je Store, ob
   Kids/Families-Programm (Empfehlung: nein) — bestimmt Altersfreigabe & Policy.
2. **Elterliche Einwilligung** (Art. 8 DSGVO) unter der gewählten Altersgrenze:
   ob erforderlich und wie (verifizierbar?) — inkl. Frage, ob ein
   **serverseitiges Alters-Gate** statt reiner Selbstauskunft nötig ist.
3. **Web-Löschroute** bereitstellen (Option A oder B) und URL überall eintragen.
4. **Datenklassen** in App Privacy / Data Safety final bestätigen (store-angaben.md).
5. **Impressum-Anschrift** für minderjährige Betreiber lösen (impressum.md).
6. Prüfen, ob `behoerden_weitergabe`-Consent die Digest-Aufnahme **technisch**
   gaten muss (offener Punkt aus data-flows.md; aktuell enthält der Digest keine
   personenbezogenen Melder-Daten).
