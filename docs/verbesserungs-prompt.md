# Auftrags-Prompt: CLAR Runde 6 — Sicherheit, Vollständigkeit, Politur

> Zusammengestellt am 2026-07-14 durch Vollaudit von Frontend (Screens, Components,
> i18n, A11y, Testing) und Backend (17 Migrationen, 9 Edge Functions, RLS, Secrets,
> DSGVO). Dieser Prompt ist als Auftrag für eine lange, eigenständige Claude-Code-
> Session gedacht — Entscheidungen sind bewusst vorweggenommen, damit ohne
> Rückfragen gearbeitet werden kann. Reihenfolge: **zuerst verifizieren, dann
> Sicherheit, dann Funktionen/Politur.** Nach jedem Paket kurz `docs/fortschritt.md`
> und ggf. `docs/security-review.md` fortschreiben (Stil wie bisherige Einträge).

Arbeite Paket für Paket ab, committe pro Paket, und lies vor dem Start jeder Datei
zuerst den aktuellen Stand (Migrationen/Docs können sich seit diesem Audit geändert
haben). Wenn ein Punkt beim Nachsehen bereits erledigt ist, überspringen und kurz
vermerken statt nachzufragen.

---

## Paket A — Verifikation (zuerst, bevor irgendwas Neues gebaut wird)

1. Prüfe, ob Migration `017_security_hardening_2.sql` (Revoke von
   `increment_user_credits` / `check_and_increment_daily_reports` für
   `PUBLIC`/`anon`/`authenticated`) tatsächlich auf dem echten Dev-/Staging-Supabase-
   Projekt angewendet wurde, nicht nur lokal in `supabase/migrations`. Falls unklar
   oder kein Zugriff auf das gehostete Projekt besteht: dokumentiere das als
   offenen Operator-Punkt in `docs/fortschritt.md`, statt es als erledigt
   abzuhaken.
2. Prüfe denselben Punkt für die Supabase-Dashboard-Checkliste aus `docs/auth.md`
   (Rate Limits `sign_in_sign_ups`, `email_sent`, `token_verifications`) — die
   Werte in `supabase/config.toml` gelten nur für `supabase start` lokal, nicht
   automatisch für das gehostete Projekt.
3. Lege eine pgTAP-Regressionstest-Datei an (`supabase/tests/privilege_escalation.test.sql`
   o.ä.), die dauerhaft sicherstellt, dass `increment_user_credits` und
   `check_and_increment_daily_reports` NICHT von `anon`/`authenticated`/`PUBLIC`
   ausführbar sind. Ziel: eine künftige `GRANT ALL`-Migration darf das nicht
   unbemerkt zurückdrehen können.

## Paket B — Sicherheitshärtung (höchste Priorität, "alle Sicherheitsstandards")

4. **Legacy-Bucket `report-photos` bereinigen**: Alte Fotos in diesem öffentlichen
   Bucket wurden nie durch die Anonymisierungs-Pipeline (EXIF-Strip, Gesichts-/
   Kennzeichen-Blur) geschickt. Schreibe ein Migrations-/Cleanup-Skript, das diese
   Objekte auffindet und entweder nachträglich durch `process-photo`-Logik schickt
   oder (falls nicht mehr referenziert) löscht. Dokumentiere das Ergebnis.
5. **Moderations-Frontend bauen**: `review_queue`, `moderate_report`, `approve_photo`
   existieren serverseitig vollständig (Migration `010_trust_safety.sql`), aber es
   gibt keine Client-UI — das Fail-Safe-Flagging-System ist dadurch praktisch
   wirkungslos, solange niemand die Queue abarbeiten kann. Baue einen einfachen,
   auf Moderator-Rolle (`is_moderator()`) beschränkten Screen (kann ein separater
   Router-Bereich `src/app/moderation/` sein, nur sichtbar/erreichbar für Nutzer mit
   Moderator-Flag): Liste offener `review_queue`-Einträge mit Grund, Foto-Vorschau,
   Buttons "freigeben" / "ablehnen" via bestehender RPCs.
6. **Rate-Limiting-Lücken schließen**: Füge `check_and_log_rate_limit`-Aufrufe hinzu für
   - `confirm-case-done` (öffentlicher, unauthentifizierter Endpunkt — bisher komplett
     ohne Limit; IP-Hash-basiert limitieren, analog zu `submit-report`),
   - `export-my-data` und `delete-account` (leichtes Limit pro User, defensiv).
