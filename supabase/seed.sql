-- ============================================================
-- CLAR — Seed fuer LOKALE Entwicklung / Staging (Paket 12)
-- Rein SYNTHETISCHE Daten (example.com, Test-UUIDs) — niemals in prod.
-- Wird von `supabase start` / `supabase db reset` automatisch eingespielt.
-- (Echte Cold-Start-Inhalte: scripts/seed-admin.mjs, Paket 10.)
-- ============================================================

-- Synthetische Nutzer. Passwort-Login ist damit NICHT moeglich
-- (kein encrypted_password) — fuer RLS-/Funktions-Tests reicht die ID.
INSERT INTO auth.users (id, email, email_confirmed_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'dev-melderin@example.com', NOW()),
  ('10000000-0000-0000-0000-000000000002', 'dev-melder2@example.com',  NOW()),
  ('10000000-0000-0000-0000-000000000003', 'dev-partner@example.com',  NOW())
ON CONFLICT (id) DO NOTHING;

-- Profile: Level 'aktiv' (Regeln akzeptiert), Partner-Rolle fuer Tests.
UPDATE public.user_profiles
SET verification_level = 'aktiv', rules_accepted_at = NOW()
WHERE id IN ('10000000-0000-0000-0000-000000000001',
             '10000000-0000-0000-0000-000000000002',
             '10000000-0000-0000-0000-000000000003');

UPDATE public.user_profiles
SET role = 'partner'
WHERE id = '10000000-0000-0000-0000-000000000003';

-- Ein offener Fall mit veroeffentlichter Meldung (Karten-Test) ...
INSERT INTO public.cases (id, title, status, location_lat, location_lng, geohash8)
VALUES ('20000000-0000-0000-0000-000000000001', 'Muellfund Parkweg (SEED)',
        'geprueft', 51.3397, 12.3731, public.geohash_encode(51.3397, 12.3731, 8))
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.reports
  (id, user_id, description, latitude, longitude, status, verification,
   case_id, geohash8, is_seed, points_eligible)
VALUES
  ('30000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   'Sperrmuell am Parkweg (synthetischer Seed)',
   51.3397, 12.3731, 'veroeffentlicht', 'ki_verifiziert',
   '20000000-0000-0000-0000-000000000001',
   public.geohash_encode(51.3397, 12.3731, 8), TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- ... und ein erledigter Fall (gruener Marker).
INSERT INTO public.cases (id, title, status, location_lat, location_lng, geohash8)
VALUES ('20000000-0000-0000-0000-000000000002', 'Aufgeraeumt: Kanalufer (SEED)',
        'gemeldet', 51.3450, 12.3800, public.geohash_encode(51.3450, 12.3800, 8))
ON CONFLICT (id) DO NOTHING;
-- Statusmaschine erlaubt keine Spruenge -> Schrittfolge.
UPDATE public.cases SET status = 'geprueft'
  WHERE id = '20000000-0000-0000-0000-000000000002' AND status = 'gemeldet';
UPDATE public.cases SET status = 'erledigt'
  WHERE id = '20000000-0000-0000-0000-000000000002' AND status = 'geprueft';

INSERT INTO public.reports
  (id, user_id, description, latitude, longitude, status, verification,
   case_id, geohash8, is_seed, points_eligible)
VALUES
  ('30000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000002',
   'Kanalufer, bereits aufgeraeumt (synthetischer Seed)',
   51.3450, 12.3800, 'veroeffentlicht', 'ki_verifiziert',
   '20000000-0000-0000-0000-000000000002',
   public.geohash_encode(51.3450, 12.3800, 8), TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Ein Event vom Partner (Events-Tab).
INSERT INTO public.cleanup_events
  (id, title, description, location_lat, location_lng, event_date,
   max_participants, created_by, status, is_seed)
VALUES
  ('40000000-0000-0000-0000-000000000001',
   'Cleanup Stadtpark (SEED)', 'Synthetischer Termin fuer die Entwicklung.',
   51.3400, 12.3700, NOW() + INTERVAL '14 days',
   20, '10000000-0000-0000-0000-000000000003', 'approved', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Punkte-Historie fuer das Impact-Profil (idempotent per booking_key).
SELECT public.award_points('10000000-0000-0000-0000-000000000001',
  'report_verified', 'seed:report:30000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', NULL);
