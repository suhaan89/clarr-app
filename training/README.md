# CLAR – Müll-Erkennung trainieren

Dieser Ordner gehört **nicht** zur App. Hier entsteht das kleine Modell, das
auf dem Handy „illegale Müllablagerung ja/nein“ schätzt. Wie die App es
lädt, steht in `docs/vision-ondevice.md`.

## Kurz erklärt

| Begriff | Bedeutung |
|---|---|
| **Transfer Learning** | Wir starten mit einem Modell, das auf Millionen Alltagsfotos schon „sehen“ gelernt hat (`yolo11n-cls.pt`), und bringen ihm nur noch unsere eine Frage bei. Dafür reichen einige hundert Fotos pro Klasse. |
| **Klasse / Label** | `positiv` = illegale Müllablagerung, `negativ` = alles andere. |
| **Train / Val** | Mit *train* lernt das Modell, mit *val* prüfen wir es. Val-Fotos sieht es beim Lernen nie. |
| **Epoche** | Ein Durchlauf durch alle Trainingsfotos. |
| **Overfitting** | Das Modell lernt die Trainingsfotos auswendig statt das Muster. Erkennbar daran, dass *train* sehr gut und *val* deutlich schlechter ist. |
| **Data Leakage** | Fast gleiche Fotos (gleicher Ort) in train UND val. Die Zahlen sehen dann zu gut aus. Deshalb Gruppen, siehe unten. |
| **Precision** | Von allem, was das Modell „Müll“ nennt: wie viel ist wirklich Müll? |
| **Recall** | Von allem echten Müll: wie viel findet das Modell? |
| **Confusion Matrix** | 2×2-Tabelle: Wahrheit (Zeilen) gegen Vorhersage (Spalten). |
| **Schwellenwert** | Ab welchem Score die App „könnte Müll sein“ zeigt. Darunter kommt der Hinweis „Wir erkennen hier keinen Müll, trotzdem melden?“. |
| **int8-Quantisierung** | Gewichte werden auf 8-Bit-Ganzzahlen gerundet: ~4× kleiner und schneller, minimal ungenauer. |

## Einmalig einrichten

Python **3.11 oder 3.12** (für 3.14 gibt es noch nicht alle Pakete).

```powershell
cd training
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env    # nur für Fotos aus der App, siehe unten
```

Eine NVIDIA-Grafikkarte beschleunigt das Training stark. Ohne läuft es auf
dem Prozessor, dauert dann aber Stunden statt Minuten (`--device cpu`).

## Daten reinlegen

```
training/data/manual/
  positiv/   illegale Ablagerungen: Säcke im Wald, Sperrmüll am Feldweg,
             Bauschutt, Reifen, verstreuter Verpackungsmüll im Grünen
  negativ/   alles, was NICHT gemeldet werden soll
```

**Negativbeispiele sind mindestens so wichtig wie positive.** Sonst lernt
das Modell nur „Müll = Mülltonne“. Unbedingt dabei:

- **volle, aber legale Mülleimer, Container, Glascontainer, gelbe Säcke am Abholtag**
  (der schwierigste Fall, davon viele)
- saubere Wege, Parks, Ufer, Straßen
- Selfies, Menschen, Haustiere, Innenräume
- Memes, Screenshots, Fotos von Bildschirmen
- Baustellen mit ordentlich gelagertem Material, Gartenkompost

Faustregel: mindestens 300 Fotos pro Klasse, besser 1000, ungefähr gleich
viele auf beiden Seiten.

**Gruppen:** Mehrere Fotos vom selben Ort bekommen denselben Präfix vor
`__`, z. B. `waldweg-3__a.jpg`, `waldweg-3__b.jpg`. Dann landen sie
zusammen in train oder zusammen in val.

**Keine** fremden Personen oder lesbaren Kennzeichen erkennbar ins
Trainingsmaterial legen. Öffentliche Datensätze nur mit passender Lizenz
(z. B. TACO: CC BY 4.0) und Lizenzhinweis.

