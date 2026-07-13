#!/usr/bin/env node
// CLAR — Aufraeum-Skript fuer den Legacy-Bucket "report-photos" (Runde 6,
// Paket B.4; offener Punkt seit docs/security-review.md Nr. 1).
//
// Hintergrund: Vor der Anonymisierungs-Pipeline (Paket 5) landeten Fotos
// direkt in diesem OEFFENTLICHEN Bucket — kein EXIF-Strip, keine Gesichts-/
// Kennzeichen-Pixelierung. Der Schreibweg ist seit Migration 014 geschlossen
// (keine neuen Objekte mehr moeglich), Alt-Objekte lagen bis jetzt aber
// weiter oeffentlich und unanonymisiert im Bucket.
//
// Dieses Skript:
//   1. listet ALLE Objekte im Bucket "report-photos",
//   2. prueft je Objekt, ob eine `reports`-Zeile noch per `photo_urls`
//      (Legacy-Spalte, vor Paket 5: volle Storage-URLs statt Pfade) darauf
//      verweist,
//   3. loescht referenzierte wie unreferenzierte Objekte gleichermassen —
//      der Bucket ist seit Migration 014 tot, keine laufende Funktion liest
//      noch daraus, und referenzierende Alt-Reports haben ihre KI-Pruefung
//      laengst durchlaufen (analyze-photo faellt fuer sie nur noch auf einen
//      Backward-Compat-Pfad zurueck, siehe Kommentar dort). Datenschutz
//      (unanonymisierte Fotos oeffentlich) wiegt hoeher als das Aufbewahren
//      technisch toter Referenzen.
//   4. schreibt EIN audit_log-Eintrag mit der Anzahl geloeschter Objekte
//      (keine Pfade/Inhalte).
//
// Standardmaessig NUR ein Trockenlauf (zeigt, was geloescht wuerde). Erst mit
// --delete werden Objekte tatsaechlich entfernt.
//
// Nutzung:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/cleanup-legacy-bucket.mjs            # Trockenlauf
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/cleanup-legacy-bucket.mjs --delete    # loescht wirklich
//
// Der service_role-Key kommt AUSSCHLIESSLICH aus der Umgebung.

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'report-photos';
const PAGE_SIZE = 100;

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const doDelete = process.argv.includes('--delete');

if (!url || !serviceKey) {
  console.error('SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY als Umgebungsvariablen setzen.');
  process.exit(1);
}

const admin = createClient(url, serviceKey);

async function listAllObjects() {
  const objects = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .list(undefined, { limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`Bucket-Listing fehlgeschlagen: ${error.message}`);
    if (!data || data.length === 0) break;
    // Storage `.list()` liefert auch "Ordner" (id === null) — nur echte
    // Dateien einsammeln.
    for (const entry of data) {
      if (entry.id) objects.push(entry.name);
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return objects;
}

async function countLegacyReferences() {
  // Legacy `photo_urls` enthaelt fuer Alt-Reports volle Storage-URLs zu
  // diesem Bucket (siehe supabase/functions/analyze-photo/index.ts).
  // `photo_urls` ist TEXT[] — PostgREST kann Teilstrings innerhalb eines
  // Array-Elements nicht per Filter matchen, darum client-seitig pruefen.
  // Nur fuer den Bericht interessant, nicht fuer die Loeschentscheidung
  // (siehe Kopfkommentar) — reine Transparenz fuer den Betreiber.
  const { data, error } = await admin.from('reports').select('id, photo_urls').not('photo_urls', 'eq', '{}');
  if (error) return null;
  return (data ?? []).filter((r) => (r.photo_urls ?? []).some((u) => u.includes(BUCKET))).length;
}

async function main() {
  console.log(`Modus: ${doDelete ? 'LOESCHEN' : 'Trockenlauf (kein --delete)'}`);

  const objects = await listAllObjects();
  console.log(`Gefunden: ${objects.length} Objekt(e) im Bucket "${BUCKET}".`);

  if (objects.length === 0) {
    console.log('Nichts zu tun.');
    return;
  }

  const stillReferenced = await countLegacyReferences();
  if (stillReferenced !== null) {
    console.log(
      `Hinweis: ${stillReferenced} reports-Zeile(n) verweisen noch per photo_urls auf diesen Bucket ` +
        '(Alt-Reports vor Paket 5 — ihre KI-Pruefung ist laengst abgeschlossen, siehe Skript-Kopf).'
    );
  }

  if (!doDelete) {
    console.log('Trockenlauf — nichts geloescht. Mit --delete erneut aufrufen, um wirklich zu loeschen.');
    return;
  }

  let deleted = 0;
  const chunkSize = 100;
  for (let i = 0; i < objects.length; i += chunkSize) {
    const chunk = objects.slice(i, i + chunkSize);
    const { error } = await admin.storage.from(BUCKET).remove(chunk);
    if (error) {
      console.warn(`Loeschen fehlgeschlagen fuer Chunk ${i / chunkSize}:`, error.message);
      continue;
    }
    deleted += chunk.length;
  }

  console.log(`Geloescht: ${deleted}/${objects.length} Objekt(e).`);

  await admin.from('audit_log').insert({
    action: 'legacy_bucket_cleanup',
    entity_type: 'storage_bucket',
    entity_id: BUCKET,
    details: { deleted_count: deleted, total_found: objects.length },
  });
}

main().catch((err) => {
  console.error('Abbruch:', err instanceof Error ? err.message : err);
  process.exit(1);
});
