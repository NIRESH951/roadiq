# RoadIQ: make the GitHub repo deployable on Vercel with live AI detection (ONNX, no PyTorch).
# Run from the roadiq folder:  python vercel_patch.py   (safe to run twice)
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def edit(rel, fn):
    p = ROOT / rel
    old = p.read_text(encoding="utf-8")
    new = fn(old)
    if new != old:
        p.write_text(new, encoding="utf-8", newline="\n")
        print("updated   ", rel)
    else:
        print("unchanged ", rel)


ONNX_BLOCK = '''

# --- RoadIQ: ONNX runtime path (Vercel has no room for PyTorch; the same trained model runs as ONNX) ---
_ultralytics_predict = _model_predict
_ultralytics_status = Detector.status
_pt_file = Path(C.MODEL_PATH)
if not _pt_file.is_file() and _pt_file.with_suffix(".onnx").is_file():
    detector.model_path = str(_pt_file.with_suffix(".onnx"))


def _is_onnx(self):
    return str(self.model_path).lower().endswith(".onnx")


def _status_any(self):
    if not _is_onnx(self):
        return _ultralytics_status(self)
    exists = Path(self.model_path).is_file()
    try:
        import onnxruntime  # noqa: F401
        has_lib = True
    except Exception:
        has_lib = False
    ready = exists and has_lib and self._error is None
    if not exists:
        message = f"No model file at {self.model_path}."
    elif not has_lib:
        message = "Model file found, but the 'onnxruntime' package is not installed."
    elif self._error:
        message = f"Model failed to load: {self._error}"
    elif self._model is None:
        message = "Trained model found (ONNX). It loads on the first upload."
    else:
        message = "Detector loaded and ready (ONNX runtime)."
    return {"configured": ready, "loaded": self._model is not None, "model_path": self.model_path,
            "model_file_found": exists, "library_installed": has_lib, "message": message,
            "classes": sorted(set(LABEL_MAP.values())), "validation_metrics": self._metrics()}


def _onnx_load(self):
    with self._lock:
        if self._model is None:
            try:
                import ast
                import onnxruntime as ort
                sess = ort.InferenceSession(str(self.model_path), providers=["CPUExecutionProvider"])
                raw = sess.get_modelmeta().custom_metadata_map.get("names") or "{}"
                names = ast.literal_eval(raw)
                if isinstance(names, list):
                    names = dict(enumerate(names))
                shape = sess.get_inputs()[0].shape
                size = int(shape[2]) if isinstance(shape[2], int) else 640
                self._model = (sess, {int(k): str(v) for k, v in names.items()}, size)
            except Exception as exc:
                self._error = str(exc)[:300]
                raise DetectorError(self._error) from exc
    return self._model


def _nms(boxes, scores, iou_thr):
    import numpy as np
    order = scores.argsort()[::-1]
    keep = []
    while order.size:
        i = order[0]
        keep.append(int(i))
        rest = order[1:]
        xx1 = np.maximum(boxes[i, 0], boxes[rest, 0])
        yy1 = np.maximum(boxes[i, 1], boxes[rest, 1])
        xx2 = np.minimum(boxes[i, 2], boxes[rest, 2])
        yy2 = np.minimum(boxes[i, 3], boxes[rest, 3])
        inter = np.clip(xx2 - xx1, 0, None) * np.clip(yy2 - yy1, 0, None)
        a_i = (boxes[i, 2] - boxes[i, 0]) * (boxes[i, 3] - boxes[i, 1])
        a_r = (boxes[rest, 2] - boxes[rest, 0]) * (boxes[rest, 3] - boxes[rest, 1])
        order = rest[inter / (a_i + a_r - inter + 1e-9) < iou_thr]
    return keep


def _onnx_predict(self, image_path):
    """YOLO ONNX inference without PyTorch: letterbox, run, decode boxes, per-class NMS."""
    import numpy as np
    sess, names, s = _onnx_load(self)
    try:
        with Image.open(image_path) as im:
            img = im.convert("RGB")
        W, H = img.size
        r = min(s / W, s / H)
        nw, nh = round(W * r), round(H * r)
        canvas = Image.new("RGB", (s, s), (114, 114, 114))
        px, py = (s - nw) // 2, (s - nh) // 2
        canvas.paste(img.resize((nw, nh), Image.BILINEAR), (px, py))
        x = np.asarray(canvas, dtype=np.float32).transpose(2, 0, 1)[None] / 255.0
        out = sess.run(None, {sess.get_inputs()[0].name: x})[0][0]
    except Exception as exc:
        raise DetectorError(f"Inference failed: {str(exc)[:300]}") from exc
    nc = len(names) or 1
    xywh = out[:4].T
    scores = out[4:4 + nc].T
    cls = scores.argmax(1)
    conf = scores.max(1)
    m = conf >= C.MODEL_CONFIDENCE
    xywh, cls, conf = xywh[m], cls[m], conf[m]
    if not len(conf):
        return []
    b = np.empty_like(xywh)
    b[:, 0] = xywh[:, 0] - xywh[:, 2] / 2
    b[:, 1] = xywh[:, 1] - xywh[:, 3] / 2
    b[:, 2] = xywh[:, 0] + xywh[:, 2] / 2
    b[:, 3] = xywh[:, 1] + xywh[:, 3] / 2
    keep = _nms(b + cls[:, None] * 4096.0, conf, 0.7)[:300]
    found = []
    for i in keep:
        x1 = float(np.clip((b[i, 0] - px) / r, 0, W))
        y1 = float(np.clip((b[i, 1] - py) / r, 0, H))
        x2 = float(np.clip((b[i, 2] - px) / r, 0, W))
        y2 = float(np.clip((b[i, 3] - py) / r, 0, H))
        if x2 - x1 < 1 or y2 - y1 < 1:
            continue
        raw = names.get(int(cls[i]), str(int(cls[i])))
        mapped = normalise_label(raw)
        if mapped is None:
            continue
        found.append({"type": mapped, "model_label": raw, "confidence": round(float(conf[i]), 3),
                      "bbox": [round(x1 / W, 4), round(y1 / H, 4), round((x2 - x1) / W, 4), round((y2 - y1) / H, 4)]})
    return found


def _model_predict(self, image_path):
    if _is_onnx(self):
        return _onnx_predict(self, image_path)
    return _ultralytics_predict(self, image_path)


Detector.status = _status_any
'''


