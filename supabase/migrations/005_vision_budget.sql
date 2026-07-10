-- ============================================================
-- CLAR — Migration 005: Vision-Budget + Kill-Switch (Paket 4)
-- Additiv: Spalten auf reports/vision_usage, RPCs fuer race-sichere
-- Budget-Reservierung. Genutzt von der Edge Function analyze-photo.
--
-- Doppelter Deckel:
--   * pro Nutzer/Tag  (system_settings.vision_user_daily_usd)
--   * global/Tag      (system_settings.vision_global_daily_usd)
-- KILL-SWITCH: system_settings.vision_kill_switch = true stoppt alle
-- Vision-Calls sofort; Meldungen gehen unklassifiziert in die Review-Queue,
-- die App bleibt nutzbar. Alert ab 80 % (audit_log, 1x pro Tag).
-- ============================================================

-- ----------------------
-- 1. Additive Spalten
-- ----------------------
ALTER TABLE public.reports
  -- true = Vision uebersprungen (Budget/Kill-Switch) -> unklassifiziert in Review
  ADD COLUMN IF NOT EXISTS vision_skipped BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.vision_usage
  -- Reservierung vs. finalisiert: reserviert zaehlt sofort ins Budget
  -- (pessimistisch), damit parallele Requests den Deckel nicht durchbrechen.
  ADD COLUMN IF NOT EXISTS finalized BOOLEAN NOT NULL DEFAULT FALSE;

-- ----------------------
-- 2. reserve_vision_budget — atomare Pruefung + Reservierung.
--    Advisory-Lock serialisiert alle Reservierungen; die Reservierungszeile
--    zaehlt ab sofort in die Tagessummen (SUM ueber estimated_cost_usd).
--    Rueckgabe: allowed + usage_id (zum Finalisieren) + Alert-Status.
-- ----------------------
CREATE OR REPLACE FUNCTION public.reserve_vision_budget(
  p_user_id            UUID,
  p_report_id          UUID,
  p_model              TEXT,
  p_estimated_cost_usd NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kill   BOOLEAN := COALESCE((SELECT (value)::BOOLEAN FROM public.system_settings WHERE key = 'vision_kill_switch'), FALSE);
  v_glimit NUMERIC  := COALESCE((SELECT (value)::NUMERIC FROM public.system_settings WHERE key = 'vision_global_daily_usd'), 0);
  v_ulimit NUMERIC  := COALESCE((SELECT (value)::NUMERIC FROM public.system_settings WHERE key = 'vision_user_daily_usd'), 0);
  v_alert  NUMERIC  := COALESCE((SELECT (value)::NUMERIC FROM public.system_settings WHERE key = 'vision_alert_threshold'), 0.8);
  v_gused  NUMERIC;
  v_uused  NUMERIC;
  v_usage_id BIGINT;
  v_alert_fired BOOLEAN := FALSE;
BEGIN
  -- Serialisiert ALLE Budget-Reservierungen (ein globaler Deckel -> ein Lock).
  PERFORM pg_advisory_xact_lock(hashtext('vision_budget'));

  SELECT COALESCE(SUM(estimated_cost_usd), 0) INTO v_gused
  FROM public.vision_usage
  WHERE created_at >= date_trunc('day', NOW());

  SELECT COALESCE(SUM(estimated_cost_usd), 0) INTO v_uused
  FROM public.vision_usage
  WHERE created_at >= date_trunc('day', NOW())
    AND user_id = p_user_id;

  IF v_kill OR v_gused + p_estimated_cost_usd > v_glimit THEN
    RETURN jsonb_build_object('allowed', false, 'reason',
      CASE WHEN v_kill THEN 'kill_switch' ELSE 'global_budget' END);
  END IF;

  IF v_uused + p_estimated_cost_usd > v_ulimit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'user_budget');
  END IF;

  INSERT INTO public.vision_usage
    (user_id, report_id, model, estimated_cost_usd, success, finalized)
  VALUES
    (p_user_id, p_report_id, p_model, p_estimated_cost_usd, FALSE, FALSE)
  RETURNING id INTO v_usage_id;

  -- Alert ab 80 % des Globalbudgets — hoechstens einmal pro Tag.
  IF v_glimit > 0 AND (v_gused + p_estimated_cost_usd) >= v_glimit * v_alert THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.audit_log
      WHERE action = 'vision_budget_alert'
        AND created_at >= date_trunc('day', NOW())
    ) THEN
      INSERT INTO public.audit_log (actor_user_id, action, entity_type, details)
      VALUES (NULL, 'vision_budget_alert', 'system',
              jsonb_build_object('used_usd', v_gused + p_estimated_cost_usd,
                                 'limit_usd', v_glimit,
                                 'threshold', v_alert));
      v_alert_fired := TRUE;
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'usage_id', v_usage_id,
                            'alert_fired', v_alert_fired,
                            'global_used_usd', v_gused + p_estimated_cost_usd,
                            'global_limit_usd', v_glimit);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_vision_budget(UUID, UUID, TEXT, NUMERIC)
  FROM PUBLIC, anon, authenticated;

