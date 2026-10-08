"""Fotos aus Open Images holen: Negativbeispiele und weitere Muell-Fotos.

    python fetch_openimages.py [--no-positives] [--scale 1.0]

Open Images (Google, storage.googleapis.com/openimages) enthaelt rund neun
Millionen Fotos, die laut Datensatz unter CC BY 2.0 stehen, also auch
gewerblich nutzbar sind (Namensnennung noetig, siehe README). Jedes Foto
traegt von Menschen bestaetigte Schlagworte. Daraus waehlt das Skript:

  negativ/   alles, was KEINE Meldung sein soll: Muelltonnen und Container,
             Boden, Laub, Wege, Wald, Wasser, Strassen, Menschen, Tiere,
             Essen, Innenraeume, Screenshots (Mengen in NEGATIVE unten)
  positiv/   Fotos mit den Schlagworten Litter, Waste oder Bin bag, sofern
             kein Muellbehaelter mit auf dem Bild ist

Die Fotos landen verkleinert (lange Kante 640 px) in data/manual/..., die
Quellen in data/manual/openimages-quellen.csv. Vorhandene Dateien werden
uebersprungen. Die Auswahl ist fest (kein Zufall): gleicher Aufruf, gleiche
Fotos.

WICHTIG: Die Schlagworte sind grob. Vor dem Training BEIDE Ordner
durchsehen und verschieben oder loeschen, was nicht passt. Fuer die
Muell-Fotos liest das Skript einmalig zwei grosse Listen (2,7 und 2,1 GB) als
Strom. Gespeichert werden nur die passenden Zeilen, es dauert aber einige
Minuten; --no-positives laesst das aus.
"""

from __future__ import annotations

import argparse
import csv
import io
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageOps

from common import DATA, MANUAL_DATA, already_sorted, current_place, stable_fraction

BASE = "https://storage.googleapis.com/openimages"
IMAGES = "https://s3.amazonaws.com/open-images-dataset"
CACHE = DATA / "cache" / "openimages"
SOURCES = MANUAL_DATA / "openimages-quellen.csv"
MAX_SIDE = 640
TIMEOUT_S = 60

# Schlagwort -> hoechstens so viele Negativfotos (mal --scale).
NEGATIVE = {
    # legale Muellbehaelter: der schwierigste Fall, deshalb alle
    "Waste container": 400, "Recycling bin": 50, "Dumpster": 50,
    # Boden und Natur aus der Naehe (sieht TACO-Fotos ohne Muell aehnlich)
    # (reichlich: hier lagen die meisten Fehlalarme des ersten Modells)
    "Soil": 250, "Mud": 150, "Leaf": 200, "Rock": 200, "Sand": 200, "Grass": 44,
    "Road surface": 200, "Sidewalk": 81, "Gravel": 33,
    # Orte, an denen in der App gemeldet wird: Strassen, Wege, Wald, Ufer
    "Road": 400, "Tree": 300, "Forest": 30, "River": 150, "Beach": 60, "Field": 200,
    "Pond": 80, "Snow": 30, "Parking lot": 38, "Fence": 120, "Bench": 120, "Playground": 40,
    # Alltag, der gar nichts mit Muell zu tun hat (wenig: zu leicht zu unterscheiden)
    "Person": 60, "Dog": 40, "Cat": 30, "Food": 50, "Car": 50, "Room": 50, "Kitchen": 40,
    "Couch": 30, "Screenshot": 80, "Text": 40, "Flowerpot": 30, "Bicycle": 30,
}
# Zusaetzlich Muellbehaelter aus dem grossen Trainingsteil von Open Images
# (dort gibt es tausende; in val/test nur rund 260).
MAX_TRAIN_CONTAINERS = 600
CONTAINER_NEGATIVES = ("Waste container", "Recycling bin", "Dumpster")
# "Pollution" fehlt bewusst: darunter liegen vor allem Rauch, Dampfloks und Feuerwerk.
POSITIVE = ("Litter", "Waste", "Bin bag")
MAX_POSITIVE = 1500
# Mit einem dieser Schlagworte ist ein Foto kein sauberes Negativbeispiel ...
TRASH = set(POSITIVE) | {"Pollution", "Junk", "Rubble", "Scrap", "Plastic bag", "Cardboard", "Mattress"}
# ... und mit einem dieser kein sauberes Positivbeispiel.
CONTAINERS = {"Waste container", "Recycling bin", "Dumpster", "Waste containment", "Garbage truck", "Compost"}


