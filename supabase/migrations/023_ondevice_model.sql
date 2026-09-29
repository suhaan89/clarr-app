-- ============================================================
-- CLAR — Migration 023: Eigenes On-Device-Modell + Trainingsdaten
-- (docs/vision-ondevice.md)
--
-- 1. vision_models        Modell-Metadaten, App laedt die aktive Version
-- 2. Bucket ml-models     .tflite-Dateien (oeffentlich lesbar)
-- 3. reports.ondevice_*   Score + Modellversion der Handy-Pruefung
-- 4. system_settings      Schalter fuer das nur-verschaerfende Signal
-- 5. consents             neuer, freiwilliger Schluessel 'ki_training'
-- 6. vision_training_samples  Labels fuer spaeteres Training
-- 7. Trigger / RPCs       Befuellung, Widerruf, Moderatoren-Label, Loeschfrist
-- 8. vision_training_export   was das Trainingsskript lesen darf
--
-- Grundsaetze:
--   * Der On-Device-Score ist ein HINWEIS. Er vergibt nie Punkte und macht
--     eine Entscheidung hoechstens strenger (analyze-photo).
--   * Training nur mit ausdruecklicher Einwilligung (Opt-in, Standard aus),
--     nur mit der verpixelten und freigegebenen Kopie, nie mit Privatgrund
--     oder unzulaessigen Inhalten. Loeschen ist kaskadiert, Widerruf loescht
--     sofort, nach 24 Monaten wird automatisch geloescht.
--
-- ADDITIV. Keine bestehende Signatur wird geaendert (record_consent behaelt
-- seine Signatur und bekommt nur einen weiteren erlaubten Schluessel).
-- ============================================================

-- ----------------------
-- 1. vision_models
-- ----------------------
CREATE TABLE IF NOT EXISTS public.vision_models (
  version TEXT PRIMARY KEY CHECK (version ~ '^[A-Za-z0-9._-]{1,64}$'),
  storage_path TEXT NOT NULL CHECK (
    storage_path ~ '^[A-Za-z0-9._/-]{1,200}$' AND position('..' IN storage_path) = 0
  ),
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes INT NOT NULL CHECK (size_bytes > 0),
  input_size INT NOT NULL CHECK (input_size BETWEEN 32 AND 640),
  labels JSONB NOT NULL CHECK (jsonb_typeof(labels) = 'array' AND jsonb_array_length(labels) >= 2),
  positive_index INT NOT NULL CHECK (positive_index >= 0),
  threshold DOUBLE PRECISION NOT NULL CHECK (threshold > 0 AND threshold < 1),
  -- Normalisierung je Kanal auf Pixelwerte 0..255: (pixel - mean) / std.
  -- Default = Werte 0..1 (so erwartet es der YOLO-Export).
  norm_mean JSONB NOT NULL DEFAULT '[0, 0, 0]',
  norm_std JSONB NOT NULL DEFAULT '[255, 255, 255]',
  -- {"scale": 0.0039, "zero_point": -128} oder NULL (float-Ein-/Ausgang)
  input_quant JSONB,
  output_quant JSONB,
  output_activation TEXT NOT NULL DEFAULT 'softmax'
    CHECK (output_activation IN ('softmax', 'none')),
  -- entwurf: hochgeladen, aber noch nicht an Apps ausgeliefert
  -- aktiv: genau eine Version, die alle Apps laden
  -- zurueckgezogen: nicht mehr ausgeliefert, bleibt als Referenz fuer alte Meldungen
  status TEXT NOT NULL DEFAULT 'entwurf'
    CHECK (status IN ('entwurf', 'aktiv', 'zurueckgezogen')),
  -- Auswertung aus training/ (Precision, Recall, Confusion Matrix) zur Doku
  metrics JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (positive_index < jsonb_array_length(labels))
);

-- Hoechstens EINE aktive Version.
CREATE UNIQUE INDEX IF NOT EXISTS vision_models_one_active_idx
  ON public.vision_models ((TRUE)) WHERE status = 'aktiv';

