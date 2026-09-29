"""Trainingsfotos aus Supabase holen und lokal abgleichen.

    python sync_dataset.py

Liest die View `vision_training_export` (Migration 023) mit dem Service-Role-
Key aus training/.env und laedt die VERPIXELTEN, freigegebenen Kopien nach
data/app/<split>/<label>/<sample_id>.jpg.

Loeschabgleich (wichtig fuer die DSGVO): Jede lokale Datei, deren sample_id
nicht mehr in der View steht (Widerruf der Einwilligung, geloeschte Meldung
oder Konto, abgelaufene Frist, geaendertes Label), wird GELOESCHT. Deshalb
vor jedem Training ausfuehren. prepare_dataset.py weigert sich, wenn der
letzte Abgleich aelter als 24 Stunden ist.

Die Fotos bleiben auf deinem Rechner. Nicht in Colab, Google Drive, Dropbox
o. Ae. hochladen: das waere eine Uebermittlung an Dritte, die die
Einwilligung nicht abdeckt.
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

from common import APP_DATA, CLASSES, ROOT

PAGE = 500
STAMP = APP_DATA / ".last_sync"


def fetch_rows(client) -> list[dict]:
    rows: list[dict] = []
    start = 0
    while True:
        res = (
            client.table("vision_training_export")
            .select("sample_id, label, split, blurred_path")
            .order("sample_id")
            .range(start, start + PAGE - 1)
            .execute()
        )
        batch = res.data or []
        rows.extend(batch)
        if len(batch) < PAGE:
            return rows
        start += PAGE


def target_path(row: dict) -> Path | None:
    if row["label"] not in CLASSES or row["split"] not in ("train", "val"):
        return None
    return APP_DATA / row["split"] / row["label"] / f"{row['sample_id']}.jpg"


def main() -> int:
    load_dotenv(ROOT / ".env")
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in training/.env setzen (Vorlage: .env.example).")
        return 1

    client = create_client(url, key)
    rows = fetch_rows(client)
    wanted = {p: r for r in rows if (p := target_path(r)) is not None}

    # 1. Loeschabgleich ZUERST: was nicht mehr erlaubt ist, verschwindet.
    removed = 0
    if APP_DATA.exists():
        for f in APP_DATA.rglob("*.jpg"):
            if f not in wanted:
                f.unlink()
                removed += 1

    # 2. Fehlende Fotos laden
    added = failed = 0
    bucket = client.storage.from_("public-blurred")
    for path, row in wanted.items():
        if path.exists():
            continue
        try:
            data = bucket.download(row["blurred_path"])
        except Exception as e:  # noqa: BLE001 - einzelne Fehler sollen den Lauf nicht abbrechen
            print(f"  Download fehlgeschlagen fuer {row['sample_id']}: {e}")
            failed += 1
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        added += 1

    APP_DATA.mkdir(parents=True, exist_ok=True)
    STAMP.write_text(str(int(time.time())))

    counts = {
        f"{s}/{c}": len(list((APP_DATA / s / c).glob("*.jpg")))
        for s in ("train", "val")
        for c in CLASSES
    }
    print(f"Export-View: {len(rows)} Zeilen. Neu: {added}, geloescht: {removed}, Fehler: {failed}")
    for k, v in counts.items():
        print(f"  {k}: {v}")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
