// Offline-Erfassung (Paket 9): Meldungen + Fotos werden lokal gequeued und
// beim naechsten Netz gesynct. Kein Doppel-Sync: jede Meldung traegt einen
// clientseitigen Idempotenz-Schluessel (clientKey), den der Server per
// Unique-Index (user_id, client_key) entdoppelt. Retries sind dadurch
// beliebig oft erlaubt.

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { submitReport, type PendingReport } from '@/lib/api';

const QUEUE_KEY = 'clar.report_queue.v1';
const DEVICE_ID_KEY = 'clar.install_id.v1';

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

/** Meldung in die Queue legen (der clientKey ist da bereits gesetzt). */
export async function enqueueReport(item: PendingReport): Promise<void> {
  const queue = await readQueue();
  // Gleicher clientKey darf nur einmal in der Queue liegen.
  if (!queue.some((q) => q.clientKey === item.clientKey)) {
    queue.push(item);
    await writeQueue(queue);
  }
}

export type SyncResult = { sent: number; failed: number; remaining: number };

/** Queue abarbeiten. Erfolgreiche (auch idempotent beantwortete) Eintraege
 *  werden entfernt; fehlgeschlagene bleiben fuer den naechsten Versuch. */
export async function syncQueue(): Promise<SyncResult> {
  if (syncing) return { sent: 0, failed: 0, remaining: (await readQueue()).length };
  syncing = true;
  try {
    const net = await NetInfo.fetch();
    const queue = await readQueue();
    if (!net.isConnected || queue.length === 0) {
      return { sent: 0, failed: 0, remaining: queue.length };
    }

    const deviceId = await getDeviceId();
    const remaining: PendingReport[] = [];
    let sent = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        await submitReport(item, deviceId);
        sent += 1; // idempotente Antworten zaehlen als erledigt
      } catch {
        failed += 1;
        remaining.push(item);
      }
    }
    await writeQueue(remaining);
    return { sent, failed, remaining: remaining.length };
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