ALTER TABLE public.vision_models ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vision_models FROM anon, authenticated;
-- Modell-Metadaten sind nicht geheim (das Modell steckt ohnehin in jeder
-- App). Entwuerfe bleiben unsichtbar; geschrieben wird nur per Service-Role.
GRANT SELECT ON public.vision_models TO anon, authenticated;
DROP POLICY IF EXISTS "vision_models_select_published" ON public.vision_models;
CREATE POLICY "vision_models_select_published"
  ON public.vision_models FOR SELECT
  USING (status IN ('aktiv', 'zurueckgezogen'));

-- ----------------------
-- 2. Storage-Bucket fuer die Modelldateien. Oeffentlich lesbar, schreiben
--    nur Service-Role (keine Policies fuer Client-Rollen).
-- ----------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ml-models', 'ml-models', TRUE, 8388608, ARRAY['application/octet-stream'])
ON CONFLICT (id) DO NOTHING;

-- ----------------------
-- 3. On-Device-Ergebnis an der Meldung. Geschrieben nur von submit-report
--    (Service-Role); Clients koennen reports ohnehin nicht schreiben.
-- ----------------------
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS ondevice_score DOUBLE PRECISION
    CHECK (ondevice_score IS NULL OR (ondevice_score >= 0 AND ondevice_score <= 1)),
  ADD COLUMN IF NOT EXISTS ondevice_model_version TEXT
    REFERENCES public.vision_models(version) ON UPDATE CASCADE ON DELETE SET NULL;

COMMENT ON COLUMN public.reports.ondevice_score IS
  'Wahrscheinlichkeit "Muell" laut Handy-Modell (0..1). Nur Hinweis, vom Client '
  'gemeldet und damit manipulierbar: vergibt nie Punkte, darf nur verschaerfen.';

-- ----------------------
-- 4. Schalter: Liegt der Handy-Score unter diesem Wert, obwohl die Server-KI
--    "ok" sagt, geht die Meldung zur Sicherheit an einen Menschen.
--    'null' = aus (Standard, bis ein trainiertes Modell sich bewaehrt hat).
-- ----------------------
INSERT INTO public.system_settings (key, value) VALUES
  ('ondevice_disagree_below', 'null')
ON CONFLICT (key) DO NOTHING;

-- ----------------------
-- 5. Einwilligung 'ki_training' (Opt-in). Signatur von record_consent bleibt.
-- ----------------------
ALTER TABLE public.consents DROP CONSTRAINT IF EXISTS consents_consent_key_check;
ALTER TABLE public.consents ADD CONSTRAINT consents_consent_key_check CHECK (
  consent_key IN ('kamera', 'standort', 'behoerden_weitergabe', 'altersbestaetigung', 'ki_training')
);

