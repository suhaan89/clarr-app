-- ============================================================
-- CLAR — Migration 004: Meldungs-Backend (Paket 3)
-- Additiv: system_settings, rate_limit_events, neue Spalten auf
-- reports/cases, Server-RPCs fuer die Edge Function submit-report.
--
-- Sicherheitsmodell:
--   * Clients koennen reports NICHT mehr direkt schreiben (REVOKE unten).
--   * Alle Schreibpfade laufen ueber submit_report_tx() — aufgerufen von der
--     Edge Function submit-report mit Service-Role.
--   * Quota (10/Tag pro Nutzer) und Fall-Buendelung sind atomar/race-sicher
--     (Row-Lock bzw. Advisory-Lock pro Geohash-Zelle).
-- ============================================================

-- ----------------------
-- 1. Client-Schreibzugriff auf reports entziehen.
--    Die alten Policies (reports_insert_own/reports_update_own) bleiben
--    additiv stehen, laufen aber ohne Grant ins Leere. SELECT bleibt
--    unveraendert (Karten-Screen).
-- ----------------------
REVOKE INSERT, UPDATE, DELETE ON public.reports FROM anon, authenticated;

-- ----------------------
-- 2. system_settings — serverseitige Schalter/Limits (Kill-Switch, Budgets).
--    Nur Service-Role: RLS an, keine Policies, keine Client-Grants.
-- ----------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.system_settings FROM anon, authenticated;

INSERT INTO public.system_settings (key, value) VALUES
  ('vision_kill_switch',       'false'),
  ('vision_global_daily_usd',  '5.00'),
  ('vision_user_daily_usd',    '0.50'),
  ('vision_alert_threshold',   '0.8'),
  ('report_daily_limit',       '10')
ON CONFLICT (key) DO NOTHING;

-- ----------------------
-- 3. rate_limit_events — Sliding-Window-Rate-Limit pro Konto+Geraet/IP.
--    Es werden NUR Hashes gespeichert (SHA-256), nie rohe IPs/Geraete-IDs.
--    Nur Service-Role.
-- ----------------------
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_hash TEXT,
  ip_hash TEXT,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rate_limit_events_window_idx
  ON public.rate_limit_events (action, created_at);

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_events FROM anon, authenticated;

-- Atomar: Event loggen und Fenster zaehlen (Advisory-Lock gegen Races).
-- Zaehlt pro user ODER device ODER ip — der engste Treffer limitiert.
CREATE OR REPLACE FUNCTION public.check_and_log_rate_limit(
  p_user_id     UUID,
  p_device_hash TEXT,
  p_ip_hash     TEXT,
  p_action      TEXT,
  p_max         INT,
  p_window_secs INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('rl:' || COALESCE(p_user_id::TEXT, p_ip_hash, p_device_hash, p_action)));

  INSERT INTO public.rate_limit_events (user_id, device_hash, ip_hash, action)
  VALUES (p_user_id, p_device_hash, p_ip_hash, p_action);

  SELECT COUNT(*) INTO v_count
  FROM public.rate_limit_events
  WHERE action = p_action
    AND created_at > NOW() - MAKE_INTERVAL(secs => p_window_secs)
    AND (
      user_id = p_user_id
      OR (p_device_hash IS NOT NULL AND device_hash = p_device_hash)
      OR (p_ip_hash IS NOT NULL AND ip_hash = p_ip_hash)
    );

  RETURN v_count <= p_max;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_log_rate_limit(UUID, TEXT, TEXT, TEXT, INT, INT)
  FROM PUBLIC, anon, authenticated;

