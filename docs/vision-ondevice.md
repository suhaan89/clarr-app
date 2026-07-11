# On-Device-Bilderkennung (Advisory)

Kostenlose Müll-Erkennung, die **vollständig auf dem Gerät** läuft: kein Cloud-
Dienst, kein API-Key, kein Rechnungsrisiko, offline. Das Ergebnis ist ein
**Hinweis** für die meldende Person („Müll erkannt" / „kein Müll" / „unsicher"
mit Confidence) und **blockiert die Meldung nie**. Die serverseitige
Verifikation (`analyze-photo`, Kill-Switch, Budget – siehe `docs/vision.md`)
bleibt davon **unberührt**; dieses Feature sendet nichts an den Server.

## Gewählte Lösung

| | |
|---|---|
| **Bibliothek** | [`react-native-fast-tflite`](https://github.com/mrousavy/react-native-fast-tflite) v3 (JSI/Nitro, TensorFlow Lite nativ) |
| **Basismodell** | MobileNet v1 (1.0, 224 px, **uint8-quantisiert**) + ImageNet-Labels, gebündelt in `assets/vision/` (~4 MB) |
| **Vorverarbeitung** | `expo-image-manipulator` (Resize auf 224×224) + `jpeg-js` (JPEG→RGB) |
| **Dev-Build nötig?** | **Ja** – native Module. `expo-dev-client` ist bereits im Projekt, die Hürde also schon bezahlt. In Expo Go läuft die Erkennung nicht. |

### Warum nicht `@tensorflow/tfjs-react-native`?

Das war der ursprünglich bevorzugte Weg, ist aber praktisch **nicht mehr
wartbar**: `@tensorflow/tfjs-react-native` steht bei v1.0.0 und verlangt
`@react-native-async-storage/async-storage@^1.13.0`. Das Projekt nutzt
`2.2.0` → **harter Peer-Dependency-Konflikt** (npm bricht ab). Zudem ist die
WebGL/`expo-gl`-Kette unter React Native 0.81 / New Architecture fragil.

`react-native-fast-tflite` installiert dagegen konfliktfrei, ist aktiv
gepflegt, JSI-basiert (schnell) und New-Architecture-kompatibel. Deshalb der
Wechsel. `classify()` liefert bei TFLite zwar nur Klassen-Indizes – die
zugehörigen Labels bündeln wir als `labels.json` neben dem Modell.

## Architektur (`src/lib/vision/`)

Sauber getrennt, damit das Modell später **ohne Änderung am restlichen Code**
getauscht werden kann:

```
src/lib/vision/
  types.ts        Öffentliche Typen + VisionClassifier-Interface (rein)
  config.ts       Eingabegröße, Top-k, Schwellen, Pixel-Normalisierung (rein)
  labels.ts       Heuristik „Label → Müll?" per Schlüsselwort (rein, getestet)
  verdict.ts      Rohvorhersagen → Urteil (trash/no-trash/uncertain) (rein, getestet)
  classifier.ts   EINZIGE native/modell-spezifische Datei (fast-tflite, lazy)
  index.ts        Öffentliche API: analyzePhoto(), warmUpVision(), Typen
  useVision.ts    React-Hook: Zustandsmaschine idle→analyzing→done|unavailable
assets/vision/
  model.tflite    Das gebündelte Modell (offline)
  labels.json     Labelliste passend zur Modell-Ausgabe
  model.assets.ts Verweis (require) auf beide – der Umschaltpunkt
```

**Reine Module** (`types`, `config`, `labels`, `verdict`) enthalten keine
nativen Imports und sind per Jest getestet (`src/lib/vision/__tests__/`). Alles
Native lädt `classifier.ts` **lazy** und in `try/catch`: Fehlt Dev-Build,
Modul oder Modell, wirft es `VisionUnavailableError`, der Hook zeigt „Analyse
nicht verfügbar" – die App und die Meldung bleiben voll funktionsfähig.

### Entscheidungslogik (`verdict.ts`)

Bewusst dreiwertig und konservativ (MobileNet ist **nicht** müll-spezifisch):

1. Stärkstes müll-relevantes Label ≥ `trashConfident` (0.30) → **Müll erkannt**.
2. Schwaches Müll-Signal ≥ `trashMaybe` (0.12) → **unsicher**.
3. Modell erkennt insgesamt nichts Deutliches (< `sceneMin` 0.20) → **unsicher**.
4. Sonst → **kein Müll erkannt**.

Schwellen zentral in `config.ts`. Die „Label → Müll"-Zuordnung in `labels.ts`
matcht Schlüsselwörter wie `bottle`, `plastic bag`, `tin can`, `carton` in den
ImageNet-Labelnamen.

## Setup / Aktivierung

Das Modell ist bereits gebündelt (`assets/vision/`), `model.assets.ts` zeigt
darauf. Nach `npm install` genügt ein **Dev-Build**:

```bash
npx expo run:android      # oder run:ios
```

Modell neu laden oder aktualisieren (lädt EINMAL online, danach offline):

```bash
node scripts/fetch-vision-model.js
```

## Ein müll-spezifisches Modell einspielen

Genau dafür ist die Schnittstelle gebaut – **kein Code außerhalb von
`assets/vision/` ändert sich**:

1. Ein auf Müll trainiertes Modell als **`.tflite`** exportieren (Bild-
   klassifikation, Eingabe 224×224×3). Öffentliche Datensätze z. B.
   [**TACO**](http://tacodataset.org/) (Trash Annotations in Context) oder
   TrashNet; mit TensorFlow/Keras trainieren und via TFLite-Converter
   exportieren (float32 **oder** uint8 – der Classifier erkennt den Typ über
   `model.inputs[0].dataType`).
2. Passende Labelliste als `labels.json` (ein String pro Klasse, Reihenfolge =
   Modell-Ausgabe) bereitstellen.
3. Beide Dateien einspielen – am einfachsten per Skript:
   ```bash
   MODEL_URL=https://…/muell-modell.tflite \
   LABELS_URL=https://…/muell-labels.txt \
     node scripts/fetch-vision-model.js
   ```
   oder manuell nach `assets/vision/` legen und `model.assets.ts` auf beide
   `require(...)` zeigen lassen.
4. **Normalisierung** in `config.ts` prüfen (`Preprocess.pixelMean/pixelStd`):
   Standard ist `[-1, 1]` (Keras-MobileNet). Erwartet das Modell `[0, 1]`,
   `mean = 0, std = 255` setzen. Bei uint8-Modellen wird sie übersprungen.
5. Ggf. `labels.ts` anpassen: Hat das neue Modell eine echte „Müll"-Klasse,
   kann die Schlüsselwort-Heuristik entfallen und direkt auf den Klassennamen
   geprüft werden.

## GPU-Beschleunigung (optional)

Standard ist der CPU-Delegate (maximal kompatibel). Für GPU in
`classifier.ts` beim `loadTensorflowModel(MODEL_ASSET, [...])` einen Delegate
angeben (`'core-ml'`/`'metal'` auf iOS, `'android-gpu'`/`'nnapi'` auf Android)
und im `react-native-fast-tflite`-Plugin (`app.json`) die passenden Optionen
aktivieren. Nicht jedes Modell unterstützt jeden Delegate.

## Bekannte Grenzen der Treffsicherheit

- **Kein Müll-Modell.** MobileNet/ImageNet kennt Alltagsobjekte, keine
  „Vermüllung". Eine Flasche im Bild wird erkannt – ob sie *Abfall* ist,
  entscheidet der Kontext, den das Modell nicht sieht. Daher rein **Advisory**.
- **Falsch-Positive/Negative** sind erwartbar: verstreute Kleinteile,
  ungewöhnliche Blickwinkel, schlechtes Licht, Nässe. „unsicher" ist Absicht,
  kein Fehler.
- **uint8-Quantisierung** kostet etwas Genauigkeit gegenüber float32 – im
  Gegenzug kleiner und schneller.
- Die Schwellen in `config.ts` sind Startwerte und dürfen nach echten Tests
  nachjustiert werden.
- Läuft nur im Dev-/Production-Build, **nicht in Expo Go**.

Fazit: gut genug als hilfreicher Hinweis beim Fotografieren, **nicht** als
Verifikation. Die eigentliche Prüfung bleibt serverseitig.
