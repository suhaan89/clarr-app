"""Startmaterial aus dem offenen Datensatz TACO holen (nur Positivbeispiele).

    python fetch_taco.py [--limit 500] [--all-licenses]

TACO (Trash Annotations in Context, tacodataset.org) enthaelt 1500 Fotos von
Muell in der Umgebung. Das Skript laedt sie verkleinert (lange Kante 640 px)
nach data/manual/positiv/taco-<id>.jpg. Schon vorhandene Dateien werden
uebersprungen, ein Abbruch laesst sich also einfach fortsetzen.

Ausgelassen werden:
  * Fotos, die nur drinnen aufgenommen sind (Muell auf dem Tisch ist keine
    illegale Ablagerung),
  * ohne --all-licenses alle Fotos mit fremdem Lizenzvermerk (OpenLitterMap
    unter ODbL, "CC" ohne genaue Angabe). Uebrig bleiben die Fotos, die TACO
    selbst unter CC BY 4.0 stellt.

WICHTIG:
  * TACO zeigt oft EINZELNE Teile (Flasche, Dose) statt Haufen. Vor dem
    Training durchsehen und loeschen, was fuer CLAR keine Meldung waere.
  * TACO liefert KEINE Negativbeispiele. data/manual/negativ musst du selbst
    fuellen (siehe README).
  * CC BY 4.0 verlangt Namensnennung, siehe README Abschnitt "Lizenzen".
"""

from __future__ import annotations

import argparse
import io
import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageOps

from common import MANUAL_DATA

ANNOTATIONS_URL = "https://raw.githubusercontent.com/pedropro/TACO/master/data/annotations.json"
INDOOR = 1  # scene_categories: "Indoor, Man-made"
MAX_SIDE = 640
TIMEOUT_S = 60


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "clar-training/1.0"})
    with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
        return response.read()


def download(image: dict) -> str:
    target = MANUAL_DATA / "positiv" / f"taco-{image['id']:04d}.jpg"
    if target.exists():
        return "vorhanden"
    try:
        data = fetch(image.get("flickr_640_url") or image["flickr_url"])
        img = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
        img.thumbnail((MAX_SIDE, MAX_SIDE), Image.BILINEAR)
        # Erst fertig schreiben, dann umbenennen: kein halbes Bild nach Abbruch.
        partial = target.with_suffix(".part")
        img.save(partial, "JPEG", quality=90)
        partial.replace(target)
        return "neu"
    except Exception as error:  # einzelne tote Links sollen den Lauf nicht stoppen
        return f"Fehler ({type(error).__name__})"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="hoechstens so viele Fotos")
    parser.add_argument("--all-licenses", action="store_true",
                        help="auch Fotos mit ODbL- oder ungenauem CC-Vermerk laden")
    args = parser.parse_args()

    data = json.loads(fetch(ANNOTATIONS_URL))
    scenes: dict[int, set[int]] = {}
    for scene in data["scene_annotations"]:
        scenes.setdefault(scene["image_id"], set()).update(scene["background_ids"])

    images = []
    for image in data["images"]:
        if scenes.get(image["id"]) == {INDOOR}:
            continue
        if image.get("license") and not args.all_licenses:
            continue
        images.append(image)
    if args.limit:
        images = images[: args.limit]

    (MANUAL_DATA / "positiv").mkdir(parents=True, exist_ok=True)
    print(f"Lade {len(images)} von {len(data['images'])} TACO-Fotos ...")
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(download, images))

    for outcome in sorted(set(results)):
        print(f"  {outcome}: {results.count(outcome)}")
    print("Jetzt durchsehen und unpassende Fotos loeschen. Negativbeispiele fehlen noch.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
