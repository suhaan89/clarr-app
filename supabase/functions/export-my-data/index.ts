// CLAR — Edge Function: export-my-data (Paket 11, Art. 15 DSGVO)
//
// Self-Service-Datenexport: liefert ALLE zum eigenen Account gespeicherten
// Daten als JSON. Strikt nur der eigene Account (user_id aus dem JWT —
// es gibt keinen Parameter, mit dem man fremde Daten anfordern koennte).
// Original-Fotos werden als kurzlebige Signed URLs beigelegt.

import { ipHashFromRequest, checkRateLimit } from "../_shared/security.ts";
import { serveUserFunction } from "../_shared/http.ts";

serveUserFunction("export-my-data", async ({ req, user, admin, json }) => {
  const uid = user.id;

  // Leichtes, defensives Limit — verhindert, dass ein kompromittiertes
  // Token den Export-Endpunkt (7 Tabellen + Signed-URL-Generierung je
  // Foto) im Sekundentakt ausloest.
  const rlOk = await checkRateLimit(admin, {
    userId: uid,
    deviceHash: null,
    ipHash: await ipHashFromRequest(req),
    action: "export_my_data",
    max: 5,
    windowSecs: 3600,
  });
  if (!rlOk) {
    return json(429, { error: "rate_limited" });
  }

  const [
    profile,
    reports,
    photos,
    ledger,
    consents,
    flags,
    signups,
    auditLog,
    visionUsage,
    ownEvents,
    rateLimits,
    trainingSamples,
  ] = await Promise.all([
    admin.from("user_profiles").select("*").eq("id", uid).maybeSingle(),
    admin.from("reports").select("*").eq("user_id", uid),
    admin.from("report_photos").select("*").eq("user_id", uid),
    admin.from("points_ledger").select("*").eq("user_id", uid),
    admin.from("consents").select("*").eq("user_id", uid),
    admin.from("moderation_flags").select("*").eq("user_id", uid),
    admin.from("cleanup_signups").select("*").eq("user_id", uid),
    // Art. 15 DSGVO: auch Eintraege, in denen der User selbst der Akteur
    // war (z. B. eigene Meldungen/Loeschungen) — KEINE Eintraege, in denen
    // er nur als Ziel/entity_id vorkommt (dort steht i. d. R. keine
    // personenbezogene ID, sondern eine report_id/case_id o. ae.).
    admin.from("audit_log").select("*").eq("actor_user_id", uid),
    // KI-Kostenerfassung (Paket 4) — enthaelt keine Bildinhalte, nur
    // Modell/Kosten/Zeitpunkt je eigenem Report.
    admin.from("vision_usage").select("*").eq("user_id", uid),
    // Selbst angelegte Cleanup-Aktionen: bisher fehlten sie im Export,
    // obwohl sie ueber created_by personenbezogen sind (Art. 15 DSGVO).
    admin.from("cleanup_events").select("*").eq("created_by", uid),
    // Missbrauchsschutz-Zeilen. Sie enthalten nur Hashes, sind aber ueber
    // user_id dem Konto zugeordnet und damit auskunftspflichtig.
    admin.from("rate_limit_events").select("*").eq("user_id", uid),
    // Trainingsdaten-Zeilen (Migration 023) — nur mit Einwilligung vorhanden.
    admin.from("vision_training_samples").select("*").eq("user_id", uid),
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
    details: { tables: 12 },
  });

  return json(200, {
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
    audit_log: auditLog.data,
    vision_usage: visionUsage.data,
    cleanup_events_created: ownEvents.data,
    rate_limit_events: rateLimits.data,
    vision_training_samples: trainingSamples.data,
    hinweis:
      "Signed URLs sind 1 Stunde gueltig. Veroeffentlichte Fotos existieren zusaetzlich anonymisiert (geblurrt). " +
      "audit_log enthaelt nur Eintraege, in denen dieses Konto selbst gehandelt hat (actor_user_id) — " +
      "nicht jede Zeile, in der die Konto-ID irgendwo als Referenz (z. B. entity_id) vorkommt. " +
      "rate_limit_events enthaelt ausschliesslich Pruefsummen (SHA-256) von Geraet und IP, nie die Werte selbst. " +
      "Die Anmeldedaten selbst (E-Mail, Zeitpunkt der Registrierung) stehen unter 'account'; " +
      "das Passwort liegt nur als nicht umkehrbarer Hash bei Supabase und ist deshalb nicht exportierbar.",
  });
});
