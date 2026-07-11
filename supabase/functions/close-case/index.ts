// CLAR — Edge Function: close-case (Paket 7)
//
// Fallabschluss mit Nachher-Foto. Serverseitig validiert:
//   * Auth-Pflicht, nur 'aktiv'
//   * Mock-Location wird beim Abschluss hart abgelehnt (Punkte im Spiel)
//   * Geo-Pruefung (<= 100 m am Fallort) + eigenes Nachher-Foto fuer alle
//     Nicht-Partner (Anti-Kollusion); Partner-/Moderator-Rolle darf ohne
//     Foto abschliessen (z. B. Kommune bestaetigt Abholung)
//   * Statuswechsel laeuft durch die Statusmaschine (Trigger, audit_log)
//   * Punkte idempotent an den Fall gebunden (nur der erste Abschluss)
//   * Push an Melder mit Opt-in (notify_case_closed) — best effort
//
// Nachher-Fotos landen wie alle Fotos im privaten originals-Bucket und
// werden anschliessend via process-photo anonymisiert.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PHOTOS = 3;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Nachher-Foto-Pfade muessen unter dem eigenen User-Prefix liegen
// (originals/<uid>/...) — verhindert SSRF/Cross-Tenant-Verweise.
// Backstop bleibt der DB-Trigger enforce_photo_path_owner (Migration 014).
function isOwnStoragePath(path: unknown, uid: string): path is string {
  return (
    typeof path === "string" &&
    path.length > 0 &&
    path.length <= 256 &&
    !path.includes("..") &&
    path.startsWith(`${uid}/`) &&
    /^[A-Za-z0-9/_.-]+$/.test(path)
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    const body = await req.json().catch(() => null);
    if (!body) return json(400, { error: "invalid_body" });

    const caseId = typeof body.case_id === "string" ? body.case_id : null;
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const photoPaths: string[] = Array.isArray(body.photoPaths)
      ? body.photoPaths.filter((p: unknown) => typeof p === "string").slice(0, MAX_PHOTOS)
      : [];

    if (!caseId) return json(400, { error: "case_id_required" });
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return json(400, { error: "invalid_location" });
    }
    // Nur eigene Storage-Pfade zulassen (leere Liste = Partner-Abschluss ok).
    if (!photoPaths.every((p) => isOwnStoragePath(p, user.id))) {
      return json(400, { error: "invalid_photo_path" });
    }
    // Beim Abschluss sind Punkte im Spiel: Mock-Location wird hart abgelehnt.
    if (body.mocked === true) {
      await admin.rpc("adjust_reputation", {
        p_user_id: user.id,
        p_delta: -10,
        p_reason: "mock_location_close_case",
      });
      return json(403, { error: "mock_location_rejected" });
    }

    const { data: profile } = await admin
      .from("user_profiles")
      .select("verification_level")
      .eq("id", user.id)
      .single();
    if (!profile || profile.verification_level !== "aktiv") {
      return json(403, { error: "not_active" });
    }

    const { data: rlOk } = await admin.rpc("check_and_log_rate_limit", {
      p_user_id: user.id,
      p_device_hash: null,
      p_ip_hash: null,
      p_action: "close_case",
      p_max: 5,
      p_window_secs: 600,
    });
    if (rlOk === false) return json(429, { error: "rate_limited" });

    const { data: result, error: txError } = await admin.rpc("close_case_tx", {
      p_case_id: caseId,
      p_user_id: user.id,
      p_lat: latitude,
      p_lng: longitude,
      p_photo_paths: photoPaths.length > 0 ? photoPaths : null,
    });
    if (txError) throw txError;
    if (!result?.ok) return json(400, result);

    // Push an Melder mit Opt-in — best effort, blockiert den Abschluss nie.
    // Inhalt bewusst ohne personenbezogene Daten/Ortsdetails.
    try {
      const { data: recipients } = await admin.rpc("case_notify_recipients", {
        p_case_id: caseId,
      });
      const tokens = (recipients ?? [])
        .map((r: { push_token: string | null }) => r.push_token)
        .filter((t: string | null): t is string => !!t && t.startsWith("ExponentPushToken"));

      if (tokens.length > 0) {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tokens.map((to: string) => ({
            to,
            title: "Fall erledigt",
            body: "Ein von dir gemeldeter Muell-Fall wurde aufgeraeumt. Danke fuer deine Meldung!",
          }))),
        });
      }
    } catch (pushError) {
      console.error(
        "close-case push error:",
        pushError instanceof Error ? pushError.message : "unknown",
      );
    }

    return json(200, result);
  } catch (error) {
    console.error("close-case error:", error instanceof Error ? error.message : "unknown");
    return json(500, { error: "internal_error" });
  }
});
