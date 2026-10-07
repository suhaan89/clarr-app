"""Transfer Learning mit MobileNetV2 (Keras, Apache 2.0).

    python train.py [--name muell-v1] [--epochs 40]

Startet von Gewichten, die auf ImageNet schon "sehen" gelernt haben, und
lernt in zwei Phasen nur noch "Muell ja/nein":

  1. Kopf: Das vortrainierte Netz bleibt eingefroren, nur die neue letzte
     Schicht lernt. Schnell und stabil, auch mit wenigen Fotos.
  2. Feintuning: Die oberen Schichten des Netzes lernen mit kleiner
     Lernrate mit. Bringt meist noch ein paar Prozentpunkte.

Ergebnis: runs/<name>/weights/best.keras (die Epoche mit dem kleinsten
Val-Fehler) und runs/<name>/history.json.

Warum MobileNetV2 und nicht das neuere V3: V2 besteht nur aus Bausteinen,
die sich sauber auf 8-Bit-Ganzzahlen runden lassen. Das int8-Modell aus V3
(Hard-Swish, Squeeze-Excite) liess sich mit dem Standard-Beschleuniger von
TFLite (XNNPACK) gar nicht laden.
"""

from __future__ import annotations

import argparse
import json
import sys

import numpy as np
from PIL import Image, ImageOps

from common import CLASSES, DATASET, IMG_SIZE, RUNS, list_images, preprocess

# Trainingsbilder werden etwas groesser geladen und dann zufaellig auf
# IMG_SIZE zugeschnitten (leichte Variation von Ausschnitt und Abstand).
AUG_SIZE = 256
FINE_TUNE_FRACTION = 0.3  # so viel vom oberen Teil des Netzes lernt in Phase 2 mit


def load_split(split: str) -> tuple[list, np.ndarray]:
    paths, labels = [], []
    for index, cls in enumerate(CLASSES):
        found = list_images(DATASET / split / cls)
        paths += found
        labels += [index] * len(found)
    return paths, np.array(labels, dtype=np.int32)


def augment(path, rng: np.random.Generator) -> np.ndarray:
    """Leichte Variationen, die auch echte Handyfotos haben. Werte 0..1."""
    img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    w, h = img.size
    side = min(w, h)
    left, top = (w - side) // 2, (h - side) // 2
    img = img.crop((left, top, left + side, top + side)).resize((AUG_SIZE, AUG_SIZE), Image.BILINEAR)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    x, y = rng.integers(0, AUG_SIZE - IMG_SIZE + 1, size=2)
    arr = arr[y : y + IMG_SIZE, x : x + IMG_SIZE]
    if rng.random() < 0.5:
        arr = arr[:, ::-1]
    arr = arr * rng.uniform(0.75, 1.25)                          # Helligkeit
    arr = (arr - arr.mean()) * rng.uniform(0.8, 1.2) + arr.mean()  # Kontrast
    return np.clip(arr, 0.0, 1.0)


def make_dataset(keras, paths, labels, batch: int, training: bool, seed: int):
    class Photos(keras.utils.PyDataset):
        def __init__(self):
            super().__init__(workers=4, use_multiprocessing=False, max_queue_size=8)
            self.epoch = 0
            self.order = np.arange(len(paths))
            self.on_epoch_end()

        def __len__(self):
            return int(np.ceil(len(paths) / batch))

        def __getitem__(self, i):
            idx = self.order[i * batch : (i + 1) * batch]
            if training:
                # Eigener Zufallsgenerator pro Batch: die Batches laden parallel.
                rng = np.random.default_rng((seed, self.epoch, i))
                x = np.stack([augment(paths[j], rng) for j in idx])
            else:
                # Validierung exakt wie in der App und in evaluate.py
                x = np.concatenate([preprocess(paths[j]) for j in idx])
            return x.astype(np.float32), labels[idx]

        def on_epoch_end(self):
            if training:
                np.random.default_rng((seed, self.epoch)).shuffle(self.order)
                self.epoch += 1

    return Photos()


