-- ============================================================
-- CLAR — Migration 006: Foto-Pipeline (Paket 5)
-- Additiv: zwei Storage-Buckets mit strikten Policies, Metadaten-Spalten
-- auf report_photos, submit_report_tx legt report_photos-Zeilen mit an.
--
-- Bucket-Modell:
--   originals       privat  — nur Eigentuemer (lesen/hochladen/loeschen
--                             im eigenen Ordner) + Service-Role.
--                             Zugriff fuer Anzeige nur ueber kurzlebige
--                             Signed URLs (Client erzeugt sie selbst).
--   public-blurred  public  — oeffentlich LESBAR; schreiben/loeschen kann
--                             AUSSCHLIESSLICH die Service-Role
--                             (process-photo). Clients haben keine
--                             INSERT/UPDATE/DELETE-Policy.
-- Oeffentliche Anzeige NUR aus public-blurred. Originale sind nie oeffentlich.
-- ============================================================

-- ----------------------
-- 1. Buckets
-- ----------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('originals', 'originals', FALSE, 10485760, ARRAY['image/jpeg', 'image/png']),
  ('public-blurred', 'public-blurred', TRUE, 10485760, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- ----------------------
-- 2. Storage-Policies
--    Pfad-Konvention originals: {user_id}/{dateiname}.jpg
-- ----------------------
DO $$ BEGIN
  CREATE POLICY "originals_select_own"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'originals'
      AND auth.uid()::TEXT = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "originals_insert_own"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'originals'
      AND auth.role() = 'authenticated'
      AND auth.uid()::TEXT = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "originals_delete_own"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'originals'
      AND auth.uid()::TEXT = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- public-blurred: nur lesen. KEINE Insert/Update/Delete-Policies fuer
-- Clients — schreiben kann nur die Service-Role (bypasst RLS).
DO $$ BEGIN
  CREATE POLICY "public_blurred_select_all"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'public-blurred');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------
-- 3. report_photos — Metadaten der Pipeline
-- ----------------------
ALTER TABLE public.report_photos
  ADD COLUMN IF NOT EXISTS phash TEXT,
  ADD COLUMN IF NOT EXISTS blurred_path TEXT,
  ADD COLUMN IF NOT EXISTS plates_blurred BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS report_photos_phash_idx ON public.report_photos (phash);

-- ----------------------
-- 4. submit_report_tx — erweitert: legt zu jedem Foto-Pfad eine
--    report_photos-Zeile an (kind 'before', approved = FALSE).
--    Signatur unveraendert; photo_urls haelt jetzt Storage-PFADE im
--    originals-Bucket (keine oeffentlichen URLs mehr).
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
  v_path      TEXT;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL
     OR p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_location');
  END IF;

  v_geohash8 := public.geohash_encode(p_lat, p_lng, 8);

  PERFORM pg_advisory_xact_lock(hashtext('case:' || substr(v_geohash8, 1, 6)));

  v_quota := public.consume_report_quota(p_user_id, v_limit);
  IF NOT (v_quota ->> 'allowed')::BOOLEAN THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quota_exceeded', 'limit', v_limit);
  END IF;

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

  -- Eine report_photos-Zeile pro Original (Pipeline-Status, approved=FALSE:
  -- oeffentlich wird ein Foto erst nach process-photo + Freigabe-Logik).
  FOREACH v_path IN ARRAY COALESCE(p_photo_paths, '{}'::TEXT[]) LOOP
    INSERT INTO public.report_photos (report_id, user_id, kind, storage_path)
    VALUES (v_report_id, p_user_id, 'before', v_path);
  END LOOP;

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
