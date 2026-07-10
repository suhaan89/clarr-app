-- ============================================================
-- CLAR App Database Schema
-- Run this in the Supabase SQL editor (Project > SQL Editor)
-- ============================================================

-- ----------------------
-- user_profiles
-- ----------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  credits INT NOT NULL DEFAULT 0,
  reports_count_today INT NOT NULL DEFAULT 0,
  last_report_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create a profile row whenever a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------
-- reports
-- ----------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  waste_type TEXT,
  ai_confidence DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------
-- cleanup_events
-- ----------------------
CREATE TABLE IF NOT EXISTS public.cleanup_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  max_participants INT NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------
-- cleanup_signups
-- ----------------------
CREATE TABLE IF NOT EXISTS public.cleanup_signups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.cleanup_events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

-- ----------------------
-- Anti-spam RPC
-- Checks whether the user is under the daily report limit,
-- increments the counter if so, and returns the result.
-- Counts attempts even when AI verification later fails (no credits).
-- ----------------------
CREATE OR REPLACE FUNCTION public.check_and_increment_daily_reports(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count      INT;
  v_last_date  DATE;
  v_today      DATE := CURRENT_DATE;
  v_limit      CONSTANT INT := 10;
BEGIN
  SELECT reports_count_today, last_report_date
  INTO v_count, v_last_date
  FROM public.user_profiles
  WHERE id = p_user_id;

  -- Create profile row if missing (e.g. legacy accounts without trigger)
  IF NOT FOUND THEN
    INSERT INTO public.user_profiles (id, reports_count_today, last_report_date)
    VALUES (p_user_id, 1, v_today)
    ON CONFLICT (id) DO NOTHING;
    RETURN jsonb_build_object('allowed', true, 'count', 1, 'limit', v_limit);
  END IF;

  -- New calendar day: reset counter
  IF v_last_date IS NULL OR v_last_date < v_today THEN
    UPDATE public.user_profiles
    SET reports_count_today = 1,
        last_report_date    = v_today
    WHERE id = p_user_id;
    RETURN jsonb_build_object('allowed', true, 'count', 1, 'limit', v_limit);
  END IF;

  -- Already at the daily limit
  IF v_count >= v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'count', v_count, 'limit', v_limit);
  END IF;

  -- Under limit: increment
  UPDATE public.user_profiles
  SET reports_count_today = reports_count_today + 1
  WHERE id = p_user_id;

  RETURN jsonb_build_object('allowed', true, 'count', v_count + 1, 'limit', v_limit);
END;
$$;

-- ----------------------
-- Atomic credit increment used by the award-credits Edge Function
-- (service-role only via SECURITY DEFINER)
-- ----------------------
CREATE OR REPLACE FUNCTION public.increment_user_credits(p_user_id UUID, p_amount INT)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO public.user_profiles (id, credits)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (id) DO UPDATE
    SET credits = public.user_profiles.credits + EXCLUDED.credits
  RETURNING credits;
$$;

-- ----------------------
-- Row-Level Security
-- ----------------------
ALTER TABLE public.user_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleanup_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleanup_signups ENABLE ROW LEVEL SECURITY;

-- user_profiles
CREATE POLICY "users_select_own_profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_update_own_profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- reports: readable by everyone (map display), writable by owner
CREATE POLICY "reports_select_all"
  ON public.reports FOR SELECT
  USING (true);

CREATE POLICY "reports_insert_own"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reports_update_own"
  ON public.reports FOR UPDATE
  USING (auth.uid() = user_id);

-- cleanup_events: pending/approved visible to all; rejected only to creator
CREATE POLICY "events_select_non_rejected"
  ON public.cleanup_events FOR SELECT
  USING (status <> 'rejected' OR auth.uid() = created_by);

CREATE POLICY "events_insert_own"
  ON public.cleanup_events FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- cleanup_signups
CREATE POLICY "signups_select_all"
  ON public.cleanup_signups FOR SELECT
  USING (true);

CREATE POLICY "signups_insert_own"
  ON public.cleanup_signups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "signups_delete_own"
  ON public.cleanup_signups FOR DELETE
  USING (auth.uid() = user_id);

-- ----------------------
-- Storage bucket
-- Run these separately in the Supabase Dashboard under
-- Storage > New Bucket, OR paste into the SQL editor:
-- ----------------------
/*
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-photos', 'report-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "report_photos_select_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'report-photos');

CREATE POLICY "report_photos_insert_authenticated"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'report-photos' AND auth.role() = 'authenticated');
*/
