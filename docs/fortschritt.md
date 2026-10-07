# Fortschritt — Backend-Pakete (Lauf 2026-07-10)

Dieses Repo (`clarr-app`) ist das neue App-Gerüst. Das Supabase-Backend wird
paketweise aus `clar-app2` übernommen (geprüfter Stand, Commit `1ac7ec8` dort);
Details und Annahmen in `NOTIZEN.md`.

## Paket 1 — Fundament ✅

- `supabase/migrations/001_schema.sql`: Bestandsschema der DEV-DB
  (user_profiles, reports, cleanup_events, cleanup_signups, Storage-Bucket
  `report-photos`) — Referenz, in DEV bereits angewendet.
- `supabase/migrations/002_fundament.sql`: additiv — Enums (`report_status`,
  `case_status`, `photo_kind`, `verification_level`, `flag_reason`), neue
  Tabellen `cases`, `report_photos`, `points_ledger` (append-only inkl.
  Trigger gegen UPDATE/DELETE), `moderation_flags`, `vision_usage`,
  `audit_log`; additive Spalten auf `reports`; RLS default-deny + explizite
  Policies; View `points_balance` (security_invoker).
- `user_profiles.credits` bleibt unverändert (Cache); Quelle der Wahrheit
  wird `points_ledger`.
- Doku: `docs/fundament.md`, Bestandsaufnahme `docs/schema-ist.md`.

## Paket 2 — Auth ✅

- `supabase/migrations/003_auth.sql`: `user_verification_level`
  (neu → mail_verifiziert → aktiv), `reputation_score` (nur serverseitig via
  `adjust_reputation`), Trigger auf `auth.users.email_confirmed_at`,
  RPC `activate_account`; `user_profiles` für Clients read-only;
  Alters-/Einwilligung nur TODO „JURISTISCH PRUEFEN".
