# Ops: Migrationen, Tests, Umgebungen (Paket 12)

## Grundsätze

- **Migrationen sind die Quelle der Wahrheit** (`supabase/migrations/`,
  fortlaufend `NNN_name.sql`). Kein Schema-Gefummel im Dashboard — was
  nicht als Migration im Repo liegt, existiert nicht.
- **Nur additiv**: neue Tabellen/Spalten/Funktionen; niemals DROP/RENAME
  von Bestand. Die zwei dokumentierten Policy-Ausnahmen stehen in
  NOTIZEN.md (Paket 8: `reports_select_all`, Paket 10: `events_insert_own`).
- **Umgebungen**: dev → staging → prod, immer in dieser Reihenfolge,
  immer per Migration. Automatische Läufe migrieren NUR dev.

## Workflow

```
# 1. Neue Migration schreiben
supabase/migrations/014_beschreibung.sql   # naechste freie Nummer

# 2. Lokal testen (Docker noetig)
supabase start                # spielt Migrationen + seed.sql ein
supabase test db              # pgTAP: supabase/tests/*.test.sql
npm test                      # Jest: Client-Logik (Offline-Queue, Validierung)

# 3. Gegen DEV ausrollen
supabase link --project-ref <DEV-REF>
supabase db push              # wendet ausstehende Migrationen an

# 4. Edge Functions deployen
supabase functions deploy submit-report analyze-photo process-photo \
  close-case close-event-cases export-my-data delete-account authority-digest \
  storage-cleanup
supabase functions deploy confirm-case-done --no-verify-jwt   # Behoerden-Link ohne Login

# 5. Secrets (nur Dashboard/CLI, NIE im Repo)
supabase secrets set ANTHROPIC_API_KEY=... RESEND_API_KEY=... DIGEST_FROM_EMAIL=...
```

## Tests

| Ebene | Werkzeug | Was |
|---|---|---|
| DB/Rewards/Auth | pgTAP (`supabase test db`) | Idempotenz, Tagesdeckel, „Client kann nicht buchen", Verifikations-Level, reputation-Grenzen, Consents append-only |
| Client-Logik | Jest (`npm test`) | Offline-Queue (kein Doppel-Sync), Auth-/Pseudonym-Validierung |
| Typen | `npx tsc --noEmit` | App-Code (supabase/ ist Deno, ausgenommen) |

## Seeds

- `supabase/seed.sql`: SYNTHETISCHE Daten für lokale Entwicklung/Staging
  (example.com-Nutzer, SEED-markierte Fälle/Events). Läuft automatisch bei
  `supabase start`/`db reset`. Niemals in prod einspielen.
- `scripts/seed-admin.mjs`: ECHTE Cold-Start-Inhalte (Paket 10), nur vom
  Betreiber mit service_role aus der Umgebung; verweigert prod-URLs.

## Scheduling

- `authority-digest` wöchentlich (Dashboard → Edge Functions → Schedules
  oder pg_cron + pg_net) mit `Authorization: Bearer <service_role>`.
- `storage-cleanup` (Runde 6, Paket G.32) täglich, gleiches Schema.
  Räumt Objekte in `originals`/`public-blurred` ohne zugehörige
  `report_photos`-Zeile auf (24h-Schonfrist gegen Races mit laufenden
  Uploads). Schreibt eine Zusammenfassung (nur Zahlen) ins `audit_log`.

## Was NIE passieren darf

- service_role-Key im Repo, im Client oder in Logs.
- Migration direkt gegen staging/prod aus einem automatischen Lauf.
- Schema-Änderungen am Dashboard vorbei an den Migrationen.

## Sicherheitsvorfaelle und Datenpannen

Ergebnis des Legal-Audits 2026-09-23. Der Prozess ist bewusst so klein
gehalten, dass eine einzelne Person ihn unter Stress durchhalten kann.

### Rollen

- **Meldestelle:** [BETREIBER EINTRAGEN: Sicherheits-E-Mail]. Die Adresse
  steht in der Datenschutzerklaerung (Abschnitt 12) und im Impressum.
- **Verantwortlich fuer die Entscheidung:** der im Impressum genannte
  Anbieter. Bei minderjaehrigen Betreibern entscheidet die gesetzlich
  vertretende Person mit.

### Ablauf bei einem Verdacht

1. **Stunde 0 bis 1 — Eindaemmen.** Betroffenen Zugang sperren, Schluessel
   rotieren (Supabase service_role, ANTHROPIC_API_KEY, RESEND_API_KEY ueber
   die jeweilige Konsole), bei Bedarf den Vision-Kill-Switch in
   `system_settings` setzen. Nichts loeschen: Logs sind Beweismittel.
2. **Stunde 1 bis 4 — Feststellen.** Was ist betroffen (Tabellen, Buckets,
   Konten), seit wann, wie viele Personen, welche Datenkategorien. Quellen:
   `audit_log`, `rate_limit_events`, Supabase-Logs.
