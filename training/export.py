"""Export als TFLite int8 + Metadaten fuer die App.

    python export.py --model runs/muell/weights/best.keras --version 2026-10-01-a [--threshold 0.45]

int8-Quantisierung: Die Gewichte werden von 32-Bit-Kommazahlen auf 8-Bit-
Ganzzahlen gerundet. Das Modell wird dadurch etwa viermal kleiner und
schneller. Zum Kalibrieren (welcher Zahlenbereich kommt wirklich vor?)
nutzt der Export Bilder aus data/dataset.

Ergebnis in exports/<version>/:
  model.tflite        die Datei fuer Supabase Storage (Bucket ml-models)
  manifest.json       alle Metadaten (liest auch evaluate.py)
  vision_models.sql   INSERT fuer public.vision_models (Status 'entwurf')

Der Schwellenwert kommt aus --threshold oder aus metrics.json neben dem
Modell (evaluate.py). Danach UNBEDINGT das quantisierte Modell nochmal
pruefen:  python evaluate.py --model exports/<version>/model.tflite
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np

from common import CLASSES, DATASET, EXPORTS, IMG_SIZE, list_images, load_tflite_interpreter, preprocess, run_tflite, sha256_file

MAX_BYTES = 5 * 1024 * 1024
CALIBRATION_IMAGES = 200


def convert_int8(model_path: Path, calibration: list[Path]) -> bytes:
    """Keras-Modell -> TFLite mit int8-Gewichten und int8-Ein-/Ausgang."""
    import keras
    import tensorflow as tf

    model = keras.saving.load_model(model_path)

    def representative():
        for path in calibration:
            yield [preprocess(path)]

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = representative
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.int8
    converter.inference_output_type = tf.int8
    return converter.convert()


def quant_params(detail: dict) -> dict | None:
    if detail["dtype"] not in (np.int8, np.uint8):
        return None
    scale, zero = detail["quantization"]
    return {"scale": float(scale), "zero_point": int(zero)}


def sql_json(value) -> str:
    return "NULL" if value is None else "'" + json.dumps(value).replace("'", "''") + "'::jsonb"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--version", required=True, help="z. B. 2026-10-01-a (Buchstaben, Ziffern, . _ -)")
    parser.add_argument("--threshold", type=float, default=None)
    args = parser.parse_args()

    if not re.fullmatch(r"[A-Za-z0-9._-]{1,64}", args.version):
        print("Ungueltige Version.")
        return 1
    out_dir = EXPORTS / args.version
    if out_dir.exists():
        print(out_dir, "existiert schon. Jede Version gibt es nur einmal (die App cacht nach Version).")
        return 1

    threshold = args.threshold
    metrics_path = args.model.parent / "metrics.json"
    metrics = json.loads(metrics_path.read_text()) if metrics_path.exists() else None
    if threshold is None:
        if not metrics:
            print("Kein --threshold und keine metrics.json. Erst evaluate.py laufen lassen.")
            return 1
        threshold = metrics["recommended"]["threshold"]
    if not 0 < threshold < 1:
        print("Schwellenwert muss zwischen 0 und 1 liegen.")
        return 1

    labels = list(CLASSES)
    positive_index = labels.index("positiv")

    # Kalibrierbilder gleichmaessig aus beiden Klassen ziehen.
    train_images = list_images(DATASET / "train")
    if not train_images:
        print("Keine Kalibrierbilder unter", DATASET / "train", "- erst `python prepare_dataset.py`.")
        return 1
    step = max(1, len(train_images) // CALIBRATION_IMAGES)
    tflite_bytes = convert_int8(args.model, train_images[::step][:CALIBRATION_IMAGES])

    out_dir.mkdir(parents=True)
    tflite = out_dir / "model.tflite"
    tflite.write_bytes(tflite_bytes)
    size = tflite.stat().st_size
    if size > MAX_BYTES:
        print(f"Warnung: {size / 1e6:.1f} MB, Ziel war unter 5 MB.")

    # Datentypen und Quantisierung direkt aus der Datei lesen, nicht raten.
    interpreter = load_tflite_interpreter(tflite)
    inp = interpreter.get_input_details()[0]
    out = interpreter.get_output_details()[0]
    if list(inp["shape"]) != [1, IMG_SIZE, IMG_SIZE, 3]:
        print("Unerwartete Eingabeform", inp["shape"], "(erwartet 1x224x224x3, NHWC).")
        return 1

    # Sind die Ausgaben schon Wahrscheinlichkeiten (Summe 1)?
    sample = (list_images(DATASET / "val") or list_images(DATASET / "train"))[:5]
    sums = [float(run_tflite(interpreter, preprocess(p)).sum()) for p in sample]
    activation = "softmax" if sums and all(abs(s - 1) < 0.05 for s in sums) else "none"

    manifest = {
        "version": args.version,
        "storage_path": f"models/{args.version}.tflite",
        "sha256": sha256_file(tflite),
        "size_bytes": size,
        "input_size": IMG_SIZE,
        "labels": labels,
        "positive_index": positive_index,
        "threshold": round(float(threshold), 3),
        "norm_mean": [0, 0, 0],
        "norm_std": [255, 255, 255],
        "input_quant": quant_params(inp),
        "output_quant": quant_params(out),
        "output_activation": activation,
        "input_dtype": np.dtype(inp["dtype"]).name,
        "output_dtype": np.dtype(out["dtype"]).name,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))

    db_metrics = {"at_0_5": metrics["at_0_5"], "recommended": metrics["recommended"]} if metrics else None
    sql = f"""-- In der Supabase-SQL-Konsole (DEV!) ausfuehren, NACHDEM model.tflite
-- nach ml-models/{manifest['storage_path']} hochgeladen wurde.
INSERT INTO public.vision_models
  (version, storage_path, sha256, size_bytes, input_size, labels, positive_index, threshold,
   norm_mean, norm_std, input_quant, output_quant, output_activation, status, metrics)
VALUES
  ('{args.version}', '{manifest['storage_path']}', '{manifest['sha256']}', {size}, {IMG_SIZE},
   {sql_json(labels)}, {positive_index}, {manifest['threshold']},
   '[0, 0, 0]'::jsonb, '[255, 255, 255]'::jsonb, {sql_json(manifest['input_quant'])},
   {sql_json(manifest['output_quant'])}, '{activation}', 'entwurf', {sql_json(db_metrics)});

-- Freischalten (die alte aktive Version wird dabei zurueckgezogen):
-- BEGIN;
-- UPDATE public.vision_models SET status = 'zurueckgezogen' WHERE status = 'aktiv';
-- UPDATE public.vision_models SET status = 'aktiv' WHERE version = '{args.version}';
-- COMMIT;
"""
    (out_dir / "vision_models.sql").write_text(sql)

    print(f"Fertig: {tflite} ({size / 1e6:.2f} MB, Eingang {manifest['input_dtype']}, Ausgang {manifest['output_dtype']})")
    print("Jetzt pruefen:  python evaluate.py --model", tflite)
    print("Dann hochladen und", out_dir / "vision_models.sql", "ausfuehren (siehe README).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
