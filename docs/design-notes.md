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
