-- ============================================================
-- CLAR — Migration 010: Trust & Safety (Paket 8)
-- Additiv: Review-Queue, Fail-safe-Flagging, Moderations-RPC,
-- rollen-geschuetzte Sichtbarkeit.
--
-- Grundsaetze:
--   * CLAR meldet MUELL, nie Personen — es gibt weiterhin KEIN
--     "Verursacher"-Feld, und es kommt auch keines dazu.
--   * Fail-safe: ein Flag macht eine oeffentliche Meldung SOFORT
--     unsichtbar, bis ein Mensch geprueft hat.
--   * Privatgrund-/Wohnkontext-Meldungen werden nie oeffentlich.
-- ============================================================

-- ----------------------
-- 1. Enum-Erweiterungen (additiv)
--    'privat': Meldung ist gueltig, bleibt aber dauerhaft nicht-oeffentlich
--    (Privatgrund/Wohnkontext).
-- ----------------------
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'privat';
ALTER TYPE public.flag_reason  ADD VALUE IF NOT EXISTS 'privatgrund_verdacht';

-- ----------------------
-- 2. Rollen-Helfer (SECURITY DEFINER, damit Policies ihn nutzen koennen,
--    ohne an der user_profiles-RLS zu scheitern).
-- ----------------------
CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'moderator'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_moderator() TO authenticated;

-- ----------------------
-- 3. Sichtbarkeit von reports einschraenken (SICHERHEITSFIX, ersetzt die
--    Altlast reports_select_all aus Migration 001 — dokumentiert seit
--    Chunk 01 als offener Punkt). Ohne diese Verengung waere das
--    Fail-safe-Flagging wirkungslos: "unsichtbar" gibt es mit
--    SELECT-true nicht.
--    Sichtbar sind: veroeffentlichte Meldungen, eigene Meldungen,
--    alles fuer Moderatoren.
-- ----------------------
DROP POLICY IF EXISTS "reports_select_all" ON public.reports;

CREATE POLICY "reports_select_public_own_or_mod"
  ON public.reports FOR SELECT
  USING (
    status = 'veroeffentlicht'
    OR user_id = auth.uid()
    OR public.is_moderator()
  );

-- ----------------------
-- 4. review_queue — EIN Ort fuer alles, was ein Mensch ansehen muss.
--    Gruende (CHECK statt Enum, additiv erweiterbar):
--      geflaggt              Flag-Button (fail-safe)
--      confidence            KI-Confidence unter Schwelle
--      stichprobe            ~5% Zufalls-Stichprobe veroeffentlichter Meldungen
--      privatgrund           Privatgrund-/Wohnkontext-Verdacht
--      unklassifiziert       Vision uebersprungen (Budget/Kill-Switch)
--      personen_im_bild      Foto-Pipeline hat Personen/Kennzeichen erkannt
--      standort_suspekt      Mock-Location/Speed-Verdacht
-- ----------------------
CREATE TABLE IF NOT EXISTS public.review_queue (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN
    ('geflaggt', 'confidence', 'stichprobe', 'privatgrund',
     'unklassifiziert', 'personen_im_bild', 'standort_suspekt')),
  flag_id UUID REFERENCES public.moderation_flags(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'erledigt')),
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  decision TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS review_queue_open_idx
  ON public.review_queue (status, created_at);
CREATE INDEX IF NOT EXISTS review_queue_report_idx
  ON public.review_queue (report_id);

ALTER TABLE public.review_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_queue FROM anon, authenticated;

-- Moderatoren duerfen die Queue LESEN (bearbeitet wird nur ueber die RPC).
GRANT SELECT ON public.review_queue TO authenticated;
CREATE POLICY "review_queue_select_moderator"
  ON public.review_queue FOR SELECT
  USING (public.is_moderator());

-- Moderatoren sehen ausserdem alle Flags (Melder weiterhin nur eigene).
CREATE POLICY "flags_select_moderator"
  ON public.moderation_flags FOR SELECT
  USING (public.is_moderator());

-- Doppelte offene Queue-Eintraege mit gleichem Grund vermeiden
CREATE UNIQUE INDEX IF NOT EXISTS review_queue_open_unique_idx
  ON public.review_queue (report_id, reason)
  WHERE status = 'offen';