CREATE OR REPLACE FUNCTION public.record_consent(
  p_consent_key TEXT,
  p_granted     BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet';
  END IF;
  IF p_consent_key NOT IN ('kamera', 'standort', 'behoerden_weitergabe', 'altersbestaetigung', 'ki_training') THEN
    RAISE EXCEPTION 'Unbekannter Consent-Schluessel';
  END IF;
  INSERT INTO public.consents (user_id, consent_key, granted)
  VALUES (auth.uid(), p_consent_key, COALESCE(p_granted, FALSE));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_consent(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.record_consent(TEXT, BOOLEAN) TO authenticated;

-- Neue Fassung der Rechtstexte (Abschnitt Training, src/constants/legal.ts)
ALTER TABLE public.consents
  ALTER COLUMN policy_version SET DEFAULT '2026-09-28-v1';

-- ----------------------
-- 6. vision_training_samples — eine Zeile pro Meldung, deren Foto spaeter
--    zum Training dienen darf. Die Bilddatei selbst wird NICHT kopiert; das
--    Trainingsskript holt die verpixelte Kopie ueber die Export-View.
-- ----------------------
CREATE TABLE IF NOT EXISTS public.vision_training_samples (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id UUID NOT NULL UNIQUE REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Fester Train/Val-Split pro Fall (gleicher Ort = gleiche Seite), damit
  -- fast gleiche Fotos nicht in Training UND Validierung landen.
  split TEXT NOT NULL CHECK (split IN ('train', 'val')),
  ondevice_score DOUBLE PRECISION,
  ondevice_model_version TEXT,
  -- Grund-Code der KI-Entscheidung (reports.decision_reason, siehe Migration 022)
  ai_outcome TEXT,
  ai_confidence DOUBLE PRECISION,
  -- Entscheidung aus der Review-Queue (moderate_report)
  human_decision TEXT CHECK (human_decision IN ('freigeben', 'ablehnen')),
  -- Ausdrueckliches Label eines Moderators (set_training_label), schlaegt alles
  human_label TEXT CHECK (human_label IN ('positiv', 'negativ')),
  -- Abgeleitetes Label: Mensch vor KI. Eine Ablehnung ohne ausdrueckliches
  -- Label bleibt offen, weil "abgelehnt" auch Duplikat o. Ae. heissen kann.
  label TEXT GENERATED ALWAYS AS (
    CASE
      WHEN human_label IS NOT NULL THEN human_label
      WHEN human_decision = 'freigeben' THEN 'positiv'
      WHEN human_decision = 'ablehnen' THEN NULL
      WHEN ai_outcome IN ('published', 'location_suspect') THEN 'positiv'
      WHEN ai_outcome = 'not_waste' THEN 'negativ'
      ELSE NULL
    END
  ) STORED,
  label_source TEXT GENERATED ALWAYS AS (
    CASE
      WHEN human_label IS NOT NULL OR human_decision = 'freigeben' THEN 'mensch'
      WHEN human_decision IS NULL AND ai_outcome IN ('published', 'location_suspect', 'not_waste') THEN 'ki'
      ELSE NULL
    END
  ) STORED,
  -- Fassung der Erklaerung, unter der eingewilligt wurde (Nachweis)
  consent_policy_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vision_training_samples_user_idx
  ON public.vision_training_samples (user_id);
CREATE INDEX IF NOT EXISTS vision_training_samples_created_idx
  ON public.vision_training_samples (created_at);

-- Kein Client-Zugriff, auch nicht fuer Moderatoren (Label nur per RPC).
ALTER TABLE public.vision_training_samples ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vision_training_samples FROM anon, authenticated;

-- ----------------------
-- 7a. Befuellung: nach jeder Statusentscheidung (apply_vision_result und
--     moderate_report setzen beide decision_reason + decided_at).
-- ----------------------
CREATE OR REPLACE FUNCTION public.sync_vision_training_sample()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_granted BOOLEAN;
  v_consent_at TIMESTAMPTZ;
  v_policy TEXT;
  v_human TEXT;
  v_ai TEXT;
BEGIN
  IF NEW.is_seed THEN
    RETURN NEW;
  END IF;

  -- Nie ins Training: unzulaessige Inhalte und alles mit Privatgrund-Bezug.
  IF NEW.decision_reason IN ('unsafe_content', 'private_context', 'moderator_private') THEN
    DELETE FROM public.vision_training_samples WHERE report_id = NEW.id;
    RETURN NEW;
  END IF;

  -- Nur mit aktueller Einwilligung, die schon VOR der Meldung bestand.
  SELECT granted, created_at, policy_version
  INTO v_granted, v_consent_at, v_policy
  FROM public.consents
  WHERE user_id = NEW.user_id AND consent_key = 'ki_training'
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  IF NOT COALESCE(v_granted, FALSE) OR v_consent_at > NEW.created_at THEN
    RETURN NEW;
  END IF;

  v_human := CASE NEW.decision_reason
    WHEN 'moderator_approved' THEN 'freigeben'
    WHEN 'moderator_rejected' THEN 'ablehnen'
    ELSE NULL
  END;
  v_ai := CASE WHEN v_human IS NULL THEN NEW.decision_reason ELSE NULL END;

  INSERT INTO public.vision_training_samples (
    report_id, user_id, split, ondevice_score, ondevice_model_version,
    ai_outcome, ai_confidence, human_decision, consent_policy_version
  ) VALUES (
    NEW.id,
    NEW.user_id,
    CASE WHEN get_byte(decode(md5(COALESCE(NEW.case_id, NEW.id)::TEXT), 'hex'), 0) < 51
         THEN 'val' ELSE 'train' END,  -- ~20 % Validierung
    NEW.ondevice_score,
    NEW.ondevice_model_version,
    v_ai,
    NEW.ai_confidence,
    v_human,
    v_policy
  )
  ON CONFLICT (report_id) DO UPDATE SET
    ai_outcome = COALESCE(EXCLUDED.ai_outcome, vision_training_samples.ai_outcome),
    ai_confidence = COALESCE(EXCLUDED.ai_confidence, vision_training_samples.ai_confidence),
    human_decision = COALESCE(EXCLUDED.human_decision, vision_training_samples.human_decision),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_vision_training_sample() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reports_sync_training_sample ON public.reports;
CREATE TRIGGER reports_sync_training_sample
  AFTER UPDATE OF decision_reason, decided_at ON public.reports
  FOR EACH ROW
  WHEN (NEW.decision_reason IS NOT NULL AND NEW.decided_at IS DISTINCT FROM OLD.decided_at)
  EXECUTE FUNCTION public.sync_vision_training_sample();

-- ----------------------
-- 7b. Widerruf: sofort alle Trainingszeilen der Person loeschen.
-- ----------------------
CREATE OR REPLACE FUNCTION public.revoke_training_samples()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.vision_training_samples WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_training_samples() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS consents_revoke_training ON public.consents;
CREATE TRIGGER consents_revoke_training
  AFTER INSERT ON public.consents
  FOR EACH ROW
  WHEN (NEW.consent_key = 'ki_training' AND NOT NEW.granted)
  EXECUTE FUNCTION public.revoke_training_samples();

-- ----------------------
-- 7c. Moderatoren koennen ein Label ausdruecklich setzen (z. B. "negativ"
--     bei einer Ablehnung, weil wirklich kein Muell zu sehen ist).
--     NULL setzt das ausdrueckliche Label zurueck.
-- ----------------------
CREATE OR REPLACE FUNCTION public.set_training_label(
  p_report_id UUID,
  p_label     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF p_label IS NOT NULL AND p_label NOT IN ('positiv', 'negativ') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_label');
  END IF;

  UPDATE public.vision_training_samples
  SET human_label = p_label, updated_at = NOW()
  WHERE report_id = p_report_id;
  IF NOT FOUND THEN
    -- Keine Einwilligung oder ausgeschlossen: dann gibt es auch nichts zu labeln.
    RETURN jsonb_build_object('ok', false, 'error', 'not_in_training_set');
  END IF;

  INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'training_label_set', 'report', p_report_id::TEXT,
          jsonb_build_object('label', p_label));

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_training_label(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_training_label(UUID, TEXT) TO authenticated;

-- ----------------------
-- 7d. Loeschfrist: Trainingszeilen spaetestens nach 24 Monaten entfernen.
--     Aufruf durch storage-cleanup (Scheduler, Service-Role).
-- ----------------------
CREATE OR REPLACE FUNCTION public.purge_expired_training_samples()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM public.vision_training_samples
  WHERE created_at < NOW() - INTERVAL '24 months';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_expired_training_samples() FROM PUBLIC, anon, authenticated;

-- ----------------------
-- 8. Export-View fuer training/sync_dataset.py (nur Service-Role).
--    Nur Zeilen mit Label und nur Fotos, die verpixelt UND freigegeben sind
--    (approved = TRUE: keine Person erkannt oder von einem Menschen geprueft).
--    Das Skript gleicht vor jedem Training ab und loescht lokal alles, was
--    hier nicht mehr auftaucht (Widerruf, Loeschung, Frist).
-- ----------------------
CREATE OR REPLACE VIEW public.vision_training_export
WITH (security_invoker = true) AS
SELECT
  s.id AS sample_id,
  s.label,
  s.label_source,
  s.split,
  p.blurred_path,
  s.ondevice_score,
  s.ondevice_model_version,
  s.ai_confidence,
  s.created_at
FROM public.vision_training_samples s
JOIN LATERAL (
  SELECT rp.blurred_path
  FROM public.report_photos rp
  WHERE rp.report_id = s.report_id
    AND rp.approved = TRUE
    AND rp.blurred_path IS NOT NULL
  ORDER BY rp.created_at
  LIMIT 1
) p ON TRUE
WHERE s.label IS NOT NULL;

REVOKE ALL ON public.vision_training_export FROM anon, authenticated;