7. **GPS-Präzision auf öffentlichen Karten reduzieren**: `cases`/veröffentlichte
   `reports` zeigen exakte Lat/Lng. Implementiere Rundung auf Geohash-Zelle
   (~Geohash8-Zentroid, wie in `docs/security-review.md` B2 vorgeschlagen) für alle
   Werte, die über öffentliche Policies/Views ausgegeben werden. Exakte Koordinaten
   bleiben nur intern (Moderation, eigene Reports des Users) sichtbar.
8. **`app.json` Permission-Strings ergänzen**: Füge `ios.infoPlist` mit
   `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`,
   `NSPhotoLibraryUsageDescription` (deutsch, konkret begründet, z. B. "CLAR nutzt
   die Kamera, um Fotos von gemeldeten Orten aufzunehmen") sowie ein
   `android.permissions`-Array hinzu. Das ist Voraussetzung für App-Store-/Play-
   Store-Einreichung.
9. **Auth-Token in SecureStore migrieren**: Ersetze den `AsyncStorage`-Adapter in
   `src/lib/supabase.ts` durch `expo-secure-store` (Paket ergänzen, Adapter analog
   Supabase-Doku implementieren). Teste Login/Logout/Session-Persistenz auf einem
   echten Gerät oder Simulator, bevor als erledigt markiert — bei Fehlschlag
   Rollback-Pfad bereithalten (Team hatte dies wegen Massen-Logout-Risiko bisher
   aufgeschoben).
10. **CORS einschränken**: Ersetze `Access-Control-Allow-Origin: "*"` in den
    öffentlichen Edge Functions durch eine Allow-List bekannter Origins (App-eigene
    Domain/Expo-Web-Build), falls eine Web-Version existiert oder geplant ist;
    andernfalls zumindest dokumentieren, warum Wildcard bewusst beibehalten wird.
11. **Konstante-Zeit-Vergleich** in `authority-digest/index.ts` für den
    Service-Token-Check (`crypto.timingSafeEqual`-Äquivalent statt `!==`).
12. **pHash-Duplikatserkennung tatsächlich durchsetzen**: `report_photos.phash` wird
    berechnet, aber nie automatisch verglichen. Ergänze in `submit-report` oder
    `process-photo` einen Hamming-Distanz-Check gegen kürzlich eingereichte Fotos
    desselben Users/Standorts und markiere Duplikate zur Review statt sie direkt
    zu veröffentlichen.
13. **`export-my-data` vervollständigen**: Ergänze `audit_log`-Einträge (wo der User
    `actor_user_id` ist) und `vision_usage`-Zeilen des Users im Export, oder
    dokumentiere explizit, warum sie ausgeschlossen bleiben (Art. 15 DSGVO-Abwägung).
14. **RLS-Verhaltenstests statt nur Grant-Checks**: Ergänze pgTAP-Tests, die per
    `set_config('request.jwt.claims', ...)` echte Cross-User-Zugriffsversuche
    simulieren (User A darf User Bs `report_photos`, `points_ledger`,
    `moderation_flags`, unveröffentlichte `reports` nicht lesen). Ergänze auch
    einen Test für den `handle_flag_inserted`-Trigger (Fail-Safe-Unpublish greift
    sofort bei Flag-Insert).
15. **npm audit** Advisories (postcss, uuid, transitiv über Expo-Tooling) im Blick
    behalten: Ticket/Datum in `docs/fortschritt.md` mit Review-Termin nach dem
    nächsten Expo-SDK-Upgrade anlegen, statt stillschweigend dauerhaft
    aufzuschieben.

## Paket C — Rechtliches (Voraussetzung für echten Launch, teils Minderjährige)

16. **Alters-/Einwilligungsabfrage (Art. 8 DSGVO) umsetzen**: Löse das TODO in
    `src/app/login.tsx:64`. Baue einen einfachen Consent-/Altersabfrage-Screen vor
    oder während der Registrierung (Altersgrenze und Text nach deutschem Standard:
    z. B. Selbstauskunft "Ich bin 16 Jahre oder älter" mit Verweis auf
    Einwilligungspflicht der Eltern darunter — konkrete Rechtsprüfung bleibt offen,
    aber die technische Erfassung/Speicherung der Einwilligung in der bestehenden
    `consents`-Tabelle soll funktionsfähig sein).
17. `datenschutz.tsx`/`impressum.tsx`: technische Platzhalter-Struktur beibehalten,
    aber alle `[JURISTISCH PRÜFEN]`-Marker klar sichtbar lassen (nicht raten/
    erfinden) — das ist bewusst kein Punkt, den Claude Code juristisch selbst lösen
    soll, nur technisch sauber vorbereiten.

## Paket D — Clari-Posen (dein ursprünglicher Auftrag)

18. Rendere auf claude.ai/design (oder gleichwertig) drei zusätzliche Clari-Posen
    im Stil von `assets/mascot/clari-idle.png`: `celebrate` (Arme hoch, Konfetti),
    `levelup` (stolze Pose), `hint` (zeigend). Gleicher Freistellungs-Stil wie das
    bestehende Maskottchen (siehe Commit "Maskottchen Clari: 3D-Grafik
    freigestellt und eingebunden").
19. Lege die Dateien unter `assets/mascot/` ab (`clari-celebrate.png`,
    `clari-levelup.png`, `clari-hint.png`) und verdrahte sie in
    `src/components/Mascot.tsx` — aktuell zeigen alle vier `SOURCES`-Einträge auf
    dasselbe `IDLE`-Bild. Nach dem Fix müssen `Celebration.tsx` (Fall
    abgeschlossen) und der Level-up-Moment in `profil.tsx` sichtbar die passende
    Pose zeigen, nicht mehr die Idle-Pose.

## Paket E — Chatbot-Assistent (dein ursprünglicher Auftrag)

20. Baue einen einfachen regelbasierten Chat-Assistenten (Sprechblasen-UI, kein
    LLM-Backend nötig — FAQ-/Entscheidungsbaum-Logik reicht für den Start) mit
    Clari als Gesicht (nutzt die Mascot-Komponente/-Posen aus Paket D). Inhalte:
    Antworten zu "Wie melde ich etwas?", "Was passiert mit meinen Fotos?", "Wie
    funktionieren Punkte/Level?", Link zu Datenschutz. UI als Overlay/Modal,
    erreichbar über ein Hilfe-Icon (z. B. in der Tab-Bar oder im Profil). Halte
    Text/Fragen in `src/lib/i18n` lokalisiert, nicht hartkodiert.

## Paket F — UI-Feinschliff (dein ursprünglicher Auftrag + Ergänzungen)

21. **Glas-Tab-Bar**: bestehende `GlassSurface`-Komponente auf die Tab-Bar anwenden,
    konsistent mit dem neuen Liquid-Glass-Stil der Home-Seite.
22. **Skeleton-Loader**: neue Komponente `src/components/Skeleton.tsx` (Shimmer-
    Platzhalter für Karten/Listen) bauen und auf Home, Karte, Profil einsetzen,
    statt dass diese Screens beim ersten Render leere/Null-Zustände zeigen.
23. **Pull-to-Refresh**: `RefreshControl` auf Events-, Karte- und Profil-Screens
    ergänzen (aktuell nirgends vorhanden, nur `useFocusEffect`-Refetch beim
    Tab-Wechsel).
24. **Hero-Übergang**: sanfte Shared-Element- oder Fade/Scale-Übergangsanimation
    zwischen Home-Hero und Detailscreens (z. B. beim Antippen der Hero-Stat oder
    eines Case) mit Reanimated, passend zum bestehenden Animationssystem.
25. Splash-Hintergrundfarbe in `app.json` (`#1B7A43`) an aktuelle Theme-Primärfarbe
    (`#1C8146` in `src/constants/theme.ts`) angleichen.
26. `WeeklyChallenge`-Komponente entweder in Events oder Profil einbinden (ist
    fertig gebaut und exportiert, wird aber nirgends verwendet) oder bewusst
    entfernen, wenn nicht mehr gewollt — nicht als toten Code liegen lassen.

## Paket G — Robustheit & Fehlerbehandlung

27. Globale `ErrorBoundary` in `src/app/_layout.tsx` ergänzen, die bei einem
    ungefangenen Render-Fehler eine freundliche Fallback-UI statt Absturz zeigt.
28. Fehlerbehandlung bei Datenabfragen vereinheitlichen: `index.tsx`, `karte.tsx`,
    `profil.tsx` prüfen aktuell weder `error` aus der Supabase-Antwort noch zeigen
    sie einen Fehlerzustand/Retry — Muster aus `events.tsx` (`Alert.alert` bei
    Fehler) auf alle Datenscreens übertragen, plus sichtbaren Retry-Button statt
    reinem Alert, wo sinnvoll.
29. `case/[id].tsx`: "Nicht gefunden"/Fehlerzustand ergänzen statt endlosem
    Spinner, wenn die Zeile null bleibt (nicht vorhanden oder durch RLS
    verweigert).
30. `+not-found.tsx` Route unter `src/app/` ergänzen für ungültige Deep-Links.
31. Offline-Queue robuster machen: `PendingReport` speichert nur lokale
    File-URIs, nicht die Foto-Bytes selbst — bei Verlust des Cache-Verzeichnisses
    (z. B. nach App-Update) geht die Meldung verloren. Kopiere Fotos beim
    Queuen in ein dauerhafteres Verzeichnis (`expo-file-system` documentDirectory)
    oder zeige einen klaren "Foto verloren, bitte erneut aufnehmen"-Hinweis statt
    stillem Dauerfehlschlag.
32. Storage-Aufräum-Job für verwaiste Objekte ergänzen (offener Punkt aus
    `docs/fortschritt.md`) — z. B. als Supabase Edge Function mit Cron, die
    Storage-Objekte ohne zugehörige `report_photos`-Zeile löscht.

## Paket H — i18n & Barrierefreiheit

33. Die sechs unvollständigen Sprachen (`de-AT`, `fr`, `it`, `zh`, `nb`, `cs`, ~160-170
    von ~270 Schlüsseln) auf Vollständigkeit bringen oder zumindest korrekt als
    `beta: true` markieren — `gsw` (Schweizerdeutsch) hat aktuell nur ~100 Schlüssel,
    ist aber nicht als Beta markiert und fällt still auf Deutsch zurück; das
    Beta-Flag dafür setzen, bis die Übersetzung vervollständigt ist.
34. `accessibilityLabel`/`accessibilityRole` auf `Card.tsx`, `Badge.tsx`,
    `ProgressBar.tsx` ergänzen, wo diese als tippbare oder informationstragende
    Elemente in Screens verwendet werden (aktuell keine A11y-Props in diesen
    Basis-Komponenten).
35. Prüfen/sicherstellen, dass `AccessibilityInfo.isReduceMotionEnabled` (native
    OS-Einstellung) tatsächlich respektiert wird, nicht nur Reanimateds interner
    `useReducedMotion()`-Hook — beides an mind. einer Animation (z. B. Confetti)
    gegentesten.
36. Layout-Stresstest bei großer Systemschrift (iOS/Android max. Accessibility-
    Textgröße) für `LanguagePicker` und das 3-spaltige `Badges`-Grid — ggf. Grid auf
    kleinere Spaltenzahl oder Scroll-Layout bei Overflow umstellen.

## Paket I — Tests

37. Component-/Screen-Tests ergänzen (aktuell null): mind. für den
    `melden.tsx`-Schrittzustand (`foto → details → fertig`), die Level-up-
    Trigger-Logik in `profil.tsx`, und bedingte Render-Zustände (Loading/Empty/
    Error) der Hauptscreens.
38. Unit-Tests für bisher ungetestete reine Funktionen: `levelProgress`/`nextRank`
    in `src/constants/levels.ts`, `getCaseStatus` in `src/constants/status.ts`,
    inkl. Edge Cases (negativer Punktestand, unbekannter Status-String).
39. i18n-Test: alle `LANGUAGES`-Codes haben einen `CATALOGS`-Eintrag, Fallback-auf-
    Deutsch-Verhalten bei fehlendem Key funktioniert, Platzhalter-Interpolation
    (`{count}` etc.) wird korrekt ersetzt.
40. Falls Docker verfügbar: `supabase test db` einmal real ausführen (pgTAP lief
    laut `docs/fortschritt.md` bisher nie gegen eine laufende DB) und Ergebnis
    dokumentieren.

---

## Arbeitsweise für diese Session

- Reihenfolge: A → B → C (nur technische Vorbereitung, keine juristische
  Entscheidung) → D/E/F (deine ursprünglichen Wünsche) → G → H → I.
- Bei Unklarheit über *rechtliche* Inhalte (Alterstexte, Datenschutztexte):
  Platzhalter/TODO-Marker lassen, nicht raten — das ist der einzige Bereich, in
  dem Nachfragen statt Weiterarbeiten richtig ist.
- Bei allem anderen: sinnvolle Annahme treffen, umsetzen, kurz im Commit/in
  `docs/fortschritt.md` begründen, weitermachen statt zu fragen.
- Nach jedem abgeschlossenen Paket: `npm run lint` und `npm test` laufen lassen,
  bevor das nächste Paket beginnt.
