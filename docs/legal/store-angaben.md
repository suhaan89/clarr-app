<!--
  ENTWURF — JURISTISCH PRÜFEN. Vorbefüllung der Store-Formulare auf Basis der
  verifizierten Datenflüsse (docs/legal/data-flows.md). Die endgültigen
  Angaben im Store trifft der Betreiber; Kategorien/Zwecke rechtlich prüfen.
  „Geteilt" (shared) = an Dritte übermittelt; „gesammelt" (collected) = vom
  Betreiber/Auftragsverarbeiter verarbeitet. Anthropic/Resend/Supabase sind
  Auftragsverarbeiter — ob das als „sharing" i. S. der Store-Formulare zählt,
  ist je Store unterschiedlich und JURISTISCH zu bewerten.
-->

# Store-Angaben (Entwürfe) — App Privacy · Data Safety · Alterseinstufung

## A. Apple „App Privacy" (App Store Connect)

Für jede Datenart: gesammelt? · verknüpft mit Identität? · fürs Tracking? · Zweck.
CLAR macht **kein** Tracking (kein Werbe-/Cross-App-Tracking), **kein**
Datenverkauf.

| Datenart | Gesammelt | Mit Nutzer verknüpft | Tracking | Zweck |
|---|---|---|---|---|
| E-Mail-Adresse | Ja | Ja | Nein | App-Funktion (Konto/Login) |
| Grober **Standort** (Meldung, gerundet öffentlich) | Ja | Ja | Nein | App-Funktion (Müllkarte) |
| **Fotos** (Original privat; öffentlich nur anonymisiert) | Ja | Ja | Nein | App-Funktion |
| Nutzer-Inhalte (Beschreibungstext der Meldung) | Ja | Ja | Nein | App-Funktion |
| Identifikatoren: **nur** zufällige Install-ID (serverseitig gehasht) | Ja | Nein (gehasht) | Nein | Missbrauchsschutz |
| Nutzungsdaten (Punkte/Level, kosmetisch) | Ja | Ja | Nein | App-Funktion |
| Diagnose/Crash | **Nein** (kein Crash-SDK eingebunden) | — | Nein | — |

> Hinweis: **Kein Push.** Die App bindet `expo-notifications` nicht ein und
> fordert keine Push-Berechtigung an; „Push-Token" darf im Formular **nicht**
> angegeben werden (Stand 2026-09-23, verifiziert in `package.json` und `src/`).
>
> Hinweis: **Kartenanbieter.** `react-native-maps` nutzt auf Android Google
> Maps und auf iOS Apple Maps. Die Kartenanbieter erhalten technisch den
> angesehenen Ausschnitt. Für Apples Formular ist das i. d. R. keine eigene
> „Datenerhebung durch den Entwickler", für Play Data Safety ist es
> [PRÜFEN]. In der Datenschutzerklärung sind beide benannt.
>
> Hinweis: **Präzise** Standortdaten werden
> erfasst (Meldung/Fallabschluss brauchen ~100 m), aber **öffentlich nur
> gerundet** angezeigt — im Formular als Standort „Precise" **oder** „Coarse"
> je nach Apple-Definition einstufen (JURISTISCH PRÜFEN; Erfassung ist
> `Accuracy.Balanced` ≈ grob).

## B. Google Play „Data Safety" (Play Console)

| Datentyp | Gesammelt | Geteilt | Zweck | Optional? |
|---|---|---|---|---|
| E-Mail-Adresse | Ja | [PRÜFEN: Auftragsverarbeiter] | Konto-Verwaltung | Pflicht |
| Standort (ungefähr) | Ja | Nein* | App-Funktionalität | Pflicht für Meldung |
| Fotos | Ja | Nein* (öffentlich nur anonymisiert) | App-Funktionalität | Ja (Galerie optional) |
| App-Aktivität (Punkte) | Ja | Nein | App-Funktionalität | — |
| Geräte-/andere IDs (gehashte Install-ID) | Ja | Nein | Betrugs-/Missbrauchsschutz | — |

Zusätzlich in Data Safety anzugeben:
- **Verschlüsselung bei Übertragung:** Ja (HTTPS/TLS).
- **Verschlüsselung im Ruhezustand:** Ja (Session nativ AES; Hosting Supabase).
- **Nutzer kann Löschung beantragen:** Ja — **Web-Löschroute-URL angeben**
  (siehe minderjaehrige-und-loeschung.md §4).
- **Daten werden verkauft:** Nein.

## B1. Was NICHT angegeben werden darf

Diese Zeilen standen früher im Entwurf oder liegen nahe, treffen aber nicht zu.
Falsche Angaben in den Store-Formularen sind ein eigener Ablehnungsgrund.

- **Push-Benachrichtigungen / Push-Token:** nicht implementiert.
- **Diagnose- oder Absturzdaten:** kein Crash-SDK eingebunden.
- **Werbe-IDs, Tracking, Datenverkauf:** findet nicht statt.
- **Kontakte, Kalender, Mikrofon, Gesundheitsdaten:** keine Berechtigung, kein
  Zugriff.
- **Biometrische Daten:** Gesichter werden nur erkannt, um sie zu verpixeln.
  Es entsteht kein biometrisches Template, es findet kein Abgleich und keine
  Identifikation statt. In den Formularen daher **nicht** als biometrische
  Datenerhebung angeben. [JURISTISCH PRÜFEN]

\* „Nein" bei *geteilt* nur zutreffend, wenn Supabase/Anthropic/Resend als
**Auftragsverarbeiter** (nicht als „Dritte" i. S. des Formulars) gewertet
werden — **JURISTISCH PRÜFEN** und ggf. auf „Ja/geteilt" korrigieren.

## C. Altersfreigabe / Content Rating (Entwurf-Antworten)

**Apple Age Rating & Google IARC-Fragebogen** — vorgeschlagene Antworten
(JURISTISCH PRÜFEN):

- Gewalt / Schreckmomente / Sexualität / Drogen / Glücksspiel: **Nein**.
- **Nutzergenerierte Inhalte** (Fotos/Text öffentlich sichtbar): **Ja** →
  löst i. d. R. eine höhere Mindestfreigabe aus (Moderation + Meldefunktion
  vorhanden: Flag-Button/`moderation_flags`, fail-safe unsichtbar).
- **Nutzer-Interaktion / geteilte Standorte:** Ja (öffentliche Karte, gerundet).
- Uneingeschränkter **Web-Zugang**: Nein (kein In-App-Browser für beliebige URLs).
- Erwartetes Ergebnis: **nicht 4+/Everyone**; realistisch **12+/Teen**
  (durch UGC + Standort). Endgültige Einstufung bestimmt der Fragebogen.

## D. Erforderliche Store-Metadaten (Text)

- **Support-URL** (Pflicht), **Marketing-URL** (optional), **Datenschutz-URL**
  (Pflicht, öffentlich): siehe hosting-checkliste.md.
- **Kurz-/Langbeschreibung** de/en: Entwürfe in store-praesenz.md (Area 4).
