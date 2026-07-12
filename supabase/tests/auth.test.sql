-- ============================================================
-- CLAR — Tests Auth-Logik (Paket 12)
-- Ausfuehren mit lokaler DB:  supabase test db
-- (pgTAP; laeuft in einer Transaktion und wird zurueckgerollt)
-- ============================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(11);

-- ---------- Setup: Testnutzer (Trigger legt user_profiles-Zeile an) ----------
INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-0000-0000-0000000000a1', 'test-auth@example.com');

-- ============================================================
-- 1. user_profiles ist fuer Client-Rollen read-only
-- ============================================================
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.user_profiles', 'INSERT'),
  'authenticated hat kein INSERT auf user_profiles'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.user_profiles', 'UPDATE'),
  'authenticated hat kein UPDATE auf user_profiles (reputation/role/credits geschuetzt)'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.user_profiles', 'UPDATE'),
  'anon hat kein UPDATE auf user_profiles'
);

-- ============================================================
-- 2. Verifikations-Level: Start 'neu'; Mail-Trigger stuft hoch
-- ============================================================
SELECT is(
  (SELECT verification_level::TEXT FROM public.user_profiles
   WHERE id = '00000000-0000-0000-0000-0000000000a1'),
  'neu',
  'Neuer Nutzer startet mit verification_level = neu'
);

UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE id = '00000000-0000-0000-0000-0000000000a1';

SELECT is(
  (SELECT verification_level::TEXT FROM public.user_profiles
   WHERE id = '00000000-0000-0000-0000-0000000000a1'),
  'mail_verifiziert',
  'E-Mail-Bestaetigung stuft auf mail_verifiziert hoch'
);

-- ============================================================
-- 3. reputation_score: Start 100, nur serverseitig, Grenzen 0..1000
-- ============================================================
SELECT is(
  (SELECT reputation_score FROM public.user_profiles
   WHERE id = '00000000-0000-0000-0000-0000000000a1'),
  100,
  'reputation_score startet bei 100'
);
SELECT ok(
  NOT has_function_privilege('authenticated',
    'public.adjust_reputation(uuid, int, text)', 'EXECUTE'),
  'authenticated darf adjust_reputation nicht ausfuehren'
);

SELECT lives_ok(
  $$SELECT public.adjust_reputation('00000000-0000-0000-0000-0000000000a1', -9999, 'test')$$,
  'Serverseitiger Abzug funktioniert'
);
SELECT is(
  (SELECT reputation_score FROM public.user_profiles
   WHERE id = '00000000-0000-0000-0000-0000000000a1'),
  0,
  'reputation_score wird bei 0 gedeckelt (nie negativ)'
);

-- ============================================================
-- 4. Einwilligungen (Paket 11): append-only
-- ============================================================
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.consents', 'INSERT'),
  'authenticated schreibt Consents nur ueber record_consent'
);
INSERT INTO public.consents (user_id, consent_key, granted)
VALUES ('00000000-0000-0000-0000-0000000000a1', 'kamera', TRUE);
SELECT throws_ok(
  $$UPDATE public.consents SET granted = FALSE
    WHERE user_id = '00000000-0000-0000-0000-0000000000a1'$$,
  NULL,
  NULL,
  'UPDATE auf consents wird vom Trigger blockiert (nachweisbare Historie)'
);

SELECT * FROM finish();
ROLLBACK;