-- ----------------------
-- 4. Geo-Helfer: Geohash-Encoder + Haversine-Distanz (reines SQL/plpgsql,
--    kein PostGIS noetig). Geohash Praezision 8 ~ 38m x 19m Zelle ("~30m").
-- ----------------------
CREATE OR REPLACE FUNCTION public.geohash_encode(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_precision INT DEFAULT 8
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  chars CONSTANT TEXT := '0123456789bcdefghjkmnpqrstuvwxyz';
  lat_min DOUBLE PRECISION := -90;  lat_max DOUBLE PRECISION := 90;
  lng_min DOUBLE PRECISION := -180; lng_max DOUBLE PRECISION := 180;
  v_result TEXT := '';
  v_bit INT := 0;
  v_ch INT := 0;
  v_is_lng BOOLEAN := TRUE;
  v_mid DOUBLE PRECISION;
BEGIN
  WHILE length(v_result) < p_precision LOOP
    IF v_is_lng THEN
      v_mid := (lng_min + lng_max) / 2;
      IF p_lng >= v_mid THEN v_ch := v_ch * 2 + 1; lng_min := v_mid;
      ELSE v_ch := v_ch * 2; lng_max := v_mid; END IF;
    ELSE
      v_mid := (lat_min + lat_max) / 2;
      IF p_lat >= v_mid THEN v_ch := v_ch * 2 + 1; lat_min := v_mid;
      ELSE v_ch := v_ch * 2; lat_max := v_mid; END IF;
    END IF;
    v_is_lng := NOT v_is_lng;
    v_bit := v_bit + 1;
    IF v_bit = 5 THEN
      v_result := v_result || substr(chars, v_ch + 1, 1);
      v_bit := 0; v_ch := 0;
    END IF;
  END LOOP;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.haversine_m(
  lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2))
      * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- ----------------------
-- 5. Additive Spalten: cases bekommen einen Ort, reports Geohash + Flags.
-- ----------------------
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geohash8 TEXT;

CREATE INDEX IF NOT EXISTS cases_status_idx  ON public.cases (status);
CREATE INDEX IF NOT EXISTS cases_geohash_idx ON public.cases (geohash8);

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS geohash8 TEXT,
  ADD COLUMN IF NOT EXISTS is_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS location_suspect BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS device_hash TEXT;

-- ----------------------
-- 6. Race-sichere Tagesquota (ersetzt funktional
--    check_and_increment_daily_reports; die alte RPC bleibt additiv stehen,
--    wird vom Client aber nicht mehr gebraucht). Ein einzelnes UPDATE mit
--    Bedingung = atomar dank Row-Lock.
-- ----------------------
CREATE OR REPLACE FUNCTION public.consume_report_quota(
  p_user_id UUID,
  p_limit   INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (p_user_id)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.user_profiles
  SET reports_count_today = CASE
        WHEN last_report_date IS DISTINCT FROM CURRENT_DATE THEN 1
        ELSE reports_count_today + 1
      END,
      last_report_date = CURRENT_DATE
  WHERE id = p_user_id
    AND (last_report_date IS DISTINCT FROM CURRENT_DATE
         OR reports_count_today < p_limit)
  RETURNING reports_count_today INTO v_count;

  IF v_count IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'limit', p_limit);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'count', v_count, 'limit', p_limit);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_report_quota(UUID, INT)
  FROM PUBLIC, anon, authenticated;

-- ----------------------
-- 7. Vision-Budget-Status (Grundlage fuer Paket 4).
--    Liest system_settings + vision_usage (heute). Nur Service-Role.
-- ----------------------
CREATE OR REPLACE FUNCTION public.vision_budget_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kill    BOOLEAN := COALESCE((SELECT (value)::BOOLEAN FROM public.system_settings WHERE key = 'vision_kill_switch'), FALSE);
  v_glimit  NUMERIC  := COALESCE((SELECT (value)::NUMERIC FROM public.system_settings WHERE key = 'vision_global_daily_usd'), 0);
  v_ulimit  NUMERIC  := COALESCE((SELECT (value)::NUMERIC FROM public.system_settings WHERE key = 'vision_user_daily_usd'), 0);
  v_alert   NUMERIC  := COALESCE((SELECT (value)::NUMERIC FROM public.system_settings WHERE key = 'vision_alert_threshold'), 0.8);
  v_gused   NUMERIC;
  v_uused   NUMERIC;
BEGIN
  SELECT COALESCE(SUM(estimated_cost_usd), 0) INTO v_gused
  FROM public.vision_usage
  WHERE created_at >= date_trunc('day', NOW());

  SELECT COALESCE(SUM(estimated_cost_usd), 0) INTO v_uused
  FROM public.vision_usage
  WHERE created_at >= date_trunc('day', NOW())
    AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'kill_switch',      v_kill,
    'global_used_usd',  v_gused,
    'global_limit_usd', v_glimit,
    'global_ok',        (NOT v_kill) AND v_gused < v_glimit,
    'user_used_usd',    v_uused,
    'user_limit_usd',   v_ulimit,
    'user_ok',          v_uused < v_ulimit,
    'alert',            v_glimit > 0 AND v_gused >= v_glimit * v_alert
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vision_budget_status(UUID)
  FROM PUBLIC, anon, authenticated;

