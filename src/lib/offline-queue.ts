// Offline-Erfassung (Paket 9): Meldungen + Fotos werden lokal gequeued und
// beim naechsten Netz gesynct. Kein Doppel-Sync: jede Meldung traegt einen
// clientseitigen Idempotenz-Schluessel (clientKey), den der Server per
// Unique-Index (user_id, client_key) entdoppelt. Retries sind dadurch
// beliebig oft erlaubt.

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';

import { submitReport, type PendingReport } from '@/lib/api';

const QUEUE_KEY = 'clar.report_queue.v1';
const DEVICE_ID_KEY = 'clar.install_id.v1';
// Dauerhaftes Verzeichnis fuer gequeute Fotos: Kamera-/Galerie-URIs zeigen
// auf Cache-Verzeichnisse, die das OS (v. a. bei Speicherdruck oder nach
// einem App-Update) jederzeit raeumen darf. Ohne Kopie wuerde eine offline
// gequeute Meldung dann bei jedem Sync-Versuch stumm scheitern.
const QUEUE_PHOTOS_DIR = `${FileSystem.documentDirectory}offline-queue-photos/`;

async function ensureQueuePhotosDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(QUEUE_PHOTOS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(QUEUE_PHOTOS_DIR, { intermediates: true });
  }
}

let syncing = false;

export async function getDeviceId(): Promise<string> {
  // Zufaellige Install-ID (KEINE Hardware-ID – Datenminimierung). Dient nur
  // dem serverseitigen Rate-Limit; der Server speichert davon nur den Hash.
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = (globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * Loescht alle lokal gequeuten Meldungen samt kopierter Fotos und die
 * zufaellige Install-ID.
 *
 * Gehoert zur Konto-Loeschung (Art. 17 DSGVO): `delete-account` raeumt den
 * Server ab, aber noch nicht gesendete Meldungen mit Fotos und die Install-ID
 * lagen danach weiter auf dem Geraet. Wer sein Konto loescht, erwartet, dass
 * auch das weg ist.
 */
export async function clearLocalReportData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([QUEUE_KEY, DEVICE_ID_KEY]);
  } catch {
    // Speicherfehler duerfen die Loeschung nicht aufhalten.
  }
  try {
    await FileSystem.deleteAsync(QUEUE_PHOTOS_DIR, { idempotent: true });
  } catch {
    // Verzeichnis existierte nicht oder ist bereits weg.
  }
}

export async function readQueue(): Promise<PendingReport[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingReport[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: PendingReport[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

/** Meldung in die Queue legen (der clientKey ist da bereits gesetzt).
 *  Fotos werden in ein dauerhaftes Verzeichnis kopiert, BEVOR der Eintrag
 *  in der Queue landet — die Original-Cache-URI (Kamera/Galerie) kann
 *  danach jederzeit verschwinden, ohne die gequeute Meldung zu gefaehrden. */
export async function enqueueReport(item: PendingReport): Promise<void> {
  const queue = await readQueue();
  // Gleicher clientKey darf nur einmal in der Queue liegen.
  if (queue.some((q) => q.clientKey === item.clientKey)) return;

  await ensureQueuePhotosDir();
  const durablePhotoUris = await Promise.all(
    item.photoUris.map(async (uri, i) => {
      const dest = `${QUEUE_PHOTOS_DIR}${item.clientKey}-${i}.jpg`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      return dest;
    })
  );

  queue.push({ ...item, photoUris: durablePhotoUris });
  await writeQueue(queue);
}

/** Kopien im dauerhaften Verzeichnis wieder loeschen (nach Erfolg oder
 *  endgueltigem Verlust) — sonst sammeln sich Karteileichen an. */
async function cleanupQueuedPhotos(item: PendingReport): Promise<void> {
  await Promise.all(
    item.photoUris.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}))
  );
}

export type SyncResult = { sent: number; failed: number; lost: number; remaining: number };

/** Queue abarbeiten. Erfolgreiche (auch idempotent beantwortete) Eintraege
 *  werden entfernt; fehlgeschlagene bleiben fuer den naechsten Versuch.
 *  Ein Eintrag, dessen Foto-Kopie trotzdem verschwunden ist (z. B. der
 *  Nutzer hat die App-Daten manuell geleert), wird NICHT endlos erneut
 *  versucht, sondern als "lost" aus der Queue entfernt — der Aufrufer kann
 *  daraufhin einen klaren "Foto verloren, bitte erneut aufnehmen"-Hinweis
 *  zeigen. */
export async function syncQueue(): Promise<SyncResult> {
  if (syncing) return { sent: 0, failed: 0, lost: 0, remaining: (await readQueue()).length };
  syncing = true;
  try {
    const net = await NetInfo.fetch();
    const queue = await readQueue();
    if (!net.isConnected || queue.length === 0) {
      return { sent: 0, failed: 0, lost: 0, remaining: queue.length };
    }

    const deviceId = await getDeviceId();
    const remaining: PendingReport[] = [];
    let sent = 0;
    let failed = 0;
    let lost = 0;

    for (const item of queue) {
      const missing = await Promise.all(
        item.photoUris.map(async (uri) => !(await FileSystem.getInfoAsync(uri)).exists)
      );
      if (missing.some(Boolean)) {
        lost += 1;
        continue; // nicht erneut versuchen, nicht in remaining aufnehmen
      }

      try {
        await submitReport(item, deviceId);
        sent += 1; // idempotente Antworten zaehlen als erledigt
        await cleanupQueuedPhotos(item);
      } catch {
        failed += 1;
        remaining.push(item);
      }
    }
    await writeQueue(remaining);
    return { sent, failed, lost, remaining: remaining.length };
  } finally {
    syncing = false;
  }
}

/** Auto-Sync, sobald Netz da ist. Rueckgabe: unsubscribe. */
export function startAutoSync(onResult?: (r: SyncResult) => void): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      syncQueue().then((r) => {
        if (r.sent > 0 || r.failed > 0) onResult?.(r);
      });
    }
  });
  return unsubscribe;
}
