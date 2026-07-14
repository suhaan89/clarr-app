# Security-Review (Paket 13, Stand 2026-07-10)

Gesamtaudit über Migrationen 001–014, Edge Functions und Client.
Behobene Befunde → Migration 014. Methode: Policy-/Grant-Review je Tabelle,
Secrets-Scan, Abuse-Case-Durchsprache.

## 1. RLS-Gesamtaudit (default-deny je Tabelle)

| Tabelle | RLS | Lesen | Schreiben (Client) | Befund |
|---|---|---|---|---|
| user_profiles | ✅ | nur eigenes | ❌ (REVOKE 003, RPCs) | ok; inerte Alt-Policy in 014 entfernt |
| reports | ✅ | veröffentlicht ∨ eigene ∨ Moderator (010) | ❌ (REVOKE 004, nur submit-report) | inerte 001-Policies in 014 entfernt |
| report_photos | ✅ | eigene ∨ (approved ∧ veröffentlicht) | INSERT eigene; Pfad-Besitz-Trigger (014) | behoben |
| cases | ✅ | alle (keine PII) | ❌ (nur Service) | ok |
| points_ledger | ✅ | nur eigene | ❌ + append-only-Trigger | ok |
| moderation_flags | ✅ | eigene ∨ Moderator | INSERT eigene, Tageslimit (014) | behoben |
| vision_usage / audit_log | ✅ | ❌ | ❌ | ok |
| system_settings / rate_limit_events | ✅ | ❌ | ❌ | ok |
| case_confirm_tokens / authority_digests | ✅ | ❌ | ❌ (nur Hash gespeichert) | ok |
| review_queue | ✅ | nur Moderator | ❌ | ok |
| consents | ✅ | nur eigene | nur RPC, append-only | ok |
| cleanup_events | ✅ | nicht-abgelehnte | INSERT nur Team/Partner (012) | ok |
| cleanup_signups | ✅ | **nur eigene (014)** | eigene an-/abmelden | **behoben: Teilnehmer-user_ids waren für alle lesbar (Minderjährige!)** |
| Storage originals | privat | nur Eigentümer | nur Eigentümer-Prefix | ok |
| Storage public-blurred | public read | alle | ❌ (nur Service) | ok |
| Storage report-photos (Legacy 001) | public read | alle | **Schreibweg geschlossen (014)** | Alt-Objekte manuell sichten/migrieren (TODO Betreiber) |

## 2. Secrets-Scan

- Kein `sk-ant-*`, kein JWT, kein service_role-Wert im Repo (nur
  Variablen-NAMEN in Doku/Skripten). `.env` ist gitignored, `.env.example`
  enthält Platzhalter. Client nutzt ausschließlich den anon-Key.
- Edge Functions loggen Fehler ohne Payload/Empfänger/Keys
  (z. B. Resend-Fehlerdetails bewusst verworfen).
- Rate-Limit speichert nur SHA-256-Hashes von Gerät/IP.

## 3. Rate-Limits / Quotas / Kill-Switch

| Mechanismus | Ort | Status |
|---|---|---|
| Registrierung/Login/OTP je IP | Auth-Config (config.toml + Dashboard-Checkliste docs/auth.md) | ✅ (Dashboard manuell prüfen!) |
| 5 Meldungen/10 min je Konto/Gerät/IP | `check_and_log_rate_limit` (004) | ✅ |
| 10 Meldungen/Tag/Nutzer + global | `consume_report_quota` (004), atomar | ✅ |
| Vision-Budget je Nutzer/global, pessimistische Reservierung, Advisory-Lock | 005 + analyze-photo | ✅ |
| KILL-SWITCH bei Globallimit → Review-Queue, App bleibt nutzbar; 80%-Alert | 005/007 | ✅ |
| Punkte-Tagesdeckel + Degression + Idempotenz | `award_points` (007/011) | ✅ |
| Flags/Tag | **neu 014** (`flag_daily_limit`) | ✅ |
| Digest-Token | 256 bit, nur Hash, TTL, einmalig/atomar | ✅ |

