// CLAR — Edge Function: close-event-cases (Paket 10)
//
// Gebuendelter Abschluss mehrerer Faelle nach einer Cleanup-Aktion.
//   * Nur Team-/Partner-Rolle (Events sind orga-geleitet).
//   * Nachher-Fotos laufen wie immer durch die Anonymisierungs-Pipeline
//     (originals -> process-photo), Anzeige nur geblurrt.
//   * Punkte: idempotent pro Fall (booking_key case_closed_after:<case_id>
//     via close_case_tx) — doppelter Aufruf bucht nichts doppelt.

import { serveUserFunction, stringList } from "../_shared/http.ts";

serveUserFunction("close-event-cases", async ({ req, user, admin, json }) => {
  // Nur Team/Partner darf Events abschliessen.
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["partner", "moderator"].includes(profile.role)) {
    return json(403, { error: "role_required" });
  }

  const body = await req.json().catch(() => null);
  if (!body) return json(400, { error: "invalid_body" });

  const eventId = typeof body.event_id === "string" ? body.event_id : null;
  const caseIds = stringList(body.case_ids, 25);
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const photoPaths = stringList(body.photoPaths, 5);

  if (!eventId || caseIds.length === 0) return json(400, { error: "event_and_cases_required" });

  const { data: result, error: txError } = await admin.rpc("close_event_cases_tx", {
    p_event_id: eventId,
    p_user_id: user.id,
    p_case_ids: caseIds,
    p_lat: Number.isFinite(latitude) ? latitude : null,
    p_lng: Number.isFinite(longitude) ? longitude : null,
    p_photo_paths: photoPaths,
  });
  if (txError) throw txError;

  return json(200, result);
});
