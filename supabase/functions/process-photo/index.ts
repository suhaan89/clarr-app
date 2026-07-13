// CLAR — Edge Function: process-photo (Paket 5)
//
// Pipeline pro Foto (originals -> public-blurred):
//   1. EXIF/GPS strippen  — ImageScript decodiert nur Pixel; der Re-Encode
//      als JPEG enthaelt garantiert keine Metadaten mehr.
//   2. pHash (dHash, 64 bit) berechnen und speichern (Duplikat-Erkennung).
//   3. Gesichter + Kfz-Kennzeichen unkenntlich machen (Pixelierung der vom
//      Vision-Modell gelieferten Regionen, grosszuegig gepolstert).
//   4. Ergebnis in den oeffentlich lesbaren Bucket public-blurred schreiben
//      (nur die Service-Role darf dorthin schreiben).
//
// !!! WICHTIG — BLURRING IST FEHLBAR !!!
// Die automatische Erkennung von Gesichtern/Kennzeichen kann Regionen
// uebersehen. Deshalb liegt VOR der oeffentlichen Anzeige ein Pruefschritt:
//   * Meldet das Modell Personen/Kennzeichen, bleibt das Foto approved=FALSE
//     und geht in die manuelle Review (Paket 8), auch wenn gepixelt wurde.
//   * Ist die Erkennung nicht moeglich (Budget/Kill-Switch/Fehler), wird das
//     Foto NICHT veroeffentlicht (fail-safe).
// Das ist eine technische Vorsichtsmassnahme, keine rechtliche Bewertung.
//
// Aktion 'delete': entfernt Original + ALLE Derivate + DB-Zeile (Owner only).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

import { corsHeadersFor } from "../_shared/security.ts";

const MODEL = "claude-sonnet-4-6";
const USD_PER_INPUT_TOKEN = 3 / 1_000_000;
const USD_PER_OUTPUT_TOKEN = 15 / 1_000_000;
const ESTIMATED_COST_USD = 0.012;
const MAX_PUBLIC_DIMENSION = 1600;
const MAX_DETECT_DIMENSION = 1024;
const PIXELATE_BLOCK = 24;
const REGION_PADDING = 0.15; // 15 % Polster um jede erkannte Region
const DUPLICATE_HAMMING_THRESHOLD = 5; // von 64 Bit — dHash-Faustregel fuer Nah-Duplikate
const DUPLICATE_LOOKBACK_DAYS = 30;

const DETECT_PROMPT = `Du hilfst einer Umwelt-App, Fotos vor der Veroeffentlichung zu anonymisieren.
Finde ALLE menschlichen Gesichter und ALLE Kfz-Kennzeichen im Bild.
Antworte NUR mit gueltigem JSON:
{ "regions": [ { "type": "face" | "plate", "x": number, "y": number, "w": number, "h": number } ], "peopleVisible": boolean }
Koordinaten normalisiert auf 0-1000 (x,y = linke obere Ecke der Region, bezogen auf das Gesamtbild).
Sei grosszuegig: lieber eine Region zu viel oder zu gross als eine uebersehen.
"peopleVisible": true, wenn Personen erkennbar sind (auch ohne klares Gesicht).`;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// dHash: 9x8-Graustufen, horizontale Gradienten -> 64 bit als Hex-String.
function dHash(img: Image): string {
  const small = img.clone().resize(9, 8);
  let bits = "";
  for (let y = 1; y <= 8; y++) {
    for (let x = 1; x <= 8; x++) {
      const a = small.getPixelAt(x, y);
      const b = small.getPixelAt(x + 1, y);
      const lumA = ((a >> 24) & 0xff) * 0.299 + ((a >> 16) & 0xff) * 0.587 + ((a >> 8) & 0xff) * 0.114;
      const lumB = ((b >> 24) & 0xff) * 0.299 + ((b >> 16) & 0xff) * 0.587 + ((b >> 8) & 0xff) * 0.114;
      bits += lumA > lumB ? "1" : "0";
    }
  }
  return BigInt("0b" + bits).toString(16).padStart(16, "0");
}

