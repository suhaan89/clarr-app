// CLAR — Edge Function: export-my-data (Paket 11, Art. 15 DSGVO)
//
// Self-Service-Datenexport: liefert ALLE zum eigenen Account gespeicherten
// Daten als JSON. Strikt nur der eigene Account (user_id aus dem JWT —
// es gibt keinen Parameter, mit dem man fremde Daten anfordern koennte).
// Original-Fotos werden als kurzlebige Signed URLs beigelegt.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const uid = user.id;

    const [profile, reports, photos, ledger, consents, flags, signups] = await Promise.all([
      admin.from("user_profiles").select("*").eq("id", uid).maybeSingle(),
      admin.from("reports").select("*").eq("user_id", uid),
      admin.from("report_photos").select("*").eq("user_id", uid),
      admin.from("points_ledger").select("*").eq("user_id", uid),
      admin.from("consents").select("*").eq("user_id", uid),
      admin.from("moderation_flags").select("*").eq("user_id", uid),
      admin.from("cleanup_signups").select("*").eq("user_id", uid),
    ]);

    // Original-Fotos: kurzlebige Signed URLs (1 h) auf den privaten Bucket.
    const photoUrls: Record<string, string> = {};
    for (const p of photos.data ?? []) {
      if (p.storage_path) {
        const { data: signed } = await admin.storage
          .from("originals")
          .createSignedUrl(p.storage_path, 3600);
        if (signed?.signedUrl) photoUrls[p.storage_path] = signed.signedUrl;
      }
    }

    await admin.from("audit_log").insert({
      actor_user_id: uid,
      action: "data_export",
      entity_type: "user",
      // Keine Inhalte im Audit — nur DASS exportiert wurde.
      details: { tables: 7 },
    });

    return new Response(
      JSON.stringify({
        exported_at: new Date().toISOString(),
        account: { id: uid, email: user.email, created_at: user.created_at },
        profile: profile.data,
        reports: reports.data,
        report_photos: photos.data,
        original_photo_urls_1h: photoUrls,
        points_ledger: ledger.data,
        consents: consents.data,
        moderation_flags: flags.data,
        event_signups: signups.data,
        hinweis:
          "Signed URLs sind 1 Stunde gueltig. Veroeffentlichte Fotos existieren zusaetzlich anonymisiert (geblurrt).",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("export-my-data error:", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: corsHeaders });
  }
});
