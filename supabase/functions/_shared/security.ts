// CLAR — geteilte Sicherheits-Helfer fuer Edge Functions (Paket B, Runde 6).
// Bewusst dependency-frei (nur Deno/Web-Crypto), damit jede Function ihn
// unveraendert mitbundeln kann.

// ----------------------------------------------------------------
// CORS: Wildcard ("*") erlaubte bisher JEDER Webseite, das (nur mit
// User-JWT bzw. Bestaetigung nutzbare) Antwort-JSON per Browser-JS
// auszulesen. Mobile-App-Aufrufe (Expo/React Native `fetch`) senden keinen
// Origin-Header und sind von CORS ohnehin nicht betroffen — die Einschraenkung
// wirkt ausschliesslich auf potenzielle Web-Aufrufe. Erlaubte Origins sind
// per Function-Secret ALLOWED_ORIGINS (kommagetrennt) konfigurierbar; ohne
// Secret gilt eine enge Dev-Default-Liste (Expo-Web-Dev-Server).
// ----------------------------------------------------------------
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:8081", "http://localhost:19006"];

function allowedOrigins(): string[] {
  const configured = Deno.env.get("ALLOWED_ORIGINS");
  if (configured && configured.trim().length > 0) {
    return configured.split(",").map((o) => o.trim()).filter(Boolean);
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowed = allowedOrigins();
  // Kein/unbekannter Origin -> erste erlaubte Origin zurueckgeben (kein
  // Klartreffer fuer den anfragenden Browser -> die Same-Origin-Policy
  // blockiert die Antwort clientseitig; mobile Aufrufe sind unberuehrt).
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

// ----------------------------------------------------------------
// Hash-Helfer (IP/Geraet werden NIE im Klartext gespeichert/geloggt).
// ----------------------------------------------------------------
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ipHashFromRequest(req: Request): Promise<string | null> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return ip ? await sha256Hex(`ip:${ip}`) : null;
}

// ----------------------------------------------------------------
// Konstante-Zeit-Vergleich fuer Secrets/Tokens (z. B. Service-Token-Checks).
// Verhindert Timing-Seitenkanaele, die aus einem fruehen `!==`-Abbruch bei
// der ersten abweichenden Stelle Informationen ueber das Secret ableiten
// koennten. Laenge wird zuerst ueber einen SHA-256-Hash beider Werte
// normalisiert, damit auch der Laengenvergleich selbst nichts verraet.
// ----------------------------------------------------------------
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let diff = 0;
  for (let i = 0; i < hashA.length; i++) {
    diff |= hashA.charCodeAt(i) ^ hashB.charCodeAt(i);
  }
  return diff === 0;
}

// ----------------------------------------------------------------
// Rate-Limit-Wrapper um die RPC `check_and_log_rate_limit` (Migration 004,
// server-only). `admin` ist ein Service-Role-Client.
// ----------------------------------------------------------------
export async function checkRateLimit(
  // deno-lint-ignore no-explicit-any
  admin: any,
  params: {
    userId: string | null;
    deviceHash: string | null;
    ipHash: string | null;
    action: string;
    max: number;
    windowSecs: number;
  },
): Promise<boolean> {
  const { data: ok, error } = await admin.rpc("check_and_log_rate_limit", {
    p_user_id: params.userId,
    p_device_hash: params.deviceHash,
    p_ip_hash: params.ipHash,
    p_action: params.action,
    p_max: params.max,
    p_window_secs: params.windowSecs,
  });
  if (error) throw error;
  return ok !== false;
}
