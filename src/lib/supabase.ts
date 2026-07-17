import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as aesjs from 'aes-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Bewusst ohne Werte im Fehlertext – keine Konfiguration in Logs.
  throw new Error(
    'Supabase-Konfiguration fehlt: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env setzen (siehe .env.example).'
  );
}

// SecureStore (iOS Keychain / Android Keystore) hat ein Groessenlimit von
// ~2048 Byte pro Eintrag — eine komplette Supabase-Session (Access- +
// Refresh-Token + User-Metadaten) passt da oft NICHT rein. Deshalb der
// offizielle Supabase-Adapter-Pattern: die Session selbst bleibt (AES-256-
// verschluesselt) in AsyncStorage, nur der kleine Verschluesselungs-
// schluessel wandert in SecureStore. Ergebnis: der eigentliche Session-
// Inhalt ist nie im Klartext auf dem Geraet lesbar, ohne an
// SecureStores Groessenlimit zu scheitern.
//
// Rollback-Pfad, falls das auf einem Geraet Probleme macht (z. B. Keychain-
// Zugriff durch OS-Policy verweigert): storage unten zurueck auf AsyncStorage
// setzen. Bestehende AsyncStorage-Sessions aus der Zeit vor dieser Migration
// lassen sich nicht automatisch entschluesseln (kein Schluessel in
// SecureStore vorhanden) — betroffene Nutzer muessen sich EINMALIG neu
// anmelden, sind danach aber dauerhaft sicherer gespeichert.
class SecureSessionStorage {
  async _encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = await Crypto.getRandomBytesAsync(32);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  async _decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1)
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    return this._decrypt(key, encrypted);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this._encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}

// Nur der anon-Key: alles Schreibende laeuft ueber RLS bzw. Edge Functions.
//
// Web: expo-secure-store existiert dort nicht (Keychain/Keystore sind
// Geraete-Features) — der AES-Adapter wuerde beim ersten setItem werfen.
// Im Browser uebernimmt AsyncStorage (localStorage) die Session direkt,
// wie es supabase-js auf Web standardmaessig auch tut.
export const supabase = createClient(url, anonKey, {
  auth: {
    storage: Platform.OS === 'web' ? AsyncStorage : new SecureSessionStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const SUPABASE_URL = url;
