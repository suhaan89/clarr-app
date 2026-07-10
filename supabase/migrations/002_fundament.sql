-- ============================================================
-- CLAR — Migration 002: Fundament (Chunk 01)
-- Additiv: neue Enums, neue Tabellen, additive Spalten auf reports.
-- Bestehende Tabellen/Daten werden NICHT verändert oder gelöscht.
-- RLS: default-deny auf jeder neuen Tabelle, explizite Policies darunter.
--
-- Hinweis Namens-Mapping (siehe docs/schema-ist.md):
--   events            -> existiert bereits als public.cleanup_events
--   event_participants-> existiert bereits als public.cleanup_signups
--   profiles          -> existiert bereits als public.user_profiles
-- Diese drei werden hier deshalb NICHT neu angelegt.
-- ============================================================

-- ----------------------
-- 1. Enums
-- ----------------------
DO $$ BEGIN
  CREATE TYPE public.report_status AS ENUM
    ('gemeldet', 'in_pruefung', 'veroeffentlicht', 'abgelehnt', 'erledigt');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.case_status AS ENUM
    ('gemeldet', 'geprueft', 'weitergeleitet', 'erledigt', 'geschlossen');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.photo_kind AS ENUM ('before', 'after');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_level AS ENUM
    ('unverifiziert', 'ki_verifiziert', 'moderator_verifiziert');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.flag_reason AS ENUM
    ('personenbezogene_daten', 'unangemessener_inhalt', 'spam',
     'falschmeldung', 'duplikat', 'sonstiges');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------
-- 2. cases — bündelt mehrere Reports zu einem Fall (Moderations-/Behördensicht)
--    created_by: SET NULL, damit Fälle den Account-Löschvorgang überleben
--    (Fall-Daten sind nicht personenbezogen, der Bezug wird nur gekappt).
-- ----------------------
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status public.case_status NOT NULL DEFAULT 'gemeldet',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------
-- 3. reports — additive Spalten (bestehende Spalten/Policies unverändert)
-- ----------------------
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS status public.report_status NOT NULL DEFAULT 'gemeldet',
  ADD COLUMN IF NOT EXISTS verification public.verification_level NOT NULL DEFAULT 'unverifiziert',
  ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reports_case_id_idx ON public.reports (case_id);
CREATE INDEX IF NOT EXISTS reports_status_idx  ON public.reports (status);
CREATE INDEX IF NOT EXISTS reports_user_id_idx ON public.reports (user_id);

-- ----------------------
-- 4. report_photos — ein Datensatz pro Foto mit Metadaten
--    (EXIF-/Blur-Status, Freigabe). storage_path statt öffentlicher URL,
--    damit Originale nie direkt verlinkt werden müssen.
--    ON DELETE CASCADE über report -> auth.users: Nutzerlöschung räumt auf.
-- ----------------------
CREATE TABLE IF NOT EXISTS public.report_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.photo_kind NOT NULL DEFAULT 'before',
  storage_path TEXT NOT NULL,
  exif_stripped BOOLEAN NOT NULL DEFAULT FALSE,
  faces_blurred BOOLEAN NOT NULL DEFAULT FALSE,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS report_photos_report_id_idx ON public.report_photos (report_id);
CREATE INDEX IF NOT EXISTS report_photos_user_id_idx   ON public.report_photos (user_id);

