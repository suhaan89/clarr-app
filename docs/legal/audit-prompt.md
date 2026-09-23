# Legal-Compliance-Audit für CLAR (Prompt für Claude Code)

Du bist ein sorgfältiger Compliance-Engineer für eine deutsche Mobile-App. Führe einen vollständigen rechtlichen Compliance-Audit dieses Repos durch. Die App heißt CLAR (Clean, Locate, Alert, Reward): Nutzer fotografieren illegale Müllablagerungen, die Meldung wird mit Standort gespeichert, per KI geprüft (Supabase Edge Function `analyze-photo` mit Anthropic Vision), ggf. an Behörden weitergeleitet (`authority-digest`) und mit Rewards belohnt. Stack: React Native, Expo SDK 54, Supabase (Auth, DB, Storage, Edge Functions), Anthropic API, react-native-maps, On-Device-Modell (react-native-fast-tflite). Zielmarkt: Deutschland/EU, Nutzer können minderjährig sein. Die App ist noch nicht veröffentlicht.

## Arbeitsregeln

1. **Arbeite komplett selbstständig.** Ich bin nicht erreichbar. Stelle mir keine Fragen und warte nie auf eine Freigabe. Führe Phase 1 und danach direkt Phase 2 aus. Wenn du eine Entscheidung treffen musst, wähle die vernünftigste und datenschutzfreundlichste Option, setze sie um und dokumentiere die Annahme im Bericht und in `FRAGEN.md`.
   - Arbeite auf einem neuen Git-Branch `legal-audit` (vorher `git status` prüfen und offene Änderungen committen oder stashen). Committe lokal, aber **pushe nicht**.
   - **Verboten:** destruktive Befehle (`git reset --hard`, `git clean`, `rm -rf` im Repo, Force-Push), Deploys, `supabase db push` oder andere Änderungen an der Remote-Datenbank, Löschen echter Daten, Ändern von Secrets oder `.env`.
   - Neue Migrationen darfst du als Dateien anlegen, aber nicht gegen die Remote-Datenbank ausführen.
   - **Setze alles um, was fehlt oder nur teilweise erfüllt ist**, auch Punkte mit `[ANWALT PRÜFEN]` und auch P2. Nichts wird aufgeschoben oder mir zur Entscheidung zurückgegeben. Wo eine Entscheidung nötig ist, triffst du sie selbst (datenschutzfreundlichste Variante) und baust sie ein.
2. **Code ist die Wahrheit.** Prüfe, was der Code tatsächlich tut (Migrations, Edge Functions, `src/`, `app.json`, `eas.json`, `package.json`), und vergleiche das mit den Texten in `docs/legal/`. Abweichungen sind die wichtigsten Findings.
3. **Nichts erfinden.** Wenn eine Info nicht im Repo steht (z. B. Supabase-Region, ob AV-Verträge unterschrieben sind, ob CLAR kommerziell betrieben wird), schreib sie als offene Frage in `FRAGEN.md` statt zu raten.
4. **Rechtstexte direkt schreiben und einbauen.** Schreib fehlende oder falsche Rechtstexte (Datenschutzerklärung, AGB, Hinweise, Begründungstexte usw.) vollständig und binde sie in die App ein. Markiere juristisch heikle Stellen nur mit `[ANWALT PRÜFEN]` als Kommentar, aber setze sie trotzdem um.
5. Halte dich an `AGENTS.md` und `CLAUDE.md`: alle UI-Strings über `src/lib/i18n`, Deutsch und Englisch Pflicht.
6. Schreibe ohne Gedankenstriche (keine em-dashes).

## Phase 1: Dateninventar (Grundlage für alles)

Erstelle zuerst ein vollständiges Inventar, was die App wirklich erhebt und wohin es fließt:

