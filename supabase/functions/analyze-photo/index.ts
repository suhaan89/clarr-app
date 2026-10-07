// CLAR — Edge Function: analyze-photo (Paket 4)
//
// KI-Pruefung eines eingereichten Reports. Welcher Anbieter das Bild sieht,
// entscheidet _shared/vision.ts (Standard: Cloudflare Workers AI im
// Gratis-Kontingent). Die Zugangsdaten liegen NUR als Supabase Function
// Secrets vor — nie im Client, nie in Logs.
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
//   * Dasselbe gilt ohne konfigurierten Anbieter und bei jedem Fehler des
//     Anbieters (z. B. Gratis-Kontingent fuer heute verbraucht).
//   * Bild wird vorher serverseitig verkleinert (max. 1024 px, JPEG).
//
// Ergebnis-Routing (apply_vision_result):
//   Gewalt/Nacktheit -> sofort blockiert (abgelehnt), nie oeffentlich.
//   Confidence < Schwelle -> Review-Queue. Sonst ki_verifiziert.
//   On-Device-Score (optional, vom Client) darf nur verschaerfen: "ok" ->
//   Review, wenn er unter ondevice_disagree_below liegt (Standard: aus).

import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";
import { serveUserFunction } from "../_shared/http.ts";
import { extractJsonObject, getVisionProvider } from "../_shared/vision.ts";

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

SCHRITT 3 — Kontext: Wirkt der Ort wie ein PRIVATES Grundstueck oder Wohnkontext
(Garten, Hof, Balkon, Innenraum, private Einfahrt)? Dann "privateContext": true.
Solche Meldungen werden nie oeffentlich angezeigt.

Antworte NUR mit gueltigem JSON:
{ "isWaste": boolean, "confidence": number, "wasteType": string | null, "reason": string, "unsafeContent": "violence" | "nudity" | null, "containsPeople": boolean, "privateContext": boolean }