-- ----------------------
-- 5. points_ledger — append-only Punkte-Journal
--    Schreiben NUR serverseitig (Service-Role). user_profiles.credits bleibt
--    unverändert als Cache bestehen; Quelle der Wahrheit ist dieses Ledger.
--    ON DELETE CASCADE: Punkte eines gelöschten Nutzers verschwinden mit.
--    report_id/event_id: SET NULL, damit Ledger-Einträge das Löschen der
--    referenzierten Objekte überleben (Historie bleibt konsistent).
-- ----------------------
CREATE TABLE IF NOT EXISTS public.points_ledger (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta INT NOT NULL CHECK (delta <> 0),
  reason TEXT NOT NULL,
  report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.cleanup_events(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS points_ledger_user_id_idx ON public.points_ledger (user_id);

-- Append-only auch gegen Service-Role absichern: UPDATE/DELETE hart blocken.
-- (RLS gilt nicht für Service-Role, dieser Trigger schon.)
CREATE OR REPLACE FUNCTION public.points_ledger_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'points_ledger ist append-only: % nicht erlaubt', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS points_ledger_no_update_delete ON public.points_ledger;
CREATE TRIGGER points_ledger_no_update_delete
  BEFORE UPDATE OR DELETE ON public.points_ledger
  FOR EACH ROW EXECUTE FUNCTION public.points_ledger_block_mutation();

-- Zusätzlich zu RLS: Client-Rollen dürfen grundsätzlich nicht schreiben.
REVOKE INSERT, UPDATE, DELETE ON public.points_ledger FROM anon, authenticated;

-- Guthaben-Berechnung: Summe über das Ledger.
-- security_invoker: die RLS des Ledgers gilt auch durch die View hindurch,
-- d. h. jeder Nutzer sieht nur seinen eigenen Saldo.
CREATE OR REPLACE VIEW public.points_balance
WITH (security_invoker = true) AS
SELECT
  user_id,
  COALESCE(SUM(delta), 0)::INT AS balance,
  MAX(created_at) AS last_entry_at
FROM public.points_ledger
GROUP BY user_id;

-- ----------------------
-- 6. moderation_flags — Nutzer melden Inhalte (nie Personen)
--    Genau EIN Ziel pro Flag (Report, Foto oder Event).
--    ON DELETE CASCADE: Flags verschwinden mit dem Melder bzw. dem Ziel.
-- ----------------------
CREATE TABLE IF NOT EXISTS public.moderation_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  photo_id UUID REFERENCES public.report_photos(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.cleanup_events(id) ON DELETE CASCADE,
  reason public.flag_reason NOT NULL,
  note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(report_id, photo_id, event_id) = 1)
);

CREATE INDEX IF NOT EXISTS moderation_flags_user_id_idx ON public.moderation_flags (user_id);

-- ----------------------
-- 7. vision_usage — serverseitiges Kosten-Log für die Vision-API
--    Grundlage für globalen Kostendeckel + Kill-Switch (spätere Chunks).
--    user_id/report_id: SET NULL — Kostendaten müssen Löschungen überleben,
--    sonst stimmt der globale Deckel nicht mehr.
-- ----------------------
CREATE TABLE IF NOT EXISTS public.vision_usage (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vision_usage_created_at_idx ON public.vision_usage (created_at);

REVOKE INSERT, UPDATE, DELETE ON public.vision_usage FROM anon, authenticated;

-- ----------------------
-- 8. audit_log — Audit-Trail für sicherheitsrelevante Aktionen
--    actor: SET NULL — der Trail muss Account-Löschungen überleben.
-- ----------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at);

REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM anon, authenticated;

-- ============================================================
-- Row-Level Security: default-deny auf JEDER neuen Tabelle.
-- Eine Tabelle mit aktiviertem RLS und ohne passende Policy verweigert
-- alles — Policies unten öffnen nur das explizit Gewollte.
-- ============================================================
ALTER TABLE public.cases            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_photos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_ledger    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vision_usage     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log        ENABLE ROW LEVEL SECURITY;

-- cases: öffentlich lesbar (keine personenbezogenen Daten, Transparenz über
-- den Bearbeitungsstand). Schreiben nur serverseitig (keine Policies).
CREATE POLICY "cases_select_all"
  ON public.cases FOR SELECT
  USING (true);

-- report_photos: Eigentümer sieht eigene Fotos; öffentlich nur, wenn das Foto
-- freigegeben (approved) UND die zugehörige Meldung veröffentlicht ist.
CREATE POLICY "photos_select_own_or_published"
  ON public.report_photos FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      approved
      AND EXISTS (
        SELECT 1 FROM public.reports r
        WHERE r.id = report_id
          AND r.status = 'veroeffentlicht'
      )
    )
  );

-- Einfügen nur für eigene Fotos an eigenen Reports.
CREATE POLICY "photos_insert_own"
  ON public.report_photos FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_id AND r.user_id = auth.uid()
    )
  );

-- Eigene Fotos dürfen gelöscht werden (Widerruf durch den Nutzer).
CREATE POLICY "photos_delete_own"
  ON public.report_photos FOR DELETE
  USING (auth.uid() = user_id);

-- Kein UPDATE für Clients: exif_stripped/faces_blurred/approved setzt nur der Server.

-- points_ledger: Nutzer LESEN nur eigene Einträge. Kein INSERT/UPDATE/DELETE
-- für Clients (keine Policies dafür + REVOKE + append-only-Trigger oben).
CREATE POLICY "ledger_select_own"
  ON public.points_ledger FOR SELECT
  USING (auth.uid() = user_id);

-- moderation_flags: Melder sieht und erstellt nur eigene Flags.
-- Bearbeitung/Auflösung nur serverseitig.
CREATE POLICY "flags_select_own"
  ON public.moderation_flags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "flags_insert_own"
  ON public.moderation_flags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- vision_usage: KEINE Policies — für Clients komplett unsichtbar/unschreibbar.
-- Nur Service-Role (bypasst RLS) liest/schreibt.

-- audit_log: KEINE Policies — nur Service-Role.
