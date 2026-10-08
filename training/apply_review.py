"""Entscheidungen aus der Durchsicht uebernehmen.

    python apply_review.py [--dry-run]

Liest alle data/review/entscheidungen/*.csv (Spalten: bogen, kachel,
entscheidung, grund) und wendet sie ueber data/review/index.csv an:

  behalten      Foto bleibt, wo es ist
  raus          Foto wandert nach data/aussortiert/<klasse>/ (nichts wird
                geloescht; zurueckholen = zurueckschieben)
  umsortieren   Foto wandert in die andere Klasse

Kacheln ohne Entscheidung bleiben ungeprueft und kommen beim naechsten
review_sheets.py wieder. Jede uebernommene Entscheidung landet in
data/review/geprueft.csv. Danach die Entscheidungsdateien ins Archiv.
"""

from __future__ import annotations

import argparse
import csv
import sys
import time
from collections import Counter

from common import CLASSES, MANUAL_DATA, REJECTED, REVIEW

DECISIONS = REVIEW / "entscheidungen"
INDEX = REVIEW / "index.csv"
DONE = REVIEW / "geprueft.csv"
VALID = {"behalten", "raus", "umsortieren"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="nur zaehlen, nichts verschieben")
    args = parser.parse_args()

    with INDEX.open(encoding="utf-8") as f:
        index = {(row["bogen"], row["kachel"]): row["datei"] for row in csv.DictReader(f)}

    decided: dict[str, tuple[str, str]] = {}
    problems = Counter()
    sources = sorted(DECISIONS.glob("*.csv")) if DECISIONS.exists() else []
    for source in sources:
        with source.open(encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                key = ((row.get("bogen") or "").strip(), (row.get("kachel") or "").strip())
                decision = (row.get("entscheidung") or "").strip().lower()
                if key not in index:
                    problems["unbekannte Kachel"] += 1
                elif decision not in VALID:
                    problems["unbekannte Entscheidung"] += 1
                else:
                    decided[index[key]] = (decision, (row.get("grund") or "").strip())

    counts = Counter()
    new_file = not DONE.exists()
    log = None if args.dry_run else DONE.open("a", encoding="utf-8", newline="")
    writer = csv.writer(log) if log else None
    if writer and new_file:
        writer.writerow(["datei", "entscheidung", "grund", "zeit"])
    stamp = time.strftime("%Y-%m-%d %H:%M")

    for file, (decision, reason) in decided.items():
        cls, name = file.split("/", 1)
        source = MANUAL_DATA / cls / name
        if not source.exists():
            problems["Datei fehlt"] += 1
            continue
        counts[f"{cls}: {decision}"] += 1
        if args.dry_run:
            continue
        logged = file
        if decision == "raus":
            target = REJECTED / cls / name
            target.parent.mkdir(parents=True, exist_ok=True)
            source.replace(target)
        elif decision == "umsortieren":
            other = CLASSES[1 - CLASSES.index(cls)]
            source.replace(MANUAL_DATA / other / name)
            logged = f"{other}/{name}"  # am neuen Ort gilt es als geprueft
        writer.writerow([logged, decision, reason, stamp])
    if log:
        log.close()

    print(f"{len(sources)} Entscheidungsdateien, {len(decided)} Fotos entschieden, "
          f"{len(index) - len(decided)} ohne Entscheidung")
    for key in sorted(counts):
        print(f"  {key}: {counts[key]}")
    for key, n in problems.items():
        print(f"  Achtung, {key}: {n}")

    if not args.dry_run and sources:
        archive = DECISIONS / "archiv" / time.strftime("%Y%m%d-%H%M%S")
        archive.mkdir(parents=True)
        for source in sources:
            source.replace(archive / source.name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