wasteType aus: "Hausmuell", "Sperrgut", "Bauschutt", "Gefaehrlicher Abfall", "Verpackungsmuell", "Elektroschrott", "Organischer Abfall", "Sonstiger Muell" (oder null).
"reason" auf Deutsch, 1-2 Saetze.`;

const WASTE_TYPES = [
  "Hausmuell",
  "Sperrgut",
  "Bauschutt",
  "Gefaehrlicher Abfall",
  "Verpackungsmuell",
  "Elektroschrott",
  "Organischer Abfall",
  "Sonstiger Muell",
];

type VisionVerdict = {
  isWaste: boolean;
  confidence: number;
  wasteType: string | null;
  reason: string;
  unsafeContent: "violence" | "nudity" | null;
  containsPeople: boolean;
  privateContext: boolean;
};

// Streng lesen: fehlt "isWaste" oder "confidence", gilt die Antwort als
// unbrauchbar (wirft -> Review-Queue). Sonst wuerde eine kaputte Antwort
// als "kein Muell" durchgehen und die Meldung automatisch ablehnen.
function parseVerdict(text: string): VisionVerdict {
  const raw = extractJsonObject(text);
  const confidence = Number(raw.confidence);
  if (typeof raw.isWaste !== "boolean" || !Number.isFinite(confidence)) {
    throw new Error("incomplete vision verdict");
  }
  return {
    isWaste: raw.isWaste,
    confidence: Math.max(0, Math.min(1, confidence)),
    wasteType: typeof raw.wasteType === "string" && WASTE_TYPES.includes(raw.wasteType)
      ? raw.wasteType
      : null,
    reason: typeof raw.reason === "string" ? raw.reason.slice(0, 500) : "",
    unsafeContent: raw.unsafeContent === "violence" || raw.unsafeContent === "nudity"
      ? raw.unsafeContent
      : null,
    containsPeople: raw.containsPeople === true,
    privateContext: raw.privateContext === true,
  };
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

serveUserFunction("analyze-photo", async ({ req, user, admin, json }) => {
  const body = await req.json().catch(() => null);
  const reportId = typeof body?.report_id === "string" ? body.report_id : null;
  if (!reportId) return json(400, { error: "report_id_required" });

  // Gate: Report muss dem Aufrufer gehoeren, frisch aus submit-report
  // stammen ('gemeldet') und noch kein KI-Ergebnis haben (idempotent).
  const { data: report } = await admin
    .from("reports")
    .select("id, user_id, status, ai_confidence, vision_skipped, photo_urls, ondevice_score")
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

  const provider = getVisionProvider();
  if (!provider) {
    // Kein Anbieter konfiguriert: ein Mensch prueft.
    await admin.rpc("apply_vision_result", {
      p_report_id: reportId,
      p_outcome: "skipped",
      p_waste_type: null,
      p_confidence: null,
    });
    return json(200, { analyzed: false, queued_for_review: true, reason: "no_provider" });
  }

  // Budget race-sicher reservieren — VOR dem Call. Bei einem kostenlosen
  // Anbieter ist die Schaetzung 0; der Kill-Switch greift trotzdem.
  const { data: reservation, error: reserveError } = await admin.rpc(
    "reserve_vision_budget",
    {
      p_user_id: user.id,
      p_report_id: reportId,
      p_model: provider.model,
      p_estimated_cost_usd: provider.estimatedCostUsd,
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
      // SSRF-Schutz: nur der eigene Supabase-Storage-Host darf serverseitig
      // gefetcht werden. Alt-Reports (Paket <5) koennen volle Storage-URLs
      // enthalten; beliebige/interne URLs (z. B. Metadata-Endpoints) werden
      // NICHT geladen — die Meldung geht dann in die Review (Catch unten).
      const storageBase = `${Deno.env.get("SUPABASE_URL")!}/storage/`;
      if (!photoUrl.startsWith(storageBase)) {
        throw new Error("untrusted_photo_url");
      }
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

    const reply = await provider.run({
      system: SYSTEM_PROMPT,
      userText: "Analysiere dieses Bild und gib das JSON-Ergebnis zurueck.",
      jpeg: resized,
      maxTokens: 300,
    });
    await admin.rpc("finalize_vision_usage", {
      p_usage_id: usageId,
      p_input_tokens: reply.inputTokens,
      p_output_tokens: reply.outputTokens,
      p_cost_usd: reply.costUsd,
      p_success: true,
    });

    const result = parseVerdict(reply.text);

    // Routing zentral in SQL (apply_vision_result)
    let outcome: string;
    if (result.unsafeContent === "violence" || result.unsafeContent === "nudity") {
      outcome = "unsafe";
    } else if (!result.isWaste) {
      outcome = "not_waste";
    } else if (result.privateContext) {
      // Privatgrund-/Wohnkontext-Verdacht: nie automatisch oeffentlich
      outcome = "private_context";
    } else if (result.confidence < CONFIDENCE_THRESHOLD) {
      outcome = "low_confidence";
    } else {
      outcome = "ok";
    }

    // On-Device-Score (Migration 023) als ZUSAETZLICHES Signal. Er kommt vom
    // Client und ist damit manipulierbar, deshalb gilt nur eine Richtung:
    // er darf ein "ok" in die menschliche Pruefung schieben, aber nie eine
    // Ablehnung aufheben, Kosten sparen oder Punkte ausloesen. Aus, solange
    // system_settings.ondevice_disagree_below = null ist.
    if (outcome === "ok" && typeof report.ondevice_score === "number") {
      const { data: setting } = await admin
        .from("system_settings")
        .select("value")
        .eq("key", "ondevice_disagree_below")
        .maybeSingle();
      const disagreeBelow = typeof setting?.value === "number" ? setting.value : null;
      if (disagreeBelow !== null && report.ondevice_score < disagreeBelow) {
        outcome = "low_confidence";
        await admin.from("audit_log").insert({
          action: "ondevice_disagreement",
          entity_type: "report",
          entity_id: reportId,
          details: { ondevice_score: report.ondevice_score, ai_confidence: result.confidence },
        });
      }
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
      containsPeople: result.containsPeople,
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
});
