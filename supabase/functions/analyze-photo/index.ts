// CLAR — Edge Function: analyze-photo (Paket 4)
//
// KI-Pruefung eines eingereichten Reports. Der Anthropic-Key liegt NUR als
// Supabase Function Secret (ANTHROPIC_API_KEY) — nie im Client, nie in Logs.
//
// Aufruf nur nach bestandener submit-report-Pruefung: Voraussetzung ist ein
// existierender Report des Aufrufers im Zustand 'gemeldet' ohne bisheriges
// KI-Ergebnis — solche Reports entstehen ausschliesslich ueber submit-report.
//
// Budget/Kill-Switch (Migration 005, race-sicher):
//   * reserve_vision_budget() prueft doppelt gedeckelt (Nutzer + global/Tag)
//     und reserviert pessimistisch VOR dem API-Call.
//   * Kill-Switch/Budget erschoepft -> KEIN Vision-Call; Meldung geht
//     unklassifiziert in die Review-Queue (status in_pruefung,
//     vision_skipped) — die App bleibt nutzbar. Alert ab 80 % via audit_log.
//   * Bild wird vorher serverseitig verkleinert (max. 1024 px, JPEG).
//
// Ergebnis-Routing (apply_vision_result):
//   Gewalt/Nacktheit -> sofort blockiert (abgelehnt), nie oeffentlich.
//   Confidence < Schwelle -> Review-Queue. Sonst ki_verifiziert.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "claude-sonnet-4-6";
// Sonnet-Preise: $3 / 1M Input-Tokens, $15 / 1M Output-Tokens
const USD_PER_INPUT_TOKEN = 3 / 1_000_000;
const USD_PER_OUTPUT_TOKEN = 15 / 1_000_000;
// Pessimistische Reservierung pro Call (Bild ~1024px + Prompt + Antwort)
const ESTIMATED_COST_USD = 0.015;
const CONFIDENCE_THRESHOLD = 0.6;
const MAX_IMAGE_DIMENSION = 1024;

