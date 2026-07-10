# NOTIZEN — Entscheidungen aus automatischen Läufen

## Lauf 2026-07-10 — Backend-Pakete 1–6 in dieses Repo (clarr-app)

**Grundsatz-Entscheidung dieses Laufs (bitte prüfen):**
Der Arbeitsauftrag nennt „Projekt clar-app2/", die Session läuft aber im neuen
Repo `clarr-app/` (frisches Expo-Router-Gerüst, noch ohne Supabase). In
`clar-app2/` sind die Pakete 1–6 bereits fertig committet (Branch
`auto/claude-chunks`, Migrationen 001–007 + Edge Functions). Nochmaliges
„Abarbeiten" dort wäre ein No-Op. Entscheidung: Das geprüfte Supabase-Backend
aus `clar-app2` (Stand Ende Paket 6, Commit `1ac7ec8`) wird paketweise in
dieses neue Repo portiert — pro Paket ein Commit, Dateien beim Übernehmen
reviewt. Die Migrationen bleiben die Quelle der Wahrheit für die DEV-DB;
`001_schema.sql` bildet den Bestand ab (user_profiles, reports,
cleanup_events, …). Client-Anteile der alten Pakete (LoginScreen,
ReportScreen, RewardsScreen) existieren im neuen Gerüst nicht und werden NICHT
portiert — offene Client-Tasks, siehe docs/fortschritt.md.

Die inhaltlichen Annahmen der Pakete (aus clar-app2/NOTIZEN.md) gelten
unverändert; die wichtigsten sind unten je Paket wiederholt.

## Paket 1 — Fundament

1. `report_status`-Werte waren nicht vorgegeben. Gewählt:
   `gemeldet | in_pruefung | veroeffentlicht | abgelehnt | erledigt`.
2. `verification_level`: `unverifiziert | ki_verifiziert | moderator_verifiziert`.
3. `flag_reason`: `personenbezogene_daten | unangemessener_inhalt | spam |
   falschmeldung | duplikat | sonstiges`.
4. `events`/`event_participants`/`profiles` werden NICHT neu angelegt — sie
   existieren im Bestand als `cleanup_events`/`cleanup_signups`/`user_profiles`
   (siehe docs/schema-ist.md).
5. `reports` wird additiv erweitert (`status`, `verification`, `case_id`);
   Defaults machen die Migration für Bestandszeilen sicher.
6. Alte Policy `reports_select_all` (SELECT true, aus Migration 001) bleibt
   additiv stehen — Verengung auf „veröffentlicht ODER eigene" ist als
   späteres Paket dokumentiert (docs/fundament.md, Altlasten).
7. `points_ledger` zusätzlich per Trigger gegen UPDATE/DELETE gesichert —
   auch die Service-Role kann nur anfügen; Korrektur = Gegenbuchung.
8. `vision_usage.user_id` SET NULL statt CASCADE — Kostendaten müssen
   Account-Löschungen überleben (globaler Kostendeckel).
9. Migrations-Namen `NNN_name.sql` statt CLI-Zeitstempel — folgt dem
   Bestands-Schema aus `001_schema.sql`.
10. Kein `npm test` im Repo; Migrationen wurden nicht gegen eine Live-DB
    ausgeführt (Vorgabe: kein Live-DB-Zugriff).

## Paket 2 — Auth

1. Enum heißt `user_verification_level` (`neu | mail_verifiziert | aktiv`) —
   `verification_level` ist schon für die Report-Verifikation vergeben.
2. `aktiv` = Mail bestätigt UND Community-Regeln in der App bestätigt
   (`activate_account(true)`, speichert nur `rules_accepted_at`).
3. `user_profiles` für Clients komplett read-only (REVOKE INSERT/UPDATE/
   DELETE); alle Schreibpfade sind SECURITY-DEFINER-RPCs.
4. `reputation_score` INT 0–1000, Start 100, Änderung nur über
   `adjust_reputation()` (Service-Role only, auditiert).