def open_url(url: str):
    request = urllib.request.Request(url, headers={"User-Agent": "clar-training/1.0"})
    return urllib.request.urlopen(request, timeout=TIMEOUT_S)


def cached(name: str, path: str) -> Path:
    target = CACHE / name
    if not target.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print("Lade", name, "...")
        partial = target.with_suffix(".part")
        with open_url(f"{BASE}/{path}") as response, partial.open("wb") as out:
            while chunk := response.read(1 << 20):
                out.write(chunk)
        partial.replace(target)
    return target


def class_names() -> dict[str, str]:
    with cached("classes.csv", "v7/oidv7-class-descriptions.csv").open(encoding="utf-8") as f:
        return {row[0]: row[1] for row in csv.reader(f)}


def confirmed_labels(split: str, names: dict[str, str]) -> dict[str, set[str]]:
    """Bild-ID -> Schlagworte, die ein Mensch bestaetigt hat (val und test)."""
    labels: dict[str, set[str]] = {}
    path = cached(f"{split}-labels.csv", f"v7/oidv7-{split}-annotations-human-imagelabels.csv")
    with path.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if float(row["Confidence"]) == 1:  # steht mal als "1", mal als "1.0" da
                labels.setdefault(row["ImageID"], set()).add(names.get(row["LabelName"], ""))
    return labels


def pick_negatives(scale: float, names: dict[str, str]) -> list[tuple[str, str, str]]:
    labels: dict[tuple[str, str], set[str]] = {}
    for split, folder in (("val", "validation"), ("test", "test")):
        for image_id, found in confirmed_labels(split, names).items():
            if not found & TRASH:
                labels[(folder, image_id)] = found

    chosen: dict[tuple[str, str], str] = {}
    for label, quota in NEGATIVE.items():
        candidates = sorted((k for k, found in labels.items() if label in found and k not in chosen),
                            key=lambda k: stable_fraction(k[1]))
        for key in candidates[: round(quota * scale)]:
            chosen[key] = label
    return [(folder, image_id, label) for (folder, image_id), label in chosen.items()]


def train_labels(names: dict[str, str]) -> dict[str, set[str]]:
    """Bild-ID -> Muell- und Behaelter-Schlagworte aus dem Trainingsteil.

    Liest die grosse Trainingsliste einmal als Strom und behaelt nur diese Zeilen.
    """
    wanted = {mid: name for mid, name in names.items() if name in set(POSITIVE) | CONTAINERS}
    result = CACHE / "train-muell-labels.csv"
    if not result.exists():
        print("Lese die Trainingsliste von Open Images (2,7 GB als Strom, einige Minuten) ...")
        partial = result.with_suffix(".part")
        with open_url(f"{BASE}/v7/oidv7-train-annotations-human-imagelabels.csv") as response, \
                partial.open("w", encoding="utf-8", newline="") as out:
            for raw in response:
                image_id, _source, mid, confidence = raw.decode("utf-8").rstrip().split(",")
                if mid in wanted and float(confidence) == 1:
                    out.write(f"{image_id},{wanted[mid]}\n")
        partial.replace(result)

    labels: dict[str, set[str]] = {}
    with result.open(encoding="utf-8") as f:
        for image_id, label in csv.reader(f):
            labels.setdefault(image_id, set()).add(label)
    return labels


def pick_positives(labels: dict[str, set[str]]) -> list[tuple[str, str, str]]:
    keep = sorted((i for i, found in labels.items() if found & set(POSITIVE) and not found & CONTAINERS),
                  key=stable_fraction)[:MAX_POSITIVE]
    return [("train", i, sorted(labels[i] & set(POSITIVE))[0]) for i in keep]


def pick_train_containers(labels: dict[str, set[str]]) -> list[tuple[str, str, str]]:
    """Behaelter-Fotos ohne Muell-Schlagwort: harte Negativbeispiele."""
    keep = sorted((i for i, found in labels.items() if found & set(CONTAINER_NEGATIVES) and not found & TRASH),
                  key=stable_fraction)[:MAX_TRAIN_CONTAINERS]
    return [("train", i, sorted(labels[i] & set(CONTAINER_NEGATIVES))[0]) for i in keep]