const SYSTEM_PROMPT = `Du bist ein KI-Erkennungssystem fuer die CLAR-App, die illegale Muellablagerungen dokumentiert.

Analysiere das Bild in ZWEI Schritten:

SCHRITT 1 — Sicherheit: Enthaelt das Bild Gewalt, Nacktheit oder sexuelle Inhalte?
Wenn ja, setze "unsafeContent" auf "violence" bzw. "nudity" und bewerte NICHT weiter.
Erkennbare Personen oder Kfz-Kennzeichen sind KEIN unsafeContent (werden separat unkenntlich gemacht) — vermerke sie aber in "containsPeople".

SCHRITT 2 — Muell: Zeigt das Bild eine illegale Muellablagerung, Vermuellung oder Umweltverschmutzung?

POSITIV (isWaste: true):
- Illegal entsorgte Abfaelle auf Feldern, Waldwegen, Gruenflaechen, Strassenraendern oder Gewaessern
- Haufenweise weggeworfener Muell (Hausmuell, Sperrgut, Bauschutt, Reifen, Elektroschrott)
- Verstreute Einwegartikel/Verpackungen in Natur oder auf oeffentlichen Flaechen
- Unsachgemaess entsorgte Chemikalien oder Gefahrstoffe

NEGATIV (isWaste: false):
- Saubere Flaechen ohne Muell
- Ordnungsgemaesse Muellbehaelter/Container (auch voll)
- Hausmuell in Saecken/Tonnen am Abholort
- Baustellen mit ordentlich gelagertem Material
- Kompost/Gartenabfaelle auf Privatgelaende

Confidence-Richtlinien:
- 0.85-1.0: eindeutig; 0.65-0.84: wahrscheinlich; 0.40-0.64: unklar/schlechtes Bild; <0.40: kein Hinweis.
Sei konservativ: Fehlalarme schaden mehr als verpasste Meldungen.

Antworte NUR mit gueltigem JSON:
{ "isWaste": boolean, "confidence": number, "wasteType": string | null, "reason": string, "unsafeContent": "violence" | "nudity" | null, "containsPeople": boolean }

wasteType aus: "Hausmuell", "Sperrgut", "Bauschutt", "Gefaehrlicher Abfall", "Verpackungsmuell", "Elektroschrott", "Organischer Abfall", "Sonstiger Muell" (oder null).
"reason" auf Deutsch, 1-2 Saetze.`;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Serverseitig verkleinern: senkt Kosten und entfernt nebenbei Metadaten
// aus dem an die API gesendeten Bild.
async function downscaleImage(bytes: Uint8Array): Promise<Uint8Array> {
  const img = await Image.decode(bytes);
  if (Math.max(img.width, img.height) > MAX_IMAGE_DIMENSION) {
    if (img.width >= img.height) {
      img.resize(MAX_IMAGE_DIMENSION, Image.RESIZE_AUTO);
    } else {
      img.resize(Image.RESIZE_AUTO, MAX_IMAGE_DIMENSION);
    }
  }
  return await img.encodeJPEG(75);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
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
    const reportId = typeof body?.report_id === "string" ? body.report_id : null;
    if (!reportId) return json(400, { error: "report_id_required" });

    // Gate: Report muss dem Aufrufer gehoeren, frisch aus submit-report
    // stammen ('gemeldet') und noch kein KI-Ergebnis haben (idempotent).
    const { data: report } = await admin
      .from("reports")
      .select("id, user_id, status, ai_confidence, vision_skipped, photo_urls")
      .eq("id", reportId)
      .single();

    if (!report || report.user_id !== user.id) {
      return json(404, { error: "report_not_found" });
    }
    if (report.status !== "gemeldet" || report.ai_confidence !== null || report.vision_skipped) {
      return json(409, { error: "already_analyzed", status: report.status });
    }
    const photoUrl: string | undefined = report.photo_urls?.[0];
    if (!photoUrl) return json(400, { error: "no_photo" });

    // Rate-Limit gegen Hammering (zusaetzlich zum Budget)
    const { data: rlOk } = await admin.rpc("check_and_log_rate_limit", {
      p_user_id: user.id,
      p_device_hash: null,
      p_ip_hash: null,
      p_action: "analyze_photo",
      p_max: 10,
      p_window_secs: 600,
    });
    if (rlOk === false) return json(429, { error: "rate_limited" });

    // Budget race-sicher reservieren — VOR dem teuren Call
    const { data: reservation, error: reserveError } = await admin.rpc(
      "reserve_vision_budget",
      {
        p_user_id: user.id,
        p_report_id: reportId,
        p_model: MODEL,
        p_estimated_cost_usd: ESTIMATED_COST_USD,
      },
    );
    if (reserveError) throw reserveError;

    if (!reservation?.allowed) {
      // KILL-SWITCH / Budget erschoepft: kein Vision-Call. Meldung geht
      // unklassifiziert in die Review-Queue, App bleibt nutzbar.
      await admin.rpc("apply_vision_result", {
        p_report_id: reportId,
        p_outcome: "skipped",
        p_waste_type: null,
        p_confidence: null,
      });
      return json(200, {
        analyzed: false,
        queued_for_review: true,
        reason: reservation?.reason ?? "budget",
      });
    }

    const usageId = reservation.usage_id;

    try {
      // Bild laden + serverseitig verkleinern. Seit Paket 5 enthaelt
      // photo_urls Storage-PFADE im privaten originals-Bucket; Alt-Reports
      // koennen noch volle URLs enthalten.
      let original: Uint8Array;
      if (photoUrl.startsWith("http")) {
        const imgResponse = await fetch(photoUrl);
        if (!imgResponse.ok) throw new Error(`photo fetch failed: ${imgResponse.status}`);
        original = new Uint8Array(await imgResponse.arrayBuffer());
      } else {
        const { data: blob, error: dlError } = await admin.storage
          .from("originals")
          .download(photoUrl);
        if (dlError || !blob) throw new Error("photo download failed");
        original = new Uint8Array(await blob.arrayBuffer());
      }
      const resized = await downscaleImage(original);

      const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/jpeg", data: toBase64(resized) },
              },
              { type: "text", text: "Analysiere dieses Bild und gib das JSON-Ergebnis zurueck." },
            ],
          },
        ],
      });

      const actualCost =
        response.usage.input_tokens * USD_PER_INPUT_TOKEN +
        response.usage.output_tokens * USD_PER_OUTPUT_TOKEN;
      await admin.rpc("finalize_vision_usage", {
        p_usage_id: usageId,
        p_input_tokens: response.usage.input_tokens,
        p_output_tokens: response.usage.output_tokens,
        p_cost_usd: actualCost,
        p_success: true,
      });

      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("no text response");
      }
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("no JSON in response");

      const result = JSON.parse(jsonMatch[0]) as {
        isWaste: boolean;
        confidence: number;
        wasteType: string | null;
        reason: string;
        unsafeContent: "violence" | "nudity" | null;
        containsPeople?: boolean;
      };
      result.confidence = Math.max(0, Math.min(1, Number(result.confidence) || 0));

      // Routing zentral in SQL (apply_vision_result)
      let outcome: string;
      if (result.unsafeContent === "violence" || result.unsafeContent === "nudity") {
        outcome = "unsafe";
      } else if (!result.isWaste) {
        outcome = "not_waste";
      } else if (result.confidence < CONFIDENCE_THRESHOLD) {
        outcome = "low_confidence";
      } else {
        outcome = "ok";
      }

      const { data: applied, error: applyError } = await admin.rpc("apply_vision_result", {
        p_report_id: reportId,
        p_outcome: outcome,
        p_waste_type: result.wasteType,
        p_confidence: result.confidence,
      });
      if (applyError) throw applyError;

      if (outcome === "unsafe") {
        // Bewusst ohne Details — der Inhalt wird nie oeffentlich.
        return json(200, { analyzed: true, blocked: true });
      }

      return json(200, {
        analyzed: true,
        outcome,
        status: applied?.status,
        wasteType: result.wasteType,
        confidence: result.confidence,
        reason: outcome === "ok" ? result.reason : undefined,
        containsPeople: result.containsPeople === true,
      });
    } catch (visionError) {
      // API-/Bildfehler: Reservierung als fehlgeschlagen finalisieren
      // (Schaetzkosten bleiben pessimistisch stehen), Meldung in Review.
      console.error(
        "analyze-photo vision error:",
        visionError instanceof Error ? visionError.message : "unknown",
      );
      await admin.rpc("finalize_vision_usage", {
        p_usage_id: usageId,
        p_input_tokens: null,
        p_output_tokens: null,
        p_cost_usd: null,
        p_success: false,
      });
      await admin.rpc("apply_vision_result", {
        p_report_id: reportId,
        p_outcome: "skipped",
        p_waste_type: null,
        p_confidence: null,
      });
      return json(200, { analyzed: false, queued_for_review: true, reason: "vision_error" });
    }
  } catch (error) {
    console.error("analyze-photo error:", error instanceof Error ? error.message : "unknown");
    return json(500, { error: "internal_error" });
  }
});
