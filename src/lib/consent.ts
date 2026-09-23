// Nachgelagertes Speichern der Altersbestaetigung (Art. 8, Art. 7 (1) DSGVO).
//
// Problem: `supabase.auth.signUp()` liefert nur dann sofort eine Session, wenn
// die E-Mail-Bestaetigung ausgeschaltet ist. Ist sie an — der sichere,
// voreingestellte Fall — gibt es beim Absenden des Formulars noch kein
// `auth.uid()`, und `record_consent()` wirft "Nicht angemeldet". Die
// Altersbestaetigung ging damit genau in der Konfiguration verloren, die man
// produktiv fahren will: der Nachweis fehlte, obwohl die Person bestaetigt hat.
//
// Loesung: die Bestaetigung wird lokal gemerkt und beim ersten Login, bei dem
// eine Session existiert, serverseitig nachgetragen. Lokal steht nur ein
// Zeitstempel, kein Geburtsdatum und keine Kennung.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

const PENDING_AGE_KEY = 'clar.consent.pending_age_confirmation';

/** Merkt vor, dass die Altersbestaetigung noch serverseitig fehlt. */
export async function rememberAgeConfirmation(): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_AGE_KEY, new Date().toISOString());
  } catch {
    // Speicher nicht verfuegbar: der Nachweis wird dann beim naechsten
    // bewussten Vorgang erhoben, statt den Registrierungsvorgang zu brechen.
  }
}

/**
 * Traegt eine vorgemerkte Altersbestaetigung nach, sobald eine Session
 * existiert. Idempotent: der lokale Merker wird erst geloescht, wenn der
 * Server die Zeile angenommen hat.
 */
export async function flushPendingConsents(): Promise<void> {
  let pending: string | null = null;
  try {
    pending = await AsyncStorage.getItem(PENDING_AGE_KEY);
  } catch {
    return;
  }
  if (!pending) return;

  const { error } = await supabase.rpc('record_consent', {
    p_consent_key: 'altersbestaetigung',
    p_granted: true,
  });
  if (error) return; // beim naechsten Start erneut versuchen

  try {
    await AsyncStorage.removeItem(PENDING_AGE_KEY);
  } catch {
    // Doppelte Zeilen im append-only-Journal sind unschaedlich.
  }
}