def flickr_sources(image_ids: set[str]) -> dict[str, tuple[str, float]]:
    """Bild-ID -> (Adresse beim Fotodienst, Drehung). Nur fuer Trainingsfotos noetig:
    Der Spiegel von Open Images haelt davon nur einen Teil vor."""
    result = CACHE / "train-muell-quellen.csv"
    if not result.exists():
        print("Lese die Fotoliste von Open Images (2,1 GB als Strom, einige Minuten) ...")
        partial = result.with_suffix(".part")
        with open_url(f"{BASE}/2018_04/train/train-images-with-labels-with-rotation.csv") as response,                 partial.open("w", encoding="utf-8", newline="") as out:
            writer = csv.writer(out)
            for row in csv.DictReader(io.TextIOWrapper(response, encoding="utf-8", newline="")):
                if row["ImageID"] in image_ids:
                    writer.writerow([row["ImageID"], row["Thumbnail300KURL"] or row["OriginalURL"], row["Rotation"] or 0])
        partial.replace(result)
    with result.open(encoding="utf-8") as f:
        return {image_id: (url, float(rotation)) for image_id, url, rotation in csv.reader(f)}


def download(job: tuple[str, str, str, Path, tuple[str, float] | None]) -> str:
    folder, image_id, _label, target, fallback = job
    if already_sorted(target.name):
        return "vorhanden"
    try:
        rotation = 0.0
        try:
            with open_url(f"{IMAGES}/{folder}/{image_id}.jpg") as response:
                data = response.read()
        except urllib.error.HTTPError:
            if not fallback:
                raise
            with open_url(fallback[0]) as response:
                data = response.read()
            rotation = fallback[1]
        img = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
        if rotation:
            img = img.rotate(rotation, expand=True)  # Grad gegen den Uhrzeigersinn
        img.thumbnail((MAX_SIDE, MAX_SIDE), Image.BILINEAR)
        partial = target.with_suffix(".part")
        img.save(partial, "JPEG", quality=90)
        partial.replace(target)
        return "neu"
    except Exception as error:  # einzelne Ausfaelle sollen den Lauf nicht stoppen
        return f"Fehler ({type(error).__name__})"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-positives", action="store_true",
                        help="nur Negativbeispiele aus val/test holen (ohne die grossen Listen)")
    parser.add_argument("--scale", type=float, default=1.0, help="Mengen der Negativbeispiele skalieren")
    args = parser.parse_args()

    names = class_names()
    jobs: list[tuple[str, str, str, Path, tuple[str, float] | None]] = []
    for folder, image_id, label in pick_negatives(args.scale, names):
        slug = label.lower().replace(" ", "-")
        jobs.append((folder, image_id, label, MANUAL_DATA / "negativ" / f"oi-{slug}-{image_id}.jpg", None))
    if not args.no_positives:
        labels = train_labels(names)
        containers = pick_train_containers(labels)
        positives = pick_positives(labels)
        sources = flickr_sources({image_id for _, image_id, _ in containers + positives})
        for folder, image_id, label in containers:
            slug = label.lower().replace(" ", "-")
            target = MANUAL_DATA / "negativ" / f"oi-{slug}-{image_id}.jpg"
            jobs.append((folder, image_id, label, target, sources.get(image_id)))
    negatives = len(jobs)
    if not args.no_positives:
        for folder, image_id, label in positives:
            target = MANUAL_DATA / "positiv" / f"oi-{image_id}.jpg"
            jobs.append((folder, image_id, label, target, sources.get(image_id)))

    for cls in ("negativ", "positiv"):
        (MANUAL_DATA / cls).mkdir(parents=True, exist_ok=True)
    print(f"Lade {negatives} Negativ- und {len(jobs) - negatives} Positivfotos ...")
    with ThreadPoolExecutor(max_workers=12) as pool:
        results = list(pool.map(download, jobs))
    for outcome in sorted(set(results)):
        print(f"  {outcome}: {results.count(outcome)}")

    # Quellenliste fuer die Namensnennung (CC BY 2.0): Bildseite = ID bei Open Images.
    with SOURCES.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["datei", "open_images_id", "teilmenge", "schlagwort", "lizenz"])
        for (folder, image_id, label, target, _), outcome in zip(jobs, results):
            place = current_place(target.name)  # None = aussortiert, braucht keine Namensnennung
            if place:
                writer.writerow([place, image_id, folder, label, "CC BY 2.0"])
    print("Quellen:", SOURCES)
    print("Jetzt beide Ordner durchsehen: die Schlagworte sind grob.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
