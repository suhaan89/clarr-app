-- ============================================================
-- CLAR — Migration 015: Event-Kapazitaet serverseitig durchsetzen
--
-- max_participants (001_schema.sql) wurde bisher nur im Client geprueft
-- (events.tsx blendet den Button aus) — ein direkter INSERT auf
-- cleanup_signups, oder zwei Nutzer, die gleichzeitig um den letzten
-- Platz anmelden, konnten ein Event beliebig ueberbuchen. Trigger sperrt
-- die Event-Zeile (FOR UPDATE) und zaehlt die aktuellen Anmeldungen VOR
-- dem Insert im selben Transaktions-Snapshot — race-sicher.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_event_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_max   INT;
  v_count INT;
BEGIN
  SELECT max_participants INTO v_max
  FROM public.cleanup_events
  WHERE id = NEW.event_id
  FOR UPDATE;

  IF v_max IS NULL THEN
    RAISE EXCEPTION 'Event nicht gefunden'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.cleanup_signups
  WHERE event_id = NEW.event_id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Event ist bereits voll'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_signups_capacity ON public.cleanup_signups;
CREATE TRIGGER cleanup_signups_capacity
  BEFORE INSERT ON public.cleanup_signups
  FOR EACH ROW EXECUTE FUNCTION public.enforce_event_capacity();
