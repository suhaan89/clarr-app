-- ============================================================
-- CLAR — Migration 009: Behoerden-Digest + Ruecklauf-Token (Paket 7)
-- Additiv: Token-Tabelle, Digest-Log, Settings.
--
-- Ablauf:
--   * Woechentlich sammelt die Edge Function authority-digest alle Faelle
--     im Status 'geprueft', erzeugt pro Fall ein einmaliges, signiertes
--     Ruecklauf-Token (nur der SHA-256-Hash wird gespeichert) und mailt
--     Kartenlink + GEBLURRTES Foto (nie Originale) an die Behoerde.
--     Danach werden die Faelle auf 'weitergeleitet' gesetzt (Statusmaschine).
--   * Die Behoerde klickt den "erledigt"-Link -> confirm-case-done loest
--     das Token GENAU EINMAL ein (atomares bedingtes UPDATE) und setzt den
--     Fall auf 'erledigt'.
--   * Es gehen KEINE personenbezogenen Daten der Melder raus: nur Fallort,
--     Titel, geblurrtes Foto.
-- ============================================================

-- ----------------------
-- 1. Settings (aenderbar ohne Deploy). Leerer Empfaenger = Digest AUS.
-- ----------------------
INSERT INTO public.system_settings (key, value) VALUES
  ('authority_digest_email', ''),
  ('authority_token_ttl_days', '30')
ON CONFLICT (key) DO NOTHING;

-- ----------------------
-- 2. Ruecklauf-Tokens. Es wird NUR der Hash gespeichert — ein DB-Leak
--    verraet keine gueltigen Links. Einmaligkeit erzwingt
--    use_case_confirm_token() per bedingtem UPDATE (race-sicher).
-- ----------------------
CREATE TABLE IF NOT EXISTS public.case_confirm_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS case_confirm_tokens_case_idx
  ON public.case_confirm_tokens (case_id);

ALTER TABLE public.case_confirm_tokens ENABLE ROW LEVEL SECURITY;
-- KEINE Policies: nur Service-Role.
REVOKE ALL ON public.case_confirm_tokens FROM anon, authenticated;

-- ----------------------
-- 3. Digest-Log (Nachweis, was wann an wen rausging; keine Tokens im Log).
-- ----------------------
CREATE TABLE IF NOT EXISTS public.authority_digests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient TEXT NOT NULL,
  case_ids UUID[] NOT NULL,
  delivery TEXT NOT NULL CHECK (delivery IN ('resend', 'logged')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.authority_digests ENABLE ROW LEVEL SECURITY;
-- KEINE Policies: nur Service-Role.
REVOKE ALL ON public.authority_digests FROM anon, authenticated;

-- ----------------------
-- 4. Einmal-Einloesung: bedingtes UPDATE = atomar, kein Doppel-Einloesen
--    bei parallelen Klicks. Liefert die case_id oder NULL.
-- ----------------------
CREATE OR REPLACE FUNCTION public.use_case_confirm_token(p_token_hash TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_id UUID;
BEGIN
  UPDATE public.case_confirm_tokens
  SET used_at = NOW()
  WHERE token_hash = p_token_hash
    AND used_at IS NULL
    AND expires_at > NOW()
  RETURNING case_id INTO v_case_id;

  RETURN v_case_id; -- NULL = unbekannt, abgelaufen oder schon benutzt
END;
$$;

REVOKE EXECUTE ON FUNCTION public.use_case_confirm_token(TEXT)
  FROM PUBLIC, anon, authenticated;
