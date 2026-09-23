-- ============================================================
-- CLAR — Migration 022: Begruendung von Moderationsentscheidungen
-- (Legal-Audit 2026-09-23, Bereiche E und F)
--
-- Problem: reports speicherte bisher NUR den Endstatus. Warum eine Meldung
-- abgelehnt wurde und ob das automatisiert geschah, ging nirgends hervor.
-- Damit war weder Art. 17 DSA (Begruendungspflicht bei Sichtbarkeits-
-- beschraenkung, ausdruecklich inkl. Hinweis auf automatisierte Mittel)
-- noch Art. 13 (2) (f) / Art. 22 (3) DSGVO (Information ueber die Logik)
-- vollstaendig erfuellbar — der Client konnte nur raten.
--
-- Loesung: drei zusaetzliche Spalten auf reports, die JEDE statusaendernde
-- Funktion mitschreibt. `decision_reason` ist bewusst ein STABILER CODE,
-- kein Fliesstext: der Client uebersetzt ihn ueber src/lib/i18n in die
-- Sprache der Nutzerin. So steht in der Datenbank kein deutscher Satz, der
-- sich nicht uebersetzen laesst, und es landet auch kein KI-generierter
-- Freitext in der Akte.
--
-- Ausserdem: consents.policy_version trug den Default
-- 'PLATZHALTER-JURISTISCH-PRUEFEN-v0'. Ein Einwilligungsnachweis, der nicht
-- sagt, WELCHER Fassung zugestimmt wurde, ist wertlos (Art. 7 (1) DSGVO).
-- Der Default zeigt jetzt auf die Fassung in src/constants/legal.ts.
--
-- ADDITIV. Keine Daten werden geloescht, keine Signatur geaendert.
-- Bestehende Zeilen behalten NULL, der Client behandelt das als
-- "kein Grund hinterlegt".
-- ============================================================

-- ----------------------
-- 1. Entscheidungs-Metadaten auf reports
-- ----------------------
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS decision_reason TEXT,
  ADD COLUMN IF NOT EXISTS decision_automated BOOLEAN,
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;

COMMENT ON COLUMN public.reports.decision_reason IS
  'Stabiler Grund-Code der letzten Statusentscheidung; der Client uebersetzt ihn. '
  'Werte: not_waste, unsafe_content, private_context, low_confidence, vision_skipped, '
  'published, moderator_rejected, moderator_approved, moderator_private.';
COMMENT ON COLUMN public.reports.decision_automated IS
  'TRUE = ohne menschliches Zutun entschieden (Art. 22 DSGVO, Art. 17 DSA).';

-- ----------------------
-- 2. apply_vision_result schreibt die Begruendung mit.
--    Gleiche Signatur, gleiche Logik, nur zusaetzliche Spalten im UPDATE.
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
  v_reason TEXT;
