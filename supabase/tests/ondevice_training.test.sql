-- ============================================================
-- CLAR — Tests On-Device-Modell + Trainingsdaten (Migration 023)
-- Ausfuehren mit lokaler DB:  supabase test db
-- (pgTAP; laeuft in einer Transaktion und wird zurueckgerollt)
-- ============================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(16);

-- ---------- Setup ----------
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'training-ja@example.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'training-nein@example.com');

INSERT INTO public.vision_models
  (version, storage_path, sha256, size_bytes, input_size, labels, positive_index, threshold, status)
VALUES
  ('test-aktiv', 'models/test-aktiv.tflite', repeat('a', 64), 1000, 224, '["negativ","positiv"]', 1, 0.5, 'aktiv'),
  ('test-entwurf', 'models/test-entwurf.tflite', repeat('b', 64), 1000, 224, '["negativ","positiv"]', 1, 0.5, 'entwurf');

-- Einwilligung nur fuer d1 (vor den Meldungen)
INSERT INTO public.consents (user_id, consent_key, granted, created_at)
VALUES ('00000000-0000-0000-0000-0000000000d1', 'ki_training', TRUE, NOW() - INTERVAL '1 hour');

INSERT INTO public.reports (id, user_id, description, latitude, longitude, status, ondevice_score, ondevice_model_version)
VALUES
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000d1', 'ok', 47.6, 9.5, 'gemeldet', 0.9, 'test-aktiv'),
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-0000000000d1', 'kein muell', 47.6, 9.5, 'gemeldet', 0.1, 'test-aktiv'),
  ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-0000000000d1', 'unsafe', 47.6, 9.5, 'gemeldet', NULL, NULL),
  ('00000000-0000-0000-0000-00000000e004', '00000000-0000-0000-0000-0000000000d2', 'ohne einwilligung', 47.6, 9.5, 'gemeldet', NULL, NULL);

-- Meldung, die VOR der Einwilligung entstand
INSERT INTO public.reports (id, user_id, description, latitude, longitude, status, created_at)
VALUES ('00000000-0000-0000-0000-00000000e005', '00000000-0000-0000-0000-0000000000d1', 'alt', 47.6, 9.5, 'gemeldet', NOW() - INTERVAL '2 days');

-- ============================================================
-- 1. Rechte: kein Client-Zugriff auf Trainingsdaten, Entwuerfe unsichtbar
-- ============================================================
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.vision_training_samples', 'SELECT'),
  'authenticated kann vision_training_samples nicht lesen'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.vision_training_export', 'SELECT'),
  'anon kann die Export-View nicht lesen'
);

SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*)::INT FROM public.vision_models),
  1,
  'anon sieht nur die aktive Modellversion, keinen Entwurf'
);
RESET ROLE;

SELECT throws_ok(
  $$INSERT INTO public.vision_models (version, storage_path, sha256, size_bytes, input_size, labels, positive_index, threshold, status)
    VALUES ('zweite', 'models/x.tflite', repeat('c', 64), 1, 224, '["a","b"]', 1, 0.5, 'aktiv')$$,
  '23505',
  NULL,
  'es kann nur EINE aktive Version geben'
);

SELECT throws_ok(
  $$UPDATE public.reports SET ondevice_score = 1.5 WHERE id = '00000000-0000-0000-0000-00000000e001'$$,
  '23514',
  NULL,
  'ondevice_score ausserhalb 0..1 wird abgelehnt'
);

-- ============================================================
-- 2. Befuellung per Trigger
-- ============================================================
UPDATE public.reports SET decision_reason = 'published', decided_at = NOW(), ai_confidence = 0.92
WHERE id = '00000000-0000-0000-0000-00000000e001';
UPDATE public.reports SET decision_reason = 'not_waste', decided_at = NOW(), ai_confidence = 0.2
WHERE id = '00000000-0000-0000-0000-00000000e002';
UPDATE public.reports SET decision_reason = 'unsafe_content', decided_at = NOW()
WHERE id = '00000000-0000-0000-0000-00000000e003';
UPDATE public.reports SET decision_reason = 'published', decided_at = NOW()
WHERE id = '00000000-0000-0000-0000-00000000e004';
UPDATE public.reports SET decision_reason = 'published', decided_at = NOW()
WHERE id = '00000000-0000-0000-0000-00000000e005';

