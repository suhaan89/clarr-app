# On-Device-Bilderkennung (Advisory)

Ein kleines, **selbst trainiertes** Bildklassifikationsmodell („illegale
Müllablagerung ja/nein“) läuft direkt auf dem Handy. Es gibt beim
Fotografieren sofort Feedback und fängt offensichtliche Fehlfotos ab, bevor
etwas hochgeladen wird.

**Es berät nur.** Die verbindliche Entscheidung über Veröffentlichung und
Punkte bleibt serverseitig (`analyze-photo` + Review-Queue, siehe
`docs/vision.md`), weil man ein Ergebnis auf dem Gerät manipulieren kann.
Der Nutzer kann **immer** trotzdem melden.

## Überblick

```
App-Start ──► vision_models (aktive Version?) ──► ml-models/<version>.tflite
              │ keine aktive → lokales Modell löschen      │ SHA-256 prüfen
              ▼                                             ▼
Foto ──► mittig quadratisch zuschneiden ──► 224×224 ──► TFLite (nativ) ──► Score 0..1
                                                                              │
          Score ≥ Schwelle: „Könnte Müll sein“                                │
          Score < Schwelle: „Wir erkennen hier keinen Müll, trotzdem melden?“ ◄┘
                                                                              │
submit-report speichert Score + Modellversion ──► analyze-photo (verbindlich) ◄┘
                                                    darf den Score nur zum Verschärfen nutzen
Review-Queue entscheidet ──► vision_training_samples (nur mit Einwilligung) ──► training/
```