-- ----------------------
-- 3. finalize_vision_usage — traegt nach dem API-Call die echten Kosten ein.
--    Bei einem API-Fehler bleibt die pessimistische Schaetzung stehen
--    (Budget lieber ueber- als unterschaetzen).
-- ----------------------
CREATE OR REPLACE FUNCTION public.finalize_vision_usage(
  p_usage_id      BIGINT,
  p_input_tokens  INT,
  p_output_tokens INT,
  p_cost_usd      NUMERIC,
  p_success       BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vision_usage
  SET input_tokens  = COALESCE(p_input_tokens, input_tokens),
      output_tokens = COALESCE(p_output_tokens, output_tokens),
      estimated_cost_usd = COALESCE(p_cost_usd, estimated_cost_usd),
      success = p_success,
      finalized = TRUE
  WHERE id = p_usage_id
    AND finalized = FALSE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_vision_usage(BIGINT, INT, INT, NUMERIC, BOOLEAN)
  FROM PUBLIC, anon, authenticated;

-- ----------------------
-- 4. apply_vision_result — schreibt das Analyse-Ergebnis auf den Report.
--    Zustandslogik zentral in SQL, damit die Edge Function keine
--    Teil-Updates hinterlassen kann:
--      * unsafe (Gewalt/Nacktheit)  -> abgelehnt, nie oeffentlich, Audit
--      * skipped (Budget/Kill)      -> in_pruefung + vision_skipped
--      * confidence < Schwelle      -> in_pruefung (Review-Queue)
--      * sonst                      -> ki_verifiziert; oeffentlich nur,
--                                      wenn Standort nicht suspekt
-- ----------------------
CREATE OR REPLACE FUNCTION public.apply_vision_result(
  p_report_id  UUID,
  p_outcome    TEXT,          -- 'ok' | 'low_confidence' | 'unsafe' | 'skipped' | 'not_waste'
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
  v_new_status public.report_status;
BEGIN
  SELECT location_suspect INTO v_suspect
  FROM public.reports WHERE id = p_report_id;

  IF v_suspect IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'report_not_found');
  END IF;

  IF p_outcome = 'unsafe' THEN
    v_new_status := 'abgelehnt';
    UPDATE public.reports
    SET status = v_new_status
    WHERE id = p_report_id;

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

  ELSIF p_outcome = 'low_confidence' THEN
    v_new_status := 'in_pruefung';
    UPDATE public.reports
    SET status = v_new_status, waste_type = p_waste_type, ai_confidence = p_confidence
    WHERE id = p_report_id;

  ELSIF p_outcome = 'ok' THEN
    -- Suspekter Standort geht trotz guter KI-Bewertung in die Review.
    v_new_status := CASE WHEN v_suspect THEN 'in_pruefung' ELSE 'veroeffentlicht' END;
    UPDATE public.reports
    SET status = v_new_status,
        waste_type = p_waste_type,
        ai_confidence = p_confidence,
        verification = 'ki_verifiziert'
    WHERE id = p_report_id;

  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_outcome');
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_new_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_vision_result(UUID, TEXT, TEXT, DOUBLE PRECISION)
  FROM PUBLIC, anon, authenticated;
