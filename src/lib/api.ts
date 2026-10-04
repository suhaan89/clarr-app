// Aufrufe der CLAR-Edge-Functions. Der Client schreibt NIE direkt in
// reports/points_ledger – alles laeuft serverseitig validiert.

import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';

import { supabase } from '@/lib/supabase';

export type PhotoSource = 'camera' | 'gallery';

export type PendingReport = {
  clientKey: string; // Idempotenz-Schluessel, EINMAL erzeugt, bleibt in der Queue
  description: string;
  latitude: number;
  longitude: number;
  mocked: boolean;
  source: PhotoSource;
  photoUris: string[]; // lokale Datei-URIs bis zum Sync
  createdAt: string;
  // Ergebnis der On-Device-Pruefung (nur Hinweis). Fehlt bei aelteren
  // Queue-Eintraegen und wenn nicht geprueft wurde.
  ondevice?: { score: number; modelVersion: string } | null;
};

export function newClientKey(): string {
  // UUID reicht als Idempotenz-Schluessel; kein Hardware-Bezug (Datenminimierung).
  return (globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
}

/**
 * Antwort des Servers, die sich durch Wiederholen NICHT aendert (oder erst,
 * wenn der Nutzer etwas tut). Die Offline-Queue wertet `kind` aus, statt
 * jeden Fehler als "offline" zu behandeln:
 *   * not_active: Community-Regeln noch nicht bestaetigt -> Eintrag bleibt,
 *                 die App fuehrt zum Regeln-Screen
 *   * limit:      Rate-Limit oder Tageskontingent -> Eintrag bleibt, spaeter
 *   * rejected:   Meldung ist ungueltig -> Eintrag wird entfernt
 */
export type ReportErrorKind = 'not_active' | 'limit' | 'rejected';

export class ReportError extends Error {
  constructor(
    readonly kind: ReportErrorKind,
    readonly code: string
  ) {
    super(code);
    this.name = 'ReportError';
  }
}

/** HTTP-Status + Fehlercode aus einem supabase-js-Functions-Fehler lesen. */
async function readFunctionError(error: unknown): Promise<{ status: number; code: string } | null> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!context || typeof (context as Response).status !== 'number') return null;
  const response = context as Response;
  let code = 'unknown';
  try {
    const body = (await response.clone().json()) as { error?: unknown };
    if (typeof body?.error === 'string') code = body.error;
  } catch {
    // Antwort ohne JSON-Koerper: der Status allein entscheidet.
  }
  return { status: response.status, code };
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('not_signed_in');
  return data.user.id;
}

/**
 * Entfernt EXIF-/GPS-Metadaten, indem das Bild lokal neu kodiert wird.
 *
 * Datenminimierung (Art. 5 (1) c DSGVO): Kamera- und vor allem GALERIE-Fotos
 * tragen oft GPS-Koordinaten, Aufnahmezeit, Geraete-Seriennummer und teils den
 * Besitzernamen im EXIF-Block. Davon braucht CLAR nichts — der Standort einer
 * Meldung kommt bewusst aus `Location.getCurrentPositionAsync()`, nicht aus dem
 * Bild. Ein Galerie-Foto koennte sonst einen ganz anderen Ort (z. B. die
 * Wohnadresse) in den privaten Bucket tragen, als die Meldung angibt.
 *
 * `manipulateAsync` mit leerer Aktionsliste dekodiert und kodiert neu; das
 * Ergebnis traegt keine Metadaten mehr. Schlaegt das fehl (z. B. exotisches
 * Format), brechen wir bewusst ab, statt ein unbereinigtes Original
 * hochzuladen — lieber eine fehlgeschlagene Meldung als GPS im Storage.
 */
async function stripMetadata(localUri: string): Promise<string> {
  const cleaned = await manipulateAsync(localUri, [], {
    compress: 0.85,
    format: SaveFormat.JPEG,
  });
  return cleaned.uri;
}

