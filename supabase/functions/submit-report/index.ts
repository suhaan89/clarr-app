// CLAR — Edge Function: submit-report (Paket 3)
//
// Der EINZIGE Weg, eine Meldung anzulegen. Clients koennen dank REVOKE
// (Migration 004) nicht direkt in `reports` schreiben.
//
// Pruefkette (in dieser Reihenfolge, frueher Abbruch = keine Kosten):
//   1. Auth-Pflicht (JWT)
//   2. verification_level muss 'aktiv' sein (Mail verifiziert + Regeln)
//   3. Rate-Limit pro Konto + Geraet/IP (nur SHA-256-Hashes, nie rohe IPs)
//   4. Plausibilitaet: Mock-Location / unplausible Geschwindigkeit
//      -> Meldung wird angenommen, aber reputation_score sinkt und die
//         Meldung wird als location_suspect markiert (Review statt Strafe)
//   5. Tagesquota (10/Tag) + Fall-Buendelung atomar in submit_report_tx()
//
// Geo + Zeit werden serverseitig gesetzt/validiert: created_at ist Server-NOW,
// Koordinaten werden validiert; das Vision-Budget wird hier nur vor-geprueft
// (voller Kill-Switch in Paket 4 / analyze-photo).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor, sha256Hex } from "../_shared/security.ts";

const RATE_LIMIT_MAX = 5; // Einreichungen ...
const RATE_LIMIT_WINDOW_SECS = 600; // ... pro 10 Minuten (Konto ODER Geraet ODER IP)
const MAX_PLAUSIBLE_SPEED_KMH = 200;
const MAX_PHOTOS = 5;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

// Foto-Pfade muessen Storage-Objektschluessel UNTER dem eigenen User-Prefix
// sein (Konvention originals/<uid>/...). Das verhindert am Rand:
//   * SSRF: keine http(s)-/interne URLs, die der Server spaeter fetch()t
//   * Cross-Tenant: kein Verweis auf fremde Originale (<andere-uid>/...)
//   * Path-Traversal: kein ".."
// (Der DB-Trigger enforce_photo_path_owner, Migration 014, ist der Backstop.)
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
  const corsHeaders = corsHeadersFor(req);
  function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Auth-Pflicht
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

    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    // Serverseitiger Laengendeckel — dem Client-Limit (500) nicht vertrauen.
    const description = typeof body.description === "string" ? body.description.slice(0, 1000) : "";
    const mocked = body.mocked === true;
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.slice(0, 128) : null;
    // Offline-Sync: clientseitiger Idempotenz-Schluessel (Paket 9).
    const clientKey = typeof body.clientKey === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.clientKey)
      ? body.clientKey
      : null;
    // Foto-Quelle: nur In-App-Kamera ist wertbar; Galerie geht ohne Punkte.
    const source = body.source === "gallery" ? "gallery" : "camera";
    const photoPaths: string[] = Array.isArray(body.photoPaths)
      ? body.photoPaths.filter((p: unknown) => typeof p === "string").slice(0, MAX_PHOTOS)
      : [];

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return json(400, { error: "invalid_location" });
    }
    if (photoPaths.length === 0) {
      return json(400, { error: "photo_required" });
    }
    // Jeder Pfad MUSS unter dem eigenen User-Prefix liegen (SSRF/Cross-Tenant).
    if (!photoPaths.every((p) => isOwnStoragePath(p, user.id))) {
      return json(400, { error: "invalid_photo_path" });
    }

    // 2. Nur 'aktiv' darf wertbare Meldungen einreichen
    const { data: profile } = await admin
      .from("user_profiles")
      .select("verification_level, reputation_score")
      .eq("id", user.id)
      .single();

    if (!profile || profile.verification_level !== "aktiv") {
      return json(403, {
        error: "not_active",
        verification_level: profile?.verification_level ?? "neu",
        hint: "E-Mail bestaetigen und Community-Regeln akzeptieren (activate_account).",
      });
    }

    // 3. Rate-Limit pro Konto + Geraet/IP — nur Hashes, keine Roh-Daten
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    const ipHash = ip ? await sha256Hex(`ip:${ip}`) : null;
    const deviceHash = deviceId ? await sha256Hex(`dev:${deviceId}`) : null;

    const { data: rlOk, error: rlError } = await admin.rpc("check_and_log_rate_limit", {
      p_user_id: user.id,
      p_device_hash: deviceHash,
      p_ip_hash: ipHash,
      p_action: "submit_report",
      p_max: RATE_LIMIT_MAX,
      p_window_secs: RATE_LIMIT_WINDOW_SECS,
    });
    if (rlError) throw rlError;
    if (!rlOk) return json(429, { error: "rate_limited" });

    // 4. Plausibilitaet: Mock-Location + Geschwindigkeit seit letzter Meldung
    let locationSuspect = false;
    if (mocked) {
      locationSuspect = true;
      await admin.rpc("adjust_reputation", {
        p_user_id: user.id,
        p_delta: -10,
        p_reason: "mock_location",
      });
    } else {
      const { data: lastReport } = await admin
        .from("reports")
        .select("latitude, longitude, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastReport) {
        const hours =
          (Date.now() - new Date(lastReport.created_at).getTime()) / 3_600_000;
        const km = haversineKm(
          lastReport.latitude,
          lastReport.longitude,
          latitude,
          longitude,
        );
        if (hours > 0 && km / hours > MAX_PLAUSIBLE_SPEED_KMH) {
          locationSuspect = true;
          await admin.rpc("adjust_reputation", {
            p_user_id: user.id,
            p_delta: -5,
            p_reason: "implausible_speed",
          });
        }
      }
    }

    // 5. Vision-Budget-Vorpruefung (harte Durchsetzung in analyze-photo, Paket 4)
    const { data: budget } = await admin.rpc("vision_budget_status", {
      p_user_id: user.id,
    });

    // 6. Quota + Fall-Buendelung + Insert, atomar. Zeitstempel = Server-NOW.
    const { data: result, error: txError } = await admin.rpc("submit_report_tx_v2", {
      p_user_id: user.id,
      p_lat: latitude,
      p_lng: longitude,
      p_description: description,
      p_photo_paths: photoPaths,
      p_location_suspect: locationSuspect,
      p_device_hash: deviceHash,
      p_client_key: clientKey,
      p_source: source,
    });
    if (txError) throw txError;

    if (!result?.ok) {
      const status = result?.error === "quota_exceeded" ? 429 : 400;
      return json(status, result ?? { error: "unknown" });
    }

    return json(200, {
      ...result,
      location_suspect: locationSuspect,
      vision_allowed:
        budget?.global_ok === true && budget?.user_ok === true,
    });
  } catch (error) {
    console.error("submit-report error:", error instanceof Error ? error.message : error);
    return json(500, { error: "internal_error" });
  }
});