- Alle Tabellen und Spalten aus `supabase/migrations` mit personenbezogenen Daten (inkl. Standort, Fotos, IDs, Geräteinfos, Punkte/Rewards, Moderationsstatus).
- Alle Storage-Buckets, deren Policies und ob sie öffentlich lesbar sind.
- Alles, was lokal gespeichert wird (AsyncStorage, SecureStore, Dateisystem).
- Alle Berechtigungen (Kamera, Fotos, Standort, ggf. Hintergrund-Standort, Push) inkl. der Usage-Description-Texte in `app.json`.
- Alle ausgehenden Netzwerkaufrufe in App und Edge Functions (`fetch`, SDKs): an wen gehen welche Daten? Achte auf Anthropic, Supabase, Expo/EAS (Updates, Push), Kartenanbieter (Google Maps unter Android via react-native-maps, Apple Maps unter iOS), E-Mail-Versand, Behörden.
- Ob Bilder vor dem Upload von EXIF/GPS-Metadaten bereinigt werden und ob Gesichter/Kennzeichen verpixelt werden.

Vergleiche das Ergebnis mit `docs/legal/data-flows.md`.

## Phase 1: Prüfbereiche

Bewerte jeden Punkt mit **erfüllt / teilweise / fehlt / nicht anwendbar**, Fundstelle (Datei:Zeile) und konkretem Fix.

### A. Datenschutzerklärung passt zur Realität (DSGVO Art. 13, 14)
- Jede Datenkategorie aus dem Inventar ist genannt, mit Zweck, Rechtsgrundlage (Art. 6, ggf. Art. 9), Speicherdauer und Empfängern.
- Drittlandübermittlung (Anthropic und ggf. weitere US-Anbieter) mit Grundlage (Angemessenheitsbeschluss/DPF oder SCC).
- Betroffenenrechte, Widerrufsrecht, Beschwerderecht bei der Aufsichtsbehörde (Baden-Württemberg: LfDI BW), Kontakt des Verantwortlichen.
- Die Datenschutzerklärung ist in der App erreichbar, auch vor der Registrierung.
- Nichts steht drin, was der Code nicht tut, und umgekehrt.

### B. Alle Dritten benannt (Art. 13 Abs. 1 lit. e, Art. 28)
- Liste jeden Dienstleister/Empfänger aus dem Inventar und prüfe, ob er in der Datenschutzerklärung und in `hosting-checkliste.md` steht.
- Für jeden Auftragsverarbeiter: Ist ein AV-Vertrag (DPA) dokumentiert? Wenn unklar, in `FRAGEN.md`.
- Behörden als Empfänger bei `authority-digest`: welche Daten gehen raus, ist das transparent erklärt?

### C. Account-Löschung und Betroffenenrechte (Art. 15 bis 21, Apple 5.1.1(v), Google Play)
- Account-Löschung ist in der App selbst auffindbar und in wenigen Schritten auslösbar (Apple-Pflicht).
- Es gibt zusätzlich eine Web-Möglichkeit zur Löschanfrage ohne App (Google-Play-Pflicht), die in den Store-Angaben verlinkt ist.
- `supabase/functions/delete-account` löscht wirklich alles: Auth-User, Profil, Fotos im Storage, Meldungen (oder anonymisiert sie nachvollziehbar), Rewards, lokale Daten. Prüfe den Code, nicht nur die Doku.
- Datenexport (`export-my-data`) deckt alle Daten aus dem Inventar ab (Art. 15, 20).
- Einwilligungen können widerrufen werden.

### D. EU AI Act
- Klassifiziere jede KI-Komponente: `analyze-photo` (Anthropic Vision), das On-Device-Modell in `src/lib/vision`, `HelpChat.tsx`.
- **Art. 50 Abs. 1 (gilt seit 2. August 2026):** Wenn Nutzer mit einem KI-System interagieren (z. B. Chat), müssen sie klar informiert werden, dass es eine KI ist. Prüfe, ob irgendein Nutzer-Dialog KI-gestützt ist. Wenn `HelpChat` regelbasiert ist: sicherstellen, dass er nicht fälschlich als KI oder als Mensch dargestellt wird.
- **Art. 50 Abs. 2:** Erzeugt die App synthetische Bilder, Texte oder Audio? Wenn ja, maschinenlesbare Kennzeichnung nötig.
- **Art. 5:** Bestätige, dass keine verbotenen Praktiken vorliegen (z. B. manipulative Techniken, Ausnutzung von Schwächen Minderjähriger, biometrische Kategorisierung durch Gesichtsanalyse).
- **Art. 4:** Dokumentiere kurz, wie das Team KI-Kompetenz aufbaut.
- Prüfe, dass die KI-Foto-Prüfung für Nutzer transparent ist: Hinweis im Melden-Flow, Kennzeichnung im Fall-Detail, Erwähnung in der Datenschutzerklärung.

