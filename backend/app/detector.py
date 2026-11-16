"""Optional YOLO road-damage detector.

RoadIQ never invents detections. If no trained model is configured, or it fails to load,
/api/detect answers 503 with a clear message instead of returning anything.

Train on RDD2022 (classes D00, D10, D20, D40) with Ultralytics, then set
ROADIQ_MODEL_PATH to the resulting best.pt and `pip install -r requirements-ml.txt`.

Validation metrics are never computed or invented here. If you place a JSON file next to the
model (e.g. models/roadiq.metrics.json, copied from your training run), it is shown as
"reported by your training run".
"""

from __future__ import annotations

import json
from pathlib import Path
from threading import Lock

from PIL import Image, ImageDraw, ImageFont

from . import config as C

LABEL_MAP = {
    "d00": "longitudinal_crack",
    "d10": "transverse_crack",
    "d20": "alligator_crack",
    "d40": "pothole",
    "pothole": "pothole",
    "potholes": "pothole",
    "longitudinal crack": "longitudinal_crack",
    "transverse crack": "transverse_crack",
    "lateral crack": "transverse_crack",
    "alligator crack": "alligator_crack",
    "crocodile crack": "alligator_crack",
}

BOX_COLOR = {
    "pothole": (34, 211, 238),
    "alligator_crack": (167, 139, 250),
    "transverse_crack": (250, 204, 21),
    "longitudinal_crack": (74, 222, 128),
}
TYPE_LABEL = {
    "pothole": "Pothole",
    "alligator_crack": "Alligator crack",
    "transverse_crack": "Transverse crack",
    "longitudinal_crack": "Longitudinal crack",
}


class DetectorError(RuntimeError):
    """The model exists but could not be loaded or run."""


def normalise_label(raw: str) -> str | None:
    key = raw.strip().lower().replace("_", " ").replace("-", " ")
    return LABEL_MAP.get(key)


def visual_severity_from_box(w: float, h: float, confidence: float) -> float:
    """Heuristic: share of the frame the damage covers. Not a depth or structural measurement."""
    area = max(0.0, w * h)
    return round(min(1.0, max(0.2, 0.25 + 3.0 * area)), 2)


def annotate(src: Path, detections: list[dict], dest: Path) -> None:
    """Draw the model's boxes, classes and confidences onto a copy of the photo."""
    with Image.open(src) as im:
        img = im.convert("RGB")
    d = ImageDraw.Draw(img)
    W, H = img.size
    stroke = max(2, round(min(W, H) / 220))
    try:
        font = ImageFont.load_default(size=max(14, round(min(W, H) / 40)))
    except TypeError:  # Pillow < 10.1
        font = ImageFont.load_default()
    for det in detections:
        x, y, w, h = det["bbox"]
        box = [x * W, y * H, (x + w) * W, (y + h) * H]
        col = BOX_COLOR.get(det["type"], (34, 211, 238))
        d.rectangle(box, outline=col, width=stroke)
        text = f"{TYPE_LABEL.get(det['type'], det['type'])} {det['confidence'] * 100:.0f}%"
        tb = d.textbbox((0, 0), text, font=font)
        tw, th = tb[2] - tb[0], tb[3] - tb[1]
        ty = box[1] - th - 8 if box[1] - th - 8 > 0 else box[1] + stroke
        d.rectangle([box[0], ty, box[0] + tw + 10, ty + th + 8], fill=col)
        d.text((box[0] + 5, ty + 3), text, fill=(5, 12, 26), font=font)
    img.save(dest, quality=90)


