-- ============================================================
-- CLAR — Migration 024: neue Fassung der Rechtstexte
--
-- Die serverseitige Bild-KI laeuft jetzt ueber einen austauschbaren Anbieter
-- (supabase/functions/_shared/vision.ts), Standard ist Cloudflare Workers AI
-- statt Anthropic. Die Datenschutzerklaerung (Abschnitte 5 und 6) nennt den
-- neuen Empfaenger, deshalb zieht der Default von consents.policy_version
-- mit (src/constants/legal.ts).
--
-- Am Schema aendert sich nichts: reserve_vision_budget und vision_usage
-- funktionieren mit einem kostenlosen Anbieter unveraendert (Schaetzkosten 0,
-- der Kill-Switch greift weiter).
--
-- ADDITIV.
-- ============================================================

ALTER TABLE public.consents
  ALTER COLUMN policy_version SET DEFAULT '2026-10-07-v1';
