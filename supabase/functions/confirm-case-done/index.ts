// CLAR — Edge Function: confirm-case-done (Paket 7)
//
// "Erledigt"-Ruecklauf der Behoerde aus dem Wochen-Digest.
//   * GET ?token=... — der Link aus der Mail, ohne Login nutzbar.
//     Deploy deshalb mit --no-verify-jwt (siehe docs/real-world-loop.md).
//   * Token ist 256 bit Zufall; die DB kennt nur den SHA-256-Hash.
//     Einloesung ist EINMALIG und atomar (use_case_confirm_token).
//   * Gueltig -> Fall 'weitergeleitet' -> 'erledigt' (Statusmaschine
//     validiert + auditiert), Melder mit Push-Opt-in werden informiert.
//   * Ungueltig/abgelaufen/benutzt -> neutrale Fehlerseite (kein Orakel,
//     welche Tokens existieren).

import { sha256Hex, ipHashFromRequest, checkRateLimit } from "../_shared/security.ts";
import { serviceClient } from "../_shared/http.ts";

function page(status: number, title: string, text: string): Response {
  return new Response(
    `<!doctype html><html lang="de"><meta charset="utf-8">
     <meta name="viewport" content="width=device-width, initial-scale=1">
     <title>${title}</title>
     <body style="font-family:sans-serif;max-width:32em;margin:3em auto;padding:0 1em">
       <h1 style="font-size:1.3em">${title}</h1><p>${text}</p>
     </body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  // Format-Vorpruefung: base64url, feste Laenge — alles andere sofort raus.
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
    return page(400, "Ungültiger Link", "Dieser Link ist unvollständig oder beschädigt.");
  }

  const admin = serviceClient();

  // Oeffentlicher, unauthentifizierter Endpunkt (Klick aus der Behoerden-Mail)
  // — bisher ohne jedes Limit. IP-Hash-basiert begrenzen, damit ein
  // Token-Brute-Force nicht beliebig oft probieren kann.
  const ipHash = await ipHashFromRequest(req);
  const rlOk = await checkRateLimit(admin, {
    userId: null,
    deviceHash: null,
    ipHash,
    action: "confirm_case_done",
    max: 20,
    windowSecs: 600,
  });
  if (!rlOk) {
    return page(429, "Zu viele Versuche", "Bitte in ein paar Minuten erneut versuchen.");
  }

  const { data: caseId, error } = await admin.rpc("use_case_confirm_token", {
    p_token_hash: await sha256Hex(token),
  });
  if (error || !caseId) {
    return page(410, "Link nicht mehr gültig",
      "Dieser Bestätigungslink wurde bereits verwendet oder ist abgelaufen.");
  }

  // weitergeleitet -> erledigt (Statusmaschine + audit_log via Trigger).
  const { error: updateError } = await admin
    .from("cases").update({ status: "erledigt" }).eq("id", caseId)
    .eq("status", "weitergeleitet");
  if (updateError) {
    return page(409, "Fall bereits aktualisiert",
      "Dieser Fall wurde zwischenzeitlich schon abgeschlossen. Vielen Dank!");
  }

  await admin.from("audit_log").insert({
    action: "case_confirmed_by_authority",
    entity_type: "case",
    entity_id: caseId,
    details: { via: "confirm_token" },
  });

  // Push an Melder mit Opt-in — best effort, Fehler brechen nichts ab.
  try {
    const { data: recipients } = await admin.rpc("case_notify_recipients", { p_case_id: caseId });
    const tokens = (recipients ?? [])
      .map((r: { push_token: string | null }) => r.push_token)
      .filter((t: string | null): t is string => !!t && t.startsWith("ExponentPushToken"));
    if (tokens.length > 0) {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokens.map((to: string) => ({
          to,
          title: "Dein gemeldeter Müll wurde entfernt 🎉",
          body: "Die Behörde hat den Fall als erledigt gemeldet. Danke für deinen Beitrag!",
        }))),
      });
    }
  } catch (_) { /* best effort */ }

  return page(200, "Vielen Dank!",
    "Der Fall wurde als erledigt markiert. Die Melderinnen und Melder werden informiert.");
});
