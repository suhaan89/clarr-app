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
};

export function newClientKey(): string {
  // UUID reicht als Idempotenz-Schluessel; kein Hardware-Bezug (Datenminimierung).
  return (globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
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

/** Foto in den PRIVATEN originals-Bucket laden; Rueckgabe = storage_path. */
export async function uploadOriginal(localUri: string): Promise<string> {
  const userId = await requireUserId();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const sanitizedUri = await stripMetadata(localUri);
  const base64 = await FileSystem.readAsStringAsync(sanitizedUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const { error } = await supabase.storage
    .from('originals')
    .upload(path, decode(base64), { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
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
  for (const uri of item.photoUris) {
    photoPaths.push(await uploadOriginal(uri));
  }

  const result = await callFunction<{ ok?: boolean; report_id?: string; idempotent?: boolean }>(
    'submit-report',
    {
      latitude: item.latitude,
      longitude: item.longitude,
      description: item.description,
      photoPaths,
      mocked: item.mocked,
      deviceId,
      clientKey: item.clientKey,
      source: item.source,
    }
  );

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
  return result;
}

/** Oeffentliche URL eines GEBLURRTEN Fotos (nur public-blurred, nie Originale). */
export function blurredPhotoUrl(blurredPath: string): string {
  return supabase.storage.from('public-blurred').getPublicUrl(blurredPath).data.publicUrl;
}
