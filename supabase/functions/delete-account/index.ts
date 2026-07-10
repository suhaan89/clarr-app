// CLAR — Edge Function: delete-account (Paket 11, Art. 17 DSGVO)
//
// Self-Service-Loeschung des EIGENEN Accounts (user_id aus dem JWT).
// Reihenfolge:
//   1. Storage: Original-Fotos (originals/<uid>/...) UND geblurrte
//      Derivate (public-blurred, Pfade aus report_photos) loeschen —
//      ON DELETE CASCADE erfasst Storage-Objekte NICHT, darum explizit.
//   2. auth.users-Loeschung -> CASCADE raeumt user_profiles, reports,
//      report_photos, points_ledger, consents, flags, signups ab;
//      vision_usage/audit_log behalten Zeilen mit user_id = NULL
//      (Kostendeckel/Audit muessen Loeschungen ueberleben, ohne Inhalte).
//   3. audit_log-Eintrag OHNE personenbezogene Inhalte.

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

    // Bestaetigung im Body verlangt — schuetzt vor versehentlichen Aufrufen.
    const body = await req.json().catch(() => null);
    if (body?.confirm !== "KONTO ENDGUELTIG LOESCHEN") {
      return json(400, { error: "confirmation_required" });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const uid = user.id;

    // 1a. Geblurrte Derivate (Pfade stehen in report_photos.blurred_path).
    const { data: photos } = await admin
      .from("report_photos")
      .select("blurred_path")
      .eq("user_id", uid)
      .not("blurred_path", "is", null);
    const blurredPaths = (photos ?? [])
      .map((p: { blurred_path: string | null }) => p.blurred_path)
      .filter((p: string | null): p is string => !!p);
    if (blurredPaths.length > 0) {
      await admin.storage.from("public-blurred").remove(blurredPaths);
    }

    // 1b. Originale: alles unter originals/<uid>/ (seitenweise).
    let page = 0;
    for (;;) {
      const { data: objects } = await admin.storage
        .from("originals")
        .list(uid, { limit: 100, offset: page * 100 });
      if (!objects || objects.length === 0) break;
      await admin.storage
        .from("originals")
        .remove(objects.map((o: { name: string }) => `${uid}/${o.name}`));
      if (objects.length < 100) break;
      page += 1;
    }

    // 2. Account loeschen -> CASCADE (siehe Kopfkommentar).
    const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
    if (deleteError) throw deleteError;

    // 3. Audit ohne Inhalte (actor bereits NULL durch SET NULL).
    await admin.from("audit_log").insert({
      action: "account_deleted",
      entity_type: "user",
      details: { self_service: true, blurred_removed: blurredPaths.length },
    });

    return json(200, { ok: true });
  } catch (error) {
    console.error("delete-account error:", error instanceof Error ? error.message : "unknown");
    return json(500, { error: "internal_error" });
  }
});