// Hamming-Distanz zweier 64-bit dHash-Hex-Strings (Anzahl abweichender Bits).
// <= DUPLICATE_HAMMING_THRESHOLD gilt als Nah-Duplikat (uebliche Faustregel
// fuer dHash: 0 = identisch, <=5 = sehr aehnlich/gleiches Motiv erneut fotografiert).
function hammingDistanceHex(a: string, b: string): number {
  const bitsA = BigInt("0x" + a);
  const bitsB = BigInt("0x" + b);
  let xor = bitsA ^ bitsB;
  let count = 0;
  while (xor > 0n) {
    count += Number(xor & 1n);
    xor >>= 1n;
  }
  return count;
}

// Mosaik-Pixelierung einer Region (unumkehrbar bei grossen Bloecken).
function pixelateRegion(img: Image, rx: number, ry: number, rw: number, rh: number) {
  const x0 = Math.max(1, Math.floor(rx));
  const y0 = Math.max(1, Math.floor(ry));
  const x1 = Math.min(img.width, Math.ceil(rx + rw));
  const y1 = Math.min(img.height, Math.ceil(ry + rh));

  for (let by = y0; by <= y1; by += PIXELATE_BLOCK) {
    for (let bx = x0; bx <= x1; bx += PIXELATE_BLOCK) {
      const bw = Math.min(PIXELATE_BLOCK, x1 - bx + 1);
      const bh = Math.min(PIXELATE_BLOCK, y1 - by + 1);
      if (bw <= 0 || bh <= 0) continue;

      let r = 0, g = 0, b = 0, n = 0;
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          const p = img.getPixelAt(x, y);
          r += (p >> 24) & 0xff;
          g += (p >> 16) & 0xff;
          b += (p >> 8) & 0xff;
          n++;
        }
      }
      const avg = (Math.round(r / n) << 24) | (Math.round(g / n) << 16) | (Math.round(b / n) << 8) | 0xff;
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          img.setPixelAt(x, y, avg >>> 0);
        }
      }
    }
  }
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

    // ---------- Aktion: LOESCHEN (Original + alle Derivate + DB-Zeile) ----------
    if (body.action === "delete") {
      const photoId = typeof body.photo_id === "string" ? body.photo_id : null;
      if (!photoId) return json(400, { error: "photo_id_required" });

      const { data: photo } = await admin
        .from("report_photos")
        .select("id, user_id, storage_path, blurred_path")
        .eq("id", photoId)
        .single();

      if (!photo || photo.user_id !== user.id) {
        return json(404, { error: "photo_not_found" });
      }

      await admin.storage.from("originals").remove([photo.storage_path]);
      if (photo.blurred_path) {
        await admin.storage.from("public-blurred").remove([photo.blurred_path]);
      }
      await admin.from("report_photos").delete().eq("id", photoId);

      await admin.from("audit_log").insert({
        actor_user_id: user.id,
        action: "photo_deleted",
        entity_type: "report_photo",
        entity_id: photoId,
      });

      return json(200, { deleted: true });
    }

    // ---------- Aktion: VERARBEITEN (alle unverarbeiteten Fotos des Reports) ----------
    const reportId = typeof body.report_id === "string" ? body.report_id : null;
    if (!reportId) return json(400, { error: "report_id_required" });

    const { data: rlOk } = await admin.rpc("check_and_log_rate_limit", {
      p_user_id: user.id,
      p_device_hash: null,
      p_ip_hash: null,
      p_action: "process_photo",
      p_max: 15,
      p_window_secs: 600,
    });
    if (rlOk === false) return json(429, { error: "rate_limited" });

    const { data: photos } = await admin
      .from("report_photos")
      .select("id, user_id, storage_path, processed_at")
      .eq("report_id", reportId)
      .eq("user_id", user.id)
      .is("processed_at", null);

    if (!photos || photos.length === 0) {
      return json(200, { processed: 0, note: "nothing_to_process" });
    }

    const results: Array<Record<string, unknown>> = [];

    for (const photo of photos) {
      try {
        const { data: blob, error: dlError } = await admin.storage
          .from("originals")
          .download(photo.storage_path);
        if (dlError || !blob) throw new Error("download_failed");

        const original = new Uint8Array(await blob.arrayBuffer());
        const img = await Image.decode(original);

        // 1. EXIF weg + Groesse begrenzen (Re-Encode traegt keine Metadaten)
        if (Math.max(img.width, img.height) > MAX_PUBLIC_DIMENSION) {
          if (img.width >= img.height) img.resize(MAX_PUBLIC_DIMENSION, Image.RESIZE_AUTO);
          else img.resize(Image.RESIZE_AUTO, MAX_PUBLIC_DIMENSION);
        }

        // 2. pHash auf dem bereinigten Bild
        const phash = dHash(img);

        // 2b. Duplikat-Abgleich: Hamming-Distanz gegen kuerzlich eingereichte
        // Fotos DESSELBEN Users (z. B. dasselbe Motiv erneut fotografiert, um
        // mehrfach Punkte zu sammeln). Ein Treffer veroeffentlicht das Foto
        // NICHT automatisch, sondern markiert es zur Review — es wird nie
        // stillschweigend geloescht/abgelehnt, ein Mensch entscheidet.
        let duplicateSuspect = false;
        let duplicateOfId: string | null = null;
        const { data: recentPhotos } = await admin
          .from("report_photos")
          .select("id, phash")
          .eq("user_id", user.id)
          .neq("id", photo.id)
          .not("phash", "is", null)
          .gte("created_at", new Date(Date.now() - DUPLICATE_LOOKBACK_DAYS * 86_400_000).toISOString())
          .limit(200);
        for (const candidate of recentPhotos ?? []) {
          if (candidate.phash && hammingDistanceHex(phash, candidate.phash) <= DUPLICATE_HAMMING_THRESHOLD) {
            duplicateSuspect = true;
            duplicateOfId = candidate.id;
            break;
          }
        }

        // 3. Gesichter/Kennzeichen erkennen (budgetiert, race-sicher)
        const { data: reservation } = await admin.rpc("reserve_vision_budget", {
          p_user_id: user.id,
          p_report_id: reportId,
          p_model: MODEL,
          p_estimated_cost_usd: ESTIMATED_COST_USD,
        });

        if (!reservation?.allowed) {
          // FAIL-SAFE: ohne Erkennung keine Veroeffentlichung. Metadaten
          // (EXIF-Strip, pHash) speichern wir trotzdem; approved bleibt FALSE.
          await admin.from("report_photos").update({
            phash,
            exif_stripped: true,
            duplicate_suspect: duplicateSuspect,
            duplicate_of: duplicateOfId,
            processed_at: new Date().toISOString(),
          }).eq("id", photo.id);
          results.push({ photo_id: photo.id, published: false, reason: reservation?.reason ?? "budget" });
          continue;
        }

        const detectImg = img.clone();
        if (Math.max(detectImg.width, detectImg.height) > MAX_DETECT_DIMENSION) {
          if (detectImg.width >= detectImg.height) detectImg.resize(MAX_DETECT_DIMENSION, Image.RESIZE_AUTO);
          else detectImg.resize(Image.RESIZE_AUTO, MAX_DETECT_DIMENSION);
        }
        const detectJpeg = await detectImg.encodeJPEG(70);

        let regions: Array<{ type: string; x: number; y: number; w: number; h: number }> = [];
        let peopleVisible = false;
        let detectionOk = false;

        try {
          const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
          const response = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 500,
            system: DETECT_PROMPT,
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: "image/jpeg", data: toBase64(detectJpeg) } },
                { type: "text", text: "Finde Gesichter und Kennzeichen, antworte als JSON." },
              ],
            }],
          });

          const actualCost =
            response.usage.input_tokens * USD_PER_INPUT_TOKEN +
            response.usage.output_tokens * USD_PER_OUTPUT_TOKEN;
          await admin.rpc("finalize_vision_usage", {
            p_usage_id: reservation.usage_id,
            p_input_tokens: response.usage.input_tokens,
            p_output_tokens: response.usage.output_tokens,
            p_cost_usd: actualCost,
            p_success: true,
          });

          const textContent = response.content.find((c) => c.type === "text");
          const match = textContent && textContent.type === "text"
            ? textContent.text.match(/\{[\s\S]*\}/)
            : null;
          if (match) {
            const parsed = JSON.parse(match[0]);
            regions = Array.isArray(parsed.regions) ? parsed.regions : [];
            peopleVisible = parsed.peopleVisible === true;
            detectionOk = true;
          }
        } catch (detectError) {
          console.error(
            "process-photo detection error:",
            detectError instanceof Error ? detectError.message : "unknown",
          );
          await admin.rpc("finalize_vision_usage", {
            p_usage_id: reservation.usage_id,
            p_input_tokens: null,
            p_output_tokens: null,
            p_cost_usd: null,
            p_success: false,
          });
        }

        if (!detectionOk) {
          // FAIL-SAFE: Erkennung fehlgeschlagen -> nicht veroeffentlichen.
          await admin.from("report_photos").update({
            phash,
            exif_stripped: true,
            duplicate_suspect: duplicateSuspect,
            duplicate_of: duplicateOfId,
            processed_at: new Date().toISOString(),
          }).eq("id", photo.id);
          results.push({ photo_id: photo.id, published: false, reason: "detection_failed" });
          continue;
        }

        // 4. Regionen pixelieren (mit Polster), Koordinaten 0-1000 -> Pixel
        let faces = 0, plates = 0;
        for (const region of regions) {
          const rx = (Number(region.x) / 1000) * img.width;
          const ry = (Number(region.y) / 1000) * img.height;
          const rw = (Number(region.w) / 1000) * img.width;
          const rh = (Number(region.h) / 1000) * img.height;
          if (!Number.isFinite(rx + ry + rw + rh) || rw <= 0 || rh <= 0) continue;

          const padX = rw * REGION_PADDING;
          const padY = rh * REGION_PADDING;
          pixelateRegion(img, rx - padX, ry - padY, rw + 2 * padX, rh + 2 * padY);

          if (region.type === "plate") plates++;
          else faces++;
        }

        const blurredJpeg = await img.encodeJPEG(80);
        const blurredPath = `${reportId}/${photo.id}.jpg`;
        const { error: upError } = await admin.storage
          .from("public-blurred")
          .upload(blurredPath, blurredJpeg, { contentType: "image/jpeg", upsert: true });
        if (upError) throw upError;

        // PRUEFSCHRITT VOR VEROEFFENTLICHUNG (Blurring ist fehlbar):
        // Personen/Kennzeichen im Bild ODER Duplikat-Verdacht -> approved
        // bleibt FALSE, ein Mensch prueft in der Review (Paket 8). Nur Bilder
        // ohne erkannte Personen/Kennzeichen UND ohne Duplikat-Verdacht
        // werden automatisch freigegeben.
        const autoApprove = regions.length === 0 && !peopleVisible && !duplicateSuspect;

        if (regions.length > 0 || peopleVisible) {
          // Pruefschritt (Paket 8): Mensch sichtet das gepixelte Foto,
          // bevor es oeffentlich wird.
          await admin.from("review_queue")
            .insert({ report_id: reportId, reason: "personen_im_bild" })
            .select()
            .then(({ error }) => {
              // Offener Eintrag mit gleichem Grund existiert schon (partial
              // unique index) -> kein Fehler, einfach ignorieren.
              if (error && error.code !== "23505") throw error;
            });
        }
        if (duplicateSuspect) {
          await admin.from("review_queue")
            .insert({ report_id: reportId, reason: "duplikat_verdacht" })
            .select()
            .then(({ error }) => {
              if (error && error.code !== "23505") throw error;
            });
        }

        await admin.from("report_photos").update({
          phash,
          blurred_path: blurredPath,
          exif_stripped: true,
          faces_blurred: faces > 0,
          plates_blurred: plates > 0,
          duplicate_suspect: duplicateSuspect,
          duplicate_of: duplicateOfId,
          approved: autoApprove,
          processed_at: new Date().toISOString(),
        }).eq("id", photo.id);

        results.push({
          photo_id: photo.id,
          published: autoApprove,
          needs_review: !autoApprove,
          regions_pixelated: regions.length,
          duplicate_suspect: duplicateSuspect,
        });
      } catch (photoError) {
        console.error(
          "process-photo error for photo:",
          photoError instanceof Error ? photoError.message : "unknown",
        );
        results.push({ photo_id: photo.id, published: false, reason: "processing_error" });
      }
    }

    return json(200, { processed: results.length, results });
  } catch (error) {
    console.error("process-photo error:", error instanceof Error ? error.message : "unknown");
    return json(500, { error: "internal_error" });
  }
});