def build_model(keras):
    base = keras.applications.MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
    )
    base.trainable = False
    inputs = keras.Input((IMG_SIZE, IMG_SIZE, 3), name="image")  # Pixel 0..1 wie in der App
    x = keras.layers.Rescaling(2.0, offset=-1.0)(inputs)  # MobileNetV2 erwartet -1..1
    # training=False: Die BatchNorm-Statistiken des vortrainierten Netzes
    # bleiben auch beim Feintuning fest. Mit wenigen Fotos ist das stabiler.
    x = base(x, training=False)
    x = keras.layers.GlobalAveragePooling2D()(x)
    x = keras.layers.Dropout(0.2)(x)
    outputs = keras.layers.Dense(len(CLASSES), activation="softmax", name="scores")(x)
    return keras.Model(inputs, outputs), base


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=40, help="Obergrenze fuer Phase 2 (stoppt meist frueher)")
    parser.add_argument("--head-epochs", type=int, default=8, help="Epochen fuer Phase 1")
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--name", default="muell")
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    if not (DATASET / "train").exists():
        print("Kein Datensatz. Erst `python prepare_dataset.py` ausfuehren.")
        return 1
    run_dir = RUNS / args.name
    if run_dir.exists():
        print(run_dir, "existiert schon. Anderen --name waehlen.")
        return 1

    train_paths, train_labels = load_split("train")
    val_paths, val_labels = load_split("val")
    counts = np.bincount(train_labels, minlength=len(CLASSES))
    if counts.min() == 0 or len(val_paths) == 0:
        print("Beide Klassen brauchen Fotos in train und val. Erst `python prepare_dataset.py`.")
        return 1

    import keras  # erst hier: der Import dauert ein paar Sekunden

    keras.utils.set_random_seed(args.seed)
    weights_dir = run_dir / "weights"
    weights_dir.mkdir(parents=True)
    best = weights_dir / "best.keras"

    train = make_dataset(keras, train_paths, train_labels, args.batch, True, args.seed)
    val = make_dataset(keras, val_paths, val_labels, args.batch, False, args.seed)
    # Gleicht ungleich grosse Klassen aus: Fehler bei der selteneren zaehlen mehr.
    class_weight = {i: float(len(train_labels) / (len(CLASSES) * n)) for i, n in enumerate(counts)}

    model, base = build_model(keras)
    callbacks = [
        keras.callbacks.ModelCheckpoint(str(best), monitor="val_loss", save_best_only=True),
        keras.callbacks.EarlyStopping(monitor="val_loss", patience=8),  # stoppt, wenn Val nicht mehr besser wird
    ]

    def fit(learning_rate: float, epochs: int, initial_epoch: int):
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate),
            loss="sparse_categorical_crossentropy",
            metrics=["accuracy"],
        )
        return model.fit(train, validation_data=val, epochs=epochs, initial_epoch=initial_epoch,
                         class_weight=class_weight, callbacks=callbacks, verbose=2)

    print(f"Phase 1 (Kopf): {len(train_paths)} Trainings- und {len(val_paths)} Val-Fotos")
    history = fit(1e-3, args.head_epochs, 0).history

    print("Phase 2 (Feintuning)")
    base.trainable = True
    for layer in base.layers[: int(len(base.layers) * (1 - FINE_TUNE_FRACTION))]:
        layer.trainable = False
    done = len(history["loss"])
    for key, values in fit(1e-4, done + args.epochs, done).history.items():
        history[key] += values

    (run_dir / "history.json").write_text(json.dumps({"arch": "mobilenet_v2", "classes": CLASSES, **history}, indent=2))
    print("Fertig. Bestes Modell:", best)
    print("Weiter mit: python evaluate.py --model", best)
    return 0


if __name__ == "__main__":
    sys.exit(main())
