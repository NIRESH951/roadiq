"""RoadIQ FastAPI backend."""

from __future__ import annotations

import threading
import uuid
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import config as C
from .analysis import CityModel, priority_config
from .db import get_db
from .detector import DetectorError, annotate, detector, visual_severity_from_box
from .models import Defect, Inspection, Repair, RoadSegment
from .seed import init_db, seed_demo

_ready = False
_ready_lock = threading.Lock()


def _ensure_db() -> None:
    """Create and seed the database once per process. Runs from lifespan and, as a safety net on serverless
    hosts where a fresh instance may receive a request first, before every route."""
    global _ready
    if _ready:
        return
    with _ready_lock:
        if not _ready:
            init_db(seed_if_empty=True)
            _ready = True

@asynccontextmanager
async def lifespan(_app: FastAPI):
    _ensure_db()
    yield


app = FastAPI(title="RoadIQ API", version="1.0.0", lifespan=lifespan, dependencies=[Depends(_ensure_db)],
              description="AI-Powered Road Intelligence & Safer Street Prioritization")
app.add_middleware(
    CORSMiddleware,
    allow_origins=C.CORS_ORIGINS,
    allow_methods=["*"], allow_headers=["*"],
)

C.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=C.STATIC_DIR), name="static")
app.mount("/uploads", StaticFiles(directory=C.UPLOAD_DIR), name="uploads")


def city(db: Session) -> CityModel:
    return CityModel(db)


# ---------------- read endpoints ----------------
@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    """Connection check used by the UI status indicator. Reports what is really available."""
    counts = dict(db.execute(select(Defect.source, func.count()).group_by(Defect.source)).all())
    det = detector.status()
    return {
        "status": "ok",
        "database": "ok",
        "as_of": date.today().isoformat(),
        "records": {"demo": counts.get("demo", 0), "live": counts.get("live", 0)},
        "dataset": "live" if counts.get("live") and not counts.get("demo") else "mixed" if counts.get("live") else "demo",
        "detector": {"configured": det["configured"], "loaded": det["loaded"], "message": det["message"]},
    }


@app.get("/api/city")
def get_city(db: Session = Depends(get_db)):
    """Everything the 3D city, 2D map and dashboard need, computed from one set of rows."""
    return city(db).payload()


@app.get("/api/metrics")
def get_metrics(db: Session = Depends(get_db)):
    return city(db).metrics()


@app.get("/api/priority/config")
def get_priority_config():
    return priority_config()


@app.get("/api/segments")
def list_segments(db: Session = Depends(get_db)):
    return list(city(db).segment_rows.values())


@app.get("/api/segments/{segment_id}")
def get_segment(segment_id: str, db: Session = Depends(get_db)):
    model = city(db)
    if segment_id not in model.segment_rows:
        raise HTTPException(404, "Road section not found")
    return {
        "segment": model.segment_rows[segment_id],
        "defects": [d for d in model.defect_rows.values() if d["segment_id"] == segment_id],
        "inspections": [{"id": i.id, "inspected_on": i.inspected_on.isoformat(), "source": i.source}
                        for i in model.inspections if i.segment_id == segment_id],
        "repairs": [r for r in model.repair_rows if r["segment_id"] == segment_id],
    }


@app.get("/api/defects")
def list_defects(source: str | None = None, db: Session = Depends(get_db)):
    rows = list(city(db).defect_rows.values())
    return [r for r in rows if source is None or r["source"] == source]


@app.get("/api/defects/{defect_id}")
def get_defect(defect_id: str, db: Session = Depends(get_db)):
    model = city(db)
    if defect_id not in model.defect_rows:
        raise HTTPException(404, "Defect not found")
    return model.defect_rows[defect_id]


@app.get("/api/inspections")
def list_inspections(db: Session = Depends(get_db)):
    return city(db).payload()["inspections"]


@app.get("/api/repairs")
def list_repairs(db: Session = Depends(get_db)):
    return city(db).repair_rows


@app.get("/api/context")
def list_context(db: Session = Depends(get_db)):
    return city(db).payload()["context"]


# ---------------- AI detection ----------------
@app.get("/api/detect/status")
def detect_status():
    return detector.status()


MAX_UPLOAD_BYTES = 15 * 1024 * 1024


def _save_image(upload: UploadFile) -> tuple[Path, str]:
    """Store an upload as an upright JPEG without metadata (EXIF rotation applied, GPS stripped),
    so the model, the annotated copy and the browser all see the same pixels."""
    suffix = Path(upload.filename or "photo.jpg").suffix.lower()
    if suffix not in (".jpg", ".jpeg", ".png", ".webp"):
        raise HTTPException(400, "Upload a JPG, PNG or WebP photo.")
    raw = upload.file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Photo is larger than 15 MB.")
    import io
    try:
        with Image.open(io.BytesIO(raw)) as im:
            im.load()
            img = ImageOps.exif_transpose(im).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "The file is not a readable image.")
    name = f"{uuid.uuid4().hex[:12]}.jpg"
    dest = C.UPLOAD_DIR / name
    img.save(dest, quality=92)
    return dest, f"/uploads/{name}"


def _next_id(db: Session, model, prefix: str) -> str:
    count = db.scalar(select(func.count()).select_from(model).where(model.id.like(f"{prefix}%"))) or 0
    return f"{prefix}{count + 1:04d}"


