# Auftrags-Prompt: CLAR Runde 7 — Design-Feinschliff

> Zusammengestellt am 2026-07-14, direkt im Anschluss an Runde 6
> (docs/verbesserungs-prompt.md, siehe docs/fortschritt.md für den
> vollständigen Abschluss-Stand). Diese Runde ist bewusst NUR Design/UX —
> keine neue Backend-, Sicherheits- oder Rechtslogik. Grundlage: ein
> code-gestützter Konsistenz-Audit über alle Screens/Komponenten plus die
> eigenen „Selbstkritik"-Absätze in `docs/design-notes.md` (fünf bisherige
> Redesign-Runden).
>
> **Wichtige Einschränkung, die diese Runde beachten muss:** In der
> vorigen Session war weder ein Simulator/Gerät noch eine funktionierende
> Web-Vorschau verfügbar. Der Versuch, `npx expo start --web` zu nutzen,
> ist an `react-native-maps` gescheitert (siehe Paket F unten) — das
> Metro-Bundling für Web bricht komplett, nicht nur die Karte. Alle
> Befunde hier sind daher **code-gelesen, nicht visuell verifiziert**.
> Diese Runde sollte, wo immer möglich, tatsächlich auf einem Gerät/
> Simulator gegengeprüft werden, bevor Änderungen als „fertig" gelten.

---

## Paket A — Typografie- und Spacing-Disziplin

1. **Home-Screen nutzt keine `Type`-Tokens**: `src/app/(tabs)/index.tsx`
   definiert eigene `fontSize`-Werte (22, 84, 20, 30 in den Styles
   `greeting`, `heroNumber`, `ctaTitle`, `chipValue`), die zu keinem
   Eintrag in `Type` (`display: 40`, `title: 24`, `heading: 17`, …)
   passen. Ausgerechnet der Flaggschiff-„Liquid Glass"-Screen hat die
   geringste Typografie-Token-Disziplin der App. Entweder die fehlenden
   Zwischengrößen (z. B. `Type.hero`, `Type.heroLabel`) sauber in
   `constants/theme.ts` ergänzen und von dort verwenden, oder begründen,
   warum Home bewusst eine eigene Skala braucht (dann als Kommentar im
   Code, nicht stillschweigend).
2. **Ad-hoc-Rechnung auf Tokens statt echtem Wert**: `Spacing.one + 2`
   (=6px) taucht mindestens in `case/[id].tsx`, `login.tsx`, `Badge.tsx`,
   `Celebration.tsx`, `HelpChat.tsx` auf; `Spacing.two + 2` (=10px) in
   `karte.tsx`, `melden.tsx`, `WeeklyChallenge.tsx`. Neun Dateien addieren
   denselben Zwischenwert einzeln, statt dass er als eigener Schritt in
   der `Spacing`-Skala existiert. Neuen Token ergänzen (z. B.
   `Spacing.oneHalf` oder eine feinere Skala) und alle Fundstellen darauf
   umstellen.
3. **Duplizierter „Meta-Text"-Stil**: `events.tsx` (`fontSize:14`),
   `case/[id].tsx` (`fontSize:14, lineHeight:20`), `moderation.tsx`
   (`fontSize:13`) definieren je eine eigene, leicht abweichende
   Sekundärtext-Style für dieselbe Rolle (Datum/Meta-Zeile unter einem
   Titel) statt `Type.caption`/`Type.body` zu nutzen. Auf einen
   gemeinsamen Stil vereinheitlichen.
4. **`login.tsx` negative-margin-Hack**: `ageHint: { marginTop:
   -Spacing.two }` zieht den Hinweistext händisch näher an den
   Altersabfrage-Switch heran, statt die Zeile über `gap` sauber zu
   strukturieren. Auf ein `View`-Layout mit `gap` statt negativem Margin
   umstellen.

## Paket B — Interaktions- und Icon-Konsistenz

5. **`PressableScale` nicht konsequent genutzt**: `index.tsx` (Home) nutzt
   `PressableScale` (Feder-Skalierung + Haptik) fast überall, aber
   `karte.tsx` (Aktualisieren-Button), `melden.tsx` (Auslöser/
   Galerie-Button), `profil.tsx` (Rechte-Buttons, Sprachzeile) und
   `case/[id].tsx` (Flag-Button) nutzen weiterhin rohes `Pressable` mit
   manuellem `pressed && { opacity }`. Das ergibt spürbar unterschiedliches
   Tipp-Gefühl zwischen Screens. Primäre/häufig genutzte Aktionen auf
   `PressableScale` umstellen; rein sekundäre/seltene Aktionen (z. B.
   Flag-Icon-Zeile) können bewusst leichter bleiben — dann aber als
   Entscheidung kommentieren, nicht als Zufall stehen lassen.
6. **Uneinheitliche Icon-Wahl für dasselbe Konzept**: `karte.tsx`
   (Legende/Pin) nutzt `trash` (gefüllt), `profil.tsx` nutzt teils
   `trash-outline` für denselben „Müll/offen"-Gedanken. Auf eine Variante
   festlegen (Empfehlung: `-outline` als App-Standard, gefüllt nur für
   aktive/ausgewählte Zustände) und app-weit angleichen.
7. **Kein `onDanger`-Token**: `karte.tsx` `MapPin` hardcodet
   `color="#fff"` für das Icon auf rotem/grünem Grund, weil `theme.ts`
   zwar `onPrimary`/`onAccent`/`onWater` kennt, aber kein `onDanger`. Aktuell
   zufällig korrekt (Weiß passt), aber nicht systematisch. Token ergänzen,
   Stelle darauf umstellen.