BEGIN
  SELECT location_suspect, user_id, is_confirmation
  INTO v_suspect, v_user_id, v_is_conf
  FROM public.reports WHERE id = p_report_id;

  IF v_suspect IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'report_not_found');
  END IF;

  IF p_outcome = 'unsafe' THEN
    v_new_status := 'abgelehnt';
    v_reason := 'unsafe_content';
    UPDATE public.reports
    SET status = v_new_status,
        decision_reason = v_reason,
        decision_automated = TRUE,
        decided_at = NOW()
    WHERE id = p_report_id;

    INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, details)
    VALUES (NULL, 'vision_blocked_unsafe_content', 'report', p_report_id::TEXT,
            jsonb_build_object('note', 'Gewalt/Nacktheit erkannt — nie oeffentlich'));

  ELSIF p_outcome = 'not_waste' THEN
    v_new_status := 'abgelehnt';
    v_reason := 'not_waste';
    UPDATE public.reports
    SET status = v_new_status,
        ai_confidence = p_confidence,
        decision_reason = v_reason,
        decision_automated = TRUE,
        decided_at = NOW()
    WHERE id = p_report_id;

  ELSIF p_outcome = 'skipped' THEN
    v_new_status := 'in_pruefung';
    v_reason := 'vision_skipped';
    UPDATE public.reports
    SET status = v_new_status,
        vision_skipped = TRUE,
        decision_reason = v_reason,
        -- Kein automatisch entschiedener Fall: es wird gerade NICHT
        -- entschieden, sondern an einen Menschen uebergeben.
        decision_automated = FALSE,
        decided_at = NOW()
    WHERE id = p_report_id;

    INSERT INTO public.review_queue (report_id, reason)
    VALUES (p_report_id, 'unklassifiziert')
    ON CONFLICT (report_id, reason) WHERE status = 'offen' DO NOTHING;

  ELSIF p_outcome = 'low_confidence' THEN
    v_new_status := 'in_pruefung';
    v_reason := 'low_confidence';
    UPDATE public.reports
    SET status = v_new_status,
        waste_type = p_waste_type,
        ai_confidence = p_confidence,
        decision_reason = v_reason,
        decision_automated = FALSE,
        decided_at = NOW()
    WHERE id = p_report_id;

    INSERT INTO public.review_queue (report_id, reason)
    VALUES (p_report_id, 'confidence')
    ON CONFLICT (report_id, reason) WHERE status = 'offen' DO NOTHING;

  ELSIF p_outcome = 'private_context' THEN
    -- Privatgrund-/Wohnkontext-Verdacht: NIE automatisch veroeffentlichen.
    v_new_status := 'in_pruefung';
    v_reason := 'private_context';
    UPDATE public.reports
    SET status = v_new_status,
        waste_type = p_waste_type,
        ai_confidence = p_confidence,
        decision_reason = v_reason,
        decision_automated = FALSE,
        decided_at = NOW()
    WHERE id = p_report_id;

    INSERT INTO public.review_queue (report_id, reason)
    VALUES (p_report_id, 'privatgrund')
    ON CONFLICT (report_id, reason) WHERE status = 'offen' DO NOTHING;

  ELSIF p_outcome = 'ok' THEN
    v_new_status := CASE WHEN v_suspect THEN 'in_pruefung' ELSE 'veroeffentlicht' END;
    v_reason := CASE WHEN v_suspect THEN 'location_suspect' ELSE 'published' END;
    UPDATE public.reports
    SET status = v_new_status,
        waste_type = p_waste_type,
        ai_confidence = p_confidence,
        verification = 'ki_verifiziert',
        decision_reason = v_reason,
        decision_automated = NOT v_suspect,
        decided_at = NOW()
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

  RETURN jsonb_build_object('ok', true, 'status', v_new_status, 'award', v_award,
                            'decision_reason', v_reason);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_vision_result(UUID, TEXT, TEXT, DOUBLE PRECISION)
  FROM PUBLIC, anon, authenticated;

-- ----------------------
-- 3. moderate_report schreibt die Begruendung ebenfalls mit — und setzt
--    decision_automated ausdruecklich auf FALSE. Damit sieht die Nutzerin
--    korrekt "ein Mensch hat entschieden", auch wenn vorher eine KI
--    beteiligt war.
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
  v_reason TEXT;
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

  v_reason := CASE p_decision
    WHEN 'freigeben' THEN 'moderator_approved'
    WHEN 'ablehnen'  THEN 'moderator_rejected'
    WHEN 'privat'    THEN 'moderator_private'
  END;

  UPDATE public.reports
  SET status = v_new_status,
      verification = CASE WHEN p_decision IN ('freigeben', 'privat')
                          THEN 'moderator_verifiziert'::public.verification_level
                          ELSE verification END,
      decision_reason = v_reason,
      decision_automated = FALSE,
      decided_at = NOW()
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

  RETURN jsonb_build_object('ok', true, 'status', v_new_status, 'award', v_award,
                            'decision_reason', v_reason);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.moderate_report(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.moderate_report(UUID, TEXT) TO authenticated;

-- ----------------------
-- 4. Einwilligungsnachweis: echte Fassungsnummer statt Platzhalter.
--    Aendert NUR den Default fuer kuenftige Zeilen; die Tabelle ist
--    append-only, bestehende Zeilen bleiben unveraendert (und dokumentieren
--    damit ehrlich, dass die Fassung damals nicht gepflegt war).
-- ----------------------
ALTER TABLE public.consents
  ALTER COLUMN policy_version SET DEFAULT '2026-09-23-v1';