### E. Automatisierte Entscheidungen (DSGVO Art. 22, Art. 13 Abs. 2 lit. f)
- Die KI entscheidet automatisiert über `veroeffentlicht` / `abgelehnt` / `in_pruefung`. Prüfe: Gibt es eine Information über die involvierte Logik, das Recht auf menschliche Überprüfung und einen Weg, eine Ablehnung anzufechten? Hat eine Ablehnung Auswirkungen auf Rewards? `[ANWALT PRÜFEN]` ob Art. 22 greift.

### F. Digital Services Act (Hosting von Nutzerinhalten)
- Art. 11 und 12: Kontaktstelle für Behörden und Nutzer benannt.
- Art. 14: Nutzungsbedingungen erklären Moderationsregeln inkl. automatisierter Prüfung.
- Art. 16: Jeder kann einen Inhalt (Meldung/Foto) als rechtswidrig melden, per Button in der App.
- Art. 17: Wird eine Meldung abgelehnt oder entfernt, bekommt der Nutzer eine Begründung (inkl. Hinweis, ob automatisiert entschieden wurde, und Rechtsbehelfe).
- Art. 20 ff.: Beschwerdesystem usw. nur, falls CLAR nicht unter die Ausnahme für Klein- und Kleinstunternehmen fällt. `[ANWALT PRÜFEN]`

### G. Minderjährige (DSGVO Art. 8, Jugendschutz)
- In Deutschland ist Einwilligung erst ab 16 wirksam. Gibt es eine Altersabfrage und einen Prozess für Einwilligung der Eltern, soweit Einwilligung die Rechtsgrundlage ist?
- Keine Profilbildung/Werbung für Minderjährige, kinderfreundliche Sprache in Hinweisen, sichere Standardeinstellungen (z. B. kein öffentlicher Klarname).
- Vergleiche mit `docs/legal/minderjaehrige-und-loeschung.md`.

### H. Fotos, Standort, Rechte Dritter
- Fotos können Gesichter und Kennzeichen enthalten: werden sie vor Veröffentlichung verpixelt oder nicht öffentlich gezeigt?
- EXIF und GPS-Metadaten werden vor dem Upload entfernt; nur der bewusst gesetzte Standort wird gespeichert.
- Standort nur bei Nutzung (kein Hintergrund-Standort ohne Grund), möglichst geringe Genauigkeit bei öffentlicher Anzeige.
- Berechtigungstexte in `app.json` erklären den Zweck konkret, auf Deutsch und Englisch.

### I. Endgerätezugriff (§ 25 TDDDG)
- Jeder Zugriff auf Gerätespeicher oder Geräteinformationen, der nicht unbedingt erforderlich ist (Analytics, Tracking, Crash-Reporting mit Geräte-IDs), braucht vorherige Einwilligung. Liste alle SDKs, die so etwas tun.

### J. Impressum, AGB, Rewards
- Impressum nach § 5 DDG in der App erreichbar (`docs/legal/impressum.md` vorhanden, aber ist es eingebunden?).
- Nutzungsbedingungen: Nutzungsrechte an hochgeladenen Fotos, Verhaltensregeln, Haftung, Kündigung.
- Rewards: Haben sie Geldwert, gibt es Verlosungen? Dann `[ANWALT PRÜFEN]` Gewinnspielrecht und Teilnahmebedingungen, besonders bei Minderjährigen.