@app.post("/api/detect")
def detect(image: UploadFile = File(...), segment_id: str = Form(...), t: float = Form(0.5),
           lane: float = Form(0.0), db: Session = Depends(get_db)):
    """Run the trained detector on a real photo and store results as live records."""
    seg = db.get(RoadSegment, segment_id)
    if seg is None:
        raise HTTPException(404, "Choose an existing road section for this photo.")
    status = detector.status()
    if not status["configured"]:
        raise HTTPException(503, status["message"])
    path, url = _save_image(image)
    try:
        detections = detector.predict(path)
    except DetectorError as exc:
        raise HTTPException(503, f"The detector could not run: {exc}")
    annotated_path = path.with_name(path.stem + "_annotated.jpg")
    annotate(path, detections, annotated_path)
    annotated_url = f"/uploads/{annotated_path.name}"

    today = date.today()
    ins = Inspection(id=_next_id(db, Inspection, "LIVE-INS-"), segment_id=segment_id, inspected_on=today,
                     method="photo upload", notes=f"{len(detections)} detection(s)", source="live")
    db.add(ins)
    created = []
    for k, det in enumerate(detections):
        did = _next_id(db, Defect, "LIVE-")
        x, y, w, h = det["bbox"]
        db.add(Defect(
            id=did, segment_id=segment_id, inspection_id=ins.id, damage_type=det["type"],
            confidence=det["confidence"], visual_severity=visual_severity_from_box(w, h, det["confidence"]),
            t=min(0.98, max(0.02, t + 0.015 * k)), lane=max(-3.0, min(3.0, lane)), detected_on=today,
            bbox=det["bbox"], image_url=url, annotated_image_url=annotated_url, model_label=det["model_label"],
            source="live",
        ))
        db.flush()
        created.append(did)
    db.commit()
    model = city(db)
    seg_row = model.segment_rows[segment_id]
    return {"inspection_id": ins.id, "image_url": url, "annotated_image_url": annotated_url,
            "segment_id": segment_id, "road_name": seg_row["road_name"], "position": round(t, 2),
            "detections": [model.defect_rows[i] for i in created],
            "message": ("The model found no damage it recognises in this photo." if not created else
                        f"{len(created)} detection(s) stored. " + " ".join(
                            f"{model.defect_rows[i]['type_label']} ({model.defect_rows[i]['band'].upper()}): "
                            f"{model.defect_rows[i]['recommendation']}" for i in created))}


# ---------------- repairs ----------------
@app.post("/api/repairs")
def submit_repair(defect_id: str = Form(...), crew: str = Form(""), image: UploadFile | None = File(None),
                  db: Session = Depends(get_db)):
    defect = db.get(Defect, defect_id)
    if defect is None:
        raise HTTPException(404, f"No defect with ID {defect_id}. Use an ID from GET /api/defects, e.g. DEF-0014.")
    pending = db.scalar(select(Repair).where(Repair.defect_id == defect_id, Repair.status != "verified"))
    if pending is not None:
        raise HTTPException(409, f"{pending.id} is already awaiting verification for this defect.")
    url = _save_image(image)[1] if image is not None and image.filename else None
    rep = Repair(id=_next_id(db, Repair, "LIVE-REP-"), defect_id=defect_id, submitted_on=date.today(),
                 status="pending_verification", crew=crew or None, after_image_url=url, source="live")
    db.add(rep)
    db.commit()
    return next(r for r in city(db).repair_rows if r["id"] == rep.id)


@app.post("/api/repairs/{repair_id}/verify",
          responses={404: {"description": "No repair (or pending repair for that defect) found"}})
def verify_repair(repair_id: str, db: Session = Depends(get_db)):
    """Verify a repair. Accepts a repair ID (e.g. REP-001, LIVE-REP-0001) or a defect ID (e.g. DEF-0014),
    in which case that defect's repair awaiting verification is verified."""
    rep = db.get(Repair, repair_id)
    if rep is None and db.get(Defect, repair_id) is not None:
        rep = db.scalar(select(Repair).where(Repair.defect_id == repair_id, Repair.status != "verified")
                        .order_by(Repair.submitted_on.desc()))
        if rep is None:
            raise HTTPException(404, f"Defect {repair_id} has no repair awaiting verification. "
                                     "Submit one first with POST /api/repairs.")
    if rep is None:
        raise HTTPException(404, f"No repair or defect with ID {repair_id}. Use the repair ID returned by "
                                 "POST /api/repairs (e.g. LIVE-REP-0001) or a defect ID (e.g. DEF-0014).")
    rep.status = "verified"
    rep.verified_on = date.today()
    db.commit()
    return next(r for r in city(db).repair_rows if r["id"] == rep.id)


# ---------------- admin ----------------
@app.post("/api/admin/reset-demo")
def reset_demo(db: Session = Depends(get_db)):
    """Recreate demo records (source='demo'). Live records are kept."""
    return {"reseeded": seed_demo(db)}


# ---------------- optional: serve the built frontend ----------------
DIST = C.PROJECT_DIR / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)
        target = (DIST / full_path).resolve()
        if full_path and target.is_file() and DIST.resolve() in target.parents:
            return FileResponse(target)
        return FileResponse(DIST / "index.html")
