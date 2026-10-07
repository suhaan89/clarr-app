// CLAR — austauschbarer Anbieter fuer die serverseitige Bild-KI.
//
// analyze-photo (Muell ja/nein) und process-photo (Gesichter/Kennzeichen)
// rufen das Modell nur noch ueber `getVisionProvider()` auf. Welcher Anbieter
// laeuft, entscheidet das Function Secret VISION_PROVIDER:
//
//   cloudflare (Standard)  Cloudflare Workers AI, Gratis-Kontingent.
//                          Secrets: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN,
//                          optional CLOUDFLARE_VISION_MODEL.
//   anthropic              Claude ueber die Messages-API (kostenpflichtig).
//                          Secret: ANTHROPIC_API_KEY.
//   none                   kein KI-Aufruf; jede Meldung geht an einen Menschen.
//
// Fehlen die Secrets des gewaehlten Anbieters, verhaelt sich alles wie bei
// `none`. Jeder Fehler des Anbieters (Tageslimit erreicht, Timeout, Antwort
// ohne JSON) ist fuer die Aufrufer ein normaler Fehlschlag: die Meldung geht
// in die Review-Queue bzw. das Foto bleibt privat. Kosten entstehen bei
// Cloudflare nie, solange im Konto keine Zahlungsart hinterlegt ist.
//
// ACHTUNG Rechtstexte: Der Anbieter steht in der Datenschutzerklaerung
// (src/app/legal/datenschutz.tsx, Abschnitte 5 und 6). Wer VISION_PROVIDER
// umstellt, muss die Texte und POLICY_VERSION mitziehen.

export type VisionRequest = {
  system: string;
  userText: string;
  jpeg: Uint8Array;
  maxTokens: number;
};

export type VisionReply = {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number;
};

export type VisionProvider = {
  name: "cloudflare" | "anthropic";
  /** Wird in vision_usage protokolliert. */
  model: string;
  /** Pessimistische Reservierung pro Aufruf (reserve_vision_budget). */
  estimatedCostUsd: number;
  run(request: VisionRequest): Promise<VisionReply>;
};

const REQUEST_TIMEOUT_MS = 30_000;

// Apache 2.0, also auch gewerblich frei nutzbar. Llama Vision ist bewusst
// nicht der Standard: dessen Lizenz schliesst Firmen mit Sitz in der EU aus.
const CLOUDFLARE_DEFAULT_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
// Sonnet-Preise: $3 / 1M Input-Tokens, $15 / 1M Output-Tokens
const ANTHROPIC_USD_PER_INPUT_TOKEN = 3 / 1_000_000;
const ANTHROPIC_USD_PER_OUTPUT_TOKEN = 15 / 1_000_000;
// Bild ~1024px + Prompt + Antwort
const ANTHROPIC_ESTIMATED_COST_USD = 0.015;

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Erstes JSON-Objekt aus der Modellantwort. Kleinere Modelle packen gern
 * Text oder ```json-Zaeune drumherum. Wirft, wenn kein Objekt drin ist.
 */
export function extractJsonObject(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("no JSON in response");
  const parsed: unknown = JSON.parse(match[0]);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("response is not a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function tokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function cloudflareProvider(accountId: string, apiToken: string, model: string): VisionProvider {
  return {
    name: "cloudflare",
    model,
    estimatedCostUsd: 0,
    async run({ system, userText, jpeg, maxTokens }) {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          body: JSON.stringify({
            messages: [
              { role: "system", content: system },
              {
                role: "user",
                content: [
                  { type: "text", text: userText },
                  {
                    type: "image_url",
                    image_url: { url: `data:image/jpeg;base64,${toBase64(jpeg)}` },
                  },
                ],
              },
            ],
            max_tokens: maxTokens,
            temperature: 0,
          }),
        },
      );
      // Auch "Gratis-Kontingent fuer heute verbraucht" kommt hier als Fehler an.
      if (!response.ok) throw new Error(`cloudflare ${response.status}`);
      const payload = await response.json();
      const result = payload?.result;
      // Je nach Modell steht die Antwort als Text oder schon als Objekt da.
      const text = typeof result?.response === "string"
        ? result.response
        : result?.response
        ? JSON.stringify(result.response)
        : null;
      if (payload?.success === false || !text) throw new Error("cloudflare empty response");
      return {
        text,
        inputTokens: tokenCount(result.usage?.prompt_tokens),
        outputTokens: tokenCount(result.usage?.completion_tokens),
        costUsd: 0,
      };
    },
  };
}

function anthropicProvider(apiKey: string): VisionProvider {
  return {
    name: "anthropic",
    model: ANTHROPIC_MODEL,
    estimatedCostUsd: ANTHROPIC_ESTIMATED_COST_USD,
    async run({ system, userText, jpeg, maxTokens }) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: maxTokens,
          system,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: "image/jpeg", data: toBase64(jpeg) },
                },
                { type: "text", text: userText },
              ],
            },
          ],
        }),
      });
      if (!response.ok) throw new Error(`anthropic ${response.status}`);
      const payload = await response.json();
      const block = Array.isArray(payload?.content)
        ? payload.content.find((c: { type?: string }) => c?.type === "text")
        : null;
      if (typeof block?.text !== "string") throw new Error("no text response");
      const inputTokens = tokenCount(payload.usage?.input_tokens);
      const outputTokens = tokenCount(payload.usage?.output_tokens);
      return {
        text: block.text,
        inputTokens,
        outputTokens,
        costUsd: (inputTokens ?? 0) * ANTHROPIC_USD_PER_INPUT_TOKEN +
          (outputTokens ?? 0) * ANTHROPIC_USD_PER_OUTPUT_TOKEN,
      };
    },
  };
}

/** Der konfigurierte Anbieter oder `null`, wenn keine KI laufen soll oder kann. */
export function getVisionProvider(): VisionProvider | null {
  const choice = (Deno.env.get("VISION_PROVIDER") ?? "cloudflare").trim().toLowerCase();

  if (choice === "cloudflare") {
    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
    if (!accountId || !apiToken) return null;
    const model = Deno.env.get("CLOUDFLARE_VISION_MODEL") || CLOUDFLARE_DEFAULT_MODEL;
    return cloudflareProvider(accountId, apiToken, model);
  }
  if (choice === "anthropic") {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    return apiKey ? anthropicProvider(apiKey) : null;
  }
  return null;
}