-- ----------------------
-- 5. FAIL-SAFE-FLAGGING: Ein Flag auf eine Meldung/ein Foto nimmt die
--    Meldung SOFORT aus der Oeffentlichkeit und erzeugt einen
--    Review-Eintrag. Trigger laeuft beim INSERT des Flags (Client darf
--    per Policy flags_insert_own nur eigene Flags anlegen).
-- ----------------------
CREATE OR REPLACE FUNCTION public.handle_flag_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report_id UUID;
BEGIN
  v_report_id := NEW.report_id;

  -- Foto-Flag: Foto sofort sperren, Meldung des Fotos in die Review.
  IF NEW.photo_id IS NOT NULL THEN
    UPDATE public.report_photos
    SET approved = FALSE
    WHERE id = NEW.photo_id
    RETURNING report_id INTO v_report_id;
  END IF;

  IF v_report_id IS NOT NULL THEN
    -- Sofort unsichtbar (fail-safe), egal wie weit die Meldung war.
    UPDATE public.reports
    SET status = 'in_pruefung'
    WHERE id = v_report_id
      AND status = 'veroeffentlicht';

    INSERT INTO public.review_queue (report_id, reason, flag_id)
    VALUES (v_report_id,
            CASE WHEN NEW.reason = 'privatgrund_verdacht'
                 THEN 'privatgrund' ELSE 'geflaggt' END,
            NEW.id)
    ON CONFLICT (report_id, reason) WHERE status = 'offen' DO NOTHING;
  END IF;

  INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, details)
  VALUES (NEW.user_id, 'content_flagged', 'moderation_flag', NEW.id::TEXT,
          jsonb_build_object('reason', NEW.reason, 'report_id', v_report_id,
                             'photo_id', NEW.photo_id, 'event_id', NEW.event_id));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS moderation_flags_fail_safe ON public.moderation_flags;
CREATE TRIGGER moderation_flags_fail_safe
  AFTER INSERT ON public.moderation_flags
  FOR EACH ROW EXECUTE FUNCTION public.handle_flag_inserted();

-- ----------------------
-- 6. apply_vision_result — erweitert um Review-Queue-Eintraege und
--    Privatgrund-Verdacht (Outcome 'private_context') sowie die
--    ~5%-Stichprobe veroeffentlichter Meldungen (nur QA — die Meldung
--    bleibt oeffentlich, bis die Stichprobe etwas findet).
-- ----------------------
CREATE OR REPLACE FUNCTION public.apply_vision_result(
  p_report_id  UUID,
  p_outcome    TEXT,          -- 'ok' | 'low_confidence' | 'unsafe' | 'skipped' | 'not_waste' | 'private_context'
  p_waste_type TEXT,
  p_confidence DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suspect BOOLEAN;
  v_user_id UUID;
  v_is_conf BOOLEAN;
  v_new_status public.report_status;
  v_award JSONB;
BEGIN
  SELECT location_suspect, user_id, is_confirmation
  INTO v_suspect, v_user_id, v_is_conf
  FROM public.reports WHERE id = p_report_id;

  IF v_suspect IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'report_not_found');
  END IF;

  IF p_outcome = 'unsafe' THEN
    v_new_status := 'abgelehnt';
    UPDATE public.reports SET status = v_new_status WHERE id = p_report_id;

    INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, details)
    VALUES (NULL, 'vision_blocked_unsafe_content', 'report', p_report_id::TEXT,
            jsonb_build_object('note', 'Gewalt/Nacktheit erkannt — nie oeffentlich'));

  ELSIF p_outcome = 'not_waste' THEN
    v_new_status := 'abgelehnt';
    UPDATE public.reports
    SET status = v_new_status, ai_confidence = p_confidence
    WHERE id = p_report_id;

  ELSIF p_outcome = 'skipped' THEN
    v_new_status := 'in_pruefung';
    UPDATE public.reports
    SET status = v_new_status, vision_skipped = TRUE
    WHERE id = p_report_id;

    INSERT INTO public.review_queue (report_id, reason)
    VALUES (p_report_id, 'unklassifiziert')
    ON CONFLICT (report_id, reason) WHERE status = 'offen' DO NOTHING;

  ELSIF p_outcome = 'low_confidence' THEN
    v_new_status := 'in_pruefung';
    UPDATE public.reports
    SET status = v_new_status, waste_type = p_waste_type, ai_confidence = p_confidence
    WHERE id = p_report_id;

    INSERT INTO public.review_queue (report_id, reason)
    VALUES (p_report_id, 'confidence')
    ON CONFLICT (report_id, reason) WHERE status = 'offen' DO NOTHING;

  ELSIF p_outcome = 'private_context' THEN
    -- Privatgrund-/Wohnkontext-Verdacht: NIE automatisch veroeffentlichen.
    v_new_status := 'in_pruefung';
    UPDATE public.reports
    SET status = v_new_status, waste_type = p_waste_type, ai_confidence = p_confidence
    WHERE id = p_report_id;

    INSERT INTO public.review_queue (report_id, reason)
    VALUES (p_report_id, 'privatgrund')
    ON CONFLICT (report_id, reason) WHERE status = 'offen' DO NOTHING;

  ELSIF p_outcome = 'ok' THEN
    v_new_status := CASE WHEN v_suspect THEN 'in_pruefung' ELSE 'veroeffentlicht' END;
    UPDATE public.reports
    SET status = v_new_status,
        waste_type = p_waste_type,
        ai_confidence = p_confidence,
        verification = 'ki_verifiziert'
    WHERE id = p_report_id;

    IF v_suspect THEN
      INSERT INTO public.review_queue (report_id, reason)
      VALUES (p_report_id, 'standort_suspekt')
      ON CONFLICT (report_id, reason) WHERE status = 'offen' DO NOTHING;
    ELSE
      v_award := public.award_points(
        v_user_id,
        CASE WHEN v_is_conf THEN 'case_confirmed' ELSE 'report_verified' END,
        CASE WHEN v_is_conf THEN 'case_confirmed:' ELSE 'report_verified:' END || p_report_id::TEXT,
        p_report_id,
        NULL
      );

      -- ~5% QA-Stichprobe (Meldung bleibt oeffentlich; reine Nachkontrolle)
      IF random() < 0.05 THEN
        INSERT INTO public.review_queue (report_id, reason)
        VALUES (p_report_id, 'stichprobe')
        ON CONFLICT (report_id, reason) WHERE status = 'offen' DO NOTHING;
      END IF;
    END IF;

  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_outcome');
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_new_status, 'award', v_award);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_vision_result(UUID, TEXT, TEXT, DOUBLE PRECISION)
  FROM PUBLIC, anon, authenticated;