### K. App-Store-Compliance
- Apple Privacy Nutrition Label und Google Play Data Safety stimmen exakt mit dem Inventar überein (`docs/legal/store-angaben.md`).
- iOS Privacy Manifest (`ios.privacyManifests` in `app.json` bzw. PrivacyInfo.xcprivacy) mit den nötigen Required-Reason-APIs.
- Datenschutz-URL und Lösch-URL sind öffentlich erreichbar.

### L. Sicherheit (DSGVO Art. 32, Cyber Resilience Act)
- Keine Secrets im Repo oder in der Git-Historie (`git log -p` gezielt nach Keys durchsuchen). Kein `service_role`-Key und kein Anthropic-Key im Client-Bundle; nur `EXPO_PUBLIC_`-Variablen, die öffentlich sein dürfen.
- RLS ist auf jeder Tabelle aktiviert und die Policies sind sinnvoll. Storage-Policies prüfen.
- Edge Functions prüfen JWT, validieren Eingaben und haben Rate-Limits bzw. Kostenlimits für Anthropic-Aufrufe.
- `npm audit` ausführen und kritische Schwachstellen auflisten.
- Cyber Resilience Act: Seit 11. September 2026 gelten Meldepflichten für aktiv ausgenutzte Schwachstellen bei kommerziell angebotenen Produkten mit digitalen Elementen. `[ANWALT PRÜFEN]` ob CLAR darunter fällt; unabhängig davon einen einfachen Prozess für Sicherheitsvorfälle und Datenpannen (Art. 33, 34 DSGVO, 72 Stunden) in `docs/ops.md` beschreiben.

### M. Sonstiges
- Verzeichnis von Verarbeitungstätigkeiten (Art. 30) vorhanden?
- Datenschutz-Folgenabschätzung (Art. 35): Standortdaten plus Fotos Dritter plus Minderjährige plus KI sprechen dafür. Gibt es eine? Wenn nicht, Gerüst vorschlagen.
- Open-Source-Lizenzhinweise der Abhängigkeiten in der App anzeigbar.
- Barrierefreiheit (BFSG) kurz einordnen: vermutlich nicht anwendbar, aber begründen.

## Ausgabe von Phase 1

Schreibe den Bericht nach `docs/legal/audit-<heutiges Datum>.md` mit:

1. Kurzfazit (3 bis 5 Sätze): Ist die App veröffentlichungsreif? Was sind die größten Risiken?
2. Dateninventar als Tabelle.
3. Tabelle aller Prüfpunkte: Bereich, Anforderung, Status, Fundstelle, Fix, Priorität (P0 = blockiert Veröffentlichung, P1 = vor Launch, P2 = danach).
4. Liste der Abweichungen zwischen Doku und Code.
5. Offene Fragen, die du auch in `FRAGEN.md` ergänzt hast.

Fahre danach sofort mit Phase 2 fort, ohne zu fragen.

## Phase 2: Fixen (automatisch, ohne Rückfrage)

- Arbeite alle Punkte ab: zuerst P0, dann P1, dann P2. Hör nicht auf, bevor jeder Punkt erfüllt oder als nicht anwendbar begründet ist.
- Kleine, getrennte Commits pro Thema.
- Neue UI-Texte immer über i18n in Deutsch und Englisch.
- Nach jedem Fix: Tests und Lint laufen lassen, Doku in `docs/legal/` aktualisieren, damit Code und Texte wieder übereinstimmen.
- Wenn ein Fix Tests oder Lint kaputt macht und du ihn nicht sauber lösen kannst: Fix zurücknehmen und im Bericht notieren, statt weiterzubauen.

## Abschluss

Ergänze am Ende des Berichts einen Abschnitt "Ergebnis" mit: was du gefixt hast (mit Commit-Hashes), welche Entscheidungen und Annahmen du getroffen hast, und welche Stellen mit `[ANWALT PRÜFEN]` markiert sind. Beende dann die Arbeit.
