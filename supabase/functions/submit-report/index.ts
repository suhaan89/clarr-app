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
// Optional kommt der On-Device-Score der App mit (Migration 023). Er wird
// nur gespeichert, nie fuer Punkte oder Freigaben verwendet.
//
// Geo + Zeit werden serverseitig gesetzt/validiert: created_at ist Server-NOW,
// Koordinaten werden validiert; das Vision-Budget wird hier nur vor-geprueft
// (voller Kill-Switch in Paket 4 / analyze-photo).

import { sha256Hex } from "../_shared/security.ts";
import { isOwnStoragePath, serveUserFunction, stringList } from "../_shared/http.ts";

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

serveUserFunction("submit-report", async ({ req, user, admin, json }) => {
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
  const photoPaths = stringList(body.photoPaths, MAX_PHOTOS);
  // On-Device-Hinweis (Migration 023): nur gespeichert, nie vertraut.
  const ondeviceScore = typeof body.ondeviceScore === "number" &&
      Number.isFinite(body.ondeviceScore) && body.ondeviceScore >= 0 && body.ondeviceScore <= 1
    ? body.ondeviceScore
    : null;
  const ondeviceModelVersion = typeof body.ondeviceModelVersion === "string" &&
      /^[A-Za-z0-9._-]{1,64}$/.test(body.ondeviceModelVersion)
    ? body.ondeviceModelVersion
    : null;

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

  // 7. On-Device-Score nachtragen (best effort, nur bei neuer Meldung).
  //    Nur Score + Version einer bekannten, veroeffentlichten Modellversion;
  //    beides zusammen oder gar nichts. Ein Fehler hier bricht nichts ab.
  if (!result.idempotent && result.report_id && ondeviceScore !== null && ondeviceModelVersion) {
    const { data: model } = await admin
      .from("vision_models")
      .select("version")
      .eq("version", ondeviceModelVersion)
      .in("status", ["aktiv", "zurueckgezogen"])
      .maybeSingle();
    if (model) {
      const { error: odError } = await admin
        .from("reports")
        .update({ ondevice_score: ondeviceScore, ondevice_model_version: ondeviceModelVersion })
        .eq("id", result.report_id);
      if (odError) console.error("submit-report ondevice:", odError.message);
    }
  }

  return json(200, {
    ...result,
    location_suspect: locationSuspect,
    vision_allowed:
      budget?.global_ok === true && budget?.user_ok === true,
  });
});
