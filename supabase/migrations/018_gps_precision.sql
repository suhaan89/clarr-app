-- ============================================================
-- CLAR — Migration 018: GPS-Praezision auf oeffentlichen Karten
-- (docs/verbesserungs-prompt.md Paket B.7 / docs/security-review.md B2)
--
-- `reports`/`cases` enthalten exakte Lat/Lng (noetig fuer Fall-Buendelung,
-- Distanzpruefungen bei Fallabschluss, Moderation). Oeffentlich sichtbare
-- Kartendaten sollen aber nur auf Geohash8-Zentroid gerundet ausgegeben
-- werden (~19-38m Zelle), um De-Anonymisierung exakter Meldeorte (z. B.
-- Rueckschluss auf ein einzelnes Grundstueck/Fenster) zu erschweren.
-- `geohash_encode` existiert bereits (Migration 004); hier ergaenzt:
-- Decoder auf den Zell-Mittelpunkt + eine Rundungs-View fuer die Karte.
-- Additiv — die Basistabellen und ihre RLS-Policies bleiben unveraendert;
-- Moderation/serverseitige Logik liest weiterhin die exakten Spalten.
-- ============================================================

-- ----------------------
-- 1. Decoder: Geohash-String -> Zell-Mittelpunkt (Zentroid). Spiegelbild
--    der Bit-Aufteilung aus geohash_encode (gleiche Reihenfolge/Grenzen).
-- ----------------------
CREATE OR REPLACE FUNCTION public.geohash_decode_centroid(p_hash TEXT)
RETURNS TABLE(latitude DOUBLE PRECISION, longitude DOUBLE PRECISION)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  chars CONSTANT TEXT := '0123456789bcdefghjkmnpqrstuvwxyz';
  lat_min DOUBLE PRECISION := -90;  lat_max DOUBLE PRECISION := 90;
  lng_min DOUBLE PRECISION := -180; lng_max DOUBLE PRECISION := 180;
  v_is_lng BOOLEAN := TRUE;
  v_char TEXT;
  v_cd INT;
  v_bitpos INT;
  v_bit INT;
  v_mid DOUBLE PRECISION;
  i INT;
BEGIN
  IF p_hash IS NULL OR length(p_hash) = 0 THEN
    RETURN;
  END IF;

  FOR i IN 1..length(p_hash) LOOP
    v_char := substr(p_hash, i, 1);
    v_cd := position(v_char IN chars) - 1;
    IF v_cd < 0 THEN
      RETURN; -- ungueltiges Zeichen -> kein Ergebnis statt Fehler
    END IF;
    FOR v_bitpos IN REVERSE 4..0 LOOP
      v_bit := (v_cd >> v_bitpos) & 1;
      IF v_is_lng THEN
        v_mid := (lng_min + lng_max) / 2;
        IF v_bit = 1 THEN lng_min := v_mid; ELSE lng_max := v_mid; END IF;
      ELSE
        v_mid := (lat_min + lat_max) / 2;
        IF v_bit = 1 THEN lat_min := v_mid; ELSE lat_max := v_mid; END IF;
      END IF;
      v_is_lng := NOT v_is_lng;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT (lat_min + lat_max) / 2, (lng_min + lng_max) / 2;
END;
$$;

-- ----------------------
-- 2. Bequemlichkeits-Wrapper: Lat/Lng direkt auf den Geohash8-Zentroid
--    runden (encode + decode in einem Schritt).
-- ----------------------
CREATE OR REPLACE FUNCTION public.round_to_geohash8(p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS TABLE(latitude DOUBLE PRECISION, longitude DOUBLE PRECISION)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT * FROM public.geohash_decode_centroid(public.geohash_encode(p_lat, p_lng, 8));
$$;

-- ----------------------
-- 3. Oeffentliche Karten-View: dieselbe Sichtbarkeit wie die Basistabelle
--    `reports` (security_invoker -> RLS-Policies der aufrufenden Rolle
--    gelten unveraendert, siehe Migration 010 "reports_select_public_own_or_mod"),
--    aber mit gerundeten statt exakten Koordinaten. `karte.tsx` liest ab
--    sofort diese View statt der Basistabelle.
-- ----------------------
CREATE OR REPLACE VIEW public.reports_map
WITH (security_invoker = true) AS
SELECT
  r.id,
  r.status,
  r.waste_type,
  r.case_id,
  c.status AS case_status,
  g.latitude,
  g.longitude
FROM public.reports r
LEFT JOIN public.cases c ON c.id = r.case_id
CROSS JOIN LATERAL public.round_to_geohash8(r.latitude, r.longitude) AS g;

GRANT SELECT ON public.reports_map TO anon, authenticated;