/**
 * Foto in den PRIVATEN originals-Bucket laden; Rueckgabe = storage_path.
 *
 * Der Dateiname haengt am `clientKey` der Meldung: ein Retry trifft denselben
 * Pfad, statt bei jedem Versuch eine weitere, verwaiste Datei anzulegen.
 * Liegt die Datei schon da, gilt das als Erfolg.
 */
export async function uploadOriginal(localUri: string, name: string): Promise<string> {
  const userId = await requireUserId();
  const path = `${userId}/${name}.jpg`;
  const sanitizedUri = await stripMetadata(localUri);
  const base64 = await FileSystem.readAsStringAsync(sanitizedUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const { error } = await supabase.storage
    .from('originals')
    .upload(path, decode(base64), { contentType: 'image/jpeg' });
  if (error && !isAlreadyUploaded(error)) throw error;
  return path;
}

function isAlreadyUploaded(error: unknown): boolean {
  const e = error as { statusCode?: unknown; status?: unknown; message?: unknown };
  return (
    String(e.statusCode) === '409' ||
    e.status === 409 ||
    (typeof e.message === 'string' && /already exists|duplicate/i.test(e.message))
  );
}

export async function callFunction<T = Record<string, unknown>>(
  name: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  return data as T;
}

/** Meldung einreichen (Fotos hochladen + submit-report + process-photo). */
export async function submitReport(item: PendingReport, deviceId: string | null) {
  const photoPaths: string[] = [];
  for (const [i, uri] of item.photoUris.entries()) {
    photoPaths.push(await uploadOriginal(uri, `${item.clientKey}-${i}`));
  }

  let result: { ok?: boolean; report_id?: string; idempotent?: boolean };
  try {
    result = await callFunction('submit-report', {
      latitude: item.latitude,
      longitude: item.longitude,
      description: item.description,
      photoPaths,
      mocked: item.mocked,
      deviceId,
      clientKey: item.clientKey,
      source: item.source,
      ondeviceScore: item.ondevice?.score ?? null,
      ondeviceModelVersion: item.ondevice?.modelVersion ?? null,
    });
  } catch (error) {
    const info = await readFunctionError(error);
    if (info?.status === 403 && info.code === 'not_active') {
      throw new ReportError('not_active', info.code);
    }
    if (info?.status === 429) throw new ReportError('limit', info.code);
    // 400 = der Server lehnt genau diese Meldung ab; erneutes Senden aendert
    // daran nichts. 401 und 5xx bleiben normale, wiederholbare Fehler.
    if (info?.status === 400) throw new ReportError('rejected', info.code);
    throw error;
  }

  // Anonymisierungs-Pipeline anstossen – best effort; ohne Erfolg bleibt
  // das Foto ohnehin privat (fail-safe, Paket 5).
  if (result?.report_id && !result.idempotent) {
    for (const path of photoPaths) {
      try {
        await callFunction('process-photo', { reportId: result.report_id, storagePath: path });
      } catch {
        // Review/Pipeline holt das nach; kein Abbruch fuer den Nutzer.
      }
    }
  }

  // Verbindliche KI-Pruefung (docs/vision.md). Auch bei idempotenter Antwort
  // aufrufen: war ein frueherer Versuch vor diesem Schritt abgebrochen, holt
  // das die Pruefung nach; ist sie schon gelaufen, antwortet der Server 409.
  if (result?.report_id) {
    try {
      await callFunction('analyze-photo', { report_id: result.report_id });
    } catch {
      // Die Meldung ist gespeichert; ohne Pruefung bleibt sie unveroeffentlicht.
    }
  }
  return result;
}

/** Oeffentliche URL eines GEBLURRTEN Fotos (nur public-blurred, nie Originale). */
export function blurredPhotoUrl(blurredPath: string): string {
  return supabase.storage.from('public-blurred').getPublicUrl(blurredPath).data.publicUrl;
}
