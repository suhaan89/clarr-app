# CLAR Design-Notes

Selbstkritik, Entscheidungen und angestrebte Wirkung pro Screen.
Redesign Juli 2026. Regel dabei: nur Frontend/Struktur, keine Backend- oder Sicherheitslogik.

---

# Redesign-Runde 2 (Juli 2026): Wärme, Einstieg, Status-System

**Nutzer-Feedback (ernst genommen):** „Die App wirkt zu schwarz, langweilig, leblos.
Die Icons sind billig (nur grüner/roter Punkt für erledigt/nicht erledigt). Und man
landet direkt in der Karte — schlechter erster Eindruck."

## Referenzen (Muster, nicht kopiert)

- **Too Good To Go** — warmer, freundlicher Ton, großzügige Karten, starke primäre CTA
  („Retten"). Übernommen als *Prinzip*: ein klarer, einladender Hauptknopf („Müll melden")
  als Held des Home-Screens; weiche, großflächige Karten statt Listenzeilen. CLAR bleibt
  aber grün-seriös statt TGTG-türkis-verspielt.
- **FixMyStreet / SeeClickFix** (zivilgesellschaftliche Melde-Apps) — der *Fall-Status* ist
  das Rückgrat. Übernommen: Status als vollwertige Komponente (Icon + Wort + Farbe), eine
  nachvollziehbare Reise gemeldet → geprüft → erledigt. CLAR macht daraus zusätzlich Social
  Proof auf dem Home-Screen („zuletzt aufgeräumt").
- **Umwelt-/Community-Apps** (Bewegungs-/Impact-Apps) — Wirkung emotional zeigen (Vorher/
  Nachher, Zahlen). Übernommen: ruhige Impact-Kachel und zwei ehrliche Kennzahlen (offen /
  aufgeräumt) — ohne Streaks, Countdowns oder Zufallsbelohnungen.

Eigenständig für CLAR: „Vertrauensgrün" als Basis, warmer Honig-Zweitakzent NUR für kleine
Freude-Momente, sanfte grüne Verläufe für Tiefe — kein Gamification-Bunt.

## Farbwelt: weg vom Schwarz, hin zu Wärme

**Kritik am Vorzustand:** Das System war korrekt, aber flach — flächig dieselben grün-grauen
Töne, keine Tiefe, keine Verläufe, kein warmer Akzent. „Seriös" war zu „leblos" gekippt.

**Entscheidungen (`theme.ts`):**
- **Sanfte Verläufe** als neue Tiefe (`Gradients`): ein kräftiger Marken-Verlauf (grün→
  frischeres Grün) für primäre Aufrufe und den Splash, ein zarter Wasch-Verlauf hinter der
  Begrüßung. Verläufe bewusst eng benachbart — Tiefe, kein Regenbogen.
- **Warmer Zweitakzent** (`accent`, Honigton): NUR für kleine Wärme (Begrüßungs-Sonne,
  Highlights). Nie für Status — Status bleibt in der Semantik-Palette, damit Farbe eindeutig
  bleibt.
- `primaryBright` als lebendigeres Grün für die Verlaufsenden.
- Heller Modus bleibt Standard; alle Verläufe/Akzente sind für beide Modi definiert.

## Splash (`components/BrandSplash.tsx`)

**Vorher:** Nur der native Static-Splash (Icon auf Blau), dann sofort Inhalt — kein
Marken-Moment.

**Entscheidungen:**
- Kurzer (~1,9 s), animierter Marken-Splash auf dem Marken-Verlauf: Logo-Kachel steigt
  sanft auf, ein weicher Ring pulsiert dahinter (Leben ohne Unruhe), Wortmarke + Tagline.
  Blendet sich selbst aus und gibt an die App ab — wartet NICHT auf Netzwerk.
- Reanimated statt GIF/Lottie: kein Asset, kein zusätzliches Gewicht, ruhige Kurven
  (`Easing.out(cubic)`).

**Selbstkritik:** Ein Splash darf nie zur Bremse werden. Deshalb feste kurze Dauer statt
„bis alles geladen ist", und die App darunter ist bereits gemountet — der Splash ist ein
Vorhang, keine Ladeschranke.

## Home / Übersicht (`app/(tabs)/index.tsx`) — NEU

**Vorher:** Einstieg direkt in die Vollbild-Karte. Funktional, aber kalt und ohne Kontext —
„Wo bin ich? Was soll ich tun?"

**Entscheidungen:**
- **Begrüßung** (tageszeitabhängig) auf zartem Verlauf mit warmer Sonne — freundlicher
  Empfang, kein Klarname nötig (Datenschutz-Linie bleibt gewahrt).
- **Müll-melden-CTA** als Held: großflächige Verlaufskarte mit Kamera-Icon und Pfeil, führt
  direkt in den Melde-Flow. Der wichtigste Weg ist der sichtbarste.
- **Zwei Kennzahlen** (offene Fälle / aufgeräumt) als Kacheln mit Icon — Wirkung in Zahlen,
  ehrlich und ohne Druck.
- **Impact-Kurzkarte** (eigene Punkte + Level) führt tiefer ins Profil.
- **Nächste Aktionen** (max. 2) und **zuletzt aufgeräumt** (max. 3) als Social Proof — mit
  „Alle"-Link bzw. Sprung in den Fall. Leere Zustände freundlich illustriert statt leer.
- Die **Karte** ist jetzt ein eigener Tab (`karte.tsx`), nicht mehr der Start.

**Selbstkritik:** Gefahr, den Home-Screen zu überladen. Gegenmaßnahme: strikte Limits
(2 Events, 3 Fälle), klare Abschnitte, viel Weißraum. Zweite Gefahr: künstliche Dringlichkeit
(„nur noch 2 Plätze!") — bewusst weggelassen, die Zahlen informieren, sie drängen nicht.

## Echtes Icon-/Status-System (`constants/status.ts`, `components/Badge.tsx`)

**Vorher (die Feedback-Kernkritik):** Status teils als nackter Farbpunkt / farbiges Wort —
für Farbfehlsichtige unbrauchbar und billig wirkend.

**Entscheidungen:**
- Zentrale Status-Zuordnung: jeder DB-Status → **Icon + Wort + Farbton**, an einer Stelle
  (`getCaseStatus`). gemeldet (Warnkreis, rot) → geprüft (Schild, gelb) → weitergeleitet
  (Papierflieger, gelb) → erledigt (Doppelhäkchen, grün) → abgeschlossen (Archiv, neutral).
- `Badge` kann jetzt ein **Icon** statt eines Punktes tragen — Status ist nie nur Farbe
  (WCAG: nicht allein auf Farbe verlassen).
- **Karten-Pins** tragen jetzt Icons (Mülltonne = offen, Häkchen = erledigt) statt einfarbiger
  Punkte; die Legende nutzt Icon-Chips + Wort. `tracksViewChanges` wird nach dem ersten
  Zeichnen abgeschaltet (Android-Perf bei vielen Markern).

**Selbstkritik:** Unbekannte künftige Server-Status dürfen die UI nicht brechen — sie fallen
neutral mit ihrem Rohwert als Label aus.

## Design-System (`src/constants/theme.ts`)

**Kritik am Vorzustand:** Nur 5 Graustufen-Farben, die Markenfarbe `#1B7A43` war 14-mal
hart im Code verteilt, ebenso Rot-Töne. Keine Radien-/Typo-/Schatten-Tokens; jeder Screen
erfand seine eigenen Werte.

**Entscheidungen:**
- **„Vertrauensgrün"** als Marke: ruhiges, sattes Grün (`#1B7A43` hell / `#4CC183` dunkel).
  Kein grelles Gamification-Bunt — die App soll wie ein verlässliches Werkzeug wirken,
  nicht wie ein Spiel. Hintergründe sind leicht grünstichig statt reinweiß/reinschwarz,
  das wirkt wärmer und markiger, ohne aufzufallen.
- Semantik-Farben (success/danger/warning) je mit „Soft"-Fläche für Badges und Hinweise —
  Status wird flächig statt nur per Textfarbe kommuniziert.
- Tokens für Radius, Typo-Skala, Schatten. Schatten bewusst sehr dezent (Seriosität).
- Dunkelmodus vollständig: helle Grüntöne mit dunkler Schrift auf Buttons
  (Kontrast > 4.5:1 in beiden Modi geprüft).

**Wirkung beim Nutzer:** Wiedererkennbarkeit und Ruhe. Ein konsistentes Grün = „das ist
CLAR", weiche Flächen = „hier passiert nichts Schlimmes mit meinen Daten".

## Komponenten (`src/components`)

Button (4 Varianten), Card, Input (sichtbarer Fokus-Rahmen), Badge (Status-Pille mit
optionalem Farbpunkt), EmptyState (Icon-Kreis + Text), LoadingState, SectionHeader,
LanguagePicker. Alle mit Screenreader-Labels, Touch-Zielen >= 44dp und `allowFontScaling`.

**Selbstkritik:** Verlockend wäre eine große UI-Bibliothek gewesen; bewusst dagegen
entschieden — 8 kleine, lesbare Komponenten decken alles ab und bleiben wartbar.

## Mehrsprachigkeit (`src/lib/i18n`)

- Eigenes Mini-i18n (Context + AsyncStorage) statt Zusatz-Dependency — die App hat
  ~110 Strings, dafür braucht es kein i18next.
- Sprachen: Deutsch (Referenz), Österreichisches Deutsch, Schwiizerdütsch, English,
  Français, Italiano, 中文, Norsk, Čeština. Fehlende Schlüssel fallen auf Deutsch zurück.
- Österreichisches Deutsch ist bewusst fast identisch mit Standarddeutsch (nur einzelne
  idiomatische Abweichungen wie „Leiwand!") — künstliche Unterschiede wären anbiedernd.
- Schwiizerdütsch ist informell gehalten; bei rechts-/sicherheitsnahen Texten bleibt es
  nah an der Standardsprache, damit nichts missverständlich wird.
- **Rechtstexte (Datenschutz/Impressum) bleiben Deutsch** — juristische Texte werden
  nicht maschinell übersetzt; im Profil steht ein Hinweis dazu.
- Datumsformate laufen über das BCP-47-Tag der gewählten Sprache (`dateLocale`).
- Alle sichtbaren Texte nutzen echte Umlaute (ä/ö/ü) statt ae/oe/ue; interne
  DB-Statuswerte (`geprueft`, `veroeffentlicht`) bleiben unverändert — das ist Backend.

**Wirkung:** Sprache ist Vertrauen. Wer die App in der eigenen Sprache (oder Mundart)
bedienen kann, fühlt sich ernst genommen — gerade Jugendliche.

## Login

**Selbstkritik vorher:** Nur ein Textblock „CLAR" ohne jedes visuelle Markenzeichen —
wirkte wie ein Prototyp. Fehlermeldungen als nackter Text, kaum vom Erfolgsfall
unterscheidbar. Kein Weg, vor dem Einloggen die Sprache zu wechseln.

**Entscheidungen:**
- Logo-Kachel (Blatt-Icon auf Grün) + gesperrter Schriftzug: sofortige Marken-Anmutung
  ohne Asset-Abhängigkeit.
- Meldungen als farbige Karten: Grün-Soft für „Mail geschickt" (Info), Rot-Soft für
  Fehler — Farbe + Fläche statt nur Text.
- Vertrauens-Hinweis („Kein Klarname nötig …") mit Schild-Icon direkt unter den Buttons:
  das wichtigste Gefühl (Sicherheit) bekommt ein Symbol.
- Globus-Button oben rechts: Sprachwahl VOR dem Login — wer kein Deutsch spricht,
  darf nicht erst einloggen müssen.
- ScrollView statt starrem Zentrieren: kleine Screens + große Systemschrift laufen
  nicht mehr ins Abschneiden.

**Wirkung:** Erster Eindruck = seriös und freundlich; die App fragt wenig und erklärt warum.

## Karte (eigener Tab, früher Einstieg)

> Runde 2: Die Karte ist nicht mehr der Einstieg (eigener Tab `karte.tsx`); die Pins/Legende
> tragen jetzt Icons statt nackter Punkte — siehe „Echtes Icon-/Status-System" oben.

**Selbstkritik vorher:** Legende mit Emoji-Kreisen (🔴/🟢) — wirkt verspielt-billig und
ist für Screenreader Rauschen. Alles in einer Textzeile gequetscht.

**Entscheidungen:**
- Legende als Karten-Komponente mit echten Farbpunkten (Token-Farben, identisch mit den
  Pin-Farben) + getrenntem Zähler rechts. Bricht bei großer Schrift sauber um.
- Pin-Farben kommen jetzt aus dem Theme statt Hex im Screen — Dunkelmodus bekommt
  automatisch das hellere Grün.
- Bewusst KEIN zusätzliches UI über der Karte (Filter, Suchleiste): die Karte selbst
  ist der Held; erledigte (grüne) Pins neben offenen (roten) erzählen die
  Wirkungs-Geschichte von allein.

**Wirkung:** „Da passiert wirklich was" — grüne Pins als sichtbarer Beweis, dass Meldungen
zu aufgeräumten Orten führen.

## Melden (Kamera-Flow)

**Selbstkritik vorher:** Der Berechtigungs-Screen war eine Textwand mit zwei Buttons.
Der Auslöser war ein weißer Kreis mit Kamera-Icon — unklar, ob das ein Button oder
Deko ist. Der Erfolgs-Screen war nur ein Satz auf leerem Grund: der emotional
wichtigste Moment (ich habe etwas beigetragen!) fühlte sich nach nichts an.

**Entscheidungen:**
- Berechtigung als EmptyState: Kamera-Icon im Grünkreis, Titel, kurzer Text — die
  Anonymisierungs-Zusage bleibt prominent (Vertrauen VOR der Freigabe).
- Klassischer Kamera-Auslöser (weißer Ring + innerer Kreis): universell als „Foto
  machen" lesbar, kein Erklärungsbedarf.
- Galerie-Button als halbtransparente Pille — sichtbar, aber klar sekundär
  (Kamera-Fotos sind die gewollten, weil punktefähig).
- Galerie-Hinweis als gelbe Warn-Karte statt grauem Fließtext: der Punkte-Unterschied
  ist eine faire, aber wichtige Information.
- Erfolgs-/Offline-/Fehler-Screen als EmptyState mit passendem Icon (Häkchen, Wolke,
  Standort) — das Ergebnis wird als Ergebnis-Typ gespeichert und erst beim Rendern
  übersetzt, damit ein Sprachwechsel auch diesen Screen sofort umstellt.
- Datenschutz-Zeile mit Schloss-Icon vor dem Absenden: Transparenz am Punkt der
  Entscheidung, nicht irgendwo im Kleingedruckten.

**Wirkung:** Melden fühlt sich an wie Fotografieren (vertraut), Absenden wie ein
kleiner Erfolg (Häkchen-Moment) — ohne Konfetti-Kitsch.

## Aktionen (Events)

**Selbstkritik vorher:** Alle Infos in einer grauen Meta-Zeile („Mi. 15.07. 16:00 Uhr ·
3/10 dabei") — Datum, Uhrzeit und Auslastung konkurrieren unlesbar. Kein Ladezustand
(leere Liste flackerte als „keine Events" auf), Leer-Text ohne jede Gestaltung.

**Entscheidungen:**
- Datumsblock links (Tag groß, Monat klein, auf Grün-Soft): Events werden auf einen
  Blick planbar — bewährtes Muster aus Kalender-Apps.
- Teilnehmer als Fortschrittsbalken + Zahl. Bewusst OHNE „Nur noch 2 Plätze!"-Alarm:
  der Balken informiert, er drängt nicht (keine künstliche Dringlichkeit).
- Status als Badge: „Du bist dabei" (grün, mit Punkt) bzw. „Voll belegt" (gelb) —
  der eigene Zustand ist sofort sichtbar, ohne den Button lesen zu müssen.
- Abmelden als Ghost-Button, Mitmachen als Primär-Button: die Hierarchie lädt zum
  Mitmachen ein, macht Abmelden aber nicht schwerer (kein Dark Pattern).
- LoadingState vor dem ersten Laden, EmptyState mit Icon danach.

**Wirkung:** Gemeinschaft sichtbar machen — „da gehen schon 7 Leute hin" motiviert
ehrlicher als jeder Countdown.

## Profil / Impact

**Selbstkritik vorher:** Eine lange, ungegliederte Spalte — Punkte, Bestenliste,
Einwilligungen und Konto-Löschung optisch gleichwertig nebeneinander. Die
Punkte-Historie war eine nackte Text-Tabelle; „Konto löschen" stand ohne visuelle
Abgrenzung zwischen Alltagsfunktionen.

**Entscheidungen:**
- Impact-Held als Grün-Soft-Karte: Blatt-Icon, große Zahl, Level als Badge. Der eigene
  Beitrag ist das Erste und Emotionalste auf dem Screen — Anerkennung ohne Kirmes.
- Der Hinweis „Punkte sind nicht einlösbar" bleibt direkt an der Zahl: ehrliche
  Erwartungssteuerung statt Belohnungs-Illusion.
- Alle Abschnitte als Cards mit SectionHeader: Aktivität, Bestenliste, Sprache,
  Datenschutz & Rechte. Scannen statt Lesen.
- Aktivitätszeilen mit Icons je Grund (Häkchen/Personen/Funkeln) und grüner/roter
  Delta-Zahl in Tabellenziffern.
- Bestenliste mit Rang-Bubbles (Top 3 grün hinterlegt) — dezente Anerkennung,
  kein Podest-Drama; unbekannte Server-Reasons fallen roh statt kaputt aus.
- Sprachwahl als eigener Abschnitt mit Hinweis, dass Rechtstexte Deutsch bleiben.
- Export/Löschen mit Icons in der Rechte-Karte; Löschen in Rot, aber gleich
  erreichbar wie alles andere (Betroffenenrechte dürfen nicht versteckt werden).

**Wirkung:** Stolz auf den eigenen Beitrag + volle Kontrolle über die eigenen Daten —
beides sichtbar, nichts versteckt.

## Fall-Detail

**Selbstkritik vorher:** Status nur als farbiges Wort — leicht zu übersehen und für
Farbenblinde unbrauchbar. Der Lade-Spinner hing kommentarlos im Leeren; „Foto wird
noch geprüft" war eine graue Zeile, die wie ein Fehler wirkte.

**Entscheidungen:**
- Status als Badge mit Farbpunkt und abgestuftem Ton: gemeldet (rot) -> geprüft/
  weitergeleitet (gelb) -> erledigt (grün) -> abgeschlossen (neutral). Der Fortschritt
  eines Falls wird als Reise lesbar.
- Fotos in randlosen Cards; das „Foto wird geprüft" bekommt eine Sanduhr-Karte —
  Prüfung ist ein Feature (Vertrauen!), kein Defekt.
- „Ich habe aufgeräumt" als Primär-Button mit Kamera-Icon und Lade-Zustand im Button
  statt eingefrorenem Screen.
- Flag-Funktion als dezente Icon-Zeile: erreichbar, aber nicht alarmierend.

**Wirkung:** Ein Fall ist eine nachvollziehbare Geschichte mit gutem Ende — und das
gute Ende kann man selbst herbeiführen.

## Rechtstexte (Datenschutz/Impressum)

Nur behutsam angefasst: Theme-Konsistenz und echte Umlaute in sichtbaren Texten
(„JURISTISCH PRÜFEN" statt „PRUEFEN"). Inhaltlich bleiben es markierte Platzhalter —
Rechtstexte gehören Juristen, nicht Designern. Bewusst nicht übersetzt.

## Nachtrag: Beta-Kennzeichnung der Sprachen

Vollständig gepflegt sind Deutsch, English und Schwiizerdütsch — sie stehen in der
Sprachwahl oben. Alle übrigen (Österreichisches Deutsch, Français, Italiano, 中文,
Norsk, Čeština) bleiben wählbar, tragen aber ein gelbes „Beta"-Badge (auch im
Profil-Eintrag und im Screenreader-Label): ehrliche Erwartungssteuerung statt
stillem Qualitätsversprechen.

---

# Redesign-Runde 3 (Juli 2026): warm & lebendig, Haptik, ehrliche Korrektur

**Ehrliche Vorgeschichte:** Zwischen Runde 2 und hier war die Palette in eine
*kühle* „Bodensee/Seenebel"-Richtung gedreht worden (Teal als zweite Leitfarbe,
fast-schwarzer Dunkelmodus `#081314`). Nutzer-Feedback dazu klar: „sieht aus wie
AI-Slop, zu schwarz, leblos, will Effekte beim Drücken." Runde 3 korrigiert das
zurück zu **warm & lebendig** und ergänzt echtes Interaktions-Feedback.

## Kritik am kühlen Zwischenstand (schonungslos)
- **Zu kalt.** Kühler „Seenebel" (Hintergrund `#F5F9F9`, Dunkel `#081314`) wirkte
  klinisch statt einladend. Für eine Nachbarschafts-Bewegung gegen Müll das
  falsche Gefühl.
- **Teal zu dominant.** Der große Teal-Home-Header war kühl auf kühl — leblos.
- **Belohnung unklar.** Punkte/Impact in Grün verschwammen mit den grünen
  Aktions-Buttons; Reward hatte keine eigene Stimme.
- **Flache Interaktion.** Nur Opacity-Wechsel beim Tippen, kein taktiles Feedback.

## Barrierefreiheit (diese Runde geprüft)
- Warmer Text `#221E17` auf Creme `#FBF7F1` ≈ 13:1 (weit über AA).
- Weiß auf Marken-Grün und auf dem Bernstein-Akzent ≥ 4.5:1 (Akzenttöne bewusst
  dunkel genug).
- „Nicht nur Farbe" bleibt Pflicht; Status unverändert Icon + Wort + Farbe.
- Bewegung < 500ms, dezent, kein Loop. Haptik rein additiv, lautloser Fallback
  auf Geräten ohne Motor. Offen/notiert: `AccessibilityInfo.isReduceMotionEnabled`
  respektieren.

## Referenz: Too Good To Go (Muster, nicht kopiert)
Abgeschaut: **Wärme über die Neutraltöne** (Creme statt Kaltgrau) und ein
**eigener Belohnungs-Akzent** statt alles in einer Farbe. Nicht übernommen:
deren konkrete Grün-/Bildsprache. CLAR bleibt eigenständig grün-seriös.

## Entscheidungen Runde 3 (`theme.ts` + Interaktion)
- **Warme Creme-Neutraltöne** hell (`#FBF7F1` / Sand `#F2EBDF`), **warmes
  Anthrazit** dunkel (`#161311`) statt Teal-Schwarz.
- **Grün bleibt Leitfarbe**, etwas satter/wärmer (`#1C8146`), inkl. lebendigem
  `primaryBright` für Verläufe.
- **Bernstein/Sand (`accent`) wird Reward-/Impact-Farbe**: Punkte, Level,
  Datumsblöcke, Begrüßung. Trennt Belohnung klar von Aktion (Grün).
- **Teal nur noch auf der Karte** (kleiner „Locate"-Akzent). Home-Header jetzt
  grün (Marke) statt teal.
- **Interaktions-System:** `PressableScale` (Feder-Skalierung + Haptik) als
  taktiles Grundelement, app-weit über den `Button` und die Home-Karten;
  `Counter` lässt Impact-Zahlen hochzählen; Header fährt beim Öffnen sanft ein.
- **Typografie:** Bricolage Grotesque (Display) für Wortmarke/Überschriften/
  Impact-Zahlen bleibt; Fließtext System.
- **Textpflege:** englische Em-Dashes (`—`) app-weit durch den deutschen
  Halbgeviertstrich (`–`) ersetzt.

## Umsetzungs-Log Runde 3
- `theme.ts`: warme Palette (Creme, wärmeres Grün, Bernstein-Reward, Teal→Karte).
- `PressableScale`, `Counter` neu; `Button` darauf umgestellt (app-weite Haptik).
- Home: grüner Marken-Header, warme Datumsblöcke, hochzählende Zahlen, Eingang.
- _(weitere Screens folgen, Commit pro Screen)_

---

# Redesign-Runde 4 (Juli 2026): faire Gamification (Fortschritt, Abzeichen, Challenge, Feier)

**Auftrag:** Sichtbare, motivierende Gamification, die zu ECHTER Handlung führt,
ohne Suchtmechanik. Harte Vorgabe: Reward- und Backend-Logik NICHT anfassen. Alles
in dieser Runde ist eine reine Anzeige-Schicht auf den vorhandenen Serverdaten
(View `points_level`, `points_ledger`, `cases`, `cleanup_signups`).

**Schreibweise:** In dieser Runde bewusst OHNE jeden Gedankenstrich (kein langer,
kein kurzer), passend zum Auftrag. Stattdessen Komma, Punkt, Doppelpunkt, Klammern.

## Referenzen (Muster als PRINZIP, nicht kopiert)
- **Duolingo:** charaktervolle Figur und gesunde Motivation. Übernommen als Prinzip:
  ein freundliches Maskottchen (Clari), das Erfolge mitfeiert. NICHT übernommen:
  Verlust-Angst, Strafen, aggressive Erinnerungen.
- **Strava:** Impact und Gemeinschaft sichtbar machen. Übernommen: persönlicher
  Fortschritt plus ein geteiltes Wochenziel für die Gemeinschaft. NICHT übernommen:
  Wettkampf-Druck als Dauerzustand.
- **Things/Linear:** Ruhe und Präzision. Der Fortschrittsbalken ist schlank und
  ruhig, kein blinkendes Kirmes-Element.

## Ethische Leitplanken (verbindlich, altersgerecht)
- Belohnung ist Status und Anerkennung, KEIN Geldwert (Hinweis bleibt an der Zahl).
- KEINE Zufalls-/Lootbox-Mechanik: Abzeichen sind deterministisch aus echten Zahlen
  abgeleitet, die Bedingung ist immer sichtbar (Fortschritt x von Ziel).
- KEINE bestrafenden Streaks, kein Countdown, kein FOMO. Die Wochen-Challenge ist ein
  Gemeinschaftsziel ohne Timer, das Level kennt keinen Rückschritt.
- Stärkster Reward bleibt echte Wirkung: der Feier-Moment feiert den aufgeräumten Ort
  am Bodensee, nicht die Punktzahl.

## Entscheidungen pro Baustein

**Level-Fortschritt (`components/LevelProgress.tsx`, `constants/levels.ts`)**
- `constants/levels.ts` spiegelt die Server-Formel (Level = Saldo/100 + 1, Ränge bei
  0/100/250/500) NUR für die Anzeige, klar als Spiegel dokumentiert. Der Client rechnet
  nur Fortschritt aus, er bucht nichts.
- Balken in Bernstein (Reward-Farbe), zeigt den klaren nächsten Schritt ("noch X Punkte
  bis Level N") plus den nächsten Rang. Immer ein sichtbares Ziel, nie ein leerer Blick.
- `accessibilityRole="progressbar"` mit Wert, damit Screenreader den Fortschritt ansagen.

**Abzeichen (`lib/achievements.ts`, `components/Badges.tsx`)**
- Ableitung in einer RN-freien, getesteten Lib (`achievements.test.ts`): erste Meldung,
  erste Bestätigung, erster Abschluss, erstes Event, 5 und 25 Meldungen, 5 Orte sauber,
  Bronze/Silber/Gold. Werte spiegeln die Reward-Regeln.
- Medaillon verdient (warmes Bernstein plus Häkchen) gegen ruhig gedämpft mit Fortschritt.
  Nicht verdiente Abzeichen zeigen das Ziel, drängen aber nicht.
- Defensiv gegen kaputte/negative Serverwerte (NaN wird zu 0), damit die Anzeige nie bricht.

**Wochen-Challenge (`components/WeeklyChallenge.tsx`, `lib/week.ts`)**
- Gemeinschaftsziel "20 Fälle am Bodensee diese Woche" mit geteiltem, grünem Balken
  (Grün = Aktion und Gemeinschaft). Woche startet Montag (`startOfIsoWeek`).
- Bewusst ohne Zeitdruck: der Text sagt "noch X bis zum gemeinsamen Ziel", kein Countdown.

**Feier-Momente (`components/Celebration.tsx`, `Confetti.tsx`, `Mascot.tsx`)**
- Ausgelöst bei Fallabschluss (Fall-Detail) und bei echtem Level-Anstieg (Profil erkennt
  den Sprung zwischen zwei Ladevorgängen, nie beim ersten Laden, keine künstlichen Trigger).
- Konfetti auf dem UI-Thread (Reanimated), Erfolgs-Haptik, kurze Botschaft, jederzeit per
  Tipp schließbar (kein Zwang), automatischer Abschluss nach wenigen Sekunden.

## Maskottchen: bewusster Platzhalter
`components/Mascot.tsx` rendert vorerst die Marken-Kachel je Pose (idle, celebrate, levelup,
hint). Die Schnittstelle (pose, size, Label) steht, damit die gerenderten 3D-PNGs von Clari
(claude.ai/design, transparent, nach `assets/mascot/`) später ohne Umbau eingesetzt werden.
So blockiert die fehlende Grafik nicht die Mechanik.

## Barrierefreiheit (diese Runde)
- "Bewegung reduzieren" (System) wird respektiert: `useReducedMotion` schaltet Konfetti und
  Einschwing-Animation ab, Balken springt direkt auf den Wert. Botschaft und Haptik bleiben.
- Fortschritt und Feier tragen Screenreader-Labels; das Feier-Overlay ist `role="alert"`.
- Kontraste über die vorhandenen Token (Bernstein dunkel genug für weiße Schrift).

## Selbstkritik
- **Client spiegelt Server-Formeln.** Level- und Rang-Schwellen liegen doppelt vor (Server
  und `constants/levels.ts`). Bewusst in Kauf genommen, weil die Anzeige sonst nicht ohne
  neue Endpunkte ginge, und klar als Spiegel markiert. Ändert sich die Server-Regel, muss
  hier nachgezogen werden.
- **Abzeichen zählen Ledger-Zeilen.** Eine verifizierte Meldung ohne Punktebuchung (z. B.
  Tagesdeckel erreicht) fehlt in der Zählung. Für ein kosmetisches Abzeichen vertretbar.
- **Konfetti ist Views, kein Skia.** Bei sehr vielen Teilchen auf schwachen Geräten ggf.
  Teilchenzahl senken. Auf echtem Gerät prüfen (60fps). Skia bliebe eine Option für später.
- **Community-Zähler ist RLS-begrenzt.** Die Wochen-Challenge zählt nur sichtbare Fälle,
  ist also eine Näherung der echten Gemeinschaftsaktivität. Ehrlich, aber nicht exakt.

---

# Redesign-Runde 5 (Juli 2026): Home neu im „Liquid Glass"-Stil

**Auftrag:** Nur der Home-Screen, komplett neu: minimalistisch, premium, „Liquid
Glass". Sehr viel Ruhe und Weissraum, wenige schwebende Glas-Elemente, Wow beim
Reinkommen. Der Rest der App bleibt unangetastet. In dieser Runde bewusst OHNE
jeden Gedankenstrich.

## Haltung: weniger ist mehr
Der bisherige Home war reich (Wochenziel, zwei Kennzahl-Kacheln, Impact-Karte,
Event-Liste, Liste zuletzt aufgeraeumter Faelle). Gut, aber dicht. Der neue Home
zeigt nur noch: eine warme Begruessung, EINEN grossen Held-Wert, die zentrale
Aktion (Muell melden) als glaenzendes Glas, und darunter zwei kompakte Chips
(offen in der Naehe, naechste Aktion). Alles andere ist bewusst weg, die Karte
bleibt ein eigener Tab.

## Werkzeuge (nur bereits installierte, kein neuer Dev-Build)
- **expo-glass-effect** (schon in den Deps) liefert auf iOS 26+ echtes Liquid
  Glass. `GlassSurface` (neue Komponente) nutzt es, wenn `isLiquidGlassAvailable()`
  wahr ist, und faellt sonst (Android, aeltere iOS) auf eine gefrostete,
  transluzente Flaeche mit feinem Rand und Kanten-Highlight zurueck. So sieht es
  ueberall premium aus, ohne neues natives Paket.
- **expo-linear-gradient** fuer den weichen Hintergrundverlauf und die
  Licht-Waesche.
- **react-native-reanimated** fuer alle Mikroanimationen (UI-Thread, 60fps).
- **expo-haptics** ueber `PressableScale` fuer das Press-Feedback.
- Skia bewusst nicht genutzt: der Effekt traegt auch ohne, und Skia haette einen
  neuen Dev-Build und mehr Testaufwand bedeutet.

## Neue Tokens (theme.ts)
`Glass` (tint, fallbackBg, fallbackBgStrong, border, highlight, blobGreen,
blobAmber, je hell/dunkel), `HomeGradient` (drei weiche Stopps), `GlassShadow`
(weicher, groSSflaechiger Schatten), plus Hooks `useGlass` und `useHomeGradient`.
Keine harten Werte im Screen.

## Der Held-Wert
Gewaehlt: die Orte, die DU sauber gemacht hast (eigene Abschluss-Buchungen aus
dem points_ledger, reason case_closed_after). Das ist der emotionalste, echte
Real-World-Wert und passt zu „dein Impact". Bei 0 traegt eine warme Zeile
(„Dein erster Ort wartet auf dich."), damit der Einstieg nie kalt wirkt. Die
Quelle ist bewusst an einer Stelle gekapselt und laesst sich in einer Zeile auf
einen anderen Wert umstellen (z. B. Gemeinschaftssumme oder Impact-Punkte).

## Mikroanimationen (alle Reduce-Motion-fest)
- Elemente setzen sich beim Laden sanft und gestaffelt (Fade plus Aufsteigen).
- Zwei sehr langsame Licht-Blobs driften im Hintergrund, leichter Parallax beim
  Scrollen.
- Der Melden-Knopf hat einen langsam wandernden Licht-Sheen (danach kurze Pause).
- Der Held-Wert zaehlt weich hoch (Counter).
- Clari wippt ganz dezent.
- „Bewegung reduzieren" schaltet alle Bewegung ab (kein Blob-Drift, kein Sheen,
  kein Wippen, Balken/Werte erscheinen direkt), Inhalt und Haptik bleiben.

## Barrierefreiheit
- „Transparenz reduzieren" (iOS) wird respektiert: `GlassSurface` nimmt dann die
  opakere Fallback-Flaeche, damit Text auf Glas sicher lesbar bleibt.
- Held-Wert und Aktionen tragen Screenreader-Labels, Touch-Ziele bleiben gross.
- Text steht auf ausreichend deckenden Flaechen bzw. dem hellen Verlauf (Kontrast
  gewahrt), nicht auf reinem Glas ueber unruhigem Grund.

## Selbstkritik
- **Glas ohne echten Blur auf Android.** Der Fallback ist eine transluzente
  Farbflaeche, kein echter Refraktions-Blur. Auf dem sanften Verlauf liest sich
  das als „Frosted Glass", ist aber nicht dasselbe wie natives Liquid Glass. Fuer
  echten Blur ueberall braeuchte es expo-blur (nativer Build) oder Skia.
- **Blobs sind einfache Kreise.** Ohne Blur/Skia haben sie theoretisch eine harte
  Kante; durch niedrige Deckkraft, groSSe Flaeche und Rand-Positionierung faellt
  das nicht auf. Bei Bedarf spaeter mit Skia zu echten weichen Glows aufwerten.
- **Wochen-Challenge ist vom Home verschwunden.** Der Minimal-Auftrag laesst dafuer
  keinen Platz; die Komponente (`WeeklyChallenge`) bleibt im Code und koennte in
  Events oder Profil wandern. Bewusste Entscheidung, hier notiert.
- **Auf echtem Geraet noch zu pruefen** (60fps, Glas-Lesbarkeit, Sheen-Timing):
  verifiziert sind nur tsc und eslint, nicht ein Live-Lauf.

---

# Redesign-Runde 8 (Juli 2026): Runde-7-Backlog abgearbeitet + eigener Durchgang

**Auftrag:** Den in `docs/archiv/verbesserungs-prompt-runde7.md` hinterlassenen,
ungenutzten Auftrag abarbeiten (Paket A/B/C), danach eigenständig
weitersuchen und beheben, solange sinnvoll — keine Rückfrage pro Fund. Nur
Frontend/UX, keine Backend-/Sicherheitslogik. Reihenfolge wie im Auftrag
vorgegeben: B → A → C, dann ein eigener Durchgang.

## Paket B — Interaktions-/Icon-/Modal-Konsistenz

- **`PressableScale` app-weit nachgezogen**: `melden.tsx` (Ausloeser +
  Galerie-Button — die wichtigste Interaktion der App), `karte.tsx`
  (Aktualisieren), `profil.tsx` (Export/Loeschen/Moderation/Abmelden),
  `case/[id].tsx` (Flag), `HelpChat.tsx` (FAB, Schliessen, Zurueck,
  Datenschutz-Link, Fragen-Liste), `LanguagePicker.tsx` (beide Trigger-
  Varianten, Sprachoptionen). Bewusst NICHT umgestellt: Backdrop-/Sheet-
  Pressables in `HelpChat`, `LanguagePicker`, `Celebration` — das sind reine
  Tipp-Faenger zum Schliessen, keine echten Buttons; eine Feder-Animation
  darauf waere falsches Signal.
- **`hitSlop` ergaenzt** (neu, nicht im Runde-7-Auftrag): Kein einziger
  `hitSlop`-Aufruf existierte im ganzen Code. Fuer eine App, die oft
  drausen/einhaendig bedient wird (Muell fotografieren), macht das bei
  Icon-only-Buttons einen echten Unterschied. Ergaenzt bei Kamera-Ausloeser/
  Galerie (`melden.tsx`), Karten-Refresh, Flag-Button, HelpChat-FAB/Schliessen,
  Sprachwahl-Icon-Variante/Schliessen.
- **`onDanger`-Token ergaenzt** (`theme.ts`): Kartenpin-Icon nutzte hartes
  `color="#fff"` unabhaengig vom Modus. Hell bleibt Weiss, Dunkel bekommt
  (wie bei primary/accent/water) einen dunklen Ton, weil Dunkelmodus-Rot dort
  ein helles Korallrot ist — Weiss darauf waere schlecht lesbar gewesen.
- **Modal-Schliessen vereinheitlicht**: `LanguagePicker`s Sheet hatte keine
  sichtbare Schliessen-Affordanz (nur Backdrop-Tap). Jetzt ein Kopfzeilen-
  Layout mit sichtbarem ×-Button wie in `HelpChat`.
- **Korrektur am eigenen Auftrag**: Runde 7 behauptete, `karte.tsx` (gefuelltes
  `trash`) und `profil.tsx` (`trash-outline`) waeren dieselbe Ikonografie
  uneinheitlich behandelt. Stimmt nicht — `karte.tsx`s `trash` meint
  „Muellfund" (Kartenpin/Legende), `profil.tsx`s `trash-outline` meint
  „Konto loeschen" (Papierkorb-Symbol fuer Loeschen, universelle Konvention).
  Zwei verschiedene Konzepte, keine Vereinheitlichung noetig — bewusst NICHT
  angefasst, um kein falsches Icon-Vokabular einzufuehren.

## Paket A — Typografie-/Spacing-Disziplin

- **Home-Screen auf Tokens umgestellt**: `greeting` (22px) → `Type.title`
  (24px, 2px Unterschied ist nicht wahrnehmbar); `heroLabel`/`ctaTitle` waren
  identische Ad-hoc-Objekte (20px) → neuer Token `Type.subtitle` (Luecke
  zwischen `heading` 17 und `title` 24); `heroNumber`/`chipValue` nutzten
  Familie/Gewicht/Ziffernvariante manuell statt des bereits existierenden,
  aber bis dahin ungenutzten `Type.numeric` — jetzt `{...Type.numeric,
  fontSize: X}`, das Muster, fuer das `numeric` erkennbar gedacht war.
- **`Type.numeric` Bugfix**: `fontVariant` war mit `as const` auf ein
  `readonly`-Tupel getypt, das sich nicht in RNs mutablen `TextStyle`
  einsetzen liess (tsc-Fehler beim ersten Verwenden). Auf `TextStyle['fontVariant']`
  umgestellt.
- **`Spacing.one + 2` / `Spacing.two + 2` beseitigt** (9 Fundstellen): neue
  Zwischenschritte `Spacing.oneHalf` (6) und `Spacing.twoHalf` (10) in der
  Skala ergaenzt, alle Rechen-Stellen (login, Badge, Celebration, HelpChat,
  WeeklyChallenge, case/[id], karte ×2, melden) darauf umgestellt.
- **Meta-Text vereinheitlicht**: `events.tsx`/`case/[id].tsx`/`moderation.tsx`
  hatten je eine eigene, leicht abweichende Sekundaertext-Style fuer dieselbe
  Rolle (Datum/Status-Zeile neben Badge) → neuer Token `Type.meta` (14/20),
  an allen drei Stellen verwendet. `events.tsx`s Karten-`title` war zufaellig
  identisch mit `Type.heading` → ebenfalls auf den Token umgestellt.
- **`login.tsx` negative-margin-Hack behoben**: `ageHint` zog sich per
  `marginTop: -Spacing.two` naeher an die Altersabfrage. Jetzt eine eigene
  `ageGroup`-View mit `gap: Spacing.half`, die Switch-Zeile und Hinweistext
  eng gruppiert — kein negativer Wert mehr noetig.
- **Weitere gefundene Duplikate desselben Ad-hoc-Musters** (nicht im
  Runde-7-Auftrag, beim Umsetzen aufgefallen): `profil.tsx`s Impact-Punktzahl
  (48px) und `WeeklyChallenge.tsx`s Zaehler (22px) nutzten dieselbe
  Familie/Gewicht/Ziffernvariante wie Home ad-hoc statt `Type.numeric` — beide
  umgestellt.

## Paket C — Ladezustand Karte

- `karte.tsx` zeigte beim ersten Oeffnen kurz eine leere Karte + „0/0" in der
  Legende. Jetzt ein `loaded`-Flag, das bis zum ersten Request-Ende (Erfolg
  *und* Fehlerfall) `LoadingState` zeigt — neuer i18n-Schluessel `map.loading`
  in allen 8 Sprachen mit eigenem Karten-Abschnitt ergaenzt (Oesterreichisches
  Deutsch faellt bewusst auf Deutsch zurueck, wie der Rest seiner Eintraege).

## A11y-Nachtrag: `Badge.tsx`

Runde 6 hatte a11y-Props fuer Card/Badge/ProgressBar versprochen, aber nur
`Card` und `ProgressBar` spreaden tatsaechlich `...rest` durch — `Badge` nahm
gar keine zusaetzlichen Props an. Nachgezogen (`ViewProps & Props`, `...rest`
+ `style`-Merge wie bei `Card`).

## Eigener Durchgang (ohne Auftrag, zwei echte Bugs gefunden)

- **`moderation.tsx`**: `decidePhoto()` setzte `busyId(-1)`, aber der
  Foto-Freigeben/Ablehnen-Button las diesen State nie — keinerlei
  Lade-Feedback bei der Aktion, Doppel-Tap moeglich. Eigener
  `busyPhotoId`-State (pro Foto-ID statt eines geteilten Platzhalterwerts)
  ergaenzt und ans `loading`-Prop gehaengt.
- **`events.tsx`**: `toggleSignup()` hatte ueberhaupt keinen Busy-Schutz —
  ein schneller Doppel-Tap auf „Mitmachen"/„Abmelden" haette zwei
  Insert-/Delete-Aufrufe vor dem naechsten `load()` auslaufen lassen koennen.
  `busyId`-State ergaenzt (Guard am Funktionsanfang + `loading`-Prop am
  Button), analog zum bereits vorhandenen Muster in `case/[id].tsx`s
  `closeCase()`.
- Stichprobenartig auf hartkodierte Hex-Farben ausserhalb `theme.ts`
  geprueft: die einzigen Treffer (`melden.tsx`s Kamera-Overlay-Weiss/Schwarz,
  `karte.tsx`s Pin-Rand-Weiss, `BrandSplash`s Logo-Weiss, `Confetti`s
  Weiss-Partikel) sind bewusste Ausnahmen — Kamera-Sucher, Karten-Halo und
  Splash liegen nicht auf der Theme-Flaeche, sondern auf Kamerabild/Kartenkachel/
  Marken-Verlauf, wo Hell/Dunkelmodus keine Rolle spielt. Keine Aenderung.

## Selbstkritik

- **Kein Geraet/Simulator verfuegbar** (wie schon in Runde 7 vermerkt): alle
  Aenderungen sind code-gepruft (`tsc`, `eslint`, `jest`, alle 57 Tests
  gruen), aber nicht visuell/live bestaetigt. Insbesondere `hitSlop`-Werte,
  der neue `Spacing.oneHalf`/`twoHalf`-Feinschliff und die Typografie-Token-
  Umstellung am Home-Screen sollten auf einem echten Geraet gegengeprueft
  werden, sobald eines verfuegbar ist.
- **`map.*`-Uebersetzungsluecke nicht angefasst**: beim Ergaenzen von
  `map.loading` ist aufgefallen, dass die englische Katalog-Sektion
  `map.refresh_a11y`/`map.error_title`/`map.error_body` gar nicht enthaelt
  (faellt auf Deutsch zurueck) — englischsprachige Nutzer:innen saehen dort
  deutschen Text. Vorbestehende Luecke, nicht Teil dieses Auftrags (Runde 6
  Paket H war i18n/Barrierefreiheit, hat das offenbar uebersehen); hier nur
  dokumentiert, nicht repariert, um den Scope (Design/UX) nicht zu sprengen.
- **Konsequent nicht committet**: alle Aenderungen dieser Runde liegen im
  Arbeitsverzeichnis, nicht in einem Commit — das bleibt bewusst der
  naechsten Durchsicht durch den Menschen ueberlassen.
