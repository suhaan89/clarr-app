-- ============================================================
-- CLAR — Migration 003: Auth & Verifikations-Level (Paket 2)
-- Additiv: neuer Enum, neue Spalten auf user_profiles, Trigger, RPCs.
-- Bestehende Spalten (insb. user_profiles.credits) bleiben unveraendert.
--
-- Kernidee:
--   verification_level: neu -> mail_verifiziert -> aktiv
--     * neu:              registriert, E-Mail noch nicht bestaetigt
--     * mail_verifiziert: E-Mail bestaetigt (Trigger auf auth.users)
--     * aktiv:            hat zusaetzlich die Community-Regeln in der App
--                         bestaetigt (RPC activate_account). Erst 'aktiv'
--                         darf wertbare Meldungen einreichen (Paket 3).
--   reputation_score: NUR serverseitig schreibbar (SECURITY DEFINER RPC,
--     kein Client-Grant). Kein Klarname noetig — es gibt weiterhin keine
--     Namens-/Profilfelder.
-- ============================================================

-- ----------------------
-- 1. Enum fuer Nutzer-Verifikation.
--    Name 'user_verification_level', weil 'verification_level' bereits als
--    Enum fuer die REPORT-Verifikation (Migration 002) existiert.
-- ----------------------
DO $$ BEGIN
  CREATE TYPE public.user_verification_level AS ENUM
    ('neu', 'mail_verifiziert', 'aktiv');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------
-- 2. user_profiles — additive Spalten
-- ----------------------
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS verification_level public.user_verification_level
    NOT NULL DEFAULT 'neu',
  ADD COLUMN IF NOT EXISTS reputation_score INT
    NOT NULL DEFAULT 100
    CHECK (reputation_score BETWEEN 0 AND 1000);

-- Backfill: Bestandsnutzer mit bereits bestaetigter E-Mail hochstufen,
-- damit sie nicht erneut verifizieren muessen.
UPDATE public.user_profiles p
SET verification_level = 'mail_verifiziert'
FROM auth.users u
WHERE u.id = p.id
  AND u.email_confirmed_at IS NOT NULL
  AND p.verification_level = 'neu';

-- ----------------------
-- 3. Schreibschutz: user_profiles ist fuer Clients read-only.
--    Der Client liest nur (RewardsScreen: SELECT credits); alle Schreibpfade
--    laufen ueber SECURITY-DEFINER-Funktionen bzw. die Service-Role.
--    Die alte Policy users_update_own_profile bleibt stehen (additiv!),
--    laeuft aber ohne UPDATE-Grant ins Leere.
-- ----------------------
REVOKE INSERT, UPDATE, DELETE ON public.user_profiles FROM anon, authenticated;

-- ----------------------
-- 4. Trigger: E-Mail bestaetigt -> verification_level 'neu' -> 'mail_verifiziert'
--    Haengt an auth.users (Supabase setzt email_confirmed_at beim Bestaetigen).
-- ----------------------
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE public.user_profiles
    SET verification_level = 'mail_verifiziert'
    WHERE id = NEW.id
      AND verification_level = 'neu';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_email_confirmed();

-- ----------------------
-- 5. RPC: activate_account()
--    Der eingeloggte Nutzer bestaetigt die Community-Regeln in der App und
--    wird 'aktiv' — Voraussetzung fuer wertbare Meldungen (Paket 3).
--    Gate: nur moeglich, wenn die E-Mail bereits bestaetigt ist.
--
--    TODO (JURISTISCH PRUEFEN): Alters-/Einwilligungslogik.
--    Zielgruppe ist teils minderjaehrig. Ob und in welcher Form eine
--    Alterspruefung bzw. Einwilligung der Erziehungsberechtigten noetig ist
--    (DSGVO Art. 8: in DE 16 Jahre fuer Einwilligung in Datenverarbeitung),
--    muss juristisch geklaert werden, bevor hier mehr als der Platzhalter
--    gebaut wird. Bis dahin nimmt die RPC ein Flag entgegen und speichert
--    NUR den Zeitpunkt der Regel-Bestaetigung — keine Geburtsdaten o. ae.
-- ----------------------
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS rules_accepted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.activate_account(p_rules_accepted BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_level public.user_verification_level;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet';
  END IF;

  IF p_rules_accepted IS DISTINCT FROM TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rules_not_accepted');
  END IF;

  SELECT verification_level INTO v_level
  FROM public.user_profiles WHERE id = v_user_id;

  IF v_level IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_missing');
  END IF;

  IF v_level = 'neu' THEN
    -- E-Mail-Verifikation ist das Gate: ohne bestaetigte Mail kein 'aktiv'.
    RETURN jsonb_build_object('ok', false, 'error', 'email_not_verified');
  END IF;

  IF v_level = 'mail_verifiziert' THEN
    UPDATE public.user_profiles
    SET verification_level = 'aktiv',
        rules_accepted_at  = COALESCE(rules_accepted_at, NOW())
    WHERE id = v_user_id;

    INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id)
    VALUES (v_user_id, 'account_activated', 'user_profile', v_user_id::TEXT);
  END IF;

  RETURN jsonb_build_object('ok', true, 'verification_level', 'aktiv');
END;
$$;

-- Nur eingeloggte Nutzer duerfen die RPC aufrufen (PUBLIC-Default entziehen).
REVOKE EXECUTE ON FUNCTION public.activate_account(BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.activate_account(BOOLEAN) TO authenticated;

-- ----------------------
-- 6. RPC: adjust_reputation() — NUR serverseitig (Service-Role/Edge Functions).
--    Clients haben keinerlei EXECUTE-Recht. Score wird auf [0, 1000] geklemmt.
-- ----------------------
CREATE OR REPLACE FUNCTION public.adjust_reputation(
  p_user_id UUID,
  p_delta   INT,
  p_reason  TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_score INT;
BEGIN
  UPDATE public.user_profiles
  SET reputation_score = LEAST(1000, GREATEST(0, reputation_score + p_delta))
  WHERE id = p_user_id
  RETURNING reputation_score INTO v_new_score;

  IF v_new_score IS NULL THEN
    RAISE EXCEPTION 'Profil % nicht gefunden', p_user_id;
  END IF;

  INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, details)
  VALUES (NULL, 'reputation_adjusted', 'user_profile', p_user_id::TEXT,
          jsonb_build_object('delta', p_delta, 'reason', p_reason, 'new_score', v_new_score));

  RETURN v_new_score;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.adjust_reputation(UUID, INT, TEXT)
  FROM PUBLIC, anon, authenticated;

-- Hinweis Rate-Limit Registrierung: Das Limit selbst liegt in der Supabase-
-- Auth-Konfiguration (Dashboard bzw. config.toml fuer lokale Entwicklung),
-- nicht in SQL — siehe docs/auth.md. Ebenso "keine E-Mail-Enumeration":
-- Supabase-Setting "Prevent email enumeration" + neutrale Client-Meldungen.
