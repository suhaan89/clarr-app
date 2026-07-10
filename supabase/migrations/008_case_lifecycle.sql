-- ============================================================
-- CLAR — Migration 008: Real-World-Loop / Fall-Statusmaschine (Paket 7)
-- Additiv: Statusmaschinen-Trigger auf cases, Rollen, Push-Opt-in,
-- close_case_tx() fuer den Fallabschluss mit Nachher-Foto.
-- ============================================================

-- ----------------------
-- 1. Rollen (fuer Anti-Kollusion hier und Moderation in Paket 8).
--    user_profiles ist seit Migration 003 fuer Clients read-only —
--    Rollen kann nur die Service-Role vergeben.
-- ----------------------
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'partner', 'moderator'));

-- ----------------------
-- 2. Push-Opt-in (Benachrichtigung an Melder bei Fallabschluss).
--    Standard AUS (Opt-in!). Token setzt der Nutzer selbst per RPC.
-- ----------------------
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS push_token TEXT,
  ADD COLUMN IF NOT EXISTS notify_case_closed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.set_push_preferences(
  p_push_token TEXT,
  p_notify_case_closed BOOLEAN
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
  UPDATE public.user_profiles
  SET push_token = NULLIF(TRIM(p_push_token), ''),
      notify_case_closed = COALESCE(p_notify_case_closed, FALSE)
  WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_push_preferences(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_push_preferences(TEXT, BOOLEAN) TO authenticated;

-- ----------------------
-- 3. Statusmaschine: erlaubte Uebergaenge werden per Trigger erzwungen —
--    auch fuer die Service-Role. Jede Aenderung landet im audit_log.
--
--      gemeldet       -> geprueft | erledigt | geschlossen
--      geprueft       -> weitergeleitet | erledigt | geschlossen
--      weitergeleitet -> erledigt | geschlossen
--      erledigt       -> geschlossen
--      geschlossen    -> (terminal)
-- ----------------------
CREATE OR REPLACE FUNCTION public.enforce_case_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_allowed BOOLEAN;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  v_allowed := CASE OLD.status
    WHEN 'gemeldet'       THEN NEW.status IN ('geprueft', 'erledigt', 'geschlossen')
    WHEN 'geprueft'       THEN NEW.status IN ('weitergeleitet', 'erledigt', 'geschlossen')
    WHEN 'weitergeleitet' THEN NEW.status IN ('erledigt', 'geschlossen')
    WHEN 'erledigt'       THEN NEW.status IN ('geschlossen')
    ELSE FALSE
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Ungueltiger Fall-Statusuebergang: % -> %', OLD.status, NEW.status;
  END IF;

  NEW.updated_at := NOW();

  INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'case_status_changed', 'case', NEW.id::TEXT,
          jsonb_build_object('from', OLD.status, 'to', NEW.status));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cases_enforce_transition ON public.cases;
CREATE TRIGGER cases_enforce_transition
  BEFORE UPDATE OF status ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.enforce_case_transition();

-- ----------------------
-- 4. close_case_tx — Fallabschluss mit Nachher-Foto, atomar.
--    Anti-Kollusion:
--      * JEDER Abschluss (auch durch den urspruenglichen Melder) braucht ein
--        EIGENES Nachher-Foto — ausser Partner-Rolle (Kommune/Org).
--      * Geo-Pruefung: Abschliessender muss beim Fallort stehen (<= 100 m),
--        Partner ausgenommen. Zeit = Server-NOW.
--      * Punkte (case_closed_after) sind per booking_key an den FALL
--        gebunden: nur der erste Abschluss eines Falls wird verbucht —
--        wechselseitiges "Abschluss-Farmen" desselben Falls ist unmoeglich.
--    Das Nachher-Foto laeuft als eigener Abschluss-Report (kind 'after')
--    durch dieselbe Foto-Pipeline (process-photo) wie alle anderen Fotos.
-- ----------------------
CREATE OR REPLACE FUNCTION public.close_case_tx(
  p_case_id     UUID,
  p_user_id     UUID,
  p_lat         DOUBLE PRECISION,
  p_lng         DOUBLE PRECISION,
  p_photo_paths TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.cases%ROWTYPE;
  v_role TEXT;
  v_is_partner BOOLEAN;
  v_report_id UUID;
  v_path TEXT;
  v_award JSONB;
BEGIN
  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id FOR UPDATE;
  IF v_case.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'case_not_found');
  END IF;
  IF v_case.status NOT IN ('gemeldet', 'geprueft', 'weitergeleitet') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'case_not_open', 'status', v_case.status);
  END IF;

  SELECT role INTO v_role FROM public.user_profiles WHERE id = p_user_id;
  v_is_partner := (v_role = 'partner') OR (v_role = 'moderator');

  IF NOT v_is_partner THEN
    IF p_photo_paths IS NULL OR array_length(p_photo_paths, 1) IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'after_photo_required');
    END IF;
    IF v_case.location_lat IS NOT NULL
       AND public.haversine_m(v_case.location_lat, v_case.location_lng, p_lat, p_lng) > 100 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'too_far_from_case');
    END IF;
  END IF;

  -- Abschluss-Report (traegt die Nachher-Fotos; laeuft durch die Pipeline)
  IF p_photo_paths IS NOT NULL AND array_length(p_photo_paths, 1) IS NOT NULL THEN
    INSERT INTO public.reports
      (user_id, description, latitude, longitude, photo_urls, status, case_id, geohash8)
    VALUES
      (p_user_id, 'Fallabschluss (Nachher-Foto)', p_lat, p_lng, p_photo_paths,
       'erledigt', p_case_id, public.geohash_encode(p_lat, p_lng, 8))
    RETURNING id INTO v_report_id;

    FOREACH v_path IN ARRAY p_photo_paths LOOP
      INSERT INTO public.report_photos (report_id, user_id, kind, storage_path)
      VALUES (v_report_id, p_user_id, 'after', v_path);
    END LOOP;
  END IF;

  -- Statuswechsel (Trigger validiert + auditiert)
  UPDATE public.cases SET status = 'erledigt' WHERE id = p_case_id;

  -- Punkte: an den Fall gebunden -> idempotent, nur der erste Abschluss
  v_award := public.award_points(
    p_user_id,
    'case_closed_after',
    'case_closed_after:' || p_case_id::TEXT,
    v_report_id,
    NULL
  );

  INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, details)
  VALUES (p_user_id, 'case_closed', 'case', p_case_id::TEXT,
          jsonb_build_object('closure_report_id', v_report_id,
                             'as_partner', v_is_partner, 'award', v_award));

  RETURN jsonb_build_object(
    'ok', true,
    'case_id', p_case_id,
    'closure_report_id', v_report_id,
    'award', v_award
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.close_case_tx(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, TEXT[])
  FROM PUBLIC, anon, authenticated;

-- ----------------------
-- 5. Hilfs-RPC fuer close-case: Melder eines Falls mit Push-Opt-in
--    (nur Service-Role; liefert user_id + push_token).
-- ----------------------
CREATE OR REPLACE FUNCTION public.case_notify_recipients(p_case_id UUID)
RETURNS TABLE (user_id UUID, push_token TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.id, p.push_token
  FROM public.reports r
  JOIN public.user_profiles p ON p.id = r.user_id
  WHERE r.case_id = p_case_id
    AND p.notify_case_closed
    AND p.push_token IS NOT NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.case_notify_recipients(UUID)
  FROM PUBLIC, anon, authenticated;
