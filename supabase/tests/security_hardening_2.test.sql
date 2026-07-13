-- ============================================================
-- CLAR — Regressionstest Migration 017 (Security-Haertung Runde 2)
-- Ausfuehren mit lokaler DB:  supabase test db
-- (pgTAP; laeuft in einer Transaktion und wird zurueckgerollt)
--
-- Stellt sicher, dass die in 017 zurueckgezogenen EXECUTE-Rechte auch nach
-- kuenftigen Migrationen zurueckgezogen BLEIBEN (Regression: ein spaeteres
-- `GRANT EXECUTE ON ALL FUNCTIONS ...` wuerde sie sonst stillschweigend
-- wieder freischalten).
-- ============================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(14);

-- ============================================================
-- 1. increment_user_credits: fachlich tot seit points_ledger (Migration 007),
--    darf von keiner Client-Rolle mehr ausfuehrbar sein.
-- ============================================================
SELECT ok(
  NOT has_function_privilege('anon',
    'public.increment_user_credits(uuid, int)', 'EXECUTE'),
  'anon darf increment_user_credits nicht ausfuehren'
);
SELECT ok(
  NOT has_function_privilege('authenticated',
    'public.increment_user_credits(uuid, int)', 'EXECUTE'),
  'authenticated darf increment_user_credits nicht ausfuehren'
);
SELECT ok(
  NOT has_function_privilege('public',
    'public.increment_user_credits(uuid, int)', 'EXECUTE'),
  'PUBLIC darf increment_user_credits nicht ausfuehren'
);

-- ============================================================
-- 2. check_and_increment_daily_reports: ersetzt durch consume_report_quota
--    (server-only, Migration 004); darf keiner Client-Rolle mehr offenstehen.
-- ============================================================
SELECT ok(
  NOT has_function_privilege('anon',
    'public.check_and_increment_daily_reports(uuid)', 'EXECUTE'),
  'anon darf check_and_increment_daily_reports nicht ausfuehren'
);
SELECT ok(
  NOT has_function_privilege('authenticated',
    'public.check_and_increment_daily_reports(uuid)', 'EXECUTE'),
  'authenticated darf check_and_increment_daily_reports nicht ausfuehren'
);
SELECT ok(
  NOT has_function_privilege('public',
    'public.check_and_increment_daily_reports(uuid)', 'EXECUTE'),
  'PUBLIC darf check_and_increment_daily_reports nicht ausfuehren'
);

-- ============================================================
-- 3. Trigger-Funktionen: kein direkter RPC-Aufruf durch Client-Rollen.
-- ============================================================
SELECT ok(
  NOT has_function_privilege('authenticated',
    'public.handle_new_user()', 'EXECUTE'),
  'authenticated darf handle_new_user nicht direkt ausfuehren'
);
SELECT ok(
  NOT has_function_privilege('authenticated',
    'public.handle_email_confirmed()', 'EXECUTE'),
  'authenticated darf handle_email_confirmed nicht direkt ausfuehren'
);
SELECT ok(
  NOT has_function_privilege('authenticated',
    'public.handle_flag_inserted()', 'EXECUTE'),
  'authenticated darf handle_flag_inserted nicht direkt ausfuehren'
);
SELECT ok(
  NOT has_function_privilege('authenticated',
    'public.enforce_flag_budget()', 'EXECUTE'),
  'authenticated darf enforce_flag_budget nicht direkt ausfuehren'
);
SELECT ok(
  NOT has_function_privilege('authenticated',
    'public.enforce_photo_path_owner()', 'EXECUTE'),
  'authenticated darf enforce_photo_path_owner nicht direkt ausfuehren'
);
SELECT ok(
  NOT has_function_privilege('authenticated',
    'public.enforce_event_capacity()', 'EXECUTE'),
  'authenticated darf enforce_event_capacity nicht direkt ausfuehren'
);

-- ============================================================
-- 4. search_path-Haertung: SECURITY-DEFINER-Funktionen aus Migration 001
--    muessen ein festes search_path tragen (Schutz vor Hijacking).
-- ============================================================
SELECT ok(
  (SELECT proconfig::TEXT LIKE '%search_path=public%'
   FROM pg_proc
   WHERE oid = 'public.increment_user_credits(uuid, int)'::regprocedure),
  'increment_user_credits hat search_path=public gesetzt'
);
SELECT ok(
  (SELECT proconfig::TEXT LIKE '%search_path=public%'
   FROM pg_proc
   WHERE oid = 'public.check_and_increment_daily_reports(uuid)'::regprocedure),
  'check_and_increment_daily_reports hat search_path=public gesetzt'
);

SELECT * FROM finish();
ROLLBACK;
