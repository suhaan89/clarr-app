-- ============================================================
-- CLAR — Migration 021: Alters-/Einwilligungsabfrage (Art. 8 DSGVO)
-- (docs/verbesserungs-prompt.md Paket C.16)
--
-- WICHTIG: Das ist DSGVO-MECHANIK, keine Rechtsberatung. Altersgrenze,
-- genauer Text und Ausgestaltung der elterlichen Einwilligung bleiben
-- TODO JURISTISCH PRUEFEN (wie schon in Migration 013 vermerkt). Diese
-- Migration ergaenzt nur einen neuen, technisch funktionsfaehigen
-- consent_key, damit die Selbstauskunft "16 Jahre oder aelter" bei der
-- Registrierung nachweisbar gespeichert werden kann — bewusst KEIN
-- Geburtsdatum (Datenminimierung, siehe docs/auth.md).
-- ============================================================

ALTER TABLE public.consents DROP CONSTRAINT IF EXISTS consents_consent_key_check;
ALTER TABLE public.consents ADD CONSTRAINT consents_consent_key_check CHECK (
  consent_key IN ('kamera', 'standort', 'behoerden_weitergabe', 'altersbestaetigung')
);

CREATE OR REPLACE FUNCTION public.record_consent(
  p_consent_key TEXT,
  p_granted     BOOLEAN
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
  IF p_consent_key NOT IN ('kamera', 'standort', 'behoerden_weitergabe', 'altersbestaetigung') THEN
    RAISE EXCEPTION 'Unbekannter Consent-Schluessel';
  END IF;
  INSERT INTO public.consents (user_id, consent_key, granted)
  VALUES (auth.uid(), p_consent_key, COALESCE(p_granted, FALSE));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_consent(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.record_consent(TEXT, BOOLEAN) TO authenticated;
