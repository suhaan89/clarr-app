# CLAR Design-Notes

Selbstkritik, Entscheidungen und angestrebte Wirkung pro Screen.
Redesign Juli 2026. Regel dabei: nur Frontend/Struktur, keine Backend- oder Sicherheitslogik.

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

## Karte (Home)

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