- `supabase/config.toml`: Rate-Limits für Registrierung/Mails (lokal);
  Dashboard-Checkliste für das DEV-Projekt in `docs/auth.md`
  (u. a. „Prevent email enumeration").

## Paket 3 — Meldungs-Backend ✅

- `supabase/functions/submit-report/`: einziger Schreibpfad für Meldungen
  (Clients haben kein INSERT auf `reports` mehr). Auth-Pflicht + Level
  `aktiv`, Geo/Zeit serverseitig, Quota 10/Tag pro Nutzer + globales Limit
  (atomar via `consume_report_quota`), Bündelung an offene Fälle im
  ~30-m-Umkreis (Geohash + Haversine, Advisory-Lock), Mock-Location/Speed
  ⇒ `location_suspect` + Reputationsabzug, Rate-Limit Konto/Gerät/IP
  (nur SHA-256-Hashes).
- `supabase/migrations/004_submit_report.sql`: Spalten/RPCs/Tabellen dafür.
- Doku: `docs/meldungs-backend.md`.

## Paket 4 — Vision + Kill-Switch ✅

- `supabase/functions/analyze-photo/`: KI-Prüfung nur serverseitig, nur für
  eigene Reports im Zustand `gemeldet` (also nur nach submit-report).
  Budgetdeckel pro Nutzer + global (race-sicher, pessimistische Reservierung
  unter Advisory-Lock), KILL-SWITCH bei Globallimit (Meldung → Review-Queue,
  App bleibt nutzbar), Alert ab 80 % ins audit_log, Bildverkleinerung vor dem
  Call, Confidence <0.6 → Review, Gewalt/Nacktheit → Block.
- `supabase/migrations/005_vision_budget.sql`: `system_settings`-Budgets,
  Reservierungs-RPCs, Kill-Switch-Zustand.
- Doku: `docs/vision.md`. Key nur als Supabase Secret.

## Paket 5 — Foto-Pipeline ✅

- `supabase/functions/process-photo/`: EXIF/GPS strippen, dHash (pHash)
  speichern, Gesichter/Kennzeichen pixelieren (Vision-Bounding-Boxes;
  FEHLBAR — im Code markiert, Review-Schritt davor), Ablage nach
  `public-blurred`; Fail-safe: ohne erfolgreichen Lauf bleibt das Foto privat.
- `supabase/migrations/006_photo_pipeline.sql`: Buckets `originals`
  (privat) + `public-blurred` (öffentlich, nur Service schreibt) inkl.
  Storage-Policies; Metadaten-Spalten auf `report_photos`.
- Löschung entfernt Original + Derivate; Signed URLs kurzlebig.
- Doku: `docs/foto-pipeline.md`.

## Paket 6 — Reward-Engine ✅

- `supabase/migrations/007_rewards.sql`: `award_points()` (nur Service-Role),
  idempotent per `booking_key`, Regeln: Meldung 10 / Bestätigung 3 /
  Fallabschluss mit Nachher-Foto 25, Degression (Halbierung je Wiederholung
  am selben Ort, 30 Tage), Tagesdeckel 50 mit Teilbuchung; Saldo/Level als
  View `points_level`. Keine Streaks, kein Zufall.
- `supabase/tests/rewards.test.sql` (pgTAP, `supabase test db`): Idempotenz,
  Tagesdeckel, „Client kann nicht buchen".
- Doku: `docs/rewards.md`. `user_profiles.credits` bleibt unangetastet.

---

# Teil 2 (Pakete 7–13) — Stand 2026-07-10

## Fertig ✅

- **Paket 7 — Real-World-Loop**: Fall-Statusmaschine (Trigger + audit_log,
  gilt auch für Service-Role), close-case (Nachher-Foto, ≤100 m,
  Anti-Kollusion, Punkte 1× pro Fall), Push an Melder (Opt-in). NEU:
  Wochen-Digest an Behörde (Kartenlink + geblurrtes Foto, keine
  Melder-Daten) mit einmaligem, signiertem „erledigt"-Rücklauf-Token
  (nur Hash in DB) → Migrationen 008/009, Functions authority-digest,
  confirm-case-done.
- **Paket 8 — Trust & Safety**: Flag → sofort unsichtbar bis Review
  (fail-safe); Review-Queue nur geflaggt/Confidence/5%-Stichprobe/
  Privatgrund; Privatgrund bleibt privat; kein „Verursacher"-Feld;
  Moderation rollen-geschützt + audit_log (Migration 010).
- **Paket 9 — Frontend**: Karte (geprüft + geblurrt, geschlossene Fälle
  grün), Melde-Flow (In-App-Kamera=wertbar, Galerie=ohne Punkte —
  serverseitig erzwungen), Fall-Detail (Flag, Abschluss), Impact-Profil
  (Server-Punkte, ohne Streaks/Grind, Opt-in-Leaderboard mit
  Wochen-Reset), Events, Login (Anti-Enumeration). OFFLINE-Queue mit
  Client-Idempotenz-Key (Migration 011, kein Doppel-Sync). A11y: Labels,
  Touch-Ziele, dynamische Schrift, Kontraste. `tsc` sauber.
- **Paket 10 — Events + Cold-Start**: Events nur Team/Partner (RLS),
  gebündelter Fall-Abschluss (Punkte idempotent pro Fall), Admin-Seeding
  mit is_seed-Markierung (Migration 012, close-event-cases,
  scripts/seed-admin.mjs).
- **Paket 11 — Betroffenenrechte**: granulare Consents nachweisbar
  (append-only, Migration 013), Datenexport (Art. 15) + Konto-Löschung
  (Art. 17, inkl. Original+Derivate), Screens Datenschutz/Impressum als
  ENTWURF (JURISTISCH PRUEFEN), docs/legal/data-flows.md.
- **Paket 12 — Tests & Umgebungen**: `npm test` läuft (Jest, 10 Tests:
  Offline-Queue kein Doppel-Sync, Auth-Validierung); pgTAP rewards + auth;
  supabase/seed.sql (synthetisch, dev/staging); docs/ops.md
  (Migrations-Workflow, Deploys, Secrets, Scheduling).
- **Paket 13 — Security-Härtung**: RLS-Gesamtaudit (alle 16 Tabellen
  default-deny, Tabelle in docs/security-review.md), Secrets-Scan sauber,
  Quotas/Kill-Switch verifiziert, Abuse-Cases dokumentiert; Migration 014:
  Flag-Tageslimit, Teilnehmerlisten privat, Legacy-Bucket-Schreibweg zu,
  Pfad-Besitz-Trigger.
- **Bugfix-Lauf 2026-07-11**: `tsc` wieder sauber (events.tsx), verwaiste
  Fälle im Behörden-Digest bei fehlgeschlagenem Token-Insert behoben,
  Event-Kapazität serverseitig durchgesetzt (Migration 015), Pseudonym-
  Validierung Client/Server angeglichen + Fehler werden jetzt angezeigt
  statt verschluckt (Migration 016), `npm run lint` lauffähig gemacht
  (eslint-Setup fehlte). Details: NOTIZEN.md „Bugfix-Lauf 2026-07-11".

## Offen ⏳ (Stand vor Runde 6 — siehe unten für aktuellen Stand)

- **Juristisch**: Datenschutz/Impressum-Texte, Alters-/Einwilligungslogik
  (Art. 8), Consent-Gating des Behörden-Digests, AVV Supabase/Anthropic
  (alles als JURISTISCH PRUEFEN markiert).
- **Betreiber-Aktionen**: Auth-Dashboard-Checkliste (docs/auth.md) im
  DEV-Projekt setzen; Digest-Scheduling (wöchentlich) einrichten;
  `RESEND_API_KEY`/Behörden-Adresse konfigurieren; Migrationen
  008–016 + Functions gegen DEV ausrollen (docs/ops.md).
- **Technisch**: Push-Token-UI (expo-notifications), pgTAP-Lauf via Docker/CI.

---

# Runde 6 (Pakete A–I, docs/archiv/verbesserungs-prompt-runde6.md) — Stand 2026-07-14

Auftrag: langer, eigenständiger Lauf über Verifikation → Sicherheit →
Recht (nur technisch) → Funktionen/Politur → Robustheit/i18n/Tests.
Reihenfolge eingehalten. Nach jedem Paket `npm run lint`/`npx tsc --noEmit`/
`npm test` grün gehalten (siehe jeweils am Paketende).

## Paket A — Verifikation ⏳ teilweise

1. **Nicht verifizierbar in dieser Session**: kein Docker (also kein
   `supabase start`/`supabase test db`), kein `SUPABASE_ACCESS_TOKEN`, kein
   DB-Passwort für das gehostete Projekt
   (`https://uzbjknhmpbxtgvlclpqe.supabase.co`, aus `.env`). Ob Migration
   `017_security_hardening_2.sql` (Revoke `increment_user_credits`/
   `check_and_increment_daily_reports`) wirklich auf dem gehosteten
   Dev-Projekt angewendet wurde, bleibt **offener Operator-Punkt**.
   **Aktion für den Betreiber**: `npx supabase login` (oder
   `SUPABASE_ACCESS_TOKEN` setzen), dann
   `npx supabase link --project-ref uzbjknhmpbxtgvlclpqe && npx supabase db push`
   bzw. `npx supabase migration list --linked` zum Abgleich.
2. **Ebenfalls nicht verifizierbar**: die Supabase-Dashboard-Checkliste aus
   `docs/auth.md` (Rate Limits `sign_in_sign_ups`/`email_sent`, „Prevent
   email enumeration"). `supabase/config.toml` gilt nur lokal — das
   gehostete Projekt braucht die Werte manuell im Dashboard
   (Authentication → Rate Limits / Advanced). **Offener Operator-Punkt.**
3. **Erledigt** ✅: `supabase/tests/security_hardening_2.test.sql` (neu) —
   pgTAP-Regressionstest, der dauerhaft sicherstellt, dass
   `increment_user_credits`/`check_and_increment_daily_reports`/alle
   Trigger-Funktionen NICHT von `anon`/`authenticated`/`PUBLIC` ausführbar
   sind, plus `search_path`-Haertung. Ungetestet gegen echte DB (kein
   Docker) — Ausführung nachholen, siehe Paket I.40.

## Paket B — Sicherheitshärtung ✅ (bis auf Betreiber-Ausführung)

4. **Legacy-Bucket `report-photos`**: `scripts/cleanup-legacy-bucket.mjs`
   (neu) — listet den Bucket, meldet noch referenzierende Alt-Reports zur
   Transparenz und löscht (nur mit `--delete`, Default Trockenlauf).
   Begründung fürs Löschen statt Nachbearbeiten: Schreibweg seit
   Migration 014 tot, Alt-Reports haben ihre KI-Prüfung längst
   durchlaufen, kein Code liest mehr daraus — unanonymisiert öffentlich
   liegen lassen wiegt schwerer als die Referenzen zu erhalten. **Noch
   nicht ausgeführt** (kein Service-Role-Zugriff in dieser Session) —
   Betreiber-Aktion.
5. **Moderations-Frontend**: neuer Screen `src/app/moderation.tsx`
   (Stack-Route, kein Tab-Eintrag), nur erreichbar über einen Link im
   Profil-Screen bei `role = 'moderator'`; nutzt bestehende RPCs
   `moderate_report`/`approve_photo`. Migration `020_moderation_frontend.sql`
   ergänzt eine fehlende RLS-Lücke: Moderatoren konnten `report_photos`
   fremder, nicht freigegebener Fotos bisher gar nicht lesen (nur
   `review_queue`/`moderation_flags` hatten in Migration 010 eine
   Moderator-Policy bekommen, `report_photos` wurde übersehen).
6. **Rate-Limiting**: `confirm-case-done` (IP-Hash, 20/10min),
   `export-my-data` (5/h/User) und `delete-account` (3/h/User) nutzen jetzt
   `check_and_log_rate_limit` über den neuen gemeinsamen Helfer
   `supabase/functions/_shared/security.ts`.
7. **GPS-Präzision**: Migration `018_gps_precision.sql` — `geohash_decode_
   centroid`/`round_to_geohash8` (nutzt das bestehende `geohash_encode` aus
   Migration 004) + View `public.reports_map` (security_invoker, rundet auf
   Geohash8-Zentroid). `karte.tsx` liest jetzt `reports_map` statt der
   Rohtabelle; `case/[id].tsx` selektiert nur noch die tatsächlich
   angezeigten Spalten (kein `select('*')` mehr, das exakte
   `location_lat/lng` unnötig zum Client geschickt hätte).
   `supabase/tests/gps_precision.test.sql` (neu, ungetestet mangels Docker).
8. **`app.json`**: `ios.infoPlist` (Kamera/Fotos/Standort, deutsch,
   konkret) + `android.permissions` (Kamera, Standort) ergänzt — vorher
   komplett leer.
9. **Auth-Session → SecureStore**: `src/lib/supabase.ts` nutzt jetzt den
   offiziellen Supabase-Adapter-Pattern (`expo-secure-store` +
   `expo-crypto` + `aes-js`): Session bleibt AES-256-verschlüsselt in
   AsyncStorage, nur der kleine Schlüssel liegt im Keychain/Keystore (löst
   SecureStores 2048-Byte-Limit-Problem, das früher „Massen-Logout-Risiko"
   hieß). **Rollback**: Adapter in `supabase.ts` zurück auf reines
   `AsyncStorage` tauschen. **Migrationsfolge**: bestehende
   AsyncStorage-Sessions von vor diesem Update lassen sich nicht mehr
   entschlüsseln (kein Schlüssel im Keychain vorhanden) → betroffene
   Nutzer:innen müssen sich EINMALIG neu anmelden. **Nicht auf echtem
   Gerät/Simulator getestet** (keine Geräte-/Simulator-Umgebung in dieser
   Session verfügbar) — das war explizit gefordert, bevor als „fertig"
   gilt. **Vor dem Rollout: manuell auf Gerät/Simulator verifizieren.**
10. **CORS**: neues `supabase/functions/_shared/security.ts` mit
    `corsHeadersFor(req)` — Origin-Allowlist statt `"*"`, konfigurierbar
    über das Function-Secret `ALLOWED_ORIGINS` (kommagetrennt), Default nur
    lokale Expo-Web-Dev-Server. Betrifft die 7 Functions, die vorher
    `"*"` hatten (`submit-report`, `close-case`, `close-event-cases`,
    `delete-account`, `export-my-data`, `analyze-photo`, `process-photo`).
    Mobile-App-Aufrufe sind von CORS ohnehin nicht betroffen (kein
    Origin-Header) — die Einschränkung wirkt nur auf potenzielle
    Web-Aufrufe.
11. **Konstante-Zeit-Vergleich**: `authority-digest/index.ts` vergleicht
    den Service-Token jetzt über `timingSafeEqual` (SHA-256-Hash beider
    Seiten + konstante XOR-Schleife) statt `!==`.
12. **pHash-Duplikaterkennung**: `process-photo/index.ts` vergleicht den
    dHash jetzt per Hamming-Distanz (Schwelle 5/64 Bit) gegen die Fotos
    desselben Users der letzten 30 Tage. Treffer → `approved` bleibt
    `FALSE`, `review_queue`-Eintrag `duplikat_verdacht` (neuer, additiver
    Grund, Migration `019_duplicate_detection.sql`), nie automatische
    Ablehnung/Löschung — ein Mensch entscheidet.
13. **`export-my-data`**: ergänzt um `audit_log` (nur `actor_user_id =
    eigene ID`) und `vision_usage` der eigenen Reports — vorher fehlten
    beide trotz Art.-15-Anspruch.
14. **RLS-Angreifer-Tests**: `supabase/tests/rls_attacker.test.sql` (neu)
    — echte Cross-User-Zugriffsversuche per `SET ROLE authenticated` +
    `set_config('request.jwt.claims', ...)`, inkl. Test für den
    `handle_flag_inserted`-Fail-Safe-Trigger. Ungetestet mangels Docker.
15. **npm audit**: 18 moderate Advisories, alle transitiv über
    `@expo/*`-Build-Tooling (`postcss` XSS, `uuid` Bounds-Check über
    `xcode`) — keine Laufzeit-Abhängigkeit der App selbst, kein Fix ohne
    Expo-SDK-Upgrade verfügbar. **Review-Termin: nächstes Expo-SDK-Upgrade.**

**Verifikation nach Paket A+B**: `npx tsc --noEmit` ✅ sauber ·
`npm run lint` ✅ 0 Fehler (2 Vorbestand-Warnungen in
`offline-queue.test.ts`, nicht dieser Runde) · `npm test` ✅ 26/26 Tests
grün. Neue pgTAP-Dateien (`security_hardening_2`, `gps_precision`,
`rls_attacker`) konnten mangels Docker nicht ausgeführt werden —
Nachholen in Paket I.40 vermerkt.

## Paket C — Rechtliches (nur technische Vorbereitung) ✅

16. **Alters-/Einwilligungsabfrage**: `login.tsx` hat jetzt vor der
    Registrierung eine Pflicht-Selbstauskunft „Ich bin 16 Jahre oder
    älter" (Switch, Signup-Button bleibt deaktiviert ohne Bestätigung);
    wird per `record_consent('altersbestaetigung', true)` nachweisbar im
    `consents`-Journal gespeichert (Migration `021_age_consent.sql`,
    additiver consent_key, gleiche append-only-Mechanik wie die
    bestehenden Consents). `docs/auth.md` aktualisiert. **Weiterhin
    JURISTISCH PRUEFEN**: die 16-Jahre-Grenze ist eine Annahme, keine
    geprüfte Rechtsauskunft; es gibt bewusst keine serverseitige Sperre
    bei Selbstauskunft „unter 16" (nur ein Hinweistext) — das technische
    Erfassen war der Auftrag, nicht die rechtliche Ausgestaltung.
17. **Rechtstexte-Platzhalter**: `datenschutz.tsx`/`impressum.tsx`
    geprüft — beide zeigen bereits einen sichtbaren „ENTWURF – JURISTISCH
    PRÜFEN"-Banner plus `[JURISTISCH PRÜFEN]`-Marker in den Texten selbst.
    Nichts geändert (kein Rechtstext erfunden/ausformuliert), nur
    verifiziert, dass der Status korrekt sichtbar bleibt.

`npx tsc --noEmit` ✅ · `npm run lint` ✅ 0 Fehler · `npm test` ✅ 26/26.

## Paket D — Clari-Posen ⏳ blockiert (Assets), Wiring ✅

18/19. Geprüft: `Mascot.tsx`s `SOURCES`-Map, `Celebration.tsx` (reicht
`pose` durch) und die Aufrufer (`case/[id].tsx` → `pose="celebrate"`,
`profil.tsx` → `pose="levelup"`) sind bereits korrekt verdrahtet — kein Bug
wie ursprünglich angenommen. **Blockiert**: In dieser Session steht kein
Text-zu-Bild-Generierungswerkzeug zur Verfügung (nur Adobe-Bildbearbeitung:
Crop/Anpassungen/Vectorize — keine Neugenerierung von Inhalten/Posen).
**Aktion für dich**: die drei Posen extern rendern (z. B. claude.ai/design,
wie ursprünglich vorgeschlagen) und als `clari-celebrate.png`,
`clari-levelup.png`, `clari-hint.png` unter `assets/mascot/` ablegen — die
`SOURCES`-Map nimmt sie dann ohne weitere Codeänderung auf.

## Paket E — Chatbot-Assistent ✅

20. Neue Komponente `src/components/HelpChat.tsx`: regelbasierter FAQ-Chat
    (4 feste Fragen/Antworten, kein LLM), Clari (Pose `hint`) als Gesicht,
    Sprechblasen-Optik im bestehenden Card-/Modal-Stil (analog
    `Celebration.tsx`). Erreichbar über ein schwebendes Hilfe-Icon, global
    in `_layout.tsx` gerendert (nur sichtbar mit aktiver Session, nicht auf
    dem Login-Screen). Alle Texte über `src/lib/i18n` (`chat.*`-Schlüssel,
    nur `de` — Fallback greift für die anderen Sprachen).

## Paket F — UI-Feinschliff ✅

21. **Glas-Tab-Bar**: `tabBarBackground` (React-Navigation-Bottom-Tabs-
    Erweiterungspunkt) rendert jetzt `GlassSurface` hinter der Tab-Bar,
    `tabBarStyle` transparent. Bewusst NICHT `position: absolute` (das hätte
    Screens mit eigenem Bottom-Padding/absoluten Elementen wie der
    Karten-Legende zerbrochen) — die Bar bleibt im normalen Layoutfluss,
    nur ihr Hintergrund ist jetzt die Glas-Fläche.
22. **Skeleton-Loader**: neue Komponente `src/components/Skeleton.tsx`
    (`Skeleton`/`SkeletonLine`, Shimmer mit Reduce-Motion-Fallback) und in
    `profil.tsx` eingesetzt (Impact-Karte + Aktivitäts-Liste zeigen jetzt
    Platzhalter statt kurz "0 Punkte"/"noch nichts" zu blitzen, bis der
    erste Ladevorgang durch ist). Home bewusst NICHT retrofittet (eigenes,
    fein abgestimmtes Eintritts-Animationssystem — Counter startet ohnehin
    sauber bei 0, kein irreführender Null-Zustand); Karte zeigt nur kurze
    Zahlen in der Legende, geringes Risiko.
23. **Pull-to-Refresh**: `events.tsx` und `profil.tsx` (dort `load()` auf
    `async`/`Promise.all` umgestellt, damit `RefreshControl` weiß, wann der
    Refresh fertig ist) haben jetzt `RefreshControl`. `karte.tsx` bewusst
    OHNE `RefreshControl` (das braucht eine ScrollView als Vorfahre, deren
    Pan-Geste mit der Kartennavigation kollidieren würde) — stattdessen ein
    expliziter Aktualisieren-Button oben rechts.
24. **Hero-Übergang**: `case/[id].tsx` blendet den Inhalt jetzt per
    Reanimated (Fade + leichtes Scale-in, 420 ms) ein, sobald der Fall
    geladen ist, statt hart vom Spinner umzuschalten. Respektiert Reduce-
    Motion.
25. Splash-Hintergrundfarbe bereits in Paket B erledigt (`app.json`
    `#1C8146`).
26. **WeeklyChallenge**: eingebunden statt entfernt — `src/lib/week.ts`
    (`startOfIsoWeek`) war erkennbar extra dafür gebaut, aber nie benutzt.
    Home zählt jetzt neue `cases` seit Montag 00:00 (gemeinschaftsweit,
    keine PII) und zeigt die Karte unter der bestehenden Chip-Reihe.

`npx tsc --noEmit` ✅ · `npm run lint` ✅ 0 Fehler · `npm test` ✅ 26/26.

## Paket G — Robustheit & Fehlerbehandlung ✅

27. **Globale ErrorBoundary**: `src/components/ErrorBoundary.tsx` (einzige
    Klassenkomponente im Projekt — React-Fehlergrenzen gibt es nur so),
    umschließt die gesamte App in `_layout.tsx`. Freundlicher Fallback +
    "Erneut versuchen"-Button statt Absturz.
28. **Fehlerbehandlung vereinheitlicht**: `index.tsx`, `karte.tsx`,
    `profil.tsx` prüfen jetzt `error` aus der Supabase-Antwort und zeigen
    `Alert.alert` mit Retry-Option (Muster aus `events.tsx` übernommen,
    dort gab es das bisher nur für Mutationen, nicht den initialen Load —
    wird hier zum ersten Mal konsequent für Ladevorgänge genutzt).
29. **`case/[id].tsx` Not-Found**: `loading`/`caseRow`-Zustände jetzt
    getrennt — vorher hing der Screen bei einem ungültigen/fremden Link
    für immer im Spinner. Zeigt jetzt `EmptyState` "Fall nicht gefunden".
30. **`+not-found.tsx`**: neue Route für ungültige Deep-Links (`EmptyState`
    + Link zurück zur Startseite).
31. **Offline-Queue robuster**: `enqueueReport` kopiert Fotos jetzt in
    `FileSystem.documentDirectory` (dauerhaft), bevor der Eintrag in die
    Queue kommt — die ursprüngliche Kamera-/Galerie-Cache-URI kann danach
    jederzeit vom OS geräumt werden, ohne die Meldung zu gefährden. Fehlt
    die Kopie trotzdem (z. B. App-Daten manuell geleert), wird der Eintrag
    beim Sync als `lost` erkannt und NICHT endlos erneut versucht, sondern
    entfernt + dem Nutzer klar gemeldet ("Foto verloren, bitte erneut
    aufnehmen", Alert in `_layout.tsx`). Kopien werden nach erfolgreichem
    Sync wieder gelöscht. Jest-Tests erweitert (neuer Fall + `lost`-Feld in
    `SyncResult`).
32. **Storage-Aufräum-Job**: neue Edge Function
    `supabase/functions/storage-cleanup` (analog `authority-digest`:
    Service-Role-Bearer, konstante-Zeit-Vergleich). Räumt `originals`/
    `public-blurred` von Objekten ohne zugehörige `report_photos`-Zeile,
    mit 24h-Schonfrist gegen Races mit laufenden Uploads. Geplant täglich
    (docs/ops.md aktualisiert); `docs/security-review.md` offene Punkte
    4+5 als erledigt markiert.

`npx tsc --noEmit` ✅ · `npm run lint` ✅ 0 Fehler (2 Vorbestand-Warnungen)
· `npm test` ✅ 27/27.

## Paket H — i18n & Barrierefreiheit ✅

33. Erledigt vorgezogen (siehe oben) — `gsw` als `beta: true` markiert;
    tatsächlicher Stand geprüft (Skript gezählt): `de`/`en` 227/227
    Schlüssel vollständig, `gsw` 85/227, `de-AT` nur 6/227 (auch beta),
    `fr`/`it`/`zh`/`nb`/`cs` je 149/227 (bereits korrekt beta) — die
    Zahlen im ursprünglichen Prompt waren etwas ungenau, die Diagnose
    (gsw faelschlich nicht als Beta markiert) stimmte.
34. **accessibilityLabel/-Role**: `ProgressBar.tsx` hatte bisher GAR keine
    Accessibility-Props — jetzt `accessibilityRole="progressbar"` +
    `accessibilityValue` + optionales `accessibilityLabel` direkt am
    Balken (nützt v. a. `WeeklyChallenge`, das nur eine "summary"-Rolle
    auf der Karte hat, nicht "progressbar"). `LevelProgress.tsx` hatte das
    bereits korrekt auf seinem äußeren Container. `Card.tsx`/`Badge.tsx`
    geprüft: beide unterstützen Accessibility-Props bereits vollständig
    (Card reicht `...rest` durch, Badge zeigt immer sichtbaren `Text` —
    für Screenreader ohnehin automatisch lesbar) — kein Bug gefunden.
35. **Reduce-Motion**: `Confetti.tsx` verließ sich nur auf Reanimateds
    `useReducedMotion()` (liest die OS-Einstellung laut Reanimated-Doku
    nur EINMAL beim App-Start, reagiert nicht live auf eine Änderung
    während der Sitzung). Neuer geteilter Hook
    `src/lib/accessibility.ts` (`useSystemReduceMotion`, live via
    `AccessibilityInfo.addEventListener('reduceMotionChanged', ...)`,
    analog zum bestehenden `useReduceTransparency` in `GlassSurface.tsx`)
    — beide Signale jetzt kombiniert (`||`). **Nicht auf echtem Gerät
    gegengetestet** (kein Geräte-/Simulator-Zugriff in dieser Session) —
    das war explizit Teil des Auftrags; bitte vor Release einmal die
    OS-Einstellung bei laufender App umschalten und prüfen, dass Konfetti
    sofort ausbleibt.
36. **Layout-Stresstest große Schrift**: `Badges.tsx` (3-Spalten-Raster,
    31 % Breite + zweizeiliger Titel) wechselt jetzt bei
    `PixelRatio.getFontScale() > 1.6` auf 2 Spalten (47 % Breite) —
    vorher bei sehr großer Bedienungshilfen-Schrift eng/abgeschnitten.
    `LanguagePicker.tsx` geprüft: Zeilen haben `minHeight` (kein festes
    `height`/`maxHeight`, kein `numberOfLines`), wachsen also bei langen,
    umgebrochenen Sprachnamen einfach nach unten mit — kein Layoutbruch
    gefunden, keine Änderung nötig.

`npx tsc --noEmit` ✅ · `npm run lint` ✅ 0 Fehler · `npm test` ✅ 27/27.

## Paket I — Tests ✅ (bis auf pgTAP-Ausführung)

37. **Component-/Screen-Tests**: `@testing-library/react-native` neu als
    Dev-Dependency (Projekt hatte bisher NULL Komponenten-Tests). Neuer
    Test `src/app/(tabs)/__tests__/melden.test.tsx` deckt den kompletten
    Schrittzustand `foto → details → fertig` ab: Kamera-Foto UND
    Galerie-Foto führen in den Details-Schritt (inkl. Galerie-Hinweistext),
    Absenden zeigt den Erfolgs-Schritt, ein Sync-Fehlschlag zeigt den
    Offline-Hinweis, „Abbrechen" führt zurück zum Kamera-Schritt. Kamera/
    Standort/Vision/Offline-Queue sind für den Test vollständig gemockt
    (native/modellabhängig) — getestet wird nur die Screen-Logik.
    Nebenbei zwei Infra-Fixes, die jeden künftigen Komponenten-Test
    betroffen hätten: `src/global.css`-Import (nur für Web relevant)
    bricht Jest ohne Mock, neuer `moduleNameMapper`-Eintrag in
    `package.json`; `render()` von RNTL ist async und muss awaited
    werden, sonst ist `screen` leer.
38. **Unit-Tests reine Funktionen**: `src/constants/__tests__/levels.test.ts`
    (`levelProgress`/`nextRank`: Stufenübergänge, negativer Saldo,
    Bruchteil-Saldo, höchster Rang erreicht) und
    `src/constants/__tests__/status.test.ts` (`getCaseStatus`/
    `isOpenStatus`: bekannte + unbekannte Status-Strings, leerer String) —
    beide vorher ungetestet.
39. **i18n-Test**: `translate()` aus `index.tsx` in ein eigenes, React-/
    AsyncStorage-freies Modul `src/lib/i18n/translate.ts` extrahiert (reine
    Funktion, direkt testbar ohne Mocks) — der Provider ruft es jetzt nur
    noch auf. Neuer Test `translate.test.ts`: jeder `LANGUAGES`-Code hat
    einen `CATALOGS`-Eintrag, Fallback auf Deutsch bei fehlendem Schlüssel
    (mit `gsw` als echtem Lückenfall), unbekannter Schlüssel stürzt nicht
    ab, Platzhalter-Interpolation (einzeln/mehrfach/fehlender Parameter).
40. **pgTAP via Docker**: weiterhin nicht ausführbar in dieser Session
    (kein Docker) — alle vier pgTAP-Dateien aus dieser Runde
    (`security_hardening_2`, `gps_precision`, `rls_attacker`, plus die
    bestehenden `auth`/`rewards`) sind geschrieben, aber ungetestet gegen
    eine echte DB. **Aktion für den Betreiber**: Docker installieren,
    `supabase start && supabase test db` einmal laufen lassen und das
    Ergebnis hier nachtragen.

`npx tsc --noEmit` ✅ · `npm run lint` ✅ 0 Fehler (2 Vorbestand-Warnungen)
· `npm test` ✅ **57/57**, 9 Suiten (vorher 26/26, 5 Suiten).

---

# Runde 6 — Abschluss (Stand 2026-07-14)

Alle Pakete A–I aus `docs/archiv/verbesserungs-prompt-runde6.md` durchlaufen. Nicht
abschließbar in dieser Session (Infrastruktur-/Werkzeug-Limits, nicht
inhaltlich blockiert):

- **A.1/A.2**: Verifikation gegen das gehostete Supabase-Projekt (kein
  `SUPABASE_ACCESS_TOKEN`/DB-Passwort in dieser Session).
- **D.18/19**: echte Clari-Posen-Renders (kein Bildgenerierungswerkzeug
  verfügbar) — Wiring ist fertig, wartet nur auf die drei PNG-Dateien.
- **I.40**: pgTAP-Lauf gegen eine echte DB (kein Docker).
- **B.4** (Legacy-Bucket-Cleanup) und **B.9** (SecureStore-Migration,
  Geräte-/Simulator-Test): Skript bzw. Code steht, Ausführung/Verifikation
  braucht echten Service-Role-Zugriff bzw. ein echtes Gerät.

Alle anderen 33 Punkte sind inhaltlich umgesetzt, mit `npx tsc --noEmit`/
`npm run lint`/`npm test` nach jedem Paket grün gehalten und in separaten
Commits pro Paket festgehalten.

---

# Bilderkennung kostenlos (Stand 2026-10-07)

## Phase 1 — kostenlose externe KI ✅ (ungetestet gegen Cloudflare)

- `supabase/functions/_shared/vision.ts`: austauschbarer Anbieter
  (`VISION_PROVIDER` = `cloudflare` Standard, `anthropic`, `none`).
  `analyze-photo` und `process-photo` nutzen ihn; ohne Anbieter oder bei
  Fehler geht die Meldung in die Review-Queue. Antworten werden streng
  gelesen: eine unvollstaendige Antwort lehnt nichts mehr automatisch ab und
  gibt kein Foto mehr automatisch frei.
- Rechtstexte nennen Cloudflare, `POLICY_VERSION` 2026-10-07-v1,
  Migration `024_policy_version_vision_provider.sql`.
- Nur typgeprueft (`deno check`) und gegen einen nachgebauten Server
  getestet. **Betreiber:** Cloudflare-Konto ohne Zahlungsart anlegen,
  `CLOUDFLARE_ACCOUNT_ID` und `CLOUDFLARE_API_TOKEN` als Secrets setzen,
  `ANTHROPIC_API_KEY` loeschen, Functions und Migration 024 ausrollen.
  Offene Punkte: `FRAGEN.md` Nr. 17.
- **Ausgerollt am 2026-10-07** auf das Projekt CLAR
  (`uzbjknhmpbxtgvlclpqe`): Migrationen 022 bis 024 und alle zehn Edge
  Functions (vorher war keine Function ausgerollt). Die Cloudflare-Secrets
  sind gesetzt, ein Anthropic-Key existiert dort nicht. Noch offen: eine
  echte Testmeldung aus der App.

## Phase 2 — eigenes Modell vorbereiten ✅ (Fotos fehlen)

- Training von Ultralytics YOLO (AGPL) auf MobileNetV2 mit Keras
  (Apache 2.0) umgestellt: `train.py`, `evaluate.py`, `export.py`,
  Notebook, README. Durchlauf Training, Auswertung, int8-Export und
  Auswertung des `.tflite` mit einem kuenstlichen Mini-Datensatz geprueft
  (Modell 2,7 MB, Format passt zu `vision_models`).
- `training/fetch_taco.py`: 640 Fotos aus TACO liegen lokal unter
  `training/data/manual/positiv` (nicht im Repo). **Betreiber:** durchsehen,
  Negativbeispiele nach `training/data/manual/negativ` legen (mindestens
  300), dann Phase 3.
- Python 3.12 mit TensorFlow liegt in `training/.venv`.
