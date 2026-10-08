"""Kontaktboegen fuer die Durchsicht der Trainingsfotos bauen.

    python review_sheets.py [--all]

Legt unter data/review/boegen/ nummerierte Boegen an (positiv-001.jpg ...,
negativ-001.jpg ...). Jede Kachel zeigt das Foto so, wie das Modell es sieht:
mittig quadratisch zugeschnitten. Die Zuordnung Bogen + Kachel -> Datei steht
in data/review/index.csv.

Ohne --all kommen nur Fotos auf die Boegen, die noch nie durchgesehen wurden
(data/review/geprueft.csv, gefuehrt von apply_review.py). So prueft man nach
jedem Download nur das Neue.

Der Pruefauftrag steht in PRUEFAUFTRAG.md, uebernommen werden die
Entscheidungen mit apply_review.py.
"""

from __future__ import annotations

import argparse
import csv
import shutil
import sys

from PIL import Image, ImageDraw, ImageFont, ImageOps

from common import CLASSES, MANUAL_DATA, REVIEW, list_images

# Muell-Fotos groesser zeigen: dort kommt es auf kleine Dinge an.
LAYOUT = {"positiv": (4, 3, 320), "negativ": (5, 4, 256)}  # Spalten, Zeilen, Kantenlaenge
SHEETS = REVIEW / "boegen"
INDEX = REVIEW / "index.csv"
DONE = REVIEW / "geprueft.csv"


def reviewed() -> set[str]:
    if not DONE.exists():
        return set()
    with DONE.open(encoding="utf-8") as f:
        return {row["datei"] for row in csv.DictReader(f)}


def build_sheet(files, cols: int, rows: int, side: int) -> Image.Image:
    sheet = Image.new("RGB", (cols * side, rows * side), "white")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arialbd.ttf", 22)
    except OSError:
        font = ImageFont.load_default()
    for i, path in enumerate(files):
        x, y = (i % cols) * side, (i // cols) * side
        tile = ImageOps.fit(ImageOps.exif_transpose(Image.open(path)).convert("RGB"), (side - 4, side - 4))
        sheet.paste(tile, (x + 2, y + 2))
        draw.rectangle([x + 2, y + 2, x + 44, y + 30], fill="black")
        draw.text((x + 8, y + 3), str(i + 1), fill="white", font=font)
    return sheet


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true", help="auch schon gepruefte Fotos erneut zeigen")
    args = parser.parse_args()

    skip = set() if args.all else reviewed()
    if SHEETS.exists():
        shutil.rmtree(SHEETS)
    SHEETS.mkdir(parents=True)

    with INDEX.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["bogen", "kachel", "datei"])
        for cls in CLASSES:
            cols, rows, side = LAYOUT[cls]
            per_sheet = cols * rows
            files = [p for p in list_images(MANUAL_DATA / cls) if f"{cls}/{p.name}" not in skip]
            for n, start in enumerate(range(0, len(files), per_sheet), start=1):
                name = f"{cls}-{n:03d}"
                chunk = files[start : start + per_sheet]
                build_sheet(chunk, cols, rows, side).save(SHEETS / f"{name}.jpg", quality=88)
                for cell, path in enumerate(chunk, start=1):
                    writer.writerow([name, cell, f"{cls}/{path.name}"])
            print(f"{cls}: {len(files)} Fotos auf {-(-len(files) // per_sheet)} Boegen")
    print("Boegen:", SHEETS)
    return 0


if __name__ == "__main__":
    sys.exit(main())