3. **Stunde 4 bis 24 — Bewerten.** Besteht ein Risiko fuer die Rechte und
   Freiheiten der Betroffenen? Bei Standortdaten, Fotos mit Personen oder
   Daten Minderjaehriger ist die Antwort im Zweifel ja.
4. **Innerhalb von 72 Stunden — Melden (Art. 33 DSGVO).** Meldung an den
   Landesbeauftragten fuer den Datenschutz und die Informationsfreiheit
   Baden-Wuerttemberg, auch wenn noch nicht alles geklaert ist; Nachtrag ist
   zulaessig. Eine Meldung unterbleibt nur, wenn ein Risiko unwahrscheinlich
   ist — diese Begruendung wird schriftlich festgehalten.
5. **Unverzueglich — Betroffene informieren (Art. 34 DSGVO)**, wenn ein hohes
   Risiko besteht: in der App und per E-Mail an die betroffenen Konten, in
   einfacher Sprache, mit dem, was die Person selbst tun kann.
6. **Danach — Dokumentieren.** Jeder Vorfall wird in einer internen Liste
   festgehalten (Zeitpunkt, Sachverhalt, Auswirkung, Massnahmen, Entscheidung
   ueber die Meldung). Das ist nach Art. 33 (5) DSGVO Pflicht, auch wenn nicht
   gemeldet wurde.

### Gemeldete Schwachstellen von aussen

Hinweise von Dritten werden bestaetigt, innerhalb von 14 Tagen bewertet und
nach Behebung beantwortet. Wir gehen nicht gegen Personen vor, die eine
Schwachstelle verantwortungsvoll melden und keine fremden Daten abgreifen.

### Cyber Resilience Act

[ANWALT PRUEFEN] Ob CLAR unter die Verordnung (EU) 2024/2847 faellt. Sie
greift bei Produkten mit digitalen Elementen, die im Rahmen einer
Geschaeftstaetigkeit auf dem Markt bereitgestellt werden; bei einem rein
nicht kommerziellen Projekt greift sie nicht (siehe FRAGEN.md, Frage zur
kommerziellen Natur). Falls sie greift, kommen zu dem Prozess oben die
Meldepflichten an ENISA und das BSI hinzu: aktiv ausgenutzte Schwachstellen
und schwerwiegende Vorfaelle sind binnen 24 Stunden als Fruehwarnung, binnen
72 Stunden als Meldung und binnen 14 Tagen beziehungsweise einem Monat als
Abschlussbericht zu melden. Der Ablauf oben ist so geschnitten, dass diese
Fristen eingehalten werden koennen.

## Abhaengigkeiten und Lizenzen

- `npm audit` gehoert zu jedem Release-Check. Stand 2026-09-23: 34 Meldungen,
  alle transitiv aus der Expo-Build-Toolchain (@expo/config,
  @expo/config-plugins, expo-constants, expo-manifests, expo-dev-client,
  expo-splash-screen). Keine Laufzeitabhaengigkeit der ausgelieferten App ist
  direkt betroffen; eine Behebung erfordert ein Expo-SDK-Update und ist
  deshalb an den naechsten SDK-Wechsel gekoppelt.
- Der Lizenz-Screen `src/app/legal/lizenzen.tsx` listet die direkten
  Abhaengigkeiten. Nach jedem Hinzufuegen oder Entfernen eines Pakets die
  Liste nachziehen: `node scripts/lizenzen.mjs` gibt sie aus.

## Release-Build mit EAS

Einmalig, von Hand (braucht dein Expo-Konto):

1. `npx eas login`, dann `npx eas init`: traegt die `projectId` in `app.json`
   ein. Ohne sie startet kein Build.
2. Umgebungsvariablen je EAS-Umgebung (`development`, `preview`,
   `production`) setzen, z. B. `npx eas env:create`:
   `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
   `EXPO_PUBLIC_ONDEVICE_VISION`, `GOOGLE_MAPS_ANDROID_API_KEY`.
   `EXPO_PUBLIC_DEMO` in `production` NICHT setzen.
3. Google-Maps-Schluessel: Google Cloud Console > "Maps SDK for Android"
   aktivieren, Schluessel auf das Paket `app.clar.mobile` und den
   SHA-1-Fingerabdruck des Signaturschluessels beschraenken. `app.config.js`
   reicht ihn an `react-native-maps` weiter; ohne ihn bleibt die Karte auf
   Android leer.
4. `eas.json` > `submit.production`: Apple-ID, App-Store-Connect-ID und
   Team-ID eintragen, `play-service-account.json` ablegen (nicht einchecken).

Build-Nummern zaehlt EAS selbst hoch (`appVersionSource: remote`,
`autoIncrement`). `expo-doctor` meldet `@expo/config-plugins` als direkte
Abhaengigkeit: das Paket bleibt, weil das Plugin von `react-native-maps` es
so importiert.
