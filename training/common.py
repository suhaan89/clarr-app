"""Gemeinsame Pfade und Hilfsfunktionen fuer die CLAR-Trainingsskripte.

Die Vorverarbeitung hier ist absichtlich identisch zur App
(src/lib/vision/classifier.ts + preprocess.ts): mittig quadratisch
zuschneiden, auf die Eingabegroesse verkleinern, Pixel auf 0..1 bringen.
Nur so misst evaluate.py dieselbe Genauigkeit, die spaeter auf dem Handy
ankommt.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
APP_DATA = DATA / "app"          # aus Supabase synchronisiert (sync_dataset.py)
MANUAL_DATA = DATA / "manual"    # von dir selbst eingelegt
DATASET = DATA / "dataset"       # fertiger Train/Val-Split (prepare_dataset.py)
RUNS = ROOT / "runs"
EXPORTS = ROOT / "exports"

CLASSES = ("negativ", "positiv")  # alphabetisch = Reihenfolge, die YOLO vergibt
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
IMG_SIZE = 224


def list_images(folder: Path) -> list[Path]:
    if not folder.exists():
        return []
    return sorted(p for p in folder.rglob("*") if p.suffix.lower() in IMAGE_SUFFIXES)


def stable_fraction(key: str) -> float:
    """Deterministische Zahl in [0, 1) aus einem Text: gleicher Text, gleiche Seite."""
    return int(hashlib.md5(key.encode("utf-8")).hexdigest()[:8], 16) / 0x100000000


def group_key(path: Path) -> str:
    """Gruppe eines manuell eingelegten Fotos.

    Fotos vom selben Ort sollen zusammen in train ODER val landen, sonst sieht
    das Modell bei der Pruefung fast dasselbe Bild wie im Training (Data
    Leakage) und die Zahlen sind zu gut. Konvention: alles vor "__" im
    Dateinamen ist die Gruppe, z. B. "waldweg-3__foto1.jpg".
    """
    stem = path.stem
    return stem.split("__", 1)[0] if "__" in stem else stem


def preprocess(path: Path, size: int = IMG_SIZE) -> np.ndarray:
    """Foto -> float32-Array (1, size, size, 3) mit Werten 0..1, wie in der App."""
    img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    w, h = img.size
    side = min(w, h)
    left, top = (w - side) // 2, (h - side) // 2
    img = img.crop((left, top, left + side, top + side)).resize((size, size), Image.BILINEAR)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return arr[np.newaxis, ...]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_tflite_interpreter(model_path: Path):
    """TFLite-Interpreter laden (LiteRT, sonst TensorFlow)."""
    try:
        from ai_edge_litert.interpreter import Interpreter  # type: ignore
    except ImportError:
        from tensorflow.lite.python.interpreter import Interpreter  # type: ignore
    interpreter = Interpreter(model_path=str(model_path))
    interpreter.allocate_tensors()
    return interpreter


def run_tflite(interpreter, image: np.ndarray) -> np.ndarray:
    """Ein Bild (0..1, float32) durch das TFLite-Modell schicken; quantisiert bei Bedarf."""
    inp = interpreter.get_input_details()[0]
    out = interpreter.get_output_details()[0]
    x = image
    if inp["dtype"] in (np.int8, np.uint8):
        scale, zero = inp["quantization"]
        info = np.iinfo(inp["dtype"])
        x = np.clip(np.round(image / scale + zero), info.min, info.max).astype(inp["dtype"])
    interpreter.set_tensor(inp["index"], x)
    interpreter.invoke()
    y = interpreter.get_tensor(out["index"]).astype(np.float32)
    if out["dtype"] in (np.int8, np.uint8):
        scale, zero = out["quantization"]
        y = scale * (y - zero)
    return y[0]
