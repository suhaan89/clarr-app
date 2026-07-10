// CLAR — Edge Function: authority-digest (Paket 7)
//
// Woechentlicher E-Mail-Digest an die Behoerde:
//   * alle Faelle im Status 'geprueft' (KI-/moderationsgeprueft, noch nicht
//     weitergeleitet), je mit Kartenlink + GEBLURRTEM Foto (nie Originale)
//     und einem signierten, EINMALIGEN "erledigt"-Ruecklauf-Link.
//   * danach werden die Faelle auf 'weitergeleitet' gesetzt (Statusmaschine
//     validiert + auditiert den Uebergang).
//
// Es gehen KEINE Melder-Daten raus (kein Name, keine User-ID, kein Original).
//
// Aufruf NUR durch den Scheduler (pg_cron/Dashboard-Schedule) mit dem
// Service-Role-Key als Bearer — Vergleich unten. Kein Client-Aufruf.
// Versand via RESEND_API_KEY (Function Secret); ohne Key wird der Digest
// nur protokolliert (delivery='logged'), damit DEV ohne Mail-Provider laeuft.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOKEN_BYTES = 32;

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  // Nur Scheduler/Betreiber: Bearer muss der Service-Role-Key sein.
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // Empfaenger aus system_settings; leer = Digest deaktiviert.
  const { data: settings } = await admin
    .from("system_settings")
    .select("key, value")
    .in("key", ["authority_digest_email", "authority_token_ttl_days"]);
  const recipient = settings?.find((s) => s.key === "authority_digest_email")?.value?.trim();
  const ttlDays = Number(settings?.find((s) => s.key === "authority_token_ttl_days")?.value) || 30;
  if (!recipient) {
    return new Response(JSON.stringify({ ok: true, skipped: "no_recipient_configured" }), { status: 200 });
  }

  // Geprüfte, noch nicht weitergeleitete Faelle inkl. eines geblurrten Fotos.
  const { data: cases, error } = await admin
    .from("cases")
    .select("id, title, status, location_lat, location_lng, created_at")
    .eq("status", "geprueft")
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) return new Response(JSON.stringify({ error: "query_failed" }), { status: 500 });
  if (!cases || cases.length === 0) {
    return new Response(JSON.stringify({ ok: true, cases: 0 }), { status: 200 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 3600 * 1000).toISOString();
  const items: string[] = [];

  for (const c of cases) {
    // Ein geblurrtes, freigegebenes Foto des Falls (falls vorhanden).
    const { data: photo } = await admin
      .from("report_photos")
      .select("blurred_path, reports!inner(case_id)")
      .eq("reports.case_id", c.id)
      .eq("approved", true)
      .not("blurred_path", "is", null)
      .limit(1)
      .maybeSingle();

    // Einmal-Token: Klartext nur in der Mail, DB speichert den Hash.
    const raw = new Uint8Array(TOKEN_BYTES);
    crypto.getRandomValues(raw);
    const token = b64url(raw);
    const { error: tokenError } = await admin.from("case_confirm_tokens").insert({
      case_id: c.id,
      token_hash: await sha256Hex(token),
      expires_at: expiresAt,
    });
    if (tokenError) continue; // Fall bleibt 'geprueft' und kommt naechste Woche wieder

    const mapUrl = `https://www.openstreetmap.org/?mlat=${c.location_lat}&mlon=${c.location_lng}#map=18/${c.location_lat}/${c.location_lng}`;
    const photoUrl = photo?.blurred_path
      ? `${supabaseUrl}/storage/v1/object/public/public-blurred/${photo.blurred_path}`
      : null;
    const confirmUrl = `${supabaseUrl}/functions/v1/confirm-case-done?token=${token}`;

    items.push(`
      <li style="margin-bottom:16px">
        <strong>${(c.title ?? "Muellfund").replace(/</g, "&lt;")}</strong>
        (gemeldet ${new Date(c.created_at).toLocaleDateString("de-DE")})<br>
        <a href="${mapUrl}">Karte oeffnen</a>
        ${photoUrl ? ` · <a href="${photoUrl}">Foto (anonymisiert)</a>` : ""}
        · <a href="${confirmUrl}">Als erledigt markieren</a> (Link ist einmalig gueltig)
      </li>`);
  }

  const html = `
    <p>Guten Tag,</p>
    <p>CLAR hat diese Woche ${items.length} geprüfte Müll-Meldungen für Sie:</p>
    <ul>${items.join("")}</ul>
    <p>Die "erledigt"-Links sind einmalig und ${ttlDays} Tage gültig.
       Fotos sind automatisch anonymisiert (Gesichter/Kennzeichen).</p>`;

  // Versand: Resend, wenn konfiguriert; sonst nur protokollieren (DEV).
  let delivery: "resend" | "logged" = "logged";
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: Deno.env.get("DIGEST_FROM_EMAIL") ?? "clar@notifications.local",
        to: [recipient],
        subject: `CLAR Wochen-Digest: ${items.length} geprüfte Meldungen`,
        html,
      }),
    });
    if (res.ok) delivery = "resend";
    // Fehlerdetails NICHT loggen (koennten Empfaenger/Headers enthalten).
  }

  const caseIds = cases.map((c) => c.id);
  await admin.from("authority_digests").insert({ recipient, case_ids: caseIds, delivery });

  // Erst nach erfolgreichem Versand/Protokoll: geprueft -> weitergeleitet.
  for (const id of caseIds) {
    await admin.from("cases").update({ status: "weitergeleitet" }).eq("id", id);
  }

  return new Response(JSON.stringify({ ok: true, cases: caseIds.length, delivery }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
