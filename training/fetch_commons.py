"""Muell-Fotos aus Wikimedia Commons holen (nur Positivbeispiele).

    python fetch_commons.py [--limit 1500] [--with-share-alike]

Commons hat Kategorien wie "Illegal dumping" und "Littering" mit Fotos echter
wilder Ablagerungen, viele davon aus Europa. Das Skript geht diese Kategorien
samt Unterkategorien durch (drei Ebenen tief) und laedt die Fotos verkleinert
(lange Kante 640 px) nach data/manual/positiv/wc-<seiten-id>.jpg. Die Quellen
mit Urheber und Lizenz stehen in data/manual/commons-quellen.csv.

Lizenzen: Geladen werden nur Fotos, die gemeinfrei sind oder unter CC0 oder
CC BY stehen. CC BY-SA (der groesste Teil von Commons) bleibt ohne
--with-share-alike draussen: gewerbliche Nutzung ist dort zwar erlaubt, ob ein
damit trainiertes Modell unter die Weitergabe-Pflicht faellt, ist aber offen.

WICHTIG: Kategorien sind grob. Vor dem Training durchsehen (Schilder,
Plakate, Aufraeumaktionen mit Menschen, Deponien gehoeren nicht hinein).
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request

from PIL import Image, ImageOps

from common import MANUAL_DATA, already_sorted, current_place

API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "CLAR-Training/1.0 (https://clar-now.com; lokales Modelltraining)"
ROOTS = ("Illegal dumping", "Littering", "Litter")
MAX_DEPTH = 3
# Unterkategorien mit diesen Woertern zeigen meist keinen herumliegenden Muell.
SKIP_CATEGORY = re.compile(
    r"sign|bin\b|bins\b|container|campaign|poster|logo|clean|art\b|map|diagram|video|"
    r"people|collect|truck|stamp|symbol|cartoon|pictogram|law|museum|histor|landfill|"
    # Beifang der ersten Durchsicht (Maskottchen, Serien ohne Ablagerung)
    r"woodsy|smokey|mascot|halloween|toilet paper|mask|wreck|vehicle|car|cars|"
    r"sea glass|albatross|balloon|bird|documerica|cartridge",
    re.IGNORECASE,
)
SOURCES = MANUAL_DATA / "commons-quellen.csv"
MAX_SIDE = 640
PAUSE_S = 1.0  # Commons bittet um Zurueckhaltung; schneller gibt es Sperren
TIMEOUT_S = 60


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
                return response.read()
        except Exception:
            if attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))
    raise RuntimeError("unerreichbar")


def api(**params) -> dict:
    time.sleep(PAUSE_S)
    query = urllib.parse.urlencode({"action": "query", "format": "json", **params})
    return json.loads(fetch(f"{API}?{query}"))


def members(category: str, kind: str) -> list[dict]:
    """Alle Dateien oder Unterkategorien einer Kategorie (folgt 'continue')."""
    found: list[dict] = []
    extra: dict = {}
    while True:
        params = dict(generator="categorymembers", gcmtitle=f"Category:{category}", gcmtype=kind,
                      gcmlimit=200, **extra)
        if kind == "file":
            params.update(prop="imageinfo", iiprop="url|extmetadata|mime", iiurlwidth=MAX_SIDE)
        data = api(**params)
        found += list(data.get("query", {}).get("pages", {}).values())
        if "continue" not in data:
            return found
        extra = data["continue"]


def allowed(license_name: str, share_alike: bool) -> bool:
    name = license_name.lower().replace("-", " ")
    if "nc" in name.split() or "nd" in name.split():
        return False
    if name.startswith(("cc0", "public domain", "pd")):
        return True
    if name.startswith("cc by sa"):
        return share_alike
    return name.startswith("cc by")


def strip_html(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", text)).strip()[:200]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=1500)
    parser.add_argument("--with-share-alike", action="store_true", help="auch CC BY-SA laden")
    args = parser.parse_args()

    # 1. Kategorien einsammeln (Breitensuche)
    seen: set[str] = set()
    level = [c for c in ROOTS]
    categories: list[str] = []
    for depth in range(MAX_DEPTH + 1):
        next_level: list[str] = []
        for category in level:
            if category in seen:
                continue
            seen.add(category)
            categories.append(category)
            if depth < MAX_DEPTH:
                for sub in members(category, "subcat"):
                    name = sub["title"].removeprefix("Category:")
                    if not SKIP_CATEGORY.search(name):
                        next_level.append(name)
        level = next_level
    print(f"{len(categories)} Kategorien")

    # 2. Dateien mit passender Lizenz
    files: dict[int, dict] = {}
    skipped = 0
    for category in categories:
        for page in members(category, "file"):
            info = (page.get("imageinfo") or [{}])[0]
            meta = info.get("extmetadata", {})
            license_name = meta.get("LicenseShortName", {}).get("value", "")
            if info.get("mime") not in ("image/jpeg", "image/png") or not info.get("thumburl"):
                continue
            if not allowed(license_name, args.with_share_alike):
                skipped += 1
                continue
            files.setdefault(page["pageid"], {
                "url": info["thumburl"],
                "page": info.get("descriptionurl", ""),
                "license": license_name,
                "author": strip_html(meta.get("Artist", {}).get("value", "")),
                "category": category,
            })
        if len(files) >= args.limit:
            break
    chosen = list(files.items())[: args.limit]
    print(f"{len(chosen)} Fotos mit passender Lizenz ({skipped} wegen Lizenz ausgelassen)")

    # 3. Laden (nacheinander, mit Pause)
    target_dir = MANUAL_DATA / "positiv"
    target_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    counts = {"neu": 0, "vorhanden": 0, "Fehler": 0}
    for page_id, item in chosen:
        target = target_dir / f"wc-{page_id}.jpg"
        if already_sorted(target.name):
            counts["vorhanden"] += 1
        else:
            try:
                time.sleep(PAUSE_S / 2)
                img = ImageOps.exif_transpose(Image.open(io.BytesIO(fetch(item["url"])))).convert("RGB")
                img.thumbnail((MAX_SIDE, MAX_SIDE), Image.BILINEAR)
                partial = target.with_suffix(".part")
                img.save(partial, "JPEG", quality=90)
                partial.replace(target)
                counts["neu"] += 1
            except Exception:
                counts["Fehler"] += 1
                continue
        place = current_place(target.name)  # None = aussortiert, braucht keine Namensnennung
        if place:
            rows.append([place, item["page"], item["author"], item["license"], item["category"]])

    with SOURCES.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["datei", "seite", "urheber", "lizenz", "kategorie"])
        writer.writerows(rows)
    print(counts)
    print("Quellen:", SOURCES)
    return 0


if __name__ == "__main__":
    sys.exit(main())
