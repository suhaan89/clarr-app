-- ============================================================
-- CLAR — Migration 020: Moderations-Frontend, fehlende RLS-Luecke
-- (docs/verbesserungs-prompt.md Paket B.5)
--
-- `review_queue`/`moderation_flags` bekamen in Migration 010 bereits eine
-- Moderator-SELECT-Policy. `report_photos` wurde dabei uebersehen: die
-- bestehende Policy "photos_select_own_or_published" (Migration 002) laesst
-- nur den Foto-Eigentuemer oder freigegebene+veroeffentlichte Fotos lesen.
-- Ein Moderator, der einen Review-Queue-Eintrag bearbeitet, konnte damit
-- das zugehoerige (noch nicht freigegebene, fremde) Foto nicht sehen — das
-- neue Moderations-Frontend braucht das zwingend. Additive Policy (Postgres
-- kombiniert mehrere permissive Policies mit OR).
-- ============================================================

CREATE POLICY "photos_select_moderator"
  ON public.report_photos FOR SELECT
  USING (public.is_moderator());