class Detector:
    def __init__(self, model_path: str | None = None):
        self.model_path = model_path or C.MODEL_PATH
        self._model = None
        self._error: str | None = None
        self._lock = Lock()

    def _metrics(self) -> dict | None:
        path = Path(self.model_path).with_suffix(".metrics.json")
        if not path.is_file():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return None

    def status(self) -> dict:
        exists = Path(self.model_path).is_file()
        try:
            import ultralytics  # noqa: F401
            has_lib = True
        except Exception:  # pragma: no cover - depends on environment
            has_lib = False
        ready = exists and has_lib and self._error is None
        if not exists:
            message = (f"No trained model found at {self.model_path}. Train on RDD2022 and set ROADIQ_MODEL_PATH. "
                       "Until then RoadIQ shows only stored records.")
        elif not has_lib:
            message = "Model file found, but the 'ultralytics' package is not installed (pip install -r requirements-ml.txt)."
        elif self._error:
            message = f"Model failed to load: {self._error}"
        elif self._model is None:
            message = "Model file found. It loads on the first upload."
        else:
            message = "Detector loaded and ready."
        return {"configured": ready, "loaded": self._model is not None, "model_path": self.model_path,
                "model_file_found": exists, "library_installed": has_lib, "message": message,
                "classes": sorted(set(LABEL_MAP.values())), "validation_metrics": self._metrics()}

    def _load(self):
        with self._lock:
            if self._model is None:
                try:
                    from ultralytics import YOLO
                    self._model = YOLO(self.model_path)
                except Exception as exc:  # pragma: no cover - depends on the model file
                    self._error = str(exc)[:300]
                    raise DetectorError(self._error) from exc
        return self._model

    def predict(self, image_path: Path) -> list[dict]:
        model = self._load()
        try:
            result = model.predict(str(image_path), conf=C.MODEL_CONFIDENCE, verbose=False)[0]
        except Exception as exc:  # pragma: no cover
            raise DetectorError(f"Inference failed: {str(exc)[:300]}") from exc
        names = result.names
        out = []
        for box in result.boxes:
            cls = int(box.cls[0])
            raw = names.get(cls, str(cls)) if isinstance(names, dict) else names[cls]
            mapped = normalise_label(raw)
            if mapped is None:
                continue
            x, y, w, h = [float(v) for v in box.xywhn[0]]
            out.append({"type": mapped, "model_label": raw, "confidence": round(float(box.conf[0]), 3),
                        "bbox": [round(x - w / 2, 4), round(y - h / 2, 4), round(w, 4), round(h, 4)]})
        return out


detector = Detector()

# --- RoadIQ: crack sub-type from the box shape (an estimate, NOT a model class) ---
# The model says "crack"; the long/wide/area shape of its box decides longitudinal,
# transverse or alligator. The model label is marked so the UI shows it is an estimate.
def _crack_type_from_shape(w_px, h_px, area_frac):
    aspect = w_px / max(h_px, 1e-6)
    if area_frac >= 0.10 and 0.5 <= aspect <= 2.0:
        return "alligator_crack"
    if aspect <= 0.6:
        return "longitudinal_crack"
    if aspect >= 1.67:
        return "transverse_crack"
    return "alligator_crack" if area_frac >= 0.04 else "crack"


_model_predict = Detector.predict


def _predict_with_crack_type(self, image_path):
    dets = _model_predict(self, image_path)
    if not any(d.get("type") == "crack" for d in dets):
        return dets
    from PIL import Image as _Img
    with _Img.open(image_path) as im:
        W, H = im.size
    for d in dets:
        if d.get("type") != "crack":
            continue
        _, _, w, h = d["bbox"]
        sub = _crack_type_from_shape(w * W, h * H, w * h)
        if sub != "crack":
            d["type"] = sub
            d["model_label"] = f"{d.get('model_label') or 'crack'} (type estimated from crack shape)"
    return dets


Detector.predict = _predict_with_crack_type

# --- RoadIQ fix: let the model's "crack" class through (older label map dropped it) ---
_label_from_map = normalise_label


def normalise_label(raw):
    if str(raw).strip().lower() in ("crack", "cracks"):
        return "crack"
    return _label_from_map(raw)


from . import config as _cfg

if "crack" not in getattr(_cfg, "DAMAGE_TYPE_WEIGHT", {}):
    _shape_estimate = _crack_type_from_shape

    def _crack_type_from_shape(w_px, h_px, area_frac):
        t = _shape_estimate(w_px, h_px, area_frac)
        if t == "crack":
            t = "longitudinal_crack" if h_px >= w_px else "transverse_crack"
        return t
