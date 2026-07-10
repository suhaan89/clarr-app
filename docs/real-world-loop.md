# Real-World-Loop: Fall-Statusmaschine + Abschluss (Paket 7)

## Statusmaschine (`cases.status`)

Erlaubte Uebergaenge — per Trigger erzwungen, **auch fuer die Service-Role**,
jede Aenderung landet im `audit_log`:

```
gemeldet ──> geprueft ──> weitergeleitet ──> erledigt ──> geschlossen
    │            │               │              ▲
    │            └── erledigt ───┼──────────────┘
    └── erledigt / geschlossen ──┘        (geschlossen von ueberall)
```

* `gemeldet → geprueft | erledigt | geschlossen`
* `geprueft → weitergeleitet | erledigt | geschlossen`
* `weitergeleitet → erledigt | geschlossen`
* `erledigt → geschlossen`; `geschlossen` ist terminal.

## Fallabschluss (`close-case` → `close_case_tx`)

1. Auth-Pflicht, nur `aktiv`.
2. **Mock-Location wird hart abgelehnt** (Punkte im Spiel) + Reputationsabzug.
3. **Geo/Zeit-geprueft**: Abschliessender muss ≤ 100 m am Fallort stehen
   (Haversine, serverseitig); Zeit ist Server-NOW.
4. **Nachher-Foto Pflicht** (kind `after`): laeuft als Abschluss-Report durch
   dieselbe Foto-Pipeline (originals → process-photo → public-blurred).
5. Statuswechsel → `erledigt` ueber die Statusmaschine (validiert + Audit).
6. **Punkte**: `case_closed_after` (25, hoechster Wert) — `booking_key` ist an
   den **Fall** gebunden: nur der erste Abschluss eines Falls wird verbucht.

## Anti-Kollusion

* Abschluss durch Dritte **nur mit eigenem Nachher-Foto** — gilt genauso fuer
  den urspruenglichen Melder.
* Ausnahme **Partner-Rolle** (`user_profiles.role = 'partner'`, z. B.
  Kommune/Bauhof): darf ohne Foto und ohne Geo-Pruefung abschliessen.
  Rollen vergibt ausschliesslich die Service-Role (user_profiles ist fuer
  Clients read-only).
* Punkte pro Fall nur einmal (idempotenter booking_key), Tagesdeckel und
  Degression aus Paket 6 gelten zusaetzlich — wechselseitiges
  "Melden-und-Abschliessen-Farmen" lohnt sich nicht.

## Push an Melder (Opt-in)

* `user_profiles.notify_case_closed` (Default **FALSE** — echtes Opt-in) und
  `push_token`; beides setzt der Nutzer selbst via RPC
  `set_push_preferences(token, notify)`.
* `close-case` schickt nach erfolgreichem Abschluss best-effort eine
  Expo-Push-Nachricht an alle Melder des Falls mit Opt-in. Inhalt bewusst
  ohne personenbezogene Daten und ohne Ortsdetails.
* Client-UI fuer das Opt-in (expo-notifications) ist noch nicht verdrahtet —
  siehe NOTIZEN.md.

## Wochen-Digest an die Behoerde (Erweiterung Teil 2)

- `authority-digest` (Edge Function, woechentlich via Scheduler mit
  Service-Role-Bearer aufrufen): sammelt Faelle im Status `geprueft`,
  mailt pro Fall **Kartenlink (OpenStreetMap) + geblurrtes Foto**
  (nur `public-blurred`, nie Originale, keine Melder-Daten) und einen
  **einmaligen "erledigt"-Link**; danach Status `weitergeleitet`.
- Empfaenger steht in `system_settings.authority_digest_email`
  (leer = Digest aus). Versand ueber `RESEND_API_KEY` (Function Secret);
  ohne Key wird nur protokolliert (`authority_digests.delivery = 'logged'`).
- **Ruecklauf-Token**: 256 bit Zufall, DB speichert nur den SHA-256-Hash
  (`case_confirm_tokens`), TTL `authority_token_ttl_days` (Default 30),
  Einloesung einmalig + atomar (`use_case_confirm_token`, bedingtes UPDATE).
- `confirm-case-done` (Edge Function, **Deploy mit `--no-verify-jwt`**,
  da die Behoerde keinen Account hat): setzt `weitergeleitet -> erledigt`
  ueber die Statusmaschine, schreibt audit_log, pusht an Melder mit Opt-in.
  Ungueltige/benutzte Tokens bekommen eine neutrale Fehlerseite.

Scheduler-Beispiel (Supabase Dashboard -> Edge Functions -> Schedules, oder
pg_cron + pg_net): woechentlich `POST /functions/v1/authority-digest` mit
`Authorization: Bearer <service_role>` (nur serverseitig konfigurieren!).