## 4. Abuse-Cases

| Abuse-Case | Gegenmaßnahmen | Rest-Risiko |
|---|---|---|
| **Plant-and-Clean** (Müll hinlegen, melden, „aufräumen") | Abschluss-Punkte nur 1× pro Fall (booking_key an Fall); Degression am selben Ort (Geohash-7, 30 Tage); Tagesdeckel; Nachher-Foto + ≤100 m + Server-Zeit | Einzelfall mit neuem Ort bleibt möglich → Moderation/Stichprobe; Punkte sind rein kosmetisch (geringer Anreiz) |
| **Fake-Reports** | Vision-Prüfung (kein Müll → abgelehnt), Confidence-Gate → Review, Reputation sinkt bei Mock-Location, Quota | KI täuschbar → 5%-Stichprobe + Flags |
| **Duplicate-Scan** (dasselbe Foto mehrfach) | pHash gespeichert; Fall-Bündelung ≤40 m (Duplikat wird Bestätigung, 3 statt 10 P.); client_key gegen technische Duplikate; Degression | pHash-Vergleich noch nicht automatisch erzwungen (nur gespeichert) → TODO späteres Paket |
| **Multi-Accounts** | E-Mail-Verifikation als Gate, Registrierungs-Rate-Limit je IP, Geräte-/IP-Hash-Rate-Limit beim Melden, Degression wirkt pro Ort (auch account-übergreifend am selben Fleck: Fall wird gebündelt → nur Bestätigungspunkte) | Entschlossener Angreifer mit vielen Mails/Geräten skaliert begrenzt; Punkte kosmetisch |
| **Vision-Spam** (Kosten treiben) | analyze-photo nur für eigene, frische Reports; Budget je Nutzer ($0.50/Tag) + global ($5/Tag) + Kill-Switch; Bild wird verkleinert | ✅ gedeckelt |
| **Kollusion** (A meldet, B „bestätigt Abschluss") | Abschluss braucht EIGENES Nachher-Foto + Geo ≤100 m; Punkte nur für den ERSTEN Abschluss des Falls; Partner-Ausnahme nur per serverseitig vergebener Rolle | Physisch anwesende Komplizen nicht unterscheidbar → akzeptiert (kosmetische Punkte) |
| **Belästigung** (Personen fotografieren, Flag-Missbrauch) | Kein „Verursacher"-Feld; Gesichter/Kennzeichen-Pixelierung + Review-Gate davor; Gewalt/Nacktheit → Sofort-Block; Flag macht unsichtbar (fail-safe), aber jetzt mit Tageslimit (014) gegen „Karte leeren" | Blurring fehlbar → Review-Gate bleibt Pflicht |
| **Spoofing** (GPS fake) | `mocked`-Flag + Speed-Check serverseitig; beim Melden → Review + Reputationsabzug; beim Abschluss → harte Ablehnung; Server-Zeit statt Client-Zeit | Hardware-GPS-Spoofing unerkennbar → Geo-Bündelung + Review begrenzen Schaden |
| **Grinding** | Tagesdeckel 50, Degression, KEINE Streaks/Zufallsbelohnung, Leaderboard opt-in mit Wochen-Reset | ✅ bewusst unattraktiv |

## 5. Offene Punkte (Betreiber / spätere Pakete)

1. Legacy-Bucket `report-photos`: Alt-Objekte sind öffentlich und NICHT
   anonymisiert → sichten, ggf. durch Pipeline schicken, Bucket dann leeren.
2. pHash-Duplikatabgleich automatisieren (Hamming-Distanz in submit/analyze).
3. Auth-Dashboard-Checkliste (docs/auth.md) im DEV-Projekt verifizieren,
   insb. „Prevent email enumeration" und Mail-Rate-Limits.
4. ✅ Storage-Aufräum-Job: `supabase/functions/storage-cleanup` (Runde 6,
   Paket G.32), täglich per Scheduler, siehe docs/ops.md.
5. ✅ Moderations-Frontend: `src/app/moderation.tsx` (Runde 6, Paket B.5).

---

# Security-Review — Runde 2 (Stand 2026-07-11)

Zweiter, unabhängiger Durchlauf über Migrationen 001–016, alle Edge Functions,
Client, Secrets, Dependencies. Behobene Befunde → **Migration 017** und
Edge-Function-Härtung. Methode: RPC-Grant-Audit (jede Funktion gegen ihr
`REVOKE`), SECURITY-DEFINER-/`search_path`-Prüfung, Datenfluss der `photoPaths`
(Client → SQL → Storage/Vision), `npm audit`, Client-Injection-Scan.

## A. Behobene Befunde

### A1 — Privilege Escalation: `increment_user_credits` (HIGH) ✅ behoben
- **Ort:** `migrations/001_schema.sql` (Funktion), Fix in `017`.
- **Risiko:** `SECURITY DEFINER`-Funktion `increment_user_credits(p_user_id,
  p_amount)` wurde nie `REVOKE`d → per Postgres-Default `EXECUTE` für `PUBLIC`
  (anon **und** authenticated). Da der anon-Key im Client-Bundle liegt, konnte
  **jeder** — auch unauthentifiziert — via `rpc('increment_user_credits', …)`
  einem beliebigen Konto beliebige Credits gutschreiben. Fachlich tote Funktion
  (ersetzt durch `points_ledger`, Migration 007), aber offener Schreibpfad auf
  `user_profiles.credits`.
- **Fix (017):** `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` +
  festes `search_path`.

### A2 — Integrität/DoS: `check_and_increment_daily_reports` (MEDIUM) ✅ behoben
- **Ort:** `migrations/001_schema.sql`, Fix in `017`.
- **Risiko:** `SECURITY DEFINER`, nimmt eine **fremde** `p_user_id`, war
  `PUBLIC`. Angriff: `rpc('check_and_increment_daily_reports', { p_user_id:
  '<opfer>' })` mehrfach → Tageszähler des Opfers auf das Limit → Opfer für den
  Tag vom Melden ausgesperrt. Ersetzt durch `consume_report_quota` (server-only).
- **Fix (017):** `REVOKE` + `search_path`.

### A3 — `search_path`-Härtung von SECURITY-DEFINER-Funktionen (LOW) ✅ behoben
- **Ort:** `handle_new_user`, `check_and_increment_daily_reports`,
  `increment_user_credits` (001) ohne `SET search_path`.
- **Risiko:** search_path-Hijacking bei SECURITY DEFINER (nur ausnutzbar, wenn
  ein Rollen-Recht zum Objekt-Anlegen existiert; Rümpfe qualifizieren bereits
  `public.`, daher gering). Trigger-Funktionen der Sicherheitskontrollen
  (`enforce_flag_budget/photo_path_owner/event_capacity`) laufen als INVOKER
  (keine Rechteerhöhung), erhalten aber ebenfalls festes `search_path`.
- **Fix (017):** `ALTER FUNCTION … SET search_path = public` (idempotent, kein
  Verhaltensänderung) + `REVOKE EXECUTE FROM PUBLIC` auf Trigger-Funktionen.

### A4 — SSRF / Cross-Tenant über ungeprüfte `photoPaths` (MEDIUM) ✅ behoben
- **Ort:** `functions/submit-report`, `functions/close-case` (Eingang),
  `functions/analyze-photo` (Senke).
- **Risiko:** Client-`photoPaths` landeten ungeprüft in `reports.photo_urls`.
  `analyze-photo` macht daraus serverseitig `fetch(url)` (bei `http…`) bzw. lädt
  `originals/<pfad>` mit **Service-Role** (umgeht Storage-RLS). Konstruierte
  Werte ermöglichten theoretisch: SSRF auf interne Endpoints (z. B.
  Metadata-URLs) und Verweise auf fremde Originale.
  **Backstop vorhanden:** Der Trigger `enforce_photo_path_owner` (Migration 014)
  weist beim `report_photos`-Insert jeden Pfad ab, der nicht mit `<uid>/`
  beginnt → die gesamte `submit_report_tx`-Transaktion schlägt fehl. Neue,
  bösartige Pfade persistieren also nicht. Es fehlte aber die **Validierung am
  Rand**, und die Legacy-`http`-Branch in `analyze-photo` blieb ein SSRF-Sink
  für Alt-Daten.
- **Fix:** `isOwnStoragePath()` in `submit-report` + `close-case` (muss unter
  `<uid>/` liegen, kein Schema/keine `..`, Zeichen-Whitelist, ≤256). In
  `analyze-photo` wird die `http`-Branch auf den **eigenen Storage-Host**
  (`SUPABASE_URL/storage/…`) beschränkt; fremde URLs werden nicht gefetcht,
  die Meldung geht in die Review.

### A5 — Fehlender Server-Längendeckel für `description` (LOW) ✅ behoben
- **Ort:** `functions/submit-report`.
- **Risiko:** Client kappt auf 500 Zeichen, Server vertraute dem — ein direkter
  API-Call konnte beliebig lange Beschreibungen speichern (Storage-Abuse).
- **Fix:** serverseitig `description.slice(0, 1000)`.

## B. Akzeptierte Restrisiken / bewusst nicht geändert

### B1 — `npm audit`: 17 moderate (transitiv, Build-Zeit)
- **Ort:** Root-Advisories `postcss <8.5.10` (CSS-XSS) und `uuid <11.1.1`, beide
  **transitiv** über die Expo-Toolchain (`@expo/cli`, `@expo/metro-config`,
  `expo-splash-screen`, `expo-dev-client`). `npm audit fix --force` würde
  **`expo@57`** installieren — ein Major-Bruch (Projekt ist auf SDK 54).
- **Bewertung/Restrisiko:** Diese Pakete laufen zur **Build-Zeit**, nicht im
  ausgelieferten nativen App-Bundle; `postcss`-XSS betrifft CSS-Stringify (Web),
  `uuid`-Bug nur den `buf`-Pfad (CLAR nutzt `crypto.randomUUID`). Impact im
  Produkt gering. **Nicht erzwungen**, um die App nicht zu brechen.
- **Empfehlung:** geplantes, getestetes Expo-SDK-Upgrade (54 → aktuell). Optional
  `overrides` für `postcss`/`uuid` — nur mit vollem Build-Test, da Expo Versionen
  pinnt.

### B2 — Exakte Koordinaten öffentlich sichtbar
- **Ort:** `cases_select_all` (`USING(true)`, Migration 002) und veröffentlichte
  `reports` — beide liefern `location_lat/lng` exakt an alle Nutzer (Kartenpins).
- **Bewertung:** inhärent für eine Müll-Melde-Karte; Privatgrund-/Wohnkontext
  wird separat nie veröffentlicht (Vision `private_context`, Migration 010).
  Dennoch: exakte Koordinaten können Muster/Bewegungen offenlegen.
- **Empfehlung / JURISTISCH·EXTERN PRÜFEN:** öffentliche Koordinaten vergröbern
  (z. B. nur `geohash8`-Zellenmittelpunkt statt Rohkoordinate) — reine
  Anzeige-Änderung, ändert keine Server-Logik. Bewusst NICHT selbst umgesetzt,
  weil es die Karten-Präzision (Produktverhalten) betrifft.

### B3 — Token-Speicherung in unverschlüsseltem AsyncStorage
- **Ort:** `src/lib/supabase.ts`.
- **Bewertung:** App-Sandbox schützt auf nicht-gerooteten Geräten; Restrisiko
  auf gerooteten Geräten / unverschlüsselten Backups. Empfohlene Härtung
  (SecureStore, chunkend) in **`FRAGEN.md`** beschrieben und dort bewusst
  gestoppt — ein fehlerhafter Adapter loggt sonst alle Nutzer aus (braucht
  Geräte-Test). **JURISTISCH·EXTERN PRÜFEN** für die minderjährige Zielgruppe.

### B4 — `authority-digest`: nicht-konstante Schlüsselprüfung + Klartext-Koordinaten
- **Ort:** `functions/authority-digest`.
- **Bewertung:** Vergleich `auth !== \`Bearer ${serviceKey}\`` ist nicht
  konstant-zeit (LOW: langes Zufalls-Token, Netzwerk-Jitter dominiert, kein
  Online-Brute-Force realistisch). Die Karten-URL enthält exakte Koordinaten —
  geht aber an die **Behörde** (der vorgesehene Zweck), nicht an Dritte; es gehen
  **keine** Melder-Daten raus (kein Name, keine User-ID, nur geblurrtes Foto).
- **Empfehlung:** optional konstant-zeit-Vergleich (crypto). Nicht selbst
  geändert, da die Datei parallel in Bearbeitung ist (in-flight) und der Impact
  gering ist.

## C. Unabhängig geprüft und in Ordnung (keine Änderung)

- **RLS default-deny je Tabelle** (Audit Paket 13 nachvollzogen); sensible
  Tabellen `REVOKE ALL` + nur Service-Role; Schreiben ausschließlich über
  `SECURITY DEFINER`-RPCs mit `REVOKE`. Alle sonstigen RPCs haben ein explizites
  `REVOKE` (nur die 001-Altlasten fehlten → A1/A2).
- **Storage:** `originals` privat + owner-Prefix-Policies; `public-blurred` nur
  lesbar, kein Client-Write; `file_size_limit` 10 MB + `allowed_mime_types`
  (jpeg/png). Öffentliche Anzeige nur aus `public-blurred`.
- **Foto-Datenschutz:** `process-photo` re-encodet (strippt EXIF/GPS), pixeliert
  Gesichter/Kennzeichen und lässt Fotos mit erkannten Personen **nicht**
  automatisch öffentlich (Review-Gate, fail-safe bei Fehler/Budget).
- **Secrets:** Client nutzt nur `EXPO_PUBLIC_*` (anon-Key). `service_role` nur in
  Edge Functions (`Deno.env`). `.env` gitignored, nicht getrackt; `.env.example`
  nur Platzhalter. Fehler werden als `error.message` geloggt — ohne Payload,
  Empfänger, Keys.
- **Rate-Limits/Quota/Budget:** race-sicher via Advisory-Locks
  (`check_and_log_rate_limit`, `consume_report_quota`, `reserve_vision_budget`,
  `award_points`); Vision-Budget doppelt gedeckelt + Kill-Switch. Nur Hashes
  (SHA-256) statt roher IP/Geräte-ID.
- **Idempotenz / kein Doppel-Buchen:** `client_key` (Reports), `booking_key`
  (Punkte, `ON CONFLICT`), Digest-Token einmalig + nur als Hash. Retry-Pfade
  finalisieren Kosten pessimistisch, buchen nie doppelt.
- **Event-Kapazität** (015) und **Pseudonym-Validierung** (016) server-seitig
  durchgesetzt (nicht nur Client).
- **Kamera/Standort:** Berechtigung mit Begründungs-UI, Galerie optional (ohne
  Zwang zur ganzen Mediathek), `Location.Accuracy.Balanced` (grob, ~100 m) statt
  Highest, keine heimliche Aufnahme; Standort nie in Client-URLs.
- **Client-Injection:** kein `WebView`, kein `eval`/`new Function`, keine
  `Linking`-Handler; Deep-Link-Fläche = nur `scheme` (expo-router). Kein
  String-zusammengebautes SQL im Client (alles RPC/PostgREST parametrisiert).
- **Auth-Enumeration:** neutrale Client-Meldungen + `config.toml`-Rate-Limits;
  Dashboard-Setting „Prevent email enumeration" bleibt Betreiber-Checkliste
  (docs/auth.md).
