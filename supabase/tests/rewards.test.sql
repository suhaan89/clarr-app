-- ============================================================
-- CLAR — Tests Reward-Engine (Paket 6)
-- Ausfuehren mit lokaler DB:  supabase test db
-- (pgTAP; laeuft in einer Transaktion und wird zurueckgerollt)
-- ============================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(12);

-- ---------- Setup: Testnutzer (Trigger legt user_profiles-Zeile an) ----------
INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'test-rewards@example.com');

-- ============================================================
-- 1. "Client kann nicht buchen"
-- ============================================================
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.points_ledger', 'INSERT'),
  'authenticated hat kein INSERT auf points_ledger'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.points_ledger', 'INSERT'),
  'anon hat kein INSERT auf points_ledger'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.points_ledger', 'UPDATE'),
  'authenticated hat kein UPDATE auf points_ledger'
);
SELECT ok(
  NOT has_function_privilege('authenticated',
    'public.award_points(uuid, text, text, uuid, uuid)', 'EXECUTE'),
  'authenticated darf award_points nicht ausfuehren'
);
SELECT ok(
  NOT has_function_privilege('anon',
    'public.award_points(uuid, text, text, uuid, uuid)', 'EXECUTE'),
  'anon darf award_points nicht ausfuehren'
);

-- Append-only: auch privilegierte Rollen koennen nicht aendern/loeschen
SELECT lives_ok(
  $$SELECT public.award_points('00000000-0000-0000-0000-000000000001',
      'report_verified', 'test:appendonly')$$,
  'Service-seitige Buchung funktioniert'
);
SELECT throws_ok(
  $$UPDATE public.points_ledger SET delta = 999 WHERE booking_key = 'test:appendonly'$$,
  NULL,
  NULL,
  'UPDATE auf points_ledger wird vom Trigger blockiert'
);
SELECT throws_ok(
  $$DELETE FROM public.points_ledger WHERE booking_key = 'test:appendonly'$$,
  NULL,
  NULL,
  'DELETE auf points_ledger wird vom Trigger blockiert'
);

-- ============================================================
-- 2. Idempotenz: derselbe booking_key bucht nie doppelt
-- ============================================================
SELECT is(
  (public.award_points('00000000-0000-0000-0000-000000000001',
     'report_verified', 'test:idempotent') ->> 'awarded')::INT,
  10,
  'Erste Buchung vergibt 10 Punkte'
);
SELECT is(
  (public.award_points('00000000-0000-0000-0000-000000000001',
     'report_verified', 'test:idempotent') ->> 'awarded')::INT,
  0,
  'Zweite Buchung mit gleichem booking_key vergibt 0 Punkte'
);
SELECT is(
  (SELECT COUNT(*)::INT FROM public.points_ledger
   WHERE booking_key = 'test:idempotent'),
  1,
  'Genau EIN Ledger-Eintrag pro booking_key'
);

-- ============================================================
-- 3. Tagesdeckel: positive Buchungen pro Tag gedeckelt (Default 50)
--    Bisher gebucht: 10 (appendonly) + 10 (idempotent) = 20.
--    Drei weitere Meldungen a 10 -> 50 erreicht; die naechste bringt 0.
-- ============================================================
SELECT public.award_points('00000000-0000-0000-0000-000000000001',
  'report_verified', 'test:cap1');
SELECT public.award_points('00000000-0000-0000-0000-000000000001',
  'report_verified', 'test:cap2');
SELECT public.award_points('00000000-0000-0000-0000-000000000001',
  'report_verified', 'test:cap3');

SELECT is(
  (SELECT COALESCE(SUM(delta), 0)::INT FROM public.points_ledger
   WHERE user_id = '00000000-0000-0000-0000-000000000001'
     AND delta > 0
     AND created_at >= date_trunc('day', NOW())),
  50,
  'Tagessumme steht bei 50 (Deckel)'
);

SELECT is(
  (public.award_points('00000000-0000-0000-0000-000000000001',
     'report_verified', 'test:cap4') ->> 'awarded')::INT,
  0,
  'Buchung ueber dem Tagesdeckel vergibt 0 Punkte'
);

SELECT * FROM finish();
ROLLBACK;
