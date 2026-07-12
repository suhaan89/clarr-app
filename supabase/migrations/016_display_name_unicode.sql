-- ============================================================
-- CLAR — Migration 016: Pseudonym-Check server-/clientseitig angleichen
--
-- set_leaderboard_prefs (011_client_support.sql) prueft das Pseudonym
-- gegen '^[[:alnum:] _\-\.]{2,24}$' — je nach DB-Locale ASCII-only.
-- src/lib/validation.ts::isValidDisplayName erlaubt dagegen bewusst
-- Unicode-Buchstaben (\p{L}), z. B. "Müll-Jäger" (siehe
-- validation.test.ts). Bei einer ASCII-only-Locale ging ein Name mit
-- Umlaut clientseitig durch, wurde aber vom RPC mit "Ungueltiges
-- Pseudonym" abgelehnt.
--
-- Postgres-Regex kennt kein \p{L}; wir erweitern die Zeichenklasse daher
-- explizit um Latin-1-Supplement + Latin-Extended-A (deckt deutsche/
-- europaeische Namen ab) statt uns auf locale-abhaengige
-- [[:alnum:]]-Klassifizierung zu verlassen.
-- ============================================================

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
  -- Latin-Unicode-Bereich statt ASCII-only, siehe Kommentar oben.
  IF p_display_name IS NOT NULL
     AND p_display_name !~ '^[a-zA-Z0-9À-ÖØ-öø-ſ _\-\.]{2,24}$' THEN
    RAISE EXCEPTION 'Ungueltiges Pseudonym';
  END IF;
  UPDATE public.user_profiles
  SET leaderboard_opt_in = COALESCE(p_opt_in, FALSE),
      display_name = COALESCE(NULLIF(TRIM(p_display_name), ''), display_name)
  WHERE id = auth.uid();
END;
$$;