| | |
|---|---|
| **Bibliothek** | [`react-native-fast-tflite`](https://github.com/mrousavy/react-native-fast-tflite) v3 (JSI/Nitro, nativ, New Architecture) |
| **Modell** | eigenes MobileNetV2 (Keras, Apache 2.0), TFLite int8, rund 2,7 MB, **nicht** gebündelt, sondern per Download |
| **Vorverarbeitung** | `expo-image-manipulator` (Zuschnitt + Resize) + `jpeg-js` (JPEG → RGB), Normalisierung laut Metadaten |
| **Dev-Build nötig?** | Ja. In Expo Go läuft die Erkennung nicht (die App funktioniert dort trotzdem, nur ohne Hinweis). |

## Architektur (`src/lib/vision/`)

```
types.ts       Typen (ModelManifest, VisionResult, Fehlerklassen)          rein
config.ts      Feature Flag, Bucket, Prüfintervall, Größenlimit
manifest.ts    Metadaten aus vision_models prüfen, Hex, Intervall           rein, getestet
preprocess.ts  Zuschnitt, Eingabe-Tensor (float32/uint8/int8), Score       rein, getestet
verdict.ts     Score + Schwelle → „trash“ / „no-trash“                     rein, getestet
modelStore.ts  Download, SHA-256, Cache, Fernschalter
classifier.ts  EINZIGE Datei mit TFLite; lazy, nativer Thread
index.ts       Öffentliche API: analyzePhoto, warmUpVision, refreshVisionModel
useVision.ts   Hook: idle → analyzing → done | skipped | unavailable       getestet
```

### Feature Flag und Fallback

Die Prüfung läuft nur, wenn **alle** Bedingungen erfüllt sind:

1. `EXPO_PUBLIC_ONDEVICE_VISION` ist nicht `0` (Build-Schalter) und die App
   läuft nicht im Web.
2. In `public.vision_models` gibt es eine Zeile mit `status = 'aktiv'`
   (Fernschalter, wirkt beim nächsten Check).
3. Das Modell ist heruntergeladen und die Prüfsumme stimmt.
4. Das native Modul ist vorhanden (Dev-/Production-Build).

Fehlt 1 bis 3, liefert `analyzePhoto` einen `VisionDisabledError` → Status
`skipped` → **die UI zeigt nichts**, die Meldung geht ganz normal an den
Server, ohne Score. Fehlt 4 oder geht die Inferenz schief, heißt der Status
`unavailable` und es erscheint ein dezenter Hinweis. Blockiert wird nie.

Heute gibt es noch **kein** trainiertes Modell. Deshalb ist die Prüfung
überall im Zustand `skipped`, bis die erste Version freigeschaltet ist.

### Modell-Updates ohne App-Update

`refreshVisionModel()` läuft beim App-Start (`src/app/_layout.tsx`),
höchstens einmal pro 24 h, im Hintergrund und wirft nie:

| Lage | Verhalten |
|---|---|
| offline / Serverfehler | alten Stand behalten, beim nächsten Start neu fragen |
| keine aktive Version | lokales Modell und Cache löschen (Fernschalter) |
| gleiche Version, gleiche Prüfsumme | nur Metadaten übernehmen (z. B. neuer Schwellenwert) |
| neue Version | nach `vision-models/<version>.tflite.download` laden, Größe + SHA-256 prüfen, erst dann umbenennen und umschalten, alte Dateien löschen |
| Prüfsumme falsch / zu groß | verwerfen, alte Version bleibt aktiv |

Grenze: Die Prüfsumme schützt vor beschädigten oder abgebrochenen Downloads,
nicht vor einem absichtlich manipulierten Bucket (dafür bräuchte es eine
Signatur mit einem öffentlichen Schlüssel in der App). Da das Ergebnis nur
berät und der Server es nur zum Verschärfen nutzt, ist das vertretbar.

### Metadaten (`public.vision_models`, Migration 023)

| Spalte | Bedeutung |
|---|---|
| `version` | eindeutig, z. B. `2026-10-01-a`; die App cacht danach |
| `storage_path`, `sha256`, `size_bytes` | Datei im Bucket `ml-models` |
| `input_size` | Kantenlänge, z. B. 224 |
| `labels`, `positive_index` | Klassenreihenfolge der Ausgabe, Index von „positiv“ |
| `threshold` | ab hier „könnte Müll sein“ |
| `norm_mean`, `norm_std` | je Kanal auf Pixel 0..255, Standard `[0,0,0]` / `[255,255,255]` = Werte 0..1 |
| `input_quant`, `output_quant` | `{scale, zero_point}` bei int8/uint8-Tensoren, sonst `NULL` |
| `output_activation` | `softmax` (Wahrscheinlichkeiten) oder `none` (Logits, App rechnet um) |
| `status` | `entwurf` → `aktiv` (genau eine) → `zurueckgezogen` |
| `metrics` | Auswertung aus `training/evaluate.py` |

Alle Werte schreibt `training/export.py` automatisch aus der exportierten
Datei. Nichts davon ist im App-Code fest verdrahtet.

### Nicht blockierend

`model.run()` rechnet nativ auf einem eigenen Thread. Auf dem JS-Thread
laufen nur das Dekodieren eines 224×224-JPEGs und die Umrechnung von rund
50 000 Pixeln, das sind wenige Millisekunden. Das Absenden ist nie an die
Analyse gekoppelt; wer schneller absendet, schickt eben keinen Score mit.

## UX

- Score ≥ Schwelle: grüne Karte „Könnte Müll sein · Nur ein Hinweis“.
- Score < Schwelle: gelbe Karte „Wir erkennen hier keinen Müll. Trotzdem
  melden? Das entscheidest du.“ mit **Trotzdem melden** (klappt den Hinweis
  zu) und **Neues Foto**. Der Absende-Knopf bleibt immer aktiv.
- Transparenz: Die ständig sichtbare Karte „Automatische Foto-Prüfung“
  erklärt zusätzlich, dass der Score mit der Meldung gespeichert wird und
  nichts entscheidet (`report.ai_ondevice_body`).
- Alle Texte in `src/lib/i18n/translations.ts` (de + en).

## Server-Seite

- `submit-report` nimmt `ondeviceScore` (0..1) und `ondeviceModelVersion`
  an und speichert beide in `reports`, **nur** wenn die Version in
  `vision_models` veröffentlicht ist. Sonst nichts.
- `analyze-photo` nutzt den Score **nur in eine Richtung**: Sagt die
  Server-KI „ok“, der Handy-Score liegt aber unter
  `system_settings.ondevice_disagree_below`, geht die Meldung an einen
  Menschen (`low_confidence`, Audit-Eintrag `ondevice_disagreement`). Der
  Score kann nie veröffentlichen, ablehnen, Kosten sparen oder Punkte
  auslösen. Standard ist `null` = aus, bis sich ein Modell bewährt hat.
- Die App ruft `analyze-photo` jetzt nach `submit-report` auf (vorher fehlte
  dieser Aufruf, Meldungen blieben auf `gemeldet`).

Schwelle aktivieren (erst wenn ein Modell gute Zahlen hat):

```sql
UPDATE system_settings SET value = '0.15' WHERE key = 'ondevice_disagree_below';
```

## Trainingsdaten-Pipeline

`vision_training_samples` (Migration 023) sammelt pro Meldung die späteren
Labels:

| Spalte | Quelle |
|---|---|
| `report_id` → Foto | verpixelte, freigegebene Kopie über `vision_training_export` |
| `ondevice_score`, `ondevice_model_version` | aus `reports` |
| `ai_outcome`, `ai_confidence` | `apply_vision_result` (Grund-Code) |
| `human_decision` | `moderate_report` (freigeben/ablehnen) |
| `human_label` | `set_training_label` (Moderator, ausdrücklich) |
| `label`, `label_source` | berechnet: Mensch vor KI; Ablehnung ohne Label bleibt offen |
| `split` | fest pro Fall (~20 % val), damit ein Ort nicht in train UND val landet |

Befüllt per Trigger auf `reports.decision_reason/decided_at`, also ohne
Änderung an `apply_vision_result` oder `moderate_report`. Aufgenommen wird
nur, wer `ki_training` aktuell erlaubt **und** schon vor der Meldung erlaubt
hat. Nie aufgenommen: Seed-Daten, `unsafe_content`, `private_context`,
`moderator_private`.

Löschung: Widerruf (Trigger, sofort), Meldung/Konto (Kaskade), 24 Monate
(`purge_expired_training_samples` im `storage-cleanup`-Lauf), lokale Kopien
per `training/sync_dataset.py` vor jedem Training. Der Datenexport enthält
die eigenen Zeilen.

## Neues Modell ausliefern

Siehe `training/README.md`: trainieren, auswerten, exportieren, Datei in
`ml-models/models/<version>.tflite` hochladen, `vision_models.sql` ausführen,
auf `aktiv` schalten. Notbremse: Status `zurueckgezogen`.

## Development Build (Android zuerst)

Einmalig:

```bash
npm i -g eas-cli
eas login
eas init                    # trägt extra.eas.projectId in app.json ein
```

Build und Installation:

```bash
npm run build:android:dev   # = eas build --profile development --platform android
# Link/QR aus der Ausgabe öffnen und die APK auf dem Handy installieren
npx expo start              # Dev-Server; die installierte App verbindet sich damit
```

- `eas.json` → Profil `development`: `developmentClient: true`, interne
  Verteilung, APK. Die `EXPO_PUBLIC_*`-Werte kommen im Dev-Build aus deiner
  lokalen `.env`, weil Metro das JS bündelt. Für `preview`/`production`
  werden sie als EAS-Umgebungsvariablen hinterlegt
  (`eas env:create --environment preview ...`), nicht mehr als Platzhalter
  in `eas.json`.
- Config Plugin: `react-native-fast-tflite` steht bereits in `app.json` →
  `plugins`. GPU-Delegates sind bewusst aus (CPU ist am kompatibelsten).
- Lokal ohne EAS geht auch `npx expo run:android` (Android Studio + SDK nötig).
- Nach Änderungen an nativen Paketen oder `app.json` muss neu gebaut werden;
  reine JS-Änderungen kommen per Metro sofort.

## Bekannte Grenzen

- Ohne trainiertes Modell passiert nichts. Qualität hängt ganz an den
  Trainingsdaten, vor allem an guten Negativbeispielen (volle, legale
  Mülleimer!).
- Trainiert wird auf verpixelten Kopien, geprüft wird auf dem Handy das
  unverpixelte Foto. Der Unterschied ist klein (Verpixelung betrifft nur
  Gesichter/Kennzeichen), sollte aber bei der Auswertung im Blick bleiben.
- int8 kostet etwas Genauigkeit; deshalb wertet `evaluate.py` auch das
  exportierte `.tflite` aus.
- Läuft nicht in Expo Go und nicht im Web.
