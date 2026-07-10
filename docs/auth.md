# Auth & Verifikations-Level (Paket 2)

## Verifikations-Stufen (`user_profiles.verification_level`)

| Stufe | Bedeutung | Wie erreicht |
|---|---|---|
| `neu` | registriert, E-Mail unbestaetigt | Default bei Signup |
| `mail_verifiziert` | E-Mail bestaetigt | Trigger `on_auth_user_email_confirmed` (auth.users) |
| `aktiv` | Community-Regeln in der App bestaetigt | RPC `activate_account(true)` |

**Gate:** Erst `aktiv` darf wertbare Meldungen einreichen (wird in Paket 3 /
`submit-report` serverseitig geprueft). E-Mail-Verifikation ist Voraussetzung
fuer `aktiv` — ohne bestaetigte Mail gibt `activate_account` den Fehler
`email_not_verified` zurueck.

Bestandsnutzer mit bereits bestaetigter Mail wurden per Migration auf
`mail_verifiziert` hochgestuft.

## reputation_score

- `user_profiles.reputation_score`, INT 0–1000, Default 100.
- **Nur serverseitig schreibbar**: Clients haben auf `user_profiles` keinerlei
  INSERT/UPDATE/DELETE-Grant mehr (nur SELECT der eigenen Zeile via RLS).
- Aenderung ausschliesslich ueber `adjust_reputation(user_id, delta, reason)`
  (SECURITY DEFINER, EXECUTE nur fuer Service-Role, jede Aenderung landet im
  `audit_log`).

## Kein Klarname-Zwang

Es gibt weiterhin keine Namens-/Profilfelder. Identitaet = anonyme User-ID +
E-Mail (nur fuer Login/Verifikation, nie oeffentlich).

## Rate-Limit Registrierung & Anti-Enumeration

SQL kann das nicht allein — die Limits liegen in der Supabase-Auth-Config:

- **Lokal** (`supabase/config.toml`): `sign_in_sign_ups = 10` pro 5 min/IP,
  `email_sent = 4` pro Stunde, `enable_confirmations = true`.
- **Gehostetes DEV-Projekt — im Dashboard setzen (Checkliste):**
  1. Authentication → Sign In / Up → **Confirm email = ON**
  2. Authentication → Rate Limits → Sign-ups/Sign-ins und E-Mail-Versand
     analog zur config.toml begrenzen
  3. Authentication → Advanced → **Prevent email enumeration = ON**
     (Signup mit existierender Adresse liefert dann eine neutrale Antwort)

Clientseitig zeigt der LoginScreen bei der Registrierung immer dieselbe
neutrale Erfolgsmeldung („falls noch kein Konto besteht …") — auch wenn die
Adresse schon registriert ist. Es gibt keine „bereits registriert"-Meldung.

## Alters-/Einwilligungslogik — offen

Bewusst nur Platzhalter (`TODO JURISTISCH PRUEFEN` in `LoginScreen.js` und
Migration 003): Zielgruppe teils minderjaehrig, DSGVO Art. 8 (in DE 16 Jahre
fuer eigenstaendige Einwilligung). Bis zur juristischen Klaerung wird KEIN
Geburtsdatum erhoben (Datenminimierung); gespeichert wird nur
`rules_accepted_at` (Zeitpunkt der Regel-Bestaetigung).
