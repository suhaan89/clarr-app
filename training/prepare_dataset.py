"""Train/Val-Split bauen: data/dataset/{train,val}/{negativ,positiv}/

    python prepare_dataset.py [--val-fraction 0.2] [--no-app]

Quellen:
  * data/manual/{positiv,negativ}/   von dir eingelegte Fotos
  * data/app/{train,val}/{...}/      aus Supabase (sync_dataset.py)

App-Fotos behalten den Split aus der Datenbank (pro Fall fest). Manuelle
Fotos werden pro Gruppe (Dateiname vor "__") deterministisch verteilt. Der
Ordner data/dataset wird jedes Mal komplett neu gebaut, damit dort nichts
liegen bleibt, was inzwischen geloescht werden musste.
"""

from __future__ import annotations

import argparse
import shutil
import sys
import time

from common import APP_DATA, CLASSES, DATASET, MANUAL_DATA, group_key, list_images, stable_fraction

MAX_SYNC_AGE_S = 24 * 60 * 60


def link_or_copy(src, dst) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    try:
        dst.hardlink_to(src)  # spart Platz, faellt auf Kopie zurueck
    except OSError:
        shutil.copy2(src, dst)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--val-fraction", type=float, default=0.2)
    parser.add_argument("--no-app", action="store_true", help="nur manuelle Fotos verwenden")
    args = parser.parse_args()

    use_app = not args.no_app and APP_DATA.exists()
    if use_app:
        stamp = APP_DATA / ".last_sync"
        age = time.time() - int(stamp.read_text()) if stamp.exists() else None
        if age is None or age > MAX_SYNC_AGE_S:
            print("Der letzte Abgleich mit Supabase ist aelter als 24 h oder fehlt.")
            print("Erst `python sync_dataset.py` ausfuehren (Loeschabgleich!) oder --no-app nutzen.")
            return 1

    if DATASET.exists():
        shutil.rmtree(DATASET)

    counts = {(s, c): 0 for s in ("train", "val") for c in CLASSES}

    for cls in CLASSES:
        for img in list_images(MANUAL_DATA / cls):
            split = "val" if stable_fraction(group_key(img)) < args.val_fraction else "train"
            link_or_copy(img, DATASET / split / cls / f"manual-{img.name}")
            counts[(split, cls)] += 1

    if use_app:
        for split in ("train", "val"):
            for cls in CLASSES:
                for img in list_images(APP_DATA / split / cls):
                    link_or_copy(img, DATASET / split / cls / f"app-{img.name}")
                    counts[(split, cls)] += 1

    print("Datensatz in", DATASET)
    for (split, cls), n in counts.items():
        print(f"  {split}/{cls}: {n}")

    problems = [k for k, n in counts.items() if n == 0]
    if problems:
        print("Achtung: leere Ordner", problems, "- ohne Beispiele beider Klassen in train UND val geht es nicht.")
        return 1
    ratio = counts[("train", "positiv")] / max(1, counts[("train", "negativ")])
    if ratio > 3 or ratio < 1 / 3:
        print(f"Hinweis: unausgewogen (positiv/negativ = {ratio:.1f}). Mehr Beispiele der kleineren Klasse sammeln.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
