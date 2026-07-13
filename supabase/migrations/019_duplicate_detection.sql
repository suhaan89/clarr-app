-- ============================================================
-- CLAR — Migration 019: pHash-Duplikaterkennung durchsetzen
-- (docs/verbesserungs-prompt.md Paket B.12)
--
-- `report_photos.phash` (dHash, 64 bit Hex) wird seit Paket 5 berechnet,
-- aber nie verglichen. Diese Migration ergaenzt die Schema-Seite:
--   * eine Spalte, um ein Foto als Duplikat-Verdacht zu markieren,
--   * einen neuen review_queue-Grund dafuer,
--   * einen Index fuer den Kandidaten-Abgleich.
-- Die eigentliche Hamming-Distanz-Berechnung laeuft in
-- process-photo/index.ts (reines JS auf dem bereits geladenen Hex-String —
-- robuster und einfacher zu testen als ein Bit-Cast in SQL).
-- ============================================================

ALTER TABLE public.report_photos
  ADD COLUMN IF NOT EXISTS duplicate_suspect BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES public.report_photos(id) ON DELETE SET NULL;

ALTER TABLE public.review_queue DROP CONSTRAINT IF EXISTS review_queue_reason_check;
ALTER TABLE public.review_queue ADD CONSTRAINT review_queue_reason_check CHECK (reason IN
  ('geflaggt', 'confidence', 'stichprobe', 'privatgrund',
   'unklassifiziert', 'personen_im_bild', 'standort_suspekt', 'duplikat_verdacht'));

CREATE INDEX IF NOT EXISTS report_photos_phash_idx ON public.report_photos (user_id, phash)
  WHERE phash IS NOT NULL;
