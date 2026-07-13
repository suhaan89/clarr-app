-- ============================================================
-- CLAR — Tests GPS-Praezision (Migration 018)
-- Ausfuehren mit lokaler DB:  supabase test db
-- ============================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(5);

-- ============================================================
-- 1. Encode -> Decode-Zentroid liegt nah am Original (< 1 Bogenminute,
--    d. h. deutlich innerhalb der ~19-38m Geohash8-Zelle).
-- ============================================================
SELECT ok(
  (SELECT abs(latitude - 52.52) < 0.001 AND abs(longitude - 13.405) < 0.001
   FROM public.geohash_decode_centroid(public.geohash_encode(52.52, 13.405, 8))),
  'geohash_decode_centroid liegt nah am Original (Berlin)'
);

-- ============================================================
-- 2. Rundung ist deterministisch (gleicher Input -> gleicher Zentroid).
-- ============================================================
SELECT ok(
  (SELECT (a.latitude, a.longitude) = (b.latitude, b.longitude)
   FROM public.round_to_geohash8(48.1351, 11.5820) a,
        public.round_to_geohash8(48.1351, 11.5820) b),
  'round_to_geohash8 ist deterministisch'
);

-- ============================================================
-- 3. Rundung veraendert die Koordinate tatsaechlich (kein No-Op) —
--    stellt sicher, dass die View wirklich rundet statt durchzureichen.
-- ============================================================
SELECT ok(
  (SELECT latitude <> 52.520008 OR longitude <> 13.404954
   FROM public.round_to_geohash8(52.520008, 13.404954)),
  'round_to_geohash8 rundet die Koordinate (kein reiner Durchreicher)'
);

-- ============================================================
-- 4. reports_map existiert und ist fuer anon/authenticated lesbar
--    (oeffentliche Karte darf nur die gerundete View nutzen).
-- ============================================================
SELECT ok(
  has_table_privilege('anon', 'public.reports_map', 'SELECT'),
  'anon darf reports_map lesen'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.reports_map', 'SELECT'),
  'authenticated darf reports_map lesen'
);

SELECT * FROM finish();
ROLLBACK;