8. **Modal-Dismiss-Muster uneinheitlich**: `LanguagePicker`s Sheet hat
   keine sichtbare Schließen-Affordanz (nur Backdrop-Tap oder
   Android-Zurück), `HelpChat`s Modal hat oben rechts ein explizites
   ×-Icon. Auf ein gemeinsames Muster vereinheitlichen (Empfehlung: beide
   bekommen ein sichtbares ×, das ist für Screenreader-Nutzer:innen und
   Erstnutzer:innen eindeutiger als Backdrop-Tap allein).

## Paket C — Ladezustände

9. **`karte.tsx` hat keinen Ladezustand**: Anders als `profil.tsx`
   (Skeleton, diese Runde ergänzt) oder `events.tsx`/`case/[id].tsx`
   (`LoadingState`) zeigt die Karte beim ersten Öffnen eine leere Karte
   und „0/0" in der Legende, bevor die erste Anfrage zurückkommt — ein
   kurzer, aber unschöner Leerzustand. Entweder `LoadingState` bis zum
   ersten `load()`-Abschluss zeigen, oder die Legende mit `Skeleton`
   überbrücken (Komponente existiert schon, `src/components/Skeleton.tsx`).

## Paket D — Auf echtem Gerät verifizieren (übernommen aus `docs/design-notes.md`)

Diese Punkte stehen dort bereits als offene Selbstkritik, sind aber nie
gegen ein echtes Gerät geprüft worden — in dieser Runde nachholen, sofern
ein Gerät/Simulator zur Verfügung steht:

10. **Glas-Fallback auf Android** (Redesign-Runde 5): `GlassSurface` fällt
    ohne `expo-glass-effect`-Unterstützung auf eine transluzente Fläche
    zurück, kein echter Blur. Auf einem echten Android-Gerät prüfen, ob
    Text auf dem Verlauf durchgängig lesbar bleibt.
11. **60fps/Sheen-Timing/Glas-Lesbarkeit** (Redesign-Runde 5): Home-Screen
    wurde nur mit `tsc`/`eslint` verifiziert, nie live. Auf Performance
    (besonders die Licht-Blobs + Sheen-Animation) und Kontrast auf einem
    echten Gerät prüfen.
12. **Konfetti-Teilchenzahl auf schwachen Geräten** (Redesign-Runde 4):
    `Confetti` rendert standardmäßig 80 einzelne `Animated.View`s ohne
    Skia. Auf einem älteren/schwächeren Gerät prüfen, ob das noch flüssig
    läuft; bei Bedarf `count` senken oder geräteabhängig anpassen.
13. **Reduce-Motion für Konfetti** (aus Runde 6 übernommen): Der neue
    `useSystemReduceMotion`-Hook (`src/lib/accessibility.ts`) wurde nur
    code-geprüft, nie am Gerät gegengetestet (OS-Einstellung live
    umschalten, prüfen dass Konfetti sofort ausbleibt).

## Paket E — Bekannte technische Falle für zukünftige Web-/Vorschau-Versuche

14. **`react-native-maps` bricht die Web-Vorschau komplett**: Ein Versuch,
    `expo start --web` zu nutzen, um Screens visuell zu prüfen, scheitert
    an `node_modules/react-native-maps/lib/MapMarkerNativeComponent.js`
    (importiert `react-native/Libraries/Utilities/codegenNativeCommands`,
    das auf Web nicht existiert) — das bricht das Bundling für die GANZE
    App, nicht nur `karte.tsx`, weil Expo Router alle Routen in einem
    Bundle zusammenfasst. Für eine künftige Web-Vorschau bräuchte es
    entweder einen bedingten Import (`Platform.OS === 'web'` → Platzhalter
    statt `MapView`) oder ein Web-taugliches Karten-Paket. Kein
    Handlungsauftrag für diese Runde, nur Dokumentation, damit die nächste
    Session nicht erneut Zeit damit verliert.

---

## Bereits in dieser Vorbereitung direkt behoben (nicht mehr Teil des Auftrags)

Drei kleine, eindeutige Befunde wurden schon vorab korrigiert (Commit
„Design-Audit Runde 7: drei direkte Korrekturen"): `ErrorBoundary` zeigte
den Absturz-Text immer fest auf Deutsch statt die gespeicherte
Spracheinstellung zu nutzen; `BrandSplash` hatte mit `#1B7A43` ein leicht
anderes Grün als das aktuelle Marken-Grün (`#1C8146`); `melden.tsx`s
Kamera-Overlays nutzten eigene `rgba(0,0,0,x)`-Werte statt des
vorhandenen `colors.overlay`-Tokens.

## Arbeitsweise für diese Session

- Reihenfolge: A → B → C (kleine, sichere Code-Änderungen) → D (nur wenn
  ein Gerät/Simulator verfügbar ist — sonst als weiter offen vermerken,
  nicht raten) → E ist reine Dokumentation, kein Umsetzungsauftrag.
- Jede Änderung MUSS weiter durch `constants/theme.ts`-Tokens laufen,
  keine neuen Hex-/Pixel-Werte direkt in Screens.
- Nach jedem Paket: `npx tsc --noEmit`, `npm run lint`, `npm test` grün
  halten, kurzer Vermerk in `docs/design-notes.md` (nicht `fortschritt.md`
  — das ist der Backend-/Robustheits-Log, Design hat sein eigenes Log).
- Bei Unsicherheit über eine rein geschmackliche Entscheidung (z. B.
  „welches Icon wirkt runder"): sinnvolle, mit den bestehenden
  Redesign-Runden konsistente Wahl treffen, kurz begründen, weitermachen
  — nicht nachfragen. Nachfragen nur, wenn eine Änderung eine der in
  `docs/design-notes.md` dokumentierten bewussten Entscheidungen (z. B.
  „Home bleibt minimalistisch", „keine Zufalls-/Lootbox-Mechanik") infrage
  stellen würde.
