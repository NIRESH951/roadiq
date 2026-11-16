"""Demo data seeding.

Reads shared/demo_city.json (the single source of demo truth) and writes records
with source='demo'. Live records (source='live') are never touched.
"""

from __future__ import annotations

import json
from datetime import date, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from . import images
from .config import DEMO_IMAGE_DIR, SEED_FILE
from .db import Base, SessionLocal, engine, ensure_columns
from .models import ContextLocation, Defect, Inspection, Repair, Road, RoadSegment


def load_seed() -> dict:
    with open(SEED_FILE, encoding="utf-8") as fh:
        return json.load(fh)


def segment_geometry(road: dict, breaks: list[float]):
    for i in range(len(breaks) - 1):
        a, b = breaks[i], breaks[i + 1]
        if road["axis"] == "x":
            yield i + 1, (a, road["offset"]), (b, road["offset"])
        else:
            yield i + 1, (road["offset"], a), (road["offset"], b)


def _upsert_layout(db: Session, data: dict) -> None:
    half_width = data["meta"]["road_half_width"]
    attrs = data.get("segment_attributes", {})
    for road in data["roads"]:
        db.merge(Road(code=road["code"], name=road["name"], road_class=road["road_class"], source="demo"))
        for idx, (x1, z1), (x2, z2) in segment_geometry(road, data["segment_breaks"]):
            seg_id = f"{road['code']}-{idx}"
            a = attrs.get(seg_id, {})
            db.merge(RoadSegment(
                id=seg_id, road_code=road["code"], index=idx, x1=x1, z1=z1, x2=x2, z2=z2,
                width=half_width * 2,
                survey_tracked=a.get("survey_tracked", True),
                waterlogging_reports=a.get("waterlogging_reports", 0),
                drainage_complaints=a.get("drainage_complaints", 0),
                source="demo",
            ))
    for c in data["context"]:
        db.merge(ContextLocation(id=c["id"], kind=c["kind"], name=c["name"], x=c["x"], z=c["z"],
                                 axis=c.get("axis"), source="demo"))


def _ensure_inspection(db: Session, seg_id: str, days_ago: int, today: date, cache: dict) -> str:
    ins_id = f"INS-{seg_id}-{days_ago:03d}"
    if ins_id not in cache:
        db.add(Inspection(id=ins_id, segment_id=seg_id, inspected_on=today - timedelta(days=days_ago),
                          method="vehicle camera (demo)", source="demo"))
        cache[ins_id] = True
    return ins_id


def seed_demo(db: Session, today: date | None = None) -> dict:
    """(Re)create all demo records. Returns counts."""
    today = today or date.today()
    data = load_seed()
    _upsert_layout(db, data)
    db.flush()

    db.execute(delete(Repair).where(Repair.source == "demo"))
    # Repairs logged against demo defects go with them, so no orphan rows remain.
    db.execute(delete(Repair).where(Repair.defect_id.in_(select(Defect.id).where(Defect.source == "demo"))))
    db.execute(delete(Defect).where(Defect.source == "demo"))
    db.execute(delete(Inspection).where(Inspection.source == "demo"))
    db.flush()

    cache: dict = {}
    bboxes: dict[str, list[float]] = {}
    for d in data["defects"]:
        ins_id = _ensure_inspection(db, d["segment"], d["days_ago"], today, cache)
        bbox = images.render_defect(d["id"], d["type"], d["severity"], DEMO_IMAGE_DIR)
        bboxes[d["id"]] = bbox
        db.add(Defect(
            id=d["id"], segment_id=d["segment"], inspection_id=ins_id, damage_type=d["type"],
            confidence=d["confidence"], visual_severity=d["severity"], t=d["t"], lane=d["lane"],
            detected_on=today - timedelta(days=d["days_ago"]), bbox=bbox,
            image_url=f"/static/demo/{d['id']}.jpg", model_label="demo record", source="demo",
        ))
    for seg_id, days_list in data.get("extra_inspections", {}).items():
        for days_ago in days_list:
            _ensure_inspection(db, seg_id, days_ago, today, cache)

    for r in data["repairs"]:
        images.render_repair(r["id"], r["defect"], bboxes[r["defect"]], DEMO_IMAGE_DIR)
        db.add(Repair(
            id=r["id"], defect_id=r["defect"], status=r["status"], crew=r.get("crew"),
            submitted_on=today - timedelta(days=r["submitted_days_ago"]),
            verified_on=(today - timedelta(days=r["verified_days_ago"])) if "verified_days_ago" in r else None,
            after_image_url=f"/static/demo/{r['id']}.jpg", source="demo",
        ))
    db.commit()
    return {"defects": len(data["defects"]), "repairs": len(data["repairs"]), "inspections": len(cache)}


def init_db(seed_if_empty: bool = True) -> None:
    Base.metadata.create_all(engine)
    ensure_columns()
    if not seed_if_empty:
        return
    with SessionLocal() as db:
        if db.scalar(select(RoadSegment).limit(1)) is None:
            seed_demo(db)


if __name__ == "__main__":
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        print("Seeded demo data:", seed_demo(session))
