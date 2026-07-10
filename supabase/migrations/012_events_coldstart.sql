-- ============================================================
-- CLAR — Migration 012: Events + Cold-Start (Paket 10)
--
-- * Events darf nur noch Team (moderator) / Partner anlegen — die alte
--   Policy events_insert_own (jeder Angemeldete) wird ERSETZT.
--   Dokumentierte Ausnahme vom Additiv-Prinzip, wie reports_select_all
--   in Paket 8 (Begruendung: oeffentliche Treffpunkte + teils
--   minderjaehrige Zielgruppe -> Events brauchen eine verantwortliche
--   Orga; NOTIZEN.md Paket 10).
-- * Faelle koennen einem Event zugeordnet und gebuendelt abgeschlossen
--   werden (close_event_cases_tx; Punkte idempotent pro Fall).
-- * Seed-Markierung fuer Cold-Start-Inhalte (ehrliche Kennzeichnung).
-- ============================================================

-- ----------------------
-- 1. Event-Erstellung: nur Team/Partner.
-- ----------------------
DROP POLICY IF EXISTS "events_insert_own" ON public.cleanup_events;

CREATE POLICY "events_insert_team_partner"
  ON public.cleanup_events FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('partner', 'moderator')
    )
  );

-- ----------------------
-- 2. Fall-Zuordnung zu Events (additiv).
-- ----------------------
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS event_id UUID
    REFERENCES public.cleanup_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS cases_event_id_idx ON public.cases (event_id);

-- ----------------------
-- 3. Seed-Markierung (Cold-Start): echte Start-Inhalte werden ehrlich
--    als vom Team eingepflegt gekennzeichnet — keine Fake-Nutzer.
-- ----------------------
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS is_seed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.cleanup_events
  ADD COLUMN IF NOT EXISTS is_seed BOOLEAN NOT NULL DEFAULT FALSE;

-- ----------------------
-- 4. Gebuendelter Event-Abschluss: mehrere Faelle eines Events mit
--    Nachher-Fotos schliessen. Nur Service-Role (Edge Function prueft
--    Team-/Partner-Rolle). Punkte laufen pro Fall durch close_case_tx
--    -> booking_key 'case_closed_after:<case_id>' bleibt idempotent,
--    doppelte Aufrufe buchen NICHTS doppelt.
-- ----------------------
CREATE OR REPLACE FUNCTION public.close_event_cases_tx(
  p_event_id    UUID,
  p_user_id     UUID,
  p_case_ids    UUID[],
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
  v_case_id UUID;
  v_result JSONB;
  v_results JSONB := '[]'::JSONB;
  v_closed INT := 0;
BEGIN
  IF p_case_ids IS NULL OR array_length(p_case_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_cases');
  END IF;
  IF array_length(p_case_ids, 1) > 25 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_many_cases');
  END IF;

  FOREACH v_case_id IN ARRAY p_case_ids LOOP
    -- Zuordnung zum Event (idempotent; nur setzen, wenn noch frei).
    UPDATE public.cases
    SET event_id = p_event_id
    WHERE id = v_case_id AND (event_id IS NULL OR event_id = p_event_id);

    v_result := public.close_case_tx(v_case_id, p_user_id, p_lat, p_lng, p_photo_paths);
    IF COALESCE((v_result->>'ok')::BOOLEAN, FALSE) THEN
      v_closed := v_closed + 1;
    END IF;
    v_results := v_results || jsonb_build_array(
      jsonb_build_object('case_id', v_case_id, 'result', v_result));
  END LOOP;

  INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, details)
  VALUES (p_user_id, 'event_cases_closed', 'event', p_event_id::TEXT,
          jsonb_build_object('requested', array_length(p_case_ids, 1), 'closed', v_closed));

  RETURN jsonb_build_object('ok', true, 'closed', v_closed, 'results', v_results);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.close_event_cases_tx(
  UUID, UUID, UUID[], DOUBLE PRECISION, DOUBLE PRECISION, TEXT[]
) FROM PUBLIC, anon, authenticated;
