-- ============================================================
-- CLAR — Migration 011: Client-Unterstuetzung (Paket 9)
-- Additiv: Offline-Idempotenz, Foto-Quelle (Kamera/Galerie),
-- Opt-in-Leaderboard mit Wochen-Reset.
-- ============================================================

-- ----------------------
-- 1. Offline-Sync: clientseitiger Idempotenz-Schluessel.
--    Der Client erzeugt pro Meldung EINMAL einen zufaelligen Key und
--    behaelt ihn in seiner Offline-Queue. Mehrfaches Syncen derselben
--    Meldung (Retry, App-Neustart) erzeugt keine Duplikate.
-- ----------------------
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS client_key TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT
    CHECK (source IN ('camera', 'gallery')),
  ADD COLUMN IF NOT EXISTS points_eligible BOOLEAN NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS reports_user_client_key_uniq
  ON public.reports (user_id, client_key)
  WHERE client_key IS NOT NULL;

-- ----------------------
-- 2. submit_report_tx_v2 — Wrapper um submit_report_tx (bleibt unveraendert):
--    * idempotent per client_key (Schnellpfad + Unique-Index gegen Races)
--    * speichert Foto-Quelle; Galerie-Uploads sind NICHT wertbar
--      (In-App-Kamera = wertbar — Galeriebilder koennen alt/fremd sein).
-- ----------------------
CREATE OR REPLACE FUNCTION public.submit_report_tx_v2(
  p_user_id          UUID,
  p_lat              DOUBLE PRECISION,
  p_lng              DOUBLE PRECISION,
  p_description      TEXT,
  p_photo_paths      TEXT[],
  p_location_suspect BOOLEAN,
  p_device_hash      TEXT,
  p_client_key       TEXT,
  p_source           TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing UUID;
  v_result JSONB;
  v_report_id UUID;
BEGIN
  -- Idempotenz-Schnellpfad: dieselbe Meldung wurde schon gesynct.
  IF p_client_key IS NOT NULL THEN
    SELECT id INTO v_existing
    FROM public.reports
    WHERE user_id = p_user_id AND client_key = p_client_key;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'report_id', v_existing, 'idempotent', true);
    END IF;
  END IF;

  v_result := public.submit_report_tx(
    p_user_id, p_lat, p_lng, p_description, p_photo_paths,
    p_location_suspect, p_device_hash
  );
  IF NOT COALESCE((v_result->>'ok')::BOOLEAN, FALSE) THEN
    RETURN v_result;
  END IF;

  v_report_id := (v_result->>'report_id')::UUID;
  BEGIN
    UPDATE public.reports
    SET client_key      = p_client_key,
        source          = NULLIF(p_source, ''),
        points_eligible = (COALESCE(p_source, 'camera') = 'camera')
    WHERE id = v_report_id;
  EXCEPTION WHEN unique_violation THEN
    -- Race: paralleler Sync hat denselben client_key schon gesetzt.
    -- Der neue Report ist ein Duplikat — als nicht wertbar markieren und
    -- den bestehenden zurueckgeben (Aufraeumen uebernimmt die Moderation).
    SELECT id INTO v_existing
    FROM public.reports
    WHERE user_id = p_user_id AND client_key = p_client_key;
    UPDATE public.reports SET points_eligible = FALSE WHERE id = v_report_id;
    RETURN jsonb_build_object('ok', true, 'report_id', v_existing, 'idempotent', true);
  END;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_report_tx_v2(
  UUID, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT[], BOOLEAN, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;

-- ----------------------
-- 3. award_points: Eligibility-Guard (gleiche Signatur, Verhalten additiv).
--    Meldungs-Punkte (report_verified/case_confirmed) gibt es nur fuer
--    Reports mit points_eligible = TRUE (In-App-Kamera). Alle anderen
--    Buchungsarten (z. B. case_closed_after) bleiben unberuehrt.
--    Der Rumpf entspricht sonst Migration 007.
-- ----------------------
-- Rumpf identisch zu Migration 007 (gleiche Signatur/Parameternamen,
-- Advisory-Lock, ON CONFLICT); NEU ist ausschliesslich der
-- points_eligible-Guard direkt nach der booking_key-Pruefung.
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

  -- NEU (Migration 011): Galerie-/Duplikat-Reports sind nicht wertbar.
  IF p_report_id IS NOT NULL
     AND p_kind IN ('report_verified', 'case_confirmed')
     AND EXISTS (
       SELECT 1 FROM public.reports
       WHERE id = p_report_id AND NOT points_eligible
     )
  THEN
    RETURN jsonb_build_object('ok', true, 'awarded', 0, 'reason', 'not_eligible');
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

-- ----------------------
-- 4. Opt-in-Leaderboard mit Wochen-Reset.
--    * Standard AUS; Anzeige unter frei waehlbarem Pseudonym (nie E-Mail).
--    * Wochen-Reset ergibt sich aus dem Zeitfenster der View — es wird
--      nichts geloescht, das Ledger bleibt unangetastet.
--    * View laeuft mit Owner-Rechten (KEIN security_invoker) und gibt nur
--      aggregierte, freiwillig geteilte Daten preis.
-- ----------------------
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT
    CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 2 AND 24),
  ADD COLUMN IF NOT EXISTS leaderboard_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.set_leaderboard_prefs(
  p_opt_in       BOOLEAN,
  p_display_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet';
  END IF;
  -- Nur harmlose Zeichen im Pseudonym (Rest faengt die Moderation).
  IF p_display_name IS NOT NULL
     AND p_display_name !~ '^[[:alnum:] _\-\.]{2,24}$' THEN
    RAISE EXCEPTION 'Ungueltiges Pseudonym';
  END IF;
  UPDATE public.user_profiles
  SET leaderboard_opt_in = COALESCE(p_opt_in, FALSE),
      display_name = COALESCE(NULLIF(TRIM(p_display_name), ''), display_name)
  WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_leaderboard_prefs(BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_leaderboard_prefs(BOOLEAN, TEXT) TO authenticated;

CREATE OR REPLACE VIEW public.leaderboard_week AS
SELECT
  COALESCE(p.display_name, 'Anonym') AS display_name,
  SUM(l.delta)::INT AS points,
  RANK() OVER (ORDER BY SUM(l.delta) DESC) AS rank
FROM public.points_ledger l
JOIN public.user_profiles p ON p.id = l.user_id
WHERE p.leaderboard_opt_in
  AND l.delta > 0
  AND l.created_at >= date_trunc('week', NOW())
GROUP BY p.id, p.display_name
ORDER BY points DESC
LIMIT 50;

GRANT SELECT ON public.leaderboard_week TO authenticated;
REVOKE SELECT ON public.leaderboard_week FROM anon;
