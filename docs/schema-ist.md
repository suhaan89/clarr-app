# CLAR — Schema-Ist-Zustand (Audit)

Stand: 2026-07-07 · Umgebung: DEV (`uzbjknhmpbxtgvlclpqe.supabase.co`)

## Quelle & Verifizierungshinweis

Grundlage dieses Audits ist `supabase/migrations/001_schema.sql` (einzige vorhandene
Migration) sowie der Code, der gegen die DB arbeitet (`src/screens/*.js`,
`supabase/functions/*/index.ts`).

**Live-Introspektion der DEV-DB (`information_schema`, tatsächlich angewandte
Policies) war in diesem Lauf nicht möglich:**
- In `.env` liegt nur der öffentliche `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publishable
  key), kein Service-Role-Key.
- Es existiert kein `supabase/config.toml` / CLI-Projekt-Link, über den `supabase
  db pull` o. ä. laufen könnte.
- Netzwerkzugriffe (z. B. gegen den PostgREST-Endpunkt) sind in dieser
  automatisierten Umgebung nicht freigegeben.

Der unten dokumentierte Stand entspricht daher **exakt dem, was Migration `001`
definiert** und wird durch die tatsächlichen `.from(...)`-Aufrufe im Code bestätigt
(gleiche Tabellennamen, keine Hinweise auf zusätzliche/andere Spalten). Manuelle
Änderungen direkt im Supabase-Dashboard (z. B. Storage-Bucket-Policies, die in der
Migration nur als auskommentierter Kommentarblock vorliegen) können dadurch NICHT
ausgeschlossen werden. Siehe Rückfrage in `chunks/FRAGEN.md`.

## Tabellen

### `public.user_profiles`
| Spalte | Typ | Constraints |
|---|---|---|
| id | uuid | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| credits | int | NOT NULL, DEFAULT 0 |
| reports_count_today | int | NOT NULL, DEFAULT 0 |
| last_report_date | date | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

RLS: **aktiviert**
- `users_select_own_profile` (SELECT): `auth.uid() = id`
- `users_update_own_profile` (UPDATE): `auth.uid() = id`
- Kein INSERT/DELETE-Policy für normale User (Zeilen entstehen nur über Trigger
  `on_auth_user_created` bzw. `SECURITY DEFINER`-Funktionen).

### `public.reports`
| Spalte | Typ | Constraints |
|---|---|---|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| user_id | uuid | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE |
| description | text | |
| latitude | double precision | NOT NULL |
| longitude | double precision | NOT NULL |
| photo_urls | text[] | NOT NULL, DEFAULT '{}' |
| waste_type | text | |
| ai_confidence | double precision | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

RLS: **aktiviert**
- `reports_select_all` (SELECT): `true` — für alle lesbar (Kartenanzeige)
- `reports_insert_own` (INSERT): `auth.uid() = user_id`
- `reports_update_own` (UPDATE): `auth.uid() = user_id`

Hinweis: Fotos werden als öffentliche URLs direkt im `photo_urls`-Array der
`reports`-Zeile gespeichert (kein separates Photo-Objekt, kein EXIF-Stripping,
keine Gesichts-/Kennzeichen-Unkenntlichmachung im aktuellen Code —
`src/screens/ReportScreen.js:192-213` lädt Rohbilder direkt in den öffentlichen
Storage-Bucket `report-photos` hoch).

### `public.cleanup_events`
| Spalte | Typ | Constraints |
|---|---|---|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| title | text | NOT NULL |
| description | text | |
| location_lat | double precision | NOT NULL |
| location_lng | double precision | NOT NULL |
| event_date | timestamptz | NOT NULL |
| created_by | uuid | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE |
| status | text | NOT NULL, DEFAULT 'pending', CHECK IN ('pending','approved','rejected') |
| max_participants | int | NOT NULL, DEFAULT 20 |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

RLS: **aktiviert**
- `events_select_non_rejected` (SELECT): `status <> 'rejected' OR auth.uid() = created_by`
- `events_insert_own` (INSERT): `auth.uid() = created_by`
- Kein UPDATE/DELETE-Policy (z. B. Status-Änderung `pending → approved` ist über
  RLS aktuell für niemanden möglich außer via Service-Role).

### `public.cleanup_signups`
| Spalte | Typ | Constraints |
|---|---|---|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| event_id | uuid | NOT NULL, FK → `public.cleanup_events(id)` ON DELETE CASCADE |
| user_id | uuid | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| | | UNIQUE (event_id, user_id) |

RLS: **aktiviert**
- `signups_select_all` (SELECT): `true`
- `signups_insert_own` (INSERT): `auth.uid() = user_id`
- `signups_delete_own` (DELETE): `auth.uid() = user_id`

## Functions

| Function | Typ | Zweck |
|---|---|---|
| `public.handle_new_user()` | Trigger-Funktion, `SECURITY DEFINER` | Legt bei neuem `auth.users`-Eintrag automatisch eine `user_profiles`-Zeile an (Trigger `on_auth_user_created` AFTER INSERT auf `auth.users`) |
| `public.check_and_increment_daily_reports(p_user_id uuid)` | RPC, `SECURITY DEFINER` | Anti-Spam: prüft/erhöht `reports_count_today` (Tageslimit 10), reset bei neuem Kalendertag |
| `public.increment_user_credits(p_user_id uuid, p_amount int)` | RPC, `SECURITY DEFINER` | Erhöht `credits` in `user_profiles` atomar; wird von der Edge Function `award-credits` mit Service-Role aufgerufen |

## Storage

Ein Bucket `report-photos` (public) inkl. SELECT-/INSERT-Policies ist im
Migrationsfile nur als **auskommentierter SQL-Block** hinterlegt (manuell im
Dashboard auszuführen), wird aber vom Code bereits aktiv genutzt
(`ReportScreen.js`, `RewardsScreen`-Storage-URLs). Ob der Bucket in DEV
tatsächlich existiert und welche Policies aktiv sind, konnte in diesem Lauf
nicht verifiziert werden (siehe Verifizierungshinweis oben).

## Edge Functions (server-seitig, referenzieren obiges Schema)

- `award-credits`: liest `reports` (per `user_id` + `id`), prüft `ai_confidence >= 0.6`,
  ruft `increment_user_credits` per Service-Role auf.
- `verify-waste`: ruft die Anthropic Vision API server-seitig auf (Modell
  `claude-sonnet-4-6`), erzeugt `isWaste`/`confidence`/`wasteType`/`reason`.
  Kein Kostendeckel, kein Kill-Switch und kein Logging in eine `vision_usage`-Tabelle
  im aktuellen Code erkennbar.

---

# Lücken-Analyse: Ziel-Tabellen vs. Ist-Zustand

| Ziel-Tabelle | Status | Anmerkung |
|---|---|---|
| `profiles` | ⚠️ vorhanden unter anderem Namen | Ist heißt `user_profiles`, enthält nur `credits`, `reports_count_today`, `last_report_date` — kein Rollen-/Moderations-/Status-Feld über reine Credits hinaus |
| `reports` | ✅ vorhanden, aber unvollständig | Kein Status-Feld (offen/in Bearbeitung/gelöst), keine Verknüpfung zu `cases`, kein Moderationsstatus |
| `report_photos` | ❌ fehlt | Fotos liegen nur als `text[]`-URLs direkt auf `reports`; kein Platz für Pro-Foto-Metadaten (EXIF-Status, Blur-Status, Moderationsstatus je Bild) |
| `cases` | ❌ fehlt | Kein Konzept eines "Falls", der mehrere Reports bündelt |
| `events` | ⚠️ vorhanden unter anderem Namen | Ist heißt `cleanup_events`; Konzept deckt sich, aber kein UPDATE-Policy für Statuswechsel (Moderation) |
| `event_participants` | ⚠️ vorhanden unter anderem Namen | Ist heißt `cleanup_signups`; funktional äquivalent (Event ↔ User, UNIQUE-Constraint) |
| `points_ledger` | ❌ fehlt — **Verstoß gegen Feste Entscheidung** | Aktuell nur mutable `credits`-Integer-Spalte in `user_profiles`, kein append-only Ledger. Verstößt gegen CLAUDE.md-Vorgabe "Punkte werden NUR serverseitig vergeben (points_ledger ist append-only)" |
| `moderation_flags` | ❌ fehlt | Keinerlei Moderations-/Meldemechanismus in der DB |
| `vision_usage` | ❌ fehlt — **Verstoß gegen Feste Entscheidung** | `verify-waste`-Function loggt keine Kosten/Aufrufe; kein globaler Kostendeckel, kein Kill-Switch umsetzbar ohne diese Tabelle |
| `audit_log` | ❌ fehlt | Keine Audit-Trail-Tabelle vorhanden |

## Zusätzliche Beobachtungen (nicht Teil der Ziel-Tabellenliste, aber relevant)

- Es gibt kein "Verursacher"-Feld in `reports` — konform mit der festen Entscheidung.
- `cleanup_events.status` erlaubt `pending/approved/rejected`, aber es existiert
  keine RLS-Policy, die einem Moderator das Ändern des Status erlaubt (nur
  Service-Role könnte das aktuell).
- EXIF-Stripping und Gesichts-/Kennzeichen-Unkenntlichmachung (feste Entscheidung
  in CLAUDE.md) ist im aktuellen Upload-Pfad (`ReportScreen.js`) nicht
  implementiert — Rohbilder gehen direkt in den öffentlichen Bucket.
