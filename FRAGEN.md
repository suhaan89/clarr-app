# Offene Fragen / bewusst gestoppte Fixes

Hier stehen Änderungen, die ich NICHT blind umgesetzt habe, weil sie eine
funktionierende Funktion ernsthaft gefährden könnten und eine Entscheidung
bzw. einen Test am Gerät brauchen (siehe AGENTS-Regel).

## 1. Auth-Token in SecureStore statt AsyncStorage (Security-Review Runde 2, F-Token)

**Fund:** `src/lib/supabase.ts` speichert die Supabase-Session (u. a. das
Refresh-Token) über `AsyncStorage`. AsyncStorage ist **unverschlüsselt**
(App-privater Klartext-Speicher). Auf gerooteten/jailbroken Geräten oder über
Geräte-Backups kann das Token ausgelesen werden. Für eine App mit teils
minderjähriger Zielgruppe und sensiblen Daten ist verschlüsselte Ablage
(Keychain/Keystore via `expo-secure-store`) die empfohlene Härtung.

**Warum gestoppt statt umgesetzt:**
- Ein fehlerhafter Storage-Adapter loggt beim nächsten Start ALLE Nutzer aus
  bzw. verliert die Session — ein stiller, breit wirkender Funktionsbruch.
- `expo-secure-store` hat ein 2048-Byte-Limit pro Wert; Supabase-Sessions sind
  größer → es braucht einen **chunkenden** Adapter. Den kann ich hier nicht
  am Gerät verifizieren (kein iOS/Android-Build in dieser Umgebung).
- `expo-secure-store` ist ein natives Modul → Dev-Build nötig (ist vorhanden),
  aber Migration bestehender Sessions (AsyncStorage → SecureStore) muss getestet
  werden, damit eingeloggte Nutzer nicht rausfliegen.

**Vorgeschlagene Umsetzung (nach Geräte-Test aktivieren):**
1. `npx expo install expo-secure-store`
2. Chunkenden Adapter bauen (Wert in ~2000-Byte-Stücke splitten, Schlüssel
   `sb-session-0`, `sb-session-1`, …; beim Lesen zusammensetzen).
3. In `createClient(..., { auth: { storage: secureAdapter, ... } })` einsetzen.
4. Einmalige Migration: beim ersten Start vorhandene AsyncStorage-Session lesen,
   in SecureStore schreiben, AsyncStorage-Schlüssel löschen — auf echtem Gerät
   testen (frisch eingeloggt + Update-Fall).

**Bis dahin akzeptiertes Restrisiko:** dokumentiert in
`docs/security-review.md` (Runde 2). App-Sandbox schützt auf nicht-gerooteten
Geräten; das Restrisiko betrifft gerootete Geräte / unverschlüsselte Backups.

**JURISTISCH/EXTERN PRÜFEN:** ob für die Zielgruppe (teils minderjährig) die
verschlüsselte Token-Ablage verpflichtend einzustufen ist.