-- ----------------------
-- 7. moderate_report — rollengeschuetzte Moderations-Entscheidung.
--    Aufrufbar von authenticated, aber NUR Moderatoren kommen durch.
--    Entscheidungen:
--      freigeben  -> veroeffentlicht + Punkte (idempotent)
--      ablehnen   -> abgelehnt
--      privat     -> privat (gueltig, aber nie oeffentlich; Punkte ja —
--                    die Meldung war korrekt, nur der Ort ist sensibel)
--    Foto-Freigabe passiert separat ueber approve_photo().
-- ----------------------
CREATE OR REPLACE FUNCTION public.moderate_report(
  p_report_id UUID,
  p_decision  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report public.reports%ROWTYPE;
  v_new_status public.report_status;
  v_award JSONB;
BEGIN
  IF NOT public.is_moderator() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_report FROM public.reports WHERE id = p_report_id FOR UPDATE;
  IF v_report.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'report_not_found');
  END IF;

  v_new_status := CASE p_decision
    WHEN 'freigeben' THEN 'veroeffentlicht'::public.report_status
    WHEN 'ablehnen'  THEN 'abgelehnt'::public.report_status
    WHEN 'privat'    THEN 'privat'::public.report_status
    ELSE NULL
  END;
  IF v_new_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_decision');
  END IF;

  UPDATE public.reports
  SET status = v_new_status,
      verification = CASE WHEN p_decision IN ('freigeben', 'privat')
                          THEN 'moderator_verifiziert'::public.verification_level
                          ELSE verification END
  WHERE id = p_report_id;

  -- Punkte bei Freigabe/privat-gueltig (idempotent ueber booking_key —
  -- doppelt vergeben wird nie, auch wenn die KI schon verbucht hat).
  IF p_decision IN ('freigeben', 'privat') THEN
    v_award := public.award_points(
      v_report.user_id,
      CASE WHEN v_report.is_confirmation THEN 'case_confirmed' ELSE 'report_verified' END,
      CASE WHEN v_report.is_confirmation THEN 'case_confirmed:' ELSE 'report_verified:' END
        || p_report_id::TEXT,
      p_report_id,
      NULL
    );
  END IF;

  UPDATE public.review_queue
  SET status = 'erledigt',
      resolved_by = auth.uid(),
      resolved_at = NOW(),
      decision = p_decision
  WHERE report_id = p_report_id AND status = 'offen';

  UPDATE public.moderation_flags
  SET resolved_at = NOW()
  WHERE report_id = p_report_id AND resolved_at IS NULL;

  INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'report_moderated', 'report', p_report_id::TEXT,
          jsonb_build_object('decision', p_decision, 'award', v_award));

  RETURN jsonb_build_object('ok', true, 'status', v_new_status, 'award', v_award);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.moderate_report(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.moderate_report(UUID, TEXT) TO authenticated;

-- ----------------------
-- 8. approve_photo — Moderator gibt ein Foto nach Sichtpruefung frei
--    (Pruefschritt der Foto-Pipeline, siehe docs/foto-pipeline.md).
-- ----------------------
CREATE OR REPLACE FUNCTION public.approve_photo(
  p_photo_id UUID,
  p_approve  BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  UPDATE public.report_photos
  SET approved = COALESCE(p_approve, FALSE)
  WHERE id = p_photo_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'photo_not_found');
  END IF;

  INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'photo_moderated', 'report_photo', p_photo_id::TEXT,
          jsonb_build_object('approved', COALESCE(p_approve, FALSE)));

  RETURN jsonb_build_object('ok', true, 'approved', COALESCE(p_approve, FALSE));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_photo(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.approve_photo(UUID, BOOLEAN) TO authenticated;
