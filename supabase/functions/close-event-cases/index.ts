// CLAR — Edge Function: close-event-cases (Paket 10)
//
// Gebuendelter Abschluss mehrerer Faelle nach einer Cleanup-Aktion.
//   * Nur Team-/Partner-Rolle (Events sind orga-geleitet).
//   * Nachher-Fotos laufen wie immer durch die Anonymisierungs-Pipeline
//     (originals -> process-photo), Anzeige nur geblurrt.
//   * Punkte: idempotent pro Fall (booking_key case_closed_after:<case_id>
//     via close_case_tx) — doppelter Aufruf bucht nichts doppelt.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "unauthorized" });

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json(401, { error: "unauthorized" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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
    const caseIds: string[] = Array.isArray(body.case_ids)
      ? body.case_ids.filter((c: unknown) => typeof c === "string").slice(0, 25)
      : [];
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const photoPaths: string[] = Array.isArray(body.photoPaths)
      ? body.photoPaths.filter((p: unknown) => typeof p === "string").slice(0, 5)
      : [];

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
  } catch (error) {
    console.error("close-event-cases error:", error instanceof Error ? error.message : "unknown");
    return json(500, { error: "internal_error" });
  }
});
