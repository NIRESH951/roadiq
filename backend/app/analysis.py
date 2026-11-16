"""Derived road intelligence: positions, Road Priority Score, recurrence, coverage, monsoon watchlist, metrics.

Everything shown in the 3D city, the 2D map and the charts is computed here from the same
database rows, so every view agrees.
"""

from __future__ import annotations

import math
from collections import Counter, defaultdict
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import config as C
from .models import ContextLocation, Defect, Inspection, Repair, Road, RoadSegment
from .seed import load_seed

METRES_PER_UNIT = 5.0

DAMAGE_LABEL = {
    "pothole": "Pothole",
    "longitudinal_crack": "Longitudinal crack",
    "transverse_crack": "Transverse crack",
    "alligator_crack": "Alligator crack",
}
CONTEXT_LABEL = {
    "school": "school",
    "hospital": "hospital",
    "bus_stop": "bus stop",
    "pedestrian_crossing": "pedestrian crossing",
    "market": "market",
}


REPAIR_METHOD = {
    "pothole": "Patch the pothole: cut the edges square, clean out loose material and water, fill and compact "
               "(cold mix as a temporary fix, hot mix as the permanent repair)",
    "alligator_crack": "Full-depth patch: remove the cracked area and repair the base layer, because alligator "
                       "cracking usually means the layers underneath are failing",
    "longitudinal_crack": "Clean and seal the crack so water cannot get under the road surface",
    "transverse_crack": "Clean and seal the crack so water cannot get under the road surface",
    "crack": "Clean and seal the crack so water cannot get under the road surface",
}
REPAIR_TIMING = {
    "critical": "Act within 48 hours and place a warning sign until it is fixed.",
    "high": "Schedule the repair within 1 week.",
    "medium": "Schedule the repair within 1 month.",
    "low": "Add it to the next routine maintenance round.",
}


def suggest_action(damage_type: str, band: str, possible_recurrence: bool, weather: float) -> str:
    parts = [REPAIR_METHOD.get(damage_type, "Inspect on site and choose a repair method") + ".",
             REPAIR_TIMING.get(band, "")]
    if possible_recurrence:
        parts.append("Damage came back after an earlier repair: check drainage and the base layer before repairing again.")
    if weather >= 50:
        parts.append("Waterlogging is recorded here: check the drainage at this spot.")
    return " ".join(p for p in parts if p)


def band_for(score: float | None) -> str:
    if score is None:
        return "none"
    for name, lower in C.PRIORITY_BANDS:
        if score >= lower:
            return name
    return "low"


def severity_label(sev: float) -> str:
    if sev >= 0.75:
        return "severe"
    if sev >= 0.5:
        return "moderate"
    return "minor"


def segment_point(seg: RoadSegment, t: float, lane: float) -> tuple[float, float]:
    dx, dz = seg.x2 - seg.x1, seg.z2 - seg.z1
    length = math.hypot(dx, dz) or 1.0
    px, pz = -dz / length, dx / length
    return seg.x1 + dx * t + px * lane, seg.z1 + dz * t + pz * lane


def _rnd(v: float, n: int = 1) -> float:
    return round(v, n)


