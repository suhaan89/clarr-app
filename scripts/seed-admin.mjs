#!/usr/bin/env node
// CLAR — Admin-Seeding fuer den Cold-Start (Paket 10).
//
// Pflegt ECHTE Start-Meldungen/Events ein (z. B. bekannte Muell-Hotspots
// aus der Begehung, geplante Cleanup-Termine der Orga) — ehrlich als Seed
// markiert (is_seed = TRUE), KEINE erfundenen Inhalte, keine Fake-Nutzer.
//
// Nutzung (nur lokal/vom Betreiber, NIE im Client):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/seed-admin.mjs seeds/start-inhalte.json
//
// Der service_role-Key kommt AUSSCHLIESSLICH aus der Umgebung — er steht
// nie im Repo und wird nie geloggt.
//
// Format der Eingabedatei (JSON):
// {
//   "owner_user_id": "<uuid des Team-Accounts>",
//   "reports": [{ "description": "...", "latitude": 51.0, "longitude": 10.0 }],
//   "events":  [{ "title": "...", "description": "...", "latitude": 51.0,
//                 "longitude": 10.0, "event_date": "2026-08-01T10:00:00Z",
//                 "max_participants": 20 }]
// }

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const inputPath = process.argv[2];

if (!url || !serviceKey) {
  console.error('SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY als Umgebungsvariablen setzen.');
  process.exit(1);
}
if (!inputPath) {
  console.error('Aufruf: node scripts/seed-admin.mjs <inhalte.json> — keine Inhalte hardcodiert.');
  process.exit(1);
}
if (/prod/i.test(url)) {
  console.error('Sicherheitsstopp: URL sieht nach Produktion aus. Seeding nur dev/staging.');
  process.exit(1);
}

const input = JSON.parse(readFileSync(inputPath, 'utf8'));
if (!input.owner_user_id) {
  console.error('owner_user_id (Team-Account) fehlt in der Eingabedatei.');
  process.exit(1);
}

const admin = createClient(url, serviceKey);

let created = { reports: 0, events: 0 };

for (const r of input.reports ?? []) {
  if (!r.description || !Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) {
    console.warn('Report uebersprungen (unvollstaendig):', r.description ?? '<ohne Text>');
    continue;
  }
  const { error } = await admin.from('reports').insert({
    user_id: input.owner_user_id,
    description: String(r.description).slice(0, 500),
    latitude: r.latitude,
    longitude: r.longitude,
    status: 'gemeldet', // laeuft regulaer durch Pruefung/Review
    is_seed: true,
    points_eligible: false, // Team-Seeds erzeugen keine Punkte
  });
  if (error) console.warn('Report fehlgeschlagen:', error.message);
  else created.reports += 1;
}

for (const e of input.events ?? []) {
  if (!e.title || !e.event_date) {
    console.warn('Event uebersprungen (unvollstaendig):', e.title ?? '<ohne Titel>');
    continue;
  }
  const { error } = await admin.from('cleanup_events').insert({
    title: String(e.title).slice(0, 200),
    description: e.description ? String(e.description).slice(0, 1000) : null,
    location_lat: e.latitude,
    location_lng: e.longitude,
    event_date: e.event_date,
    max_participants: e.max_participants ?? 20,
    created_by: input.owner_user_id,
    status: 'approved',
    is_seed: true,
  });
  if (error) console.warn('Event fehlgeschlagen:', error.message);
  else created.events += 1;
}

console.log(`Fertig: ${created.reports} Meldungen, ${created.events} Events als Seed angelegt.`);