5. Rate-Limits liegen in der Auth-Config: `supabase/config.toml` für lokal,
   Dashboard-Checkliste in docs/auth.md (im DEV-Projekt manuell setzen,
   insb. „Prevent email enumeration"). `project_id` auf `clarr-app` angepasst.
6. Alters-/Einwilligungslogik nur als TODO-Kommentar „JURISTISCH PRUEFEN"
   in der Migration — keine Umsetzung ohne juristische Klärung.
7. Client-Anteil (LoginScreen mit Anti-Enumeration-Meldungen) ist im neuen
   Gerüst noch nicht vorhanden — offener Client-Task (docs/fortschritt.md).

## Paket 3 — Meldungs-Backend

1. „~30m-Geohash" umgesetzt als: `geohash8` (~38×19 m) gespeichert, Bündelung
   über Haversine-Distanz ≤ 40 m zum nächsten OFFENEN Fall, Advisory-Lock pro
   Geohash-6-Zelle gegen Doppel-Fälle bei Races. Kein PostGIS nötig.
2. Mock-Location/Speed: Meldung wird NICHT abgelehnt, sondern
   `location_suspect = true` + Reputationsabzug (−10 Mock, −5 Speed >200 km/h)
   — fail-safe Richtung Review statt harter Ablehnung.
3. Rate-Limit: 5 Einreichungen/10 min pro Konto ODER Gerät ODER IP; nur
   SHA-256-Hashes gespeichert; Install-ID ist eine zufällige AsyncStorage-ID
   (bewusst keine Hardware-ID — Datenminimierung).
4. Tagesquota (10/Tag) + globales Tageslimit als `consume_report_quota()` —
   einzelnes bedingtes UPDATE, dadurch atomar/race-sicher.
5. Der Service-Role-Key steht NUR in der Edge-Function-Umgebung
   (`Deno.env`, von Supabase injiziert) — nie im Repo oder Client.
6. Client ruft im neuen Gerüst noch nichts auf — der Melde-Flow (Foto +
   submit-report) ist offener Client-Task.

## Paket 4 — Vision + Kill-Switch

1. Budgets: global $5/Tag, pro Nutzer $0.50/Tag, Alert bei 80 % — alles in
   `system_settings` änderbar, ohne Deploy.
2. Pessimistische Kosten-Reservierung ($0.015/Call) VOR dem API-Call unter
   globalem Advisory-Lock — race-sicher; bei API-Fehlern bleibt die
   Schätzung stehen (Budget wird eher über- als unterschätzt).
3. KILL-SWITCH: bei erreichtem Globallimit keine Vision-Calls mehr; Meldung
   geht in die Review-Queue (`in_pruefung`), App bleibt nutzbar.
4. 80%-Alert als audit_log-Eintrag (1×/Tag) — kein Mail-/Push-Versand aus
   der DB; Betreiber müssen audit_log/Function-Logs beobachten.
5. „Nur nach submit-report" über Datenlage abgesichert: analyze-photo
   akzeptiert nur eigene Reports im Zustand `gemeldet` ohne KI-Ergebnis.
6. Kein-Müll → `abgelehnt`; Confidence <0.6 → `in_pruefung`;
   Gewalt/Nacktheit → sofort blockiert. Bild wird vor dem Call verkleinert.
7. `ANTHROPIC_API_KEY` ausschließlich als Supabase Function Secret
   (`Deno.env`), nie im Client, nie in Logs.

## Paket 5 — Foto-Pipeline

1. Gesichts-/Kennzeichen-Erkennung über das Vision-Modell (Bounding-Boxes)
   statt klassischer CV-Lib (in Deno-Edge-Functions nicht verfügbar).
   Konsequenz: zweiter (budgetierter) Vision-Call pro Foto, und die
   Erkennung ist FEHLBAR — im Code markiert; Fotos mit erkannten Personen/
   Kennzeichen werden trotz Pixelierung NICHT auto-freigegeben (Review).
2. Pixelierung (Mosaik 24 px) statt Gaussian Blur — unumkehrbar, ohne
   Zusatz-Lib umsetzbar.
3. pHash als dHash (64 bit) für Duplikat-Erkennung.
4. Fail-safe: ohne erfolgreichen Pipeline-Lauf (Budget/Kill-Switch/Fehler)
   bleibt das Foto privat (`approved = false`).
5. Buckets: `originals` (privat, nur Eigentümer), `public-blurred`
   (öffentlich lesbar, nur Service schreibt). Anzeige nur aus
   public-blurred; Signed URLs kurzlebig; Löschung entfernt Original +
   Derivate.
6. Offen: Storage-Objekte gelöschter Accounts werden von ON DELETE CASCADE
   nicht erfasst — separater Aufräum-Job nötig (dokumentiert).

## Paket 6 — Reward-Engine

1. Punktwerte: report_verified 10, case_confirmed 3, case_closed_after 25;
   Tagesdeckel 50 (`system_settings.points_daily_cap`).
2. Degression als Halbierung pro Wiederholung (Bit-Shift) im selben
   Geohash-7 (~150 m) über 30 Tage — deterministisch, kein Zufall,
   keine Streaks.
3. Idempotenz über eindeutigen `booking_key` (Schnellpfad + Unique-Index
   gegen Races) — keine Doppelbuchung möglich.
4. Teilbuchung am Deckel: bei 45/50 gibt eine 10-Punkte-Buchung noch 5.
5. Saldo/Level als View (`points_level`); Clients können nicht buchen
   (kein Grant, RLS, append-only-Trigger).
6. Tests als pgTAP (`supabase test db`): Idempotenz, Tagesdeckel,
   „Client kann nicht buchen". Kein npm-Test-Runner im Projekt; gegen die
   Live-DB wurde nichts ausgeführt (Vorgabe).

## Paket 7 — Real-World-Loop (Teil 2, 2026-07-10)

1. Basis (Statusmaschine, close-case, Push-Opt-in, Partner-Rolle) aus
   clar-app2 portiert (Stand 926186c); Annahmen von dort gelten:
   Abschluss-Radius 100 m, Nachher-Foto als eigener Abschluss-Report
   (kind `after`, läuft durch die Anonymisierungs-Pipeline), Mock-Location
   beim Abschluss = harte Ablehnung, Punkte per booking_key an den FALL
   gebunden (Anti-Kollusion: wechselseitiges Abschluss-Farmen unmöglich).
2. NEU — Wochen-Digest an Behörde: Migration 009 + Edge Functions
   `authority-digest`/`confirm-case-done`. Entscheidungen:
   - Digest verschickt nur Fälle im Status `geprueft` und setzt sie danach
     auf `weitergeleitet` (regulärer Statusmaschinen-Übergang).
   - Rücklauf-Token = 256 bit Zufall, nur SHA-256-Hash in der DB, TTL 30
     Tage (Setting), Einlösung einmalig/atomar per bedingtem UPDATE.
   - Mail-Versand über Resend, weil Supabase keinen ausgehenden
     Mail-Dienst für eigene Inhalte hat; OHNE `RESEND_API_KEY` wird nur
     protokolliert — DEV läuft ohne Mail-Provider. Empfänger-Adresse ist
     ein Setting (leer = aus), nichts hardcodiert.
   - `confirm-case-done` braucht Deploy mit `--no-verify-jwt` (Behörde hat
     keinen Account). Kein Enumerations-Orakel: neutrale Fehlerseite.
   - Es gehen keine Melder-Daten/Originalfotos raus (nur public-blurred).
3. Kein Cron im Repo: Scheduling (wöchentlich) muss im Dashboard/pg_cron
   konfiguriert werden — dokumentiert in docs/real-world-loop.md.

## Paket 8 — Trust & Safety

1. Aus clar-app2 portiert (Stand 9fcbc57), Migrationsdatei hier als
   `010_trust_safety.sql` umnummeriert (009 ist der Behörden-Digest).
2. Einzige nicht rein additive Änderung: Policy `reports_select_all`
   (SELECT true, Altlast aus 001) wird ersetzt durch „veröffentlicht ODER
   eigene ODER Moderator" — ohne das wäre Fail-safe-Flagging wirkungslos.
   Folge: unverifizierte Alt-Meldungen sind nicht mehr öffentlich sichtbar.
3. Flag → Meldung sofort unsichtbar (Trigger setzt Status zurück in
   Review), fail-safe; Review-Queue nur für geflaggt / Confidence /
   ~5%-Stichprobe / Privatgrund. Stichprobe versteckt nichts (nur QA).
4. Privatgrund bleibt dauerhaft privat; Entscheidung `privat` vergibt
   trotzdem Punkte (Meldung war korrekt). Kein „Verursacher"-Feld —
   geprüft, es existiert keines und keines kommt dazu.
5. Moderation (`moderate_report`, `approve_photo`) rollen-geschützt
   (moderator/partner) + audit_log; bis ein Admin-Screen existiert via
   Dashboard/SQL nutzbar.

## Paket 9 — Frontend

1. Migration 011: `reports.client_key` (Unique je Nutzer) für
   Offline-Idempotenz; `reports.source`/`points_eligible` — Galerie-Fotos
   geben KEINE Punkte, durchgesetzt in `award_points` (Guard), nicht nur im
   UI. `submit_report_tx_v2` ist ein additiver Wrapper; `award_points`
   wurde per CREATE OR REPLACE um den Guard ergänzt (Rumpf sonst identisch
   zu 007 — gleiche Signatur/Parameternamen).
2. „Vorher/Nachher" ist als Flow getrennt: Vorher-Fotos im Melde-Tab,
   Nachher-Fotos im Fall-Detail über den Abschluss-Flow (close-case,
   kind `after`) — kein eigener Toggle im Melde-Screen nötig.
3. Leaderboard: Opt-in-Spalte + frei wählbares Pseudonym (2–24 Zeichen,
   Zeichen-Whitelist; Missbrauch fängt die Moderation), View
   `leaderboard_week` mit Owner-Rechten (bewusst KEIN security_invoker:
   sie zeigt nur aggregierte, freiwillig geteilte Daten). Wochen-Reset =
   Zeitfenster der View, das Ledger bleibt unangetastet.
4. Login-Screen im Client gebaut (war offener Client-Task aus Teil 1):
   neutrale Fehlermeldungen (Anti-Enumeration), signUp-Antwort immer gleich.
5. Template aufgeräumt: ungenutzte Expo-Beispiel-Komponenten entfernt,
   `typedRoutes`-Experiment deaktiviert (generierte Typen waren stale und
   ohne Dev-Server nicht reproduzierbar); `supabase/` vom App-Typecheck
   ausgenommen (Deno-Code). `npx tsc --noEmit` läuft sauber.
6. Der Commit enthält auch package.json/package-lock mit dem vom Betreiber
   begonnenen SDK-54-Stand (war uncommitted) + neuen Abhängigkeiten
   (expo-camera, expo-location, expo-image-picker, react-native-maps,
   AsyncStorage, NetInfo, supabase-js u. a.).
7. `.env` in .gitignore ergänzt (war nur `.env*.local`); `.env.example`
   dokumentiert die EXPO_PUBLIC_-Variablen. Nur anon-Key im Client.

## Paket 10 — Events + Cold-Start

1. Zweite dokumentierte Policy-Ausnahme: `events_insert_own` ersetzt durch
   `events_insert_team_partner` — jeder durfte bisher Events anlegen;
   öffentliche Treffpunkte + minderjährige Zielgruppe brauchen eine
   verantwortliche Orga.
2. Gebündelter Event-Abschluss vergibt Punkte an die ABSCHLIESSENDE Person
   (Team/Partner) über den bestehenden idempotenten Pfad — KEINE
   automatische Verteilung an Teilnehmende (Kollusions-/Farming-Risiko;
   Teilnehmende punkten über eigene Meldungen/Bestätigungen).
3. Seeds: `is_seed`-Flag statt separater Tabellen; Seed-Meldungen sind
   nicht punktefähig und laufen durch die normale Prüfung. Skript
   verweigert URLs, die nach prod aussehen.

## Paket 11 — Betroffenenrechte

1. Consents als append-only-Journal (wie points_ledger, inkl.
   Service-Role-Trigger) — „nachweisbar" heißt: Historie mit Zeitstempel
   und Policy-Version, letzte Zeile gewinnt (View `current_consents`).
2. `behoerden_weitergabe`-Consent wird erhoben/gespeichert, aber technisch
   NICHT als Digest-Filter durchgesetzt: der Digest enthält keine
   personenbezogenen Daten (nur Fallort/Titel/geblurrtes Foto). Ob das
   reicht → docs/legal/data-flows.md, JURISTISCH PRUEFEN.
3. delete-account löscht Storage explizit (CASCADE erfasst Objekte nicht):
   erst public-blurred-Derivate (Pfade aus report_photos), dann
   originals/<uid>/ seitenweise, dann auth-User. Bestätigungsstring im
   Body verhindert versehentliche Aufrufe. Audit ohne Inhalte.
4. Export liefert Original-Fotos als 1h-Signed-URLs statt Bytes
   (Function-Response klein halten); Hinweis steht in der Antwort.
5. Legal-Screens sind sichtbar als ENTWURF markiert (rote Warnzeile) —
   bewusst, damit niemand sie versehentlich für final hält.
