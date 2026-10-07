"""Auswertung auf dem Val-Satz: Precision, Recall, Confusion Matrix, Schwellenwert.

    python evaluate.py --model runs/muell/weights/best.keras
    python evaluate.py --model exports/<version>/model.tflite   # quantisiertes Modell pruefen

Begriffe (positiv = "illegale Muellablagerung"):
  * Precision: Von allen Fotos, die das Modell "Muell" nennt, wie viele sind es wirklich?
  * Recall:    Von allen echten Muell-Fotos, wie viele findet das Modell?
  * Confusion Matrix: 2x2-Tabelle aus Wahrheit (Zeilen) mal Vorhersage (Spalten).

Fuer CLAR ist Recall wichtiger: ein faelschlicher Hinweis "kein Muell" bei
einer echten Ablagerung nervt und kann Leute vom Melden abhalten. Deshalb
schlaegt das Skript den HOECHSTEN Schwellenwert vor, bei dem der Recall noch
mindestens --target-recall erreicht.

Ergebnis: <modellordner>/metrics.json und confusion_matrix.png.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

from common import CLASSES, DATASET, IMG_SIZE, list_images, load_tflite_interpreter, preprocess, run_tflite


def scores_keras(model_path: Path, images: list[Path]) -> np.ndarray:
    import keras

    model = keras.saving.load_model(model_path)
    pos = CLASSES.index("positiv")
    out: list[float] = []
    for start in range(0, len(images), 32):
        batch = np.concatenate([preprocess(p, IMG_SIZE) for p in images[start : start + 32]])
        out += [float(row[pos]) for row in model.predict(batch, verbose=0)]
    return np.array(out)


def scores_tflite(model_path: Path, images: list[Path]) -> np.ndarray:
    manifest_path = model_path.parent / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    pos = manifest.get("positive_index", CLASSES.index("positiv"))
    size = manifest.get("input_size", IMG_SIZE)
    interpreter = load_tflite_interpreter(model_path)
    out = []
    for img in images:
        y = run_tflite(interpreter, preprocess(img, size))
        if manifest.get("output_activation") == "none":
            y = np.exp(y - y.max()) / np.exp(y - y.max()).sum()
        out.append(float(y[pos]))
    return np.array(out)


def confusion(y_true: np.ndarray, scores: np.ndarray, t: float) -> dict:
    pred = scores >= t
    tp = int(np.sum(pred & y_true))
    fp = int(np.sum(pred & ~y_true))
    fn = int(np.sum(~pred & y_true))
    tn = int(np.sum(~pred & ~y_true))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    return {
        "threshold": round(float(t), 3),
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "accuracy": round((tp + tn) / len(y_true), 4),
    }


def plot_matrix(m: dict, path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    grid = np.array([[m["tn"], m["fp"]], [m["fn"], m["tp"]]])
    fig, ax = plt.subplots(figsize=(4, 4))
    ax.imshow(grid, cmap="Blues")
    ax.set_xticks([0, 1], ["negativ", "positiv"])
    ax.set_yticks([0, 1], ["negativ", "positiv"])
    ax.set_xlabel("Vorhersage")
    ax.set_ylabel("Wahrheit")
    for i in range(2):
        for j in range(2):
            ax.text(j, i, str(grid[i, j]), ha="center", va="center")
    ax.set_title(f"Schwelle {m['threshold']}")
    fig.tight_layout()
    fig.savefig(path, dpi=120)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--target-recall", type=float, default=0.95)
    args = parser.parse_args()

    images: list[Path] = []
    labels: list[bool] = []
    for cls in CLASSES:
        found = list_images(DATASET / "val" / cls)
        images += found
        labels += [cls == "positiv"] * len(found)
    if not images:
        print("Kein Val-Satz unter", DATASET / "val")
        return 1
    y_true = np.array(labels)

    scores = scores_tflite(args.model, images) if args.model.suffix == ".tflite" else scores_keras(args.model, images)

    sweep = [confusion(y_true, scores, t) for t in np.arange(0.05, 0.96, 0.05)]
    ok = [m for m in sweep if m["recall"] >= args.target_recall]
    best = max(ok, key=lambda m: m["threshold"]) if ok else max(sweep, key=lambda m: m["recall"])
    at_half = confusion(y_true, scores, 0.5)

    print(f"Val-Bilder: {len(images)} (positiv {int(y_true.sum())}, negativ {int((~y_true).sum())})")
    print("Bei Schwelle 0.5:", at_half)
    print(f"Vorschlag (Recall >= {args.target_recall}):", best)

    out_dir = args.model.parent
    metrics = {"model": str(args.model), "val_images": len(images), "at_0_5": at_half,
               "recommended": best, "sweep": sweep}
    (out_dir / "metrics.json").write_text(json.dumps(metrics, indent=2))
    plot_matrix(best, out_dir / "confusion_matrix.png")
    print("Gespeichert:", out_dir / "metrics.json", "und confusion_matrix.png")

    # Fehlklassifizierte Beispiele zum Anschauen
    wrong = [(str(p), round(float(s), 3)) for p, s, t in zip(images, scores, y_true) if (s >= best["threshold"]) != t]
    if wrong:
        print(f"{len(wrong)} Fehler bei der vorgeschlagenen Schwelle, z. B.:")
        for p, s in wrong[:10]:
            print("  ", s, p)
    return 0


if __name__ == "__main__":
    sys.exit(main())
