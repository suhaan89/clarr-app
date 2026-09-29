"""Transfer Learning mit YOLO11n-cls.

    python train.py [--epochs 50] [--name muell-v1]

Startet von vortrainierten Gewichten (yolo11n-cls.pt, auf ImageNet
trainiert) und lernt nur noch "Muell ja/nein". Ergebnis:
runs/<name>/weights/best.pt (die Epoche mit der besten Val-Genauigkeit).
"""

from __future__ import annotations

import argparse
import sys

from ultralytics import YOLO

from common import DATASET, IMG_SIZE, RUNS


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--name", default="muell")
    parser.add_argument("--device", default=None, help="z. B. 0 fuer die erste GPU, cpu fuer Prozessor")
    args = parser.parse_args()

    if not (DATASET / "train").exists():
        print("Kein Datensatz. Erst `python prepare_dataset.py` ausfuehren.")
        return 1

    model = YOLO("yolo11n-cls.pt")
    model.train(
        data=str(DATASET),
        imgsz=IMG_SIZE,
        epochs=args.epochs,
        batch=args.batch,
        patience=10,          # stoppt frueh, wenn Val 10 Epochen nicht besser wird
        project=str(RUNS),
        name=args.name,
        exist_ok=False,
        device=args.device,
        # Datenaugmentierung: leichte Variationen, die auch echte Handyfotos haben.
        fliplr=0.5,
        hsv_v=0.3,
        erasing=0.2,
        plots=True,
    )
    print("Fertig. Beste Gewichte:", model.trainer.best)
    print("Weiter mit: python evaluate.py --model", model.trainer.best)
    return 0


if __name__ == "__main__":
    sys.exit(main())
