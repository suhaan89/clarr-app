-- ============================================================
-- CLAR — Migration 017: Security-Haertung Runde 2
-- Befunde aus dem zweiten Sicherheits-/Datenschutz-Durchlauf
-- (docs/security-review.md, Runde 2). Additiv, nicht funktionsbrechend.
-- ============================================================

-- ----------------------
-- 1. PRIVILEGE ESCALATION / INTEGRITAET (HIGH):
--    increment_user_credits(p_user_id, p_amount) aus Migration 001 ist
--    SECURITY DEFINER und wurde nie revoked -> per Postgres-Default
--    EXECUTE fuer PUBLIC (anon + authenticated). Jeder Client kann damit
--    `rpc('increment_user_credits', { p_user_id, p_amount })` aufrufen und
--    BELIEBIGEM Nutzer beliebige Credits gutschreiben (der anon-Key liegt
--    im Client-Bundle -> sogar ohne Login). Die Funktion ist seit dem
--    points_ledger (Migration 007) fachlich tot; Zugriff wird entzogen.
-- ----------------------
REVOKE EXECUTE ON FUNCTION public.increment_user_credits(UUID, INT)
  FROM PUBLIC, anon, authenticated;

-- ----------------------
-- 2. INTEGRITAET / DoS (MEDIUM):
--    check_and_increment_daily_reports(p_user_id) aus Migration 001 ist
--    SECURITY DEFINER, nimmt eine FREMDE user_id entgegen und war ebenfalls
--    PUBLIC. Ein Angreifer konnte damit den Tageszaehler eines beliebigen
--    Kontos hochtreiben und das Ziel vom Melden aussperren. Fachlich ersetzt
--    durch consume_report_quota (Migration 004, server-only). Zugriff weg.
-- ----------------------
REVOKE EXECUTE ON FUNCTION public.check_and_increment_daily_reports(UUID)
  FROM PUBLIC, anon, authenticated;

-- ----------------------
-- 3. SEARCH_PATH-HAERTUNG (LOW, defense-in-depth):
--    SECURITY-DEFINER-Funktionen ohne festes search_path koennen — sofern
--    ein Rollen-Recht zum Anlegen von Objekten existiert — ueber
--    search_path-Hijacking angreifbar sein. Die 001-Funktionen wurden ohne
--    `SET search_path` angelegt; wir setzen es nach (idempotent, aendert
--    kein Verhalten, da die Rumpf-Statements bereits `public.` qualifizieren).
-- ----------------------
ALTER FUNCTION public.handle_new_user()                       SET search_path = public;
ALTER FUNCTION public.check_and_increment_daily_reports(UUID)  SET search_path = public;
ALTER FUNCTION public.increment_user_credits(UUID, INT)        SET search_path = public;

-- Sicherheits-Trigger laufen als SECURITY INVOKER (keine Rechteerhoehung),
-- bekommen aber der Vollstaendigkeit halber ebenfalls ein festes search_path
-- (Postgres-Linter `function_search_path_mutable`).
ALTER FUNCTION public.enforce_flag_budget()      SET search_path = public;
ALTER FUNCTION public.enforce_photo_path_owner() SET search_path = public;
ALTER FUNCTION public.enforce_event_capacity()   SET search_path = public;

-- ----------------------
-- 4. Trigger-Funktionen sollen nicht direkt aufrufbar sein (Aufraeumen).
--    PostgREST exponiert trigger-rueckgebende Funktionen ohnehin nicht als
--    RPC, aber der EXECUTE-Grant auf PUBLIC ist unnoetig — Defense-in-depth.
-- ----------------------
REVOKE EXECUTE ON FUNCTION public.handle_new_user()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_email_confirmed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_flag_inserted()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_flag_budget()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_photo_path_owner() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_event_capacity()   FROM PUBLIC, anon, authenticated;
