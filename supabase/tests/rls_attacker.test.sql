-- ============================================================
-- CLAR — RLS-Verhaltenstests: echte Cross-User-Zugriffsversuche
-- (docs/verbesserungs-prompt.md Paket B.14)
-- Ausfuehren mit lokaler DB:  supabase test db
--
-- Bisherige Tests (auth.test.sql, rewards.test.sql, ...) pruefen nur
-- GRANT-Ebene (has_table_privilege/has_function_privilege). Das sagt
-- nichts darueber aus, ob die USING-Klauseln der Policies tatsaechlich
-- fremde Zeilen aussperren. Hier wird per set_config('request.jwt.claims',
-- ...) + SET ROLE authenticated eine echte Session von Nutzer A simuliert,
-- die versucht, auf Daten von Nutzer B zuzugreifen.
-- ============================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(9);

-- ---------- Setup (als Superuser/postgres, vor dem Rollenwechsel) ----------
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'attacker-a@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'victim-b@example.com');

-- Nutzer B: eine UNVEROEFFENTLICHTE Meldung + ein NICHT freigegebenes Foto
-- + einen Punkte-Ledger-Eintrag + ein eigenes Flag.
INSERT INTO public.reports (id, user_id, description, latitude, longitude, status)
VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2',
        'Privater Testfund', 47.6, 9.5, 'gemeldet');

INSERT INTO public.report_photos (id, report_id, user_id, storage_path, approved)
VALUES ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1',
        '00000000-0000-0000-0000-0000000000b2',
        '00000000-0000-0000-0000-0000000000b2/photo.jpg', FALSE);

INSERT INTO public.points_ledger (user_id, delta, reason)
VALUES ('00000000-0000-0000-0000-0000000000b2', 10, 'report_verified');

INSERT INTO public.moderation_flags (user_id, report_id, reason)
VALUES ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1',
        'sonstiges');

-- Eine ZWEITE, VEROEFFENTLICHTE Meldung von B fuer den Fail-Safe-Trigger-Test.
INSERT INTO public.reports (id, user_id, description, latitude, longitude, status)
VALUES ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b2',
        'Oeffentlicher Testfund', 47.6, 9.5, 'veroeffentlicht');

-- ---------- Ab hier: Session von Nutzer A (Angreifer) ----------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

-- ============================================================
-- 1. Unveroeffentlichte Meldung von B ist fuer A unsichtbar.
-- ============================================================
SELECT is(
  (SELECT COUNT(*)::INT FROM public.reports WHERE id = '00000000-0000-0000-0000-0000000000c1'),
  0,
  'A sieht Bs unveroeffentlichte Meldung nicht'
);

-- ============================================================
-- 2. Nicht freigegebenes Foto von B ist fuer A unsichtbar.
-- ============================================================
SELECT is(
  (SELECT COUNT(*)::INT FROM public.report_photos WHERE id = '00000000-0000-0000-0000-0000000000d1'),
  0,
  'A sieht Bs nicht freigegebenes Foto nicht'
);

-- ============================================================
-- 3. points_ledger von B ist fuer A unsichtbar.
-- ============================================================
SELECT is(
  (SELECT COUNT(*)::INT FROM public.points_ledger WHERE user_id = '00000000-0000-0000-0000-0000000000b2'),
  0,
  'A sieht Bs points_ledger nicht'
);

-- ============================================================
-- 4. moderation_flags von B ist fuer A unsichtbar (kein Moderator).
-- ============================================================
SELECT is(
  (SELECT COUNT(*)::INT FROM public.moderation_flags WHERE user_id = '00000000-0000-0000-0000-0000000000b2'),
  0,
  'A sieht Bs moderation_flags nicht'
);

-- ============================================================
-- 5. review_queue ist fuer A (kein Moderator) komplett unsichtbar.
-- ============================================================
SELECT is(
  (SELECT COUNT(*)::INT FROM public.review_queue),
  0,
  'A (kein Moderator) sieht review_queue nicht'
);

-- ============================================================
-- 6. A kann sich NICHT als B ausgeben, um fuer B ein Foto anzulegen
--    (photos_insert_own verlangt auth.uid() = user_id).
-- ============================================================
SELECT throws_ok(
  $$INSERT INTO public.report_photos (report_id, user_id, storage_path)
    VALUES ('00000000-0000-0000-0000-0000000000c2',
            '00000000-0000-0000-0000-0000000000b2',
            '00000000-0000-0000-0000-0000000000b2/fake.jpg')$$,
  NULL, NULL,
  'A kann kein Foto im Namen von B anlegen'
);

-- ============================================================
-- 7. Fail-Safe-Trigger: A flaggt Bs VEROEFFENTLICHTE Meldung (eigenes
--    Flag, erlaubt) -> Meldung wird SOFORT unsichtbar (status -> in_pruefung),
--    unabhaengig davon, dass A nicht der Melder ist.
-- ============================================================
INSERT INTO public.moderation_flags (user_id, report_id, reason)
VALUES ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c2',
        'sonstiges');

RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

SELECT is(
  (SELECT status::TEXT FROM public.reports WHERE id = '00000000-0000-0000-0000-0000000000c2'),
  'in_pruefung',
  'Flag-Insert nimmt die veroeffentlichte Meldung sofort aus der Oeffentlichkeit (Fail-Safe)'
);
SELECT ok(
  EXISTS(SELECT 1 FROM public.review_queue WHERE report_id = '00000000-0000-0000-0000-0000000000c2' AND status = 'offen'),
  'Fail-Safe-Trigger legt einen offenen review_queue-Eintrag an'
);

-- ============================================================
-- 8. Nach dem Fail-Safe ist die Meldung auch fuer A wieder unsichtbar
--    (war kurz vorher noch als 'veroeffentlicht' oeffentlich lesbar).
-- ============================================================
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
SELECT is(
  (SELECT COUNT(*)::INT FROM public.reports WHERE id = '00000000-0000-0000-0000-0000000000c2'),
  0,
  'Nach dem Flag ist die Meldung fuer A (nicht Melder, kein Moderator) wieder unsichtbar'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
