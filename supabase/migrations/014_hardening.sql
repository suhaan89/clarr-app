-- ============================================================
-- CLAR — Migration 014: Security-Haertung (Paket 13)
-- Befunde aus dem RLS-/Abuse-Audit (docs/security-review.md).
-- ============================================================

-- ----------------------
-- 1. Flag-Spam-Bremse: Fail-safe-Flagging (Paket 8) macht Meldungen sofort
--    unsichtbar — ohne Limit koennte EIN Konto die ganze Karte leeren
--    (Harassment-/DoS-Vektor). Budget: 10 Flags pro Nutzer und Tag
--    (system_settings.flag_daily_limit, ohne Deploy aenderbar).
-- ----------------------
INSERT INTO public.system_settings (key, value) VALUES
  ('flag_daily_limit', '10')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_flag_budget()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_limit INT := COALESCE((SELECT (value)::INT FROM public.system_settings
                           WHERE key = 'flag_daily_limit'), 10);
  v_used INT;
BEGIN
  SELECT COUNT(*) INTO v_used
  FROM public.moderation_flags
  WHERE user_id = NEW.user_id
    AND created_at >= date_trunc('day', NOW());
  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'Flag-Tageslimit erreicht'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS moderation_flags_budget ON public.moderation_flags;
CREATE TRIGGER moderation_flags_budget
  BEFORE INSERT ON public.moderation_flags
  FOR EACH ROW EXECUTE FUNCTION public.enforce_flag_budget();

-- ----------------------
-- 2. Teilnehmerlisten sind nicht oeffentlich: signups_select_all zeigte
--    JEDEM Angemeldeten, WER (user_id) bei welchem Event mitmacht —
--    heikel bei teils minderjaehriger Zielgruppe. Ersetzt durch
--    "nur eigene Anmeldungen"; Zaehler kommt aus einer aggregierten View
--    (Owner-Rechte, gibt keine user_ids preis).
--    Dokumentierte Policy-Ausnahme Nr. 3 (siehe NOTIZEN.md Paket 13).
-- ----------------------
DROP POLICY IF EXISTS "signups_select_all" ON public.cleanup_signups;

CREATE POLICY "signups_select_own"
  ON public.cleanup_signups FOR SELECT
  USING (auth.uid() = user_id);

CREATE OR REPLACE VIEW public.event_signup_counts AS
SELECT event_id, COUNT(*)::INT AS signup_count
FROM public.cleanup_signups
GROUP BY event_id;

GRANT SELECT ON public.event_signup_counts TO authenticated;
REVOKE SELECT ON public.event_signup_counts FROM anon;

-- ----------------------
-- 3. Legacy-Bucket report-photos (aus 001, oeffentlich + beschreibbar):
--    neuer Code schreibt NUR originals/public-blurred. Schreibweg wird
--    geschlossen (Policy-Ausnahme Nr. 4); vorhandene Alt-Objekte muss der
--    Betreiber manuell sichten/migrieren (docs/security-review.md).
-- ----------------------
DROP POLICY IF EXISTS "report_photos_insert_authenticated" ON storage.objects;

-- ----------------------
-- 4. report_photos: Clients koennen Zeilen nur noch fuer Pfade unterhalb
--    der EIGENEN User-ID anlegen (verhindert Verweise auf fremde
--    Originale). Gilt auch fuer Service-Pfade (close_case_tx nutzt
--    ebenfalls <uid>/-Pfade des Abschliessenden).
-- ----------------------
CREATE OR REPLACE FUNCTION public.enforce_photo_path_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.storage_path !~ ('^' || NEW.user_id::TEXT || '/') THEN
    RAISE EXCEPTION 'storage_path muss unter der eigenen User-ID liegen'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS report_photos_path_owner ON public.report_photos;
CREATE TRIGGER report_photos_path_owner
  BEFORE INSERT ON public.report_photos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_photo_path_owner();

-- ----------------------
-- 5. Aufraeumen wirkungsloser Altlast-Policies auf reports:
--    Die Schreib-Grants sind seit Migration 004 revoked — die Policies
--    aus 001 sind inert, aber verwirrend und wuerden scharf, falls je
--    wieder ein Grant erteilt wird. Defense-in-depth: weg damit.
--    (Policy-Ausnahme Nr. 5 — entfernt nur bereits Wirkungsloses.)
-- ----------------------
DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
DROP POLICY IF EXISTS "reports_update_own" ON public.reports;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