-- ----------------------
-- 8. submit_report_tx — der einzige Schreibpfad fuer neue Meldungen.
--    Atomar in EINER Transaktion:
--      * Advisory-Lock pro Geohash-6-Zelle (verhindert doppelte Faelle bei
--        gleichzeitigen Meldungen am selben Ort)
--      * Tagesquota verbrauchen
--      * offenen Fall im Umkreis (<= 40 m) suchen -> Meldung wird
--        BESTAETIGUNG statt neuem Fall
--      * sonst neuen Fall anlegen
--      * Report einfuegen (Zeit = Server-NOW via Default, Geo validiert)
--      * audit_log
-- ----------------------
CREATE OR REPLACE FUNCTION public.submit_report_tx(
  p_user_id          UUID,
  p_lat              DOUBLE PRECISION,
  p_lng              DOUBLE PRECISION,
  p_description      TEXT,
  p_photo_paths      TEXT[],
  p_location_suspect BOOLEAN,
  p_device_hash      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit     INT := COALESCE((SELECT (value)::INT FROM public.system_settings WHERE key = 'report_daily_limit'), 10);
  v_quota     JSONB;
  v_geohash8  TEXT;
  v_case_id   UUID;
  v_is_conf   BOOLEAN := FALSE;
  v_report_id UUID;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL
     OR p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_location');
  END IF;

  v_geohash8 := public.geohash_encode(p_lat, p_lng, 8);

  -- Serialisiert gleichzeitige Meldungen in derselben ~1.2km-Zelle.
  PERFORM pg_advisory_xact_lock(hashtext('case:' || substr(v_geohash8, 1, 6)));

  v_quota := public.consume_report_quota(p_user_id, v_limit);
  IF NOT (v_quota ->> 'allowed')::BOOLEAN THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quota_exceeded', 'limit', v_limit);
  END IF;

  -- Naechster OFFENER Fall im Umkreis von 40 m -> Bestaetigung.
  SELECT c.id INTO v_case_id
  FROM public.cases c
  WHERE c.status IN ('gemeldet', 'geprueft', 'weitergeleitet')
    AND c.location_lat IS NOT NULL
    AND public.haversine_m(c.location_lat, c.location_lng, p_lat, p_lng) <= 40
  ORDER BY public.haversine_m(c.location_lat, c.location_lng, p_lat, p_lng)
  LIMIT 1;

  IF v_case_id IS NOT NULL THEN
    v_is_conf := TRUE;
  ELSE
    INSERT INTO public.cases (title, status, created_by, location_lat, location_lng, geohash8)
    VALUES ('Muellmeldung ' || to_char(NOW(), 'YYYY-MM-DD'), 'gemeldet', p_user_id, p_lat, p_lng, v_geohash8)
    RETURNING id INTO v_case_id;
  END IF;

  INSERT INTO public.reports
    (user_id, description, latitude, longitude, photo_urls,
     status, case_id, is_confirmation, location_suspect, device_hash, geohash8)
  VALUES
    (p_user_id, NULLIF(TRIM(p_description), ''), p_lat, p_lng, COALESCE(p_photo_paths, '{}'),
     'gemeldet', v_case_id, v_is_conf, COALESCE(p_location_suspect, FALSE), p_device_hash, v_geohash8)
  RETURNING id INTO v_report_id;

  INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, details)
  VALUES (p_user_id, 'report_submitted', 'report', v_report_id::TEXT,
          jsonb_build_object('case_id', v_case_id, 'is_confirmation', v_is_conf,
                             'location_suspect', COALESCE(p_location_suspect, FALSE)));

  RETURN jsonb_build_object(
    'ok', true,
    'report_id', v_report_id,
    'case_id', v_case_id,
    'is_confirmation', v_is_conf,
    'reports_today', v_quota -> 'count'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_report_tx(UUID, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT[], BOOLEAN, TEXT)
  FROM PUBLIC, anon, authenticated;
