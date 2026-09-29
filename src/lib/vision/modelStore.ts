/**
 * Modell-Download und -Versionierung über Supabase (ohne App-Update).
 *
 * Ablauf beim App-Start (`refreshModel`, höchstens einmal pro Tag):
 *  1. Aktive Zeile aus `public.vision_models` lesen (öffentlich lesbar).
 *  2. Keine aktive Zeile → lokalen Cache löschen. Das ist der Fernschalter:
 *     Status auf 'zurueckgezogen' setzen, und die Prüfung ist überall aus.
 *  3. Gleiche Version schon da → nur Metadaten übernehmen (z. B. einen
 *     geänderten Schwellenwert), nichts herunterladen.
 *  4. Neue Version → Datei laden, Größe und SHA-256 prüfen, erst DANN
 *     umschalten. Schlägt etwas fehl, bleibt die bisherige Version aktiv.
 *
 * Die Prüfsumme schützt vor abgebrochenen oder beschädigten Downloads, nicht
 * vor einem absichtlich manipulierten Bucket (dafür bräuchte es eine Signatur,
 * siehe docs/vision-ondevice.md). Da das Ergebnis nur berät und serverseitig
 * nichts davon ungeprüft übernommen wird, ist das vertretbar.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode as base64ToArrayBuffer } from 'base64-arraybuffer';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '@/lib/supabase';

import {
  isOnDeviceVisionEnabled,
  MAX_MODEL_BYTES,
  MODEL_BUCKET,
  MODEL_CHECK_INTERVAL_MS,
} from './config';
import { bytesToHex, isCheckDue, MODEL_COLUMNS, parseManifest, type ModelRow } from './manifest';
import type { LocalModel, ModelManifest } from './types';

const STATE_KEY = 'clar.vision_model.v1';
const MODELS_DIR = `${FileSystem.documentDirectory}vision-models/`;

type StoredState = {
  manifest: ModelManifest | null;
  fileName: string | null;
  checkedAt: number;
};

async function readState(): Promise<StoredState | null> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as StoredState) : null;
  } catch {
    return null;
  }
}

async function writeState(state: StoredState): Promise<void> {
  try {
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Ohne Speicher gibt es eben keinen Cache; die Meldung funktioniert trotzdem.
  }
}

async function fileExists(uri: string): Promise<boolean> {
  try {
    return (await FileSystem.getInfoAsync(uri)).exists;
  } catch {
    return false;
  }
}

/** Das lokal liegende, geprüfte Modell oder `null` (dann wird nicht geprüft). */
export async function getLocalModel(): Promise<LocalModel | null> {
  if (!isOnDeviceVisionEnabled()) return null;
  const state = await readState();
  if (!state?.manifest || !state.fileName) return null;
  const fileUri = `${MODELS_DIR}${state.fileName}`;
  if (!(await fileExists(fileUri))) return null;
  return { manifest: state.manifest, fileUri };
}

/** Löscht alle heruntergeladenen Modelle und den Cache-Zustand. */
export async function clearModelCache(): Promise<void> {
  try {
    await FileSystem.deleteAsync(MODELS_DIR, { idempotent: true });
  } catch {
    // war nicht da
  }
  try {
    await AsyncStorage.removeItem(STATE_KEY);
  } catch {
    // egal
  }
}

/** Entfernt alte Modellversionen, behält nur `keep`. */
async function removeOtherFiles(keep: string): Promise<void> {
  try {
    const files = await FileSystem.readDirectoryAsync(MODELS_DIR);
    await Promise.all(
      files
        .filter((f) => f !== keep)
        .map((f) => FileSystem.deleteAsync(`${MODELS_DIR}${f}`, { idempotent: true }))
    );
  } catch {
    // Aufräumen ist nicht kritisch.
  }
}

/** Lädt die Datei herunter und prüft Größe + SHA-256. Liefert den Dateinamen. */
async function downloadAndVerify(manifest: ModelManifest): Promise<string | null> {
  const fileName = `${manifest.version}.tflite`;
  const finalUri = `${MODELS_DIR}${fileName}`;
  const tmpUri = `${finalUri}.download`;

  const info = await FileSystem.getInfoAsync(MODELS_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true });

  const url = supabase.storage.from(MODEL_BUCKET).getPublicUrl(manifest.storagePath).data.publicUrl;
  try {
    const res = await FileSystem.downloadAsync(url, tmpUri);
    if (res.status !== 200) throw new Error(`download_status_${res.status}`);

    const base64 = await FileSystem.readAsStringAsync(tmpUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const bytes = new Uint8Array(base64ToArrayBuffer(base64));
    if (bytes.length !== manifest.sizeBytes) throw new Error('size_mismatch');

    const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
    if (bytesToHex(new Uint8Array(digest)) !== manifest.sha256) throw new Error('checksum_mismatch');

    await FileSystem.deleteAsync(finalUri, { idempotent: true });
    await FileSystem.moveAsync({ from: tmpUri, to: finalUri });
    return fileName;
  } catch {
    await FileSystem.deleteAsync(tmpUri, { idempotent: true }).catch(() => {});
    return null;
  }
}

async function doRefresh(force: boolean): Promise<void> {
  if (!isOnDeviceVisionEnabled()) {
    await clearModelCache();
    return;
  }
  const state = await readState();
  const now = Date.now();
  if (!force && !isCheckDue(state?.checkedAt ?? null, now, MODEL_CHECK_INTERVAL_MS)) return;

  const { data, error } = await supabase
    .from('vision_models')
    .select(MODEL_COLUMNS)
    .eq('status', 'aktiv')
    .maybeSingle();
  // Offline oder Serverfehler: alten Stand behalten, beim nächsten Start neu fragen.
  if (error) return;

  // Zusammengesetzter Spalten-String → Supabase kann den Typ nicht ableiten;
  // parseManifest prüft ohnehin jedes Feld.
  const manifest = parseManifest(data as ModelRow | null);
  if (!manifest) {
    // Kein (gültiges) aktives Modell: Prüfung überall aus.
    await clearModelCache();
    await writeState({ manifest: null, fileName: null, checkedAt: now });
    return;
  }

  const sameFile =
    state?.manifest?.version === manifest.version &&
    state.manifest.sha256 === manifest.sha256 &&
    state.fileName !== null &&
    (await fileExists(`${MODELS_DIR}${state.fileName}`));
  if (sameFile) {
    await writeState({ manifest, fileName: state!.fileName, checkedAt: now });
    return;
  }

  if (manifest.sizeBytes > MAX_MODEL_BYTES) return;

  const fileName = await downloadAndVerify(manifest);
  // Fehlgeschlagen: bisherige Version bleibt, checkedAt NICHT setzen → neuer Versuch beim nächsten Start.
  if (!fileName) return;

  await writeState({ manifest, fileName, checkedAt: now });
  await removeOtherFiles(fileName);
}

let refreshing: Promise<void> | null = null;

/**
 * Prüft (höchstens einmal pro Tag) auf eine neue Modellversion und lädt sie.
 * Wirft nie; läuft im Hintergrund und blockiert keinen Screen.
 */
export function refreshModel(options: { force?: boolean } = {}): Promise<void> {
  if (!refreshing) {
    refreshing = doRefresh(options.force === true)
      .catch(() => {})
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}