SELECT is(
  (SELECT label || '/' || label_source FROM public.vision_training_samples
   WHERE report_id = '00000000-0000-0000-0000-00000000e001'),
  'positiv/ki',
  'KI-Veroeffentlichung ergibt Label positiv (Quelle KI)'
);
SELECT is(
  (SELECT ondevice_score FROM public.vision_training_samples
   WHERE report_id = '00000000-0000-0000-0000-00000000e001'),
  0.9::DOUBLE PRECISION,
  'On-Device-Score wird mit uebernommen'
);
SELECT is(
  (SELECT label FROM public.vision_training_samples
   WHERE report_id = '00000000-0000-0000-0000-00000000e002'),
  'negativ',
  'KI "kein Muell" ergibt Label negativ'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.vision_training_samples
              WHERE report_id = '00000000-0000-0000-0000-00000000e003'),
  'unzulaessige Inhalte landen nie im Trainingsdatensatz'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.vision_training_samples
              WHERE report_id = '00000000-0000-0000-0000-00000000e004'),
  'ohne Einwilligung keine Trainingszeile'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.vision_training_samples
              WHERE report_id = '00000000-0000-0000-0000-00000000e005'),
  'Meldungen von vor der Einwilligung bleiben draussen'
);

-- ============================================================
-- 3. Menschliche Entscheidung schlaegt KI; Ablehnung ohne Label bleibt offen
-- ============================================================
UPDATE public.reports SET decision_reason = 'moderator_rejected', decided_at = NOW() + INTERVAL '1 minute'
WHERE id = '00000000-0000-0000-0000-00000000e001';
SELECT ok(
  (SELECT label IS NULL AND human_decision = 'ablehnen' AND ai_outcome = 'published'
   FROM public.vision_training_samples WHERE report_id = '00000000-0000-0000-0000-00000000e001'),
  'Ablehnung durch Menschen ohne ausdrueckliches Label: Label offen, KI-Ergebnis bleibt erhalten'
);

UPDATE public.vision_training_samples SET human_label = 'negativ'
WHERE report_id = '00000000-0000-0000-0000-00000000e001';
SELECT is(
  (SELECT label || '/' || label_source FROM public.vision_training_samples
   WHERE report_id = '00000000-0000-0000-0000-00000000e001'),
  'negativ/mensch',
  'ausdrueckliches Moderatoren-Label gewinnt'
);

-- ============================================================
-- 4. Privatgrund entfernt, Widerruf loescht, Meldungsloeschung kaskadiert
-- ============================================================
UPDATE public.reports SET decision_reason = 'moderator_private', decided_at = NOW() + INTERVAL '2 minutes'
WHERE id = '00000000-0000-0000-0000-00000000e002';
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.vision_training_samples
              WHERE report_id = '00000000-0000-0000-0000-00000000e002'),
  'Einstufung als privat entfernt die Trainingszeile'
);

DELETE FROM public.reports WHERE id = '00000000-0000-0000-0000-00000000e001';
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.vision_training_samples
              WHERE report_id = '00000000-0000-0000-0000-00000000e001'),
  'geloeschte Meldung verschwindet aus dem Trainingsdatensatz'
);

-- neue Zeile anlegen, dann widerrufen
INSERT INTO public.reports (id, user_id, description, latitude, longitude, status)
VALUES ('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-0000000000d1', 'neu', 47.6, 9.5, 'gemeldet');
UPDATE public.reports SET decision_reason = 'published', decided_at = NOW()
WHERE id = '00000000-0000-0000-0000-00000000e006';
INSERT INTO public.consents (user_id, consent_key, granted)
VALUES ('00000000-0000-0000-0000-0000000000d1', 'ki_training', FALSE);
SELECT is(
  (SELECT count(*)::INT FROM public.vision_training_samples
   WHERE user_id = '00000000-0000-0000-0000-0000000000d1'),
  0,
  'Widerruf loescht sofort alle Trainingszeilen der Person'
);

SELECT * FROM finish();
ROLLBACK;