class CityModel:
    """Loads all rows once and computes every derived value."""

    def __init__(self, db: Session, today: date | None = None):
        self.today = today or date.today()
        self.roads = {r.code: r for r in db.scalars(select(Road))}
        self.segments = {s.id: s for s in db.scalars(select(RoadSegment))}
        self.context = list(db.scalars(select(ContextLocation)))
        self.defects = sorted(db.scalars(select(Defect)), key=lambda d: (d.detected_on, d.id))
        self.inspections = sorted(db.scalars(select(Inspection)), key=lambda i: (i.inspected_on, i.id))
        self.repairs = sorted(db.scalars(select(Repair)), key=lambda r: (r.submitted_on, r.id))
        self.repairs_by_defect: dict[str, list[Repair]] = defaultdict(list)
        for r in self.repairs:
            self.repairs_by_defect[r.defect_id].append(r)
        self.pos = {d.id: segment_point(self.segments[d.segment_id], d.t, d.lane)
                    for d in self.defects if d.segment_id in self.segments}
        self.defect_rows = {d.id: self._score_defect(d) for d in self.defects if d.id in self.pos}
        self.repair_rows = [self._repair_row(r) for r in self.repairs if r.defect_id in self.defect_rows]
        self.segment_rows = {sid: self._segment_row(s) for sid, s in self.segments.items()}

    # ---------- defects ----------
    def _defect_status(self, d: Defect) -> str:
        reps = self.repairs_by_defect.get(d.id, [])
        if any(r.status == "verified" for r in reps):
            return "repaired_verified"
        if reps:
            return "repair_submitted"
        return "open"

    def _score_defect(self, d: Defect) -> dict:
        seg = self.segments[d.segment_id]
        road = self.roads.get(seg.road_code)
        x, z = self.pos[d.id]

        damage = 100.0 * d.visual_severity * C.DAMAGE_TYPE_WEIGHT.get(d.damage_type, 0.5)
        traffic = C.TRAFFIC_BY_CLASS.get(road.road_class if road else "local", 30.0)

        radius_units = C.VULNERABILITY_RADIUS_M / METRES_PER_UNIT
        nearby = []
        for c in self.context:
            dist = math.hypot(c.x - x, c.z - z)
            if dist <= radius_units:
                pts = C.VULNERABILITY_WEIGHT.get(c.kind, 10.0) * (1 - dist / radius_units)
                nearby.append({"id": c.id, "kind": c.kind, "name": c.name,
                               "distance_m": _rnd(dist * METRES_PER_UNIT, 0), "points": _rnd(pts)})
        nearby.sort(key=lambda n: -n["points"])
        vulnerability = min(100.0, sum(n["points"] for n in nearby))

        rec_units = C.RECURRENCE_RADIUS_M / METRES_PER_UNIT
        prior = [p for p in self.defects
                 if p.segment_id == d.segment_id and p.detected_on < d.detected_on and p.id in self.pos
                 and math.hypot(self.pos[p.id][0] - x, self.pos[p.id][1] - z) <= rec_units]
        prior_repairs = [r for p in prior for r in self.repairs_by_defect.get(p.id, [])
                         if r.submitted_on <= d.detected_on]
        recurrence = C.RECURRENCE_BY_COUNT.get(len(prior), C.RECURRENCE_MAX)
        if prior_repairs:
            recurrence += C.RECURRENCE_AFTER_REPAIR_BONUS
        recurrence = min(C.RECURRENCE_MAX, recurrence)

        weather = min(100.0, seg.waterlogging_reports * C.WATERLOGGING_POINTS
                      + seg.drainage_complaints * C.DRAINAGE_POINTS)

        factors = {"D": damage, "T": traffic, "V": vulnerability, "R": recurrence, "W": weather}
        rps = sum(C.RPS_WEIGHTS[k] * v for k, v in factors.items())

        type_w = C.DAMAGE_TYPE_WEIGHT.get(d.damage_type, 0.5)
        v_parts = " + ".join(f"{CONTEXT_LABEL.get(n['kind'], n['kind'])} {n['distance_m']:.0f} m ({n['points']:.1f})" for n in nearby)
        r_text = f"{len(prior)} earlier record(s) within {C.RECURRENCE_RADIUS_M:.0f} m"
        if prior_repairs:
            r_text += f", repair submitted before re-detection (+{C.RECURRENCE_AFTER_REPAIR_BONUS:.0f})"
        factor_details = {
            "D": f"100 × visual severity {d.visual_severity:.2f} × {DAMAGE_LABEL.get(d.damage_type, d.damage_type).lower()} weight {type_w:.2f}",
            "T": f"{road.road_class if road else 'local'} road class",
            "V": (v_parts + (" (capped at 100)" if sum(n['points'] for n in nearby) > 100 else "")) if nearby
                 else f"no recorded sensitive locations within {C.VULNERABILITY_RADIUS_M:.0f} m",
            "R": r_text,
            "W": f"{seg.waterlogging_reports} waterlogging × {C.WATERLOGGING_POINTS:.0f} + "
                 f"{seg.drainage_complaints} drainage × {C.DRAINAGE_POINTS:.0f}" + (" (capped at 100)" if weather >= 100 else ""),
        }
        calculation = " + ".join(f"{C.RPS_WEIGHTS[k]:.2f}×{factors[k]:.1f}" for k in "DTVRW") + f" = {rps:.1f}"

        reasons = []
        reasons.append(f"{DAMAGE_LABEL.get(d.damage_type, d.damage_type)} with {severity_label(d.visual_severity)} "
                       f"visual severity (D {damage:.0f}).")
        if road:
            reasons.append(f"{road.name} is a{'n' if road.road_class[0] in 'aeiou' else ''} {road.road_class} road "
                           f"(T {traffic:.0f}).")
        if nearby:
            names = ", ".join(f"{n['name']} ({n['distance_m']:.0f} m)" for n in nearby[:3])
            reasons.append(f"Within {C.VULNERABILITY_RADIUS_M:.0f} m of {names} (V {vulnerability:.0f}).")
        else:
            reasons.append(f"No recorded sensitive locations within {C.VULNERABILITY_RADIUS_M:.0f} m (V 0).")
        if prior:
            txt = f"Damage was recorded at this spot {len(prior)} time{'s' if len(prior) > 1 else ''} before"
            if prior_repairs:
                txt += ", including after a repair was submitted. Re-inspection recommended"
            reasons.append(txt + f" (R {recurrence:.0f}).")
        if weather:
            reasons.append(f"{seg.waterlogging_reports} waterlogging and {seg.drainage_complaints} drainage reports "
                           f"on this section (W {weather:.0f}).")

        recommendation = suggest_action(d.damage_type, band_for(rps), bool(prior_repairs), weather)
        reasons.append(f"Suggested action: {recommendation}")

        history = [{"id": p.id, "type": p.damage_type, "detected_on": p.detected_on.isoformat(),
                    "status": self._defect_status(p), "source": p.source}
                   for p in self.defects if p.segment_id == d.segment_id and p.id != d.id
                   and p.detected_on <= d.detected_on]

        return {
            "id": d.id,
            "segment_id": d.segment_id,
            "road_name": road.name if road else d.segment_id,
            "type": d.damage_type,
            "type_label": DAMAGE_LABEL.get(d.damage_type, d.damage_type),
            "confidence": d.confidence,
            "visual_severity": d.visual_severity,
            "severity_label": severity_label(d.visual_severity),
            "x": _rnd(x, 2), "z": _rnd(z, 2), "t": d.t, "lane": d.lane,
            "detected_on": d.detected_on.isoformat(),
            "inspection_id": d.inspection_id,
            "bbox": d.bbox,
            "image_url": d.image_url,
            "model_label": d.model_label,
            "source": d.source,
            "status": self._defect_status(d),
            "rps": _rnd(rps),
            "band": band_for(rps),
            "factors": {k: _rnd(v) for k, v in factors.items()},
            "factor_details": factor_details,
            "calculation": calculation,
            "annotated_image_url": getattr(d, "annotated_image_url", None),
            "nearby": nearby,
            "reasons": reasons,
            "recurrence_of": [p.id for p in prior],
            "possible_recurrence": bool(prior_repairs),
            "recommendation": recommendation,
            "previous_records": history,
        }

    # ---------- repairs ----------
    def _repair_row(self, r: Repair) -> dict:
        d = next(x for x in self.defects if x.id == r.defect_id)
        x, z = self.pos[d.id]
        rec_units = C.RECURRENCE_RADIUS_M / METRES_PER_UNIT
        later = [o.id for o in self.defects
                 if o.segment_id == d.segment_id and o.detected_on > r.submitted_on and o.id != d.id
                 and math.hypot(self.pos[o.id][0] - x, self.pos[o.id][1] - z) <= rec_units]
        display = r.status
        if later and r.status != "verified":
            display = "reinspection_recommended"
        return {
            "id": r.id, "defect_id": r.defect_id, "segment_id": d.segment_id,
            "submitted_on": r.submitted_on.isoformat(),
            "verified_on": r.verified_on.isoformat() if r.verified_on else None,
            "status": r.status, "display_status": display, "crew": r.crew,
            "before_image_url": d.image_url, "after_image_url": r.after_image_url,
            "later_defects_nearby": later, "source": r.source,
        }

    # ---------- segments ----------
    def _segment_row(self, s: RoadSegment) -> dict:
        road = self.roads.get(s.road_code)
        defects = [self.defect_rows[d.id] for d in self.defects if d.segment_id == s.id and d.id in self.defect_rows]
        active = [d for d in defects if d["status"] != "repaired_verified"]
        top = max(active, key=lambda d: d["rps"], default=None)

        insp = [i for i in self.inspections if i.segment_id == s.id]
        last = insp[-1].inspected_on if insp else None
        days_since = (self.today - last).days if last else None
        if not s.survey_tracked and not insp:
            coverage = "unknown"
        elif last is None:
            coverage = "never"
        elif days_since <= C.RECENT_INSPECTION_DAYS:
            coverage = "recent"
        else:
            coverage = "overdue"

        repairs = [r for r in self.repair_rows if r["segment_id"] == s.id]
        order = ["reinspection_recommended", "pending_verification", "submitted", "verified"]
        repair_status = next((st for st in order if any(r["display_status"] == st for r in repairs)), "none")

        potholes = [d for d in defects if d["type"] == "pothole"]
        flags = []
        if len(potholes) >= 2:
            flags.append("repeated_potholes")
        if s.waterlogging_reports:
            flags.append("waterlogging")
        if s.drainage_complaints:
            flags.append("drainage_complaints")
        if any(d["possible_recurrence"] for d in defects):
            flags.append("recurring_damage")
        if coverage in ("overdue", "never"):
            flags.append("inspection_overdue")

        return {
            "id": s.id, "road_code": s.road_code, "road_name": road.name if road else s.road_code,
            "road_class": road.road_class if road else "local", "index": s.index,
            "x1": s.x1, "z1": s.z1, "x2": s.x2, "z2": s.z2, "width": s.width,
            "length_m": _rnd(math.hypot(s.x2 - s.x1, s.z2 - s.z1) * METRES_PER_UNIT, 0),
            "rps": top["rps"] if top else None, "band": top["band"] if top else "none",
            "top_defect_id": top["id"] if top else None,
            "open_defects": len(active), "all_defects": len(defects),
            "coverage": coverage, "survey_tracked": s.survey_tracked,
            "last_inspected_on": last.isoformat() if last else None, "days_since_inspection": days_since,
            "inspection_count": len(insp),
            "repair_status": repair_status,
            "waterlogging_reports": s.waterlogging_reports, "drainage_complaints": s.drainage_complaints,
            "monsoon_flags": flags, "monsoon_watch": len(flags) >= C.MONSOON_MIN_FLAGS,
            "possible_recurrence": any(d["possible_recurrence"] for d in active),
            "source": s.source,
        }

    # ---------- metrics ----------
    def metrics(self) -> dict:
        defects = list(self.defect_rows.values())
        active = [d for d in defects if d["status"] != "repaired_verified"]
        segs = list(self.segment_rows.values())
        tracked = [s for s in segs if s["coverage"] != "unknown"]
        return {
            "total_defects": len(active),
            "critical_roads": sum(1 for s in segs if s["band"] == "critical"),
            "high_roads": sum(1 for s in segs if s["band"] == "high"),
            "recurring_damage": sum(1 for d in active if d["possible_recurrence"]),
            "inspected_sections": sum(1 for s in segs if s["coverage"] == "recent"),
            "tracked_sections": len(tracked),
            "total_sections": len(segs),
            "pending_repair_verification": sum(1 for r in self.repair_rows
                                               if r["status"] in ("submitted", "pending_verification")),
            # Unresolved reports split into mutually exclusive groups.
            "reports_total": len(defects),
            "reports_open": sum(1 for d in defects if d["status"] == "open"),
            "reports_awaiting_verification": sum(1 for d in defects if d["status"] == "repair_submitted"),
            "reports_repaired": sum(1 for d in defects if d["status"] == "repaired_verified"),
            "reports_by_band": dict(Counter(d["band"] for d in active)),
            "sections_by_band": dict(Counter(s["band"] for s in segs)),
            "sections_with_open_damage": sum(1 for s in segs if s["band"] != "none"),
            # Repairs split into mutually exclusive groups (sum = all repairs).
            "repairs_total": len(self.repair_rows),
            "repairs_awaiting": sum(1 for r in self.repair_rows if r["display_status"] in ("submitted", "pending_verification")),
            "repairs_reinspection": sum(1 for r in self.repair_rows if r["display_status"] == "reinspection_recommended"),
            "repairs_verified": sum(1 for r in self.repair_rows if r["display_status"] == "verified"),
            "inspected_pct": round(100 * sum(1 for s in segs if s["coverage"] == "recent") / len(segs), 1) if segs else 0.0,
            "sections_needing_inspection": sum(1 for s in segs if s["coverage"] in ("overdue", "never")),
            "dataset": ("live" if not any(d["source"] == "demo" for d in defects) and defects
                        else "mixed" if any(d["source"] == "live" for d in defects) else "demo"),
            "monsoon_watchlist": sum(1 for s in segs if s["monsoon_watch"]),
            "by_type": dict(Counter(d["type"] for d in active)),
            "by_band": dict(Counter(d["band"] for d in active)),
            "by_coverage": dict(Counter(s["coverage"] for s in segs)),
            "by_repair_status": dict(Counter(r["display_status"] for r in self.repair_rows)),
            "sources": dict(Counter(d["source"] for d in defects)),
        }

    def payload(self) -> dict:
        seed = load_seed()
        return {
            "meta": {
                "as_of": self.today.isoformat(),
                "generated_at": datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
                "city_name": seed["meta"]["city_name"],
                "metres_per_unit": METRES_PER_UNIT,
                "half_extent": seed["meta"]["half_extent"],
                "road_half_width": seed["meta"]["road_half_width"],
                "layout_source": "demo",
                "offline_snapshot": False,
            },
            "config": priority_config(),
            "blocks": seed["blocks"],
            "roads": [{"code": r.code, "name": r.name, "road_class": r.road_class} for r in self.roads.values()],
            "segments": list(self.segment_rows.values()),
            "context": [{"id": c.id, "kind": c.kind, "kind_label": CONTEXT_LABEL.get(c.kind, c.kind),
                         "name": c.name, "x": c.x, "z": c.z, "axis": c.axis, "source": c.source}
                        for c in self.context],
            "defects": list(self.defect_rows.values()),
            "inspections": [{"id": i.id, "segment_id": i.segment_id, "inspected_on": i.inspected_on.isoformat(),
                             "method": i.method, "notes": i.notes, "source": i.source} for i in self.inspections],
            "repairs": self.repair_rows,
            "metrics": self.metrics(),
        }


def priority_config() -> dict:
    return {
        "weights": C.RPS_WEIGHTS,
        "formula": "RPS = 0.35D + 0.20T + 0.20V + 0.15R + 0.10W",
        "bands": [{"name": n, "min": v} for n, v in C.PRIORITY_BANDS],
        "vulnerability_radius_m": C.VULNERABILITY_RADIUS_M,
        "recurrence_radius_m": C.RECURRENCE_RADIUS_M,
        "recent_inspection_days": C.RECENT_INSPECTION_DAYS,
        "monsoon_min_flags": C.MONSOON_MIN_FLAGS,
        "damage_type_weight": C.DAMAGE_TYPE_WEIGHT,
        "traffic_by_class": C.TRAFFIC_BY_CLASS,
        "vulnerability_weight": C.VULNERABILITY_WEIGHT,
        "note": "RPS ranks roads for inspection and repair. It is not an accident probability.",
    }
