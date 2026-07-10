-- ============================================================
-- CLAR — Migration 013: Betroffenenrechte / Consent (Paket 11)
-- Additiv: nachweisbare, granulare Einwilligungen (append-only).
--
-- WICHTIG: Das ist DSGVO-MECHANIK, keine Rechtsberatung. Alle Texte,
-- Rechtsgrundlagen und Alterslogik: TODO JURISTISCH PRUEFEN.
-- ============================================================

-- ----------------------
-- 1. consents — append-only Einwilligungs-Journal ("nachweisbar"):
--    Jede Aenderung ist eine NEUE Zeile (granted TRUE/FALSE), nichts wird
--    ueberschrieben oder geloescht -> vollstaendige Historie mit Zeitpunkt.
--    Loeschung des Accounts entfernt die Historie mit (CASCADE) —
--    TODO JURISTISCH PRUEFEN: ob eine anonymisierte Nachweiskopie noetig ist.
-- ----------------------
CREATE TABLE IF NOT EXISTS public.consents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_key TEXT NOT NULL CHECK (
    consent_key IN ('kamera', 'standort', 'behoerden_weitergabe')
  ),
  granted BOOLEAN NOT NULL,
  -- Version der Erklaerung, der zugestimmt wurde (Nachweisbarkeit).
  policy_version TEXT NOT NULL DEFAULT 'PLATZHALTER-JURISTISCH-PRUEFEN-v0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS consents_user_key_idx
  ON public.consents (user_id, consent_key, created_at DESC);

ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

-- Nutzer sehen nur die eigene Historie.
CREATE POLICY "consents_select_own"
  ON public.consents FOR SELECT
  USING (auth.uid() = user_id);

-- Schreiben nur ueber die RPC (kein direkter INSERT der Client-Rollen).
REVOKE INSERT, UPDATE, DELETE ON public.consents FROM anon, authenticated;

-- Append-only auch gegen die Service-Role (wie points_ledger).
CREATE OR REPLACE FUNCTION public.consents_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'consents ist append-only: % nicht erlaubt', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS consents_no_update_delete ON public.consents;
CREATE TRIGGER consents_no_update_delete
  BEFORE UPDATE OR DELETE ON public.consents
  FOR EACH ROW EXECUTE FUNCTION public.consents_block_mutation();

-- ----------------------
-- 2. record_consent — einziger Schreibpfad (auth-Pflicht, eigener Account).
-- ----------------------
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
  IF p_consent_key NOT IN ('kamera', 'standort', 'behoerden_weitergabe') THEN
    RAISE EXCEPTION 'Unbekannter Consent-Schluessel';
  END IF;
  INSERT INTO public.consents (user_id, consent_key, granted)
  VALUES (auth.uid(), p_consent_key, COALESCE(p_granted, FALSE));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_consent(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.record_consent(TEXT, BOOLEAN) TO authenticated;

-- ----------------------
-- 3. Aktueller Stand je Schluessel (letzte Zeile gewinnt).
--    security_invoker: jeder sieht nur sich selbst (RLS der Tabelle).
-- ----------------------
CREATE OR REPLACE VIEW public.current_consents
WITH (security_invoker = true) AS
SELECT DISTINCT ON (user_id, consent_key)
  user_id, consent_key, granted, policy_version, created_at
FROM public.consents
ORDER BY user_id, consent_key, created_at DESC;

GRANT SELECT ON public.current_consents TO authenticated;
