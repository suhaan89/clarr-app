// CLAR — gemeinsames Grundgeruest fuer Edge Functions, die ein eingeloggter
// Nutzer aus der App aufruft (supabase.functions.invoke).
//
// Vorher hatte jede Function denselben Block kopiert: CORS, OPTIONS-Antwort,
// JWT pruefen, Service-Role-Client anlegen, Fehler als 500 loggen. Jetzt
// steht er hier einmal; die Function selbst enthaelt nur noch ihre Logik.
//
// Functions fuer Scheduler/Behoerden-Links (authority-digest,
// storage-cleanup, confirm-case-done) pruefen anders und nutzen nur
// `serviceClient()`.

import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeadersFor, timingSafeEqual } from "./security.ts";

export type Json = (status: number, body: unknown) => Response;

export type UserContext = {
  req: Request;
  /** Der per JWT gepruefte Aufrufer. */
  user: User;
  /** Service-Role-Client: umgeht RLS, jede Pruefung liegt bei der Function. */
  admin: SupabaseClient;
  json: Json;
};

/** Client mit Service-Role-Key (nur serverseitig, nie an den Client geben). */
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Nur Scheduler/Betreiber: der Bearer muss der Service-Role-Key sein.
 * Konstante-Zeit-Vergleich statt `!==`, damit ein Angreifer nicht ueber
 * die Antwortzeit byteweise auf den Key schliessen kann.
 */
export async function isServiceRoleRequest(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return await timingSafeEqual(auth, `Bearer ${serviceKey}`);
}

/**
 * Startet eine Function, die nur mit gueltigem Nutzer-JWT laeuft.
 * Ohne oder mit ungueltigem Token: 401. Unerwartete Fehler: 500 ohne
 * Details an den Client; ins Log geht nur die Fehlermeldung.
 */
export function serveUserFunction(
  name: string,
  handler: (ctx: UserContext) => Promise<Response>,
): void {
  Deno.serve(async (req) => {
    const corsHeaders = corsHeadersFor(req);
    const json: Json = (status, body) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

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

      return await handler({ req, user, admin: serviceClient(), json });
    } catch (error) {
      console.error(`${name} error:`, error instanceof Error ? error.message : "unknown");
      return json(500, { error: "internal_error" });
    }
  });
}

/**
 * Foto-Pfade muessen unter dem eigenen User-Prefix liegen
 * (originals/<uid>/...):
 *   * SSRF: keine http(s)-/internen URLs, die der Server spaeter fetch()t
 *   * Cross-Tenant: kein Verweis auf fremde Originale (<andere-uid>/...)
 *   * Path-Traversal: kein ".."
 * Backstop bleibt der DB-Trigger enforce_photo_path_owner (Migration 014).
 */
export function isOwnStoragePath(path: unknown, uid: string): path is string {
  return (
    typeof path === "string" &&
    path.length > 0 &&
    path.length <= 256 &&
    !path.includes("..") &&
    path.startsWith(`${uid}/`) &&
    /^[A-Za-z0-9/_.-]+$/.test(path)
  );
}

/** Nur die String-Eintraege eines Arrays, hoechstens `max` Stueck. */
export function stringList(value: unknown, max: number): string[] {
  return Array.isArray(value)
    ? value.filter((v: unknown): v is string => typeof v === "string").slice(0, max)
    : [];
}