def detector_py(s):
    if "RoadIQ: ONNX runtime path" in s:
        return s
    assert "_model_predict = Detector.predict" in s, "crack-type add-on missing in detector.py"
    return s.rstrip("\n") + "\n" + ONNX_BLOCK


PUBLIC_URL = '''

def _public_url(path):
    """On Vercel each request can land on a different instance with its own /tmp, so the detection response
    carries its images inline (data URLs). Locally they are served from /uploads as before."""
    if C.ON_VERCEL:
        import base64
        return "data:image/jpeg;base64," + base64.b64encode(Path(path).read_bytes()).decode("ascii")
    return f"/uploads/{Path(path).name}"
'''


def main_py(s):
    s = s.replace('    img.save(dest, quality=92)\n',
                  '    if C.ON_VERCEL:\n        img.thumbnail((1600, 1600))\n'
                  '    img.save(dest, quality=88 if C.ON_VERCEL else 92)\n', 1) if "img.thumbnail((1600" not in s else s
    s = s.replace('"image_url": url, "annotated_image_url": annotated_url,',
                  '"image_url": _public_url(path), "annotated_image_url": _public_url(annotated_path),', 1)
    if "def _public_url(" not in s:
        s = s.rstrip("\n") + "\n" + PUBLIC_URL
    return s


def add_reqs(s):
    for dep in ("numpy>=1.26", "onnxruntime>=1.18"):
        if dep.split(">")[0] not in s:
            s = s.rstrip("\n") + "\n" + dep + "\n"
    return s


def pyproject(s):
    if "onnxruntime" in s:
        return s
    return s.replace('    "pillow>=10.1",\n', '    "pillow>=10.1",\n    "numpy>=1.26",\n    "onnxruntime>=1.18",\n', 1)


SHRINK = '''// Vercel accepts request bodies up to about 4.5 MB, so large phone photos are resized in the browser first.
async function shrinkPhoto(file: File): Promise<Blob> {
  if (file.size <= 3_500_000 || typeof createImageBitmap !== 'function') return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.9))
    return blob ?? file
  } catch {
    return file
  }
}

export async function runDetection('''


def client_ts(s):
    if "shrinkPhoto" in s:
        return s
    s = s.replace("export async function runDetection(", SHRINK, 1)
    return s.replace("  form.append('image', file)\n  form.append('segment_id', segmentId)",
                     "  const photo = await shrinkPhoto(file)\n  form.append('image', photo, photo === file ? file.name : 'photo.jpg')\n  form.append('segment_id', segmentId)", 1)


edit("backend/app/detector.py", detector_py)
edit("backend/app/main.py", main_py)
edit("backend/requirements.txt", add_reqs)
edit("backend/pyproject.toml", pyproject)
edit("frontend/src/api/client.ts", client_ts)
print("PATCH OK")