## Neu trainieren

```powershell
python sync_dataset.py                 # nur wenn du App-Fotos nutzt (Löschabgleich!)
python prepare_dataset.py              # oder: --no-app für nur eigene Fotos
python train.py --name muell-v1
python evaluate.py --model runs\muell-v1\weights\best.pt
python export.py --model runs\muell-v1\weights\best.pt --version 2026-10-01-a
python evaluate.py --model exports\2026-10-01-a\model.tflite
```

`evaluate.py` schlägt den höchsten Schwellenwert vor, bei dem noch 95 %
des echten Mülls als Müll erkannt werden (`--target-recall`). Zweite
Auswertung = das quantisierte Modell; weicht sie deutlich von der ersten
ab, ist beim Export etwas schiefgegangen.

## Modell ausliefern (ohne App-Update)

1. In Supabase (DEV) unter Storage, Bucket `ml-models`, die Datei
   `exports/<version>/model.tflite` nach `models/<version>.tflite` hochladen.
2. `exports/<version>/vision_models.sql` in der SQL-Konsole ausführen.
   Das legt die Version als `entwurf` an, noch sieht keine App etwas.
3. Die zwei auskommentierten Zeilen am Ende der SQL-Datei ausführen, um die
   Version auf `aktiv` zu schalten. Apps holen sie beim nächsten Start
   (höchstens einmal pro Tag) und prüfen die SHA-256-Prüfsumme.
4. Notbremse: `UPDATE vision_models SET status = 'zurueckgezogen' WHERE status = 'aktiv';`
   Dann löschen die Apps beim nächsten Check ihr Modell und prüfen nicht mehr.

## Fotos aus der App (nur lokal!)

`sync_dataset.py` holt die **verpixelten und freigegebenen** Kopien der
Meldungen, deren Absender dem Training ausdrücklich zugestimmt haben
(Profil, Datenschutz, Einwilligung „KI-Training“). Labels kommen aus der
Review-Queue (Mensch) oder aus der KI-Prüfung, wenn kein Mensch entschieden
hat.

Regeln, die aus der Datenschutzerklärung folgen:

- Vor **jedem** Training `sync_dataset.py` laufen lassen. Es löscht lokal
  alles, was nicht mehr erlaubt ist (Widerruf, gelöschte Meldung oder
  gelöschtes Konto, Frist von 24 Monaten). `prepare_dataset.py` bricht ab,
  wenn der letzte Abgleich älter als 24 Stunden ist.
- App-Fotos **nie** nach Colab, Google Drive, Dropbox, GitHub oder zu
  anderen Diensten hochladen. Training mit App-Fotos nur auf deinem Rechner.
- Der Service-Role-Key steht nur in `training/.env` (per `.gitignore`
  ausgeschlossen).
- Ein bereits trainiertes Modell „vergisst“ gelöschte Fotos nicht von
  selbst. Deshalb wird regelmäßig neu trainiert, spätestens alle 12 Monate,
  und alte Modellversionen werden zurückgezogen.

## Colab

`train_colab.ipynb` ist für Training **nur mit öffentlichen oder selbst
gemachten Fotos** gedacht (Colab läuft bei Google). Das Notebook bricht
ab, wenn `data/app` oder `.env` im hochgeladenen Ordner liegen.

## Lizenz: bitte vor dem ersten Release klären

Ultralytics YOLO steht unter **AGPL-3.0**. Ultralytics vertritt, dass auch
damit trainierte und in einer App ausgelieferte Modelle darunter fallen,
außer man hat eine Enterprise-Lizenz. Für eine nicht quelloffene App ist
das ein echtes Problem. Möglichkeiten: CLAR unter AGPL veröffentlichen,
eine Lizenz kaufen, oder das Training auf ein Apache-2.0-Modell umstellen
(MobileNetV3/EfficientNet-Lite mit Keras). Die App-Seite ist davon
unabhängig: Sie liest nur `.tflite` und die Metadaten.
