-- ============================================================
-- CLAR — Migration 007: Reward-Engine (Paket 6)
-- Additiv: booking_key auf points_ledger, award_points() als einziger
-- Buchungspfad, Level-View, Verdrahtung in apply_vision_result.
--
-- Grundsaetze (CLAUDE.md):
--   * Punkte sind REIN kosmetisch, KEINE Streaks, KEINE Zufalls-Belohnungen.
--   * Buchung NUR serverseitig: points_ledger hat keine Client-Grants
--     (Migration 002), award_points() ist nur fuer die Service-Role
--     ausfuehrbar. user_profiles.credits bleibt unveraendert (Alt-Cache).
--   * Jede Buchung ist idempotent an einen eindeutigen booking_key gebunden.
-- ============================================================

-- ----------------------
-- 1. Idempotenz: eindeutiger Buchungsbezug
-- ----------------------
ALTER TABLE public.points_ledger
  ADD COLUMN IF NOT EXISTS booking_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS points_ledger_booking_key_idx
  ON public.points_ledger (booking_key)
  WHERE booking_key IS NOT NULL;

-- Tagesdeckel konfigurierbar
INSERT INTO public.system_settings (key, value) VALUES
  ('points_daily_cap', '50')
ON CONFLICT (key) DO NOTHING;

-- ----------------------
-- 2. award_points — der EINZIGE Buchungspfad.
--    * idempotent: booking_key doppelt -> keine zweite Buchung
--    * Tagesdeckel: positive Buchungen pro Nutzer/Tag gedeckelt
--      (race-sicher via Advisory-Lock pro Nutzer), Teilbuchung moeglich
--    * degressiv: report-bezogene Buchungen am selben Ort (Geohash-7,
--      ~150 m) innerhalb 30 Tagen halbieren sich pro Wiederholung
--      (10 -> 5 -> 2 -> 1 -> 0), gegen "Farmen" desselben Flecks
--    Punktwerte:
--      report_verified   10  (verifizierte Meldung)
--      case_confirmed     3  (Bestaetigung eines offenen Falls, klein)
--      case_closed_after 25  (Fallabschluss mit Nachher-Foto, hoechster Wert)
-- ----------------------
CREATE OR REPLACE FUNCTION public.award_points(
  p_user_id     UUID,
  p_kind        TEXT,
  p_booking_key TEXT,
  p_report_id   UUID DEFAULT NULL,
  p_event_id    UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base INT;
  v_points INT;
  v_cap INT := COALESCE((SELECT (value)::INT FROM public.system_settings WHERE key = 'points_daily_cap'), 50);
  v_used_today INT;
  v_repeats INT := 0;
  v_geohash7 TEXT;
BEGIN
  IF p_booking_key IS NULL OR length(p_booking_key) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_key_required');
  END IF;

  v_base := CASE p_kind
    WHEN 'report_verified'   THEN 10
    WHEN 'case_confirmed'    THEN 3
    WHEN 'case_closed_after' THEN 25
    ELSE NULL
  END;
  IF v_base IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_kind');
  END IF;

  -- Idempotenz-Schnellpfad (der Unique-Index faengt Races zusaetzlich ab)
  IF EXISTS (SELECT 1 FROM public.points_ledger WHERE booking_key = p_booking_key) THEN
    RETURN jsonb_build_object('ok', true, 'awarded', 0, 'duplicate', true);
  END IF;

  -- Degression: gleiche Buchungsart desselben Nutzers am selben Ort
  -- (Geohash-7) in den letzten 30 Tagen
  IF p_report_id IS NOT NULL THEN
    SELECT substr(r.geohash8, 1, 7) INTO v_geohash7
    FROM public.reports r WHERE r.id = p_report_id;

    IF v_geohash7 IS NOT NULL THEN
      SELECT COUNT(*) INTO v_repeats
      FROM public.points_ledger l
      JOIN public.reports r ON r.id = l.report_id
      WHERE l.user_id = p_user_id
        AND l.reason = p_kind
        AND l.created_at > NOW() - INTERVAL '30 days'
        AND substr(r.geohash8, 1, 7) = v_geohash7;
    END IF;
  END IF;

  v_points := v_base >> LEAST(v_repeats, 30); -- 10 -> 5 -> 2 -> 1 -> 0
  IF v_points <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'awarded', 0, 'reason', 'degression');
  END IF;

  -- Tagesdeckel, race-sicher pro Nutzer
  PERFORM pg_advisory_xact_lock(hashtext('points:' || p_user_id::TEXT));

  SELECT COALESCE(SUM(delta), 0) INTO v_used_today
  FROM public.points_ledger
  WHERE user_id = p_user_id
    AND delta > 0
    AND created_at >= date_trunc('day', NOW());

  v_points := LEAST(v_points, GREATEST(0, v_cap - v_used_today));
  IF v_points <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'awarded', 0, 'reason', 'daily_cap');
  END IF;

  INSERT INTO public.points_ledger (user_id, delta, reason, report_id, event_id, booking_key)
  VALUES (p_user_id, v_points, p_kind, p_report_id, p_event_id, p_booking_key)
  ON CONFLICT (booking_key) WHERE booking_key IS NOT NULL DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'awarded', 0, 'duplicate', true);
  END IF;

  RETURN jsonb_build_object('ok', true, 'awarded', v_points);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_points(UUID, TEXT, TEXT, UUID, UUID)
  FROM PUBLIC, anon, authenticated;

-- ----------------------
-- 3. Level als VIEW (kosmetisch, rein ableitbar aus dem Saldo).
--    security_invoker: jeder sieht nur den eigenen Level (Ledger-RLS).
-- ----------------------
CREATE OR REPLACE VIEW public.points_level
WITH (security_invoker = true) AS
SELECT
  user_id,
  balance,
  (balance / 100) + 1 AS level,
  CASE
    WHEN balance >= 500 THEN 'Gold'
    WHEN balance >= 250 THEN 'Silber'
    WHEN balance >= 100 THEN 'Bronze'
    ELSE 'Starter'
  END AS level_name
FROM public.points_balance;

-- ----------------------
-- 4. Verdrahtung: apply_vision_result vergibt bei Veroeffentlichung
--    automatisch Punkte (serverseitig, idempotent per booking_key).
--    Bestaetigung eines bestehenden Falls zaehlt klein (case_confirmed),
--    neue verifizierte Meldung normal (report_verified).
-- ----------------------
CREATE OR REPLACE FUNCTION public.apply_vision_result(
  p_report_id  UUID,
  p_outcome    TEXT,
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
    v_new_status := CASE WHEN v_suspect THEN 'in_pruefung' ELSE 'veroeffentlicht' END;
    UPDATE public.reports
    SET status = v_new_status,
        waste_type = p_waste_type,
        ai_confidence = p_confidence,
        verification = 'ki_verifiziert'
    WHERE id = p_report_id;

    -- Punkte nur bei tatsaechlicher Veroeffentlichung; suspekte Meldungen
    -- werden ggf. nach manueller Freigabe (Paket 8) verbucht.
    IF v_new_status = 'veroeffentlicht' THEN
      v_award := public.award_points(
        v_user_id,
        CASE WHEN v_is_conf THEN 'case_confirmed' ELSE 'report_verified' END,
        CASE WHEN v_is_conf THEN 'case_confirmed:' ELSE 'report_verified:' END || p_report_id::TEXT,
        p_report_id,
        NULL
      );
    END IF;

  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_outcome');
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_new_status, 'award', v_award);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_vision_result(UUID, TEXT, TEXT, DOUBLE PRECISION)
  FROM PUBLIC, anon, authenticated;
