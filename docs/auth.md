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

## Alters-/Einwilligungslogik (Runde 6, Paket C.16)

Technisch umgesetzt: `login.tsx` zeigt bei der Registrierung eine
Selbstauskunft „Ich bin 16 Jahre oder älter" (Switch, Pflicht vor
`signUp`); die Bestätigung wird ueber `record_consent('altersbestaetigung',
true)` nachweisbar im `consents`-Journal gespeichert (Migration 021, gleiche
append-only-Mechanik wie die uebrigen Consents). Bewusst KEIN Geburtsdatum
(Datenminimierung); nur der Bestaetigungs-Zeitpunkt wird erfasst.

**Weiterhin `TODO JURISTISCH PRUEFEN`**: die Altersgrenze (16 nach DSGVO
Art. 8 fuer DE als Annahme, nicht rechtlich verifiziert), der exakte
Wortlaut, und was bei einer Selbstauskunft unter 16 tatsaechlich passieren
soll (aktuell: nur ein Hinweistext, keine serverseitige Sperre — das ist
bewusst offen gelassen, bis die rechtliche Ausgestaltung klar ist).
