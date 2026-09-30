// CLAR — Edge Function: storage-cleanup (Runde 6, Paket G.32)
//
// Raeumt Storage-Objekte auf, die keine zugehoerige `report_photos`-Zeile
// (mehr) haben — z. B. wenn ein Upload abbrach, bevor die DB-Zeile
// geschrieben wurde, oder eine Zeile geloescht wurde, ohne dass der
// jeweilige Edge-Function-Aufruf (delete-account/process-photo) den
// Storage-Loeschschritt sauber abschliessen konnte.
//
// Prueft zwei Buckets:
//   * originals (privat)       — Pfad-Konvention <uid>/<dateiname>
//   * public-blurred (oeffentlich) — Pfad-Konvention <report_id>/<dateiname>
//
// Sicherheitsnetz gegen Race-Conditions: Objekte, die juenger sind als
// GRACE_PERIOD_MS, werden NIE geloescht — ein frisch hochgeladenes Foto,
// dessen report_photos-Zeile noch nicht geschrieben ist (submit-report
// laeuft noch), darf nicht versehentlich als "verwaist" gelten.
//
// Nebenbei: Trainingsdaten nach Ablauf der Loeschfrist entfernen
// (purge_expired_training_samples, Migration 023).
//
// Aufruf NUR durch den Scheduler (analog authority-digest): Bearer =
// Service-Role-Key, konstante-Zeit-Vergleich. Kein Client-Aufruf.

import { isServiceRoleRequest, serviceClient } from "../_shared/http.ts";

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24h
const PAGE_SIZE = 100;
const MAX_TOP_LEVEL_FOLDERS = 2000; // Sicherheitsdeckel pro Lauf

type StorageEntry = { id: string | null; name: string; created_at?: string };

Deno.serve(async (req) => {
  if (!(await isServiceRoleRequest(req))) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  const admin = serviceClient();
  const cutoff = Date.now() - GRACE_PERIOD_MS;

  async function listTopLevelFolders(bucket: string): Promise<string[]> {
    const folders: string[] = [];
    let offset = 0;
    while (folders.length < MAX_TOP_LEVEL_FOLDERS) {
      const { data, error } = await admin.storage
        .from(bucket)
        .list(undefined, { limit: PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });
      if (error || !data || data.length === 0) break;
      for (const entry of data as StorageEntry[]) {
        // Storage "Ordner" (die uid-/report_id-Praefixe) haben id === null.
        if (entry.id === null) folders.push(entry.name);
      }
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    return folders;
  }

  async function listFilesIn(bucket: string, folder: string): Promise<StorageEntry[]> {
    const files: StorageEntry[] = [];
    let offset = 0;
    for (;;) {
      const { data, error } = await admin.storage
        .from(bucket)
        .list(folder, { limit: PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });
      if (error || !data || data.length === 0) break;
      for (const entry of data as StorageEntry[]) {
        if (entry.id !== null) files.push(entry);
      }
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    return files;
  }

  async function cleanupBucket(
    bucket: string,
    column: "storage_path" | "blurred_path",
  ): Promise<{ scanned: number; deleted: number }> {
    let scanned = 0;
    let deleted = 0;
    const folders = await listTopLevelFolders(bucket);

    for (const folder of folders) {
      const files = await listFilesIn(bucket, folder);
      if (files.length === 0) continue;
      scanned += files.length;

      const paths = files.map((f) => `${folder}/${f.name}`);
      const { data: known } = await admin
        .from("report_photos")
        .select(column)
        .in(column, paths);
      const knownSet = new Set((known ?? []).map((r: Record<string, string>) => r[column]));

      const toDelete = files
        .filter((f) => {
          const path = `${folder}/${f.name}`;
          if (knownSet.has(path)) return false;
          const createdAt = f.created_at ? new Date(f.created_at).getTime() : 0;
          return createdAt === 0 || createdAt < cutoff; // unbekanntes Alter -> lieber loeschen
        })
        .map((f) => `${folder}/${f.name}`);

      if (toDelete.length > 0) {
        const { error } = await admin.storage.from(bucket).remove(toDelete);
        if (!error) deleted += toDelete.length;
      }
    }
    return { scanned, deleted };
  }

  const originals = await cleanupBucket("originals", "storage_path");
  const blurred = await cleanupBucket("public-blurred", "blurred_path");

  // Loeschfrist Trainingsdaten (24 Monate, Migration 023) im selben Lauf.
  const { data: trainingPurged } = await admin.rpc("purge_expired_training_samples");

  await admin.from("audit_log").insert({
    action: "storage_cleanup",
    entity_type: "storage_bucket",
    details: { originals, blurred, training_samples_purged: trainingPurged ?? 0 },
  });

  return new Response(
    JSON.stringify({ ok: true, originals, blurred, training_samples_purged: trainingPurged ?? 0 }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
