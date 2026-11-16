import io
import os
import tempfile

import pytest

_tmp = tempfile.mkdtemp()
os.environ["ROADIQ_DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["ROADIQ_MODEL_PATH"] = f"{_tmp}/missing.pt"
os.environ["ROADIQ_UPLOAD_DIR"] = f"{_tmp}/uploads"

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app import config as C  # noqa: E402
from app.main import app  # noqa: E402
from app import main as main_module  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _city(client):
    r = client.get("/api/city")
    assert r.status_code == 200
    return r.json()


def test_city_payload_shape(client):
    data = _city(client)
    assert len(data["segments"]) == 24
    assert len(data["defects"]) == 17
    assert len(data["context"]) == 10
    assert all(d["source"] == "demo" for d in data["defects"])
    assert "not an accident probability" in data["config"]["note"]


def test_rps_matches_formula(client):
    for d in _city(client)["defects"]:
        f = d["factors"]
        expected = sum(C.RPS_WEIGHTS[k] * f[k] for k in "DTVRW")
        assert abs(expected - d["rps"]) < 0.3, d["id"]
        assert 0 <= d["rps"] <= 100


def test_priority_story(client):
    data = _city(client)
    by_id = {d["id"]: d for d in data["defects"]}
    segs = {s["id"]: s for s in data["segments"]}
    assert by_id["DEF-0002"]["band"] == "critical"
    assert by_id["DEF-0002"]["possible_recurrence"] is True
    assert by_id["DEF-0002"]["recurrence_of"] == ["DEF-0001"]
    assert any(n["kind"] == "hospital" for n in by_id["DEF-0002"]["nearby"])
    assert by_id["DEF-0004"]["band"] == "high"
    assert segs["HA-2"]["band"] == "critical"
    assert data["metrics"]["critical_roads"] == 1
    assert data["metrics"]["high_roads"] == 1
    # Model confidence and priority are separate numbers.
    assert by_id["DEF-0002"]["confidence"] < 1 and by_id["DEF-0002"]["rps"] > 1


def test_coverage_and_monsoon(client):
    segs = {s["id"]: s for s in _city(client)["segments"]}
    assert segs["HA-2"]["coverage"] == "recent"
    assert segs["LV-3"]["coverage"] == "overdue"
    assert segs["LV-1"]["coverage"] == "never"
    assert segs["LV-4"]["coverage"] == "unknown"
    assert segs["HA-2"]["monsoon_watch"] is True
    assert segs["LV-2"]["monsoon_watch"] is True
    assert segs["MG-2"]["monsoon_watch"] is False


def test_repair_wording_is_not_an_accusation(client):
    reps = {r["id"]: r for r in _city(client)["repairs"]}
    assert reps["REP-001"]["display_status"] == "reinspection_recommended"
    assert reps["REP-001"]["status"] == "pending_verification"
    assert reps["REP-002"]["display_status"] == "verified"


def test_detect_without_model_refuses(client):
    img = io.BytesIO()
    Image.new("RGB", (64, 64), (60, 60, 60)).save(img, "PNG")
    r = client.post("/api/detect", data={"segment_id": "MG-2"},
                    files={"image": ("road.png", img.getvalue(), "image/png")})
    assert r.status_code == 503
    assert "model" in r.json()["detail"].lower()


def test_detect_with_model_stores_live_records(client, monkeypatch):
    monkeypatch.setattr(main_module.detector, "status", lambda: {"configured": True, "message": "ok"})
    monkeypatch.setattr(main_module.detector, "predict", lambda path: [
        {"type": "pothole", "model_label": "D40", "confidence": 0.77, "bbox": [0.3, 0.4, 0.2, 0.15]}])
    img = io.BytesIO()
    Image.new("RGB", (64, 64), (60, 60, 60)).save(img, "PNG")
    r = client.post("/api/detect", data={"segment_id": "LV-1", "t": "0.5"},
                    files={"image": ("road.png", img.getvalue(), "image/png")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["detections"]) == 1
    det = body["detections"][0]
    assert det["source"] == "live" and det["type"] == "pothole" and det["confidence"] == 0.77
    # Original and annotated images are both stored and served.
    assert body["image_url"].endswith(".jpg") and body["annotated_image_url"].endswith("_annotated.jpg")
    assert client.get(body["image_url"]).status_code == 200
    assert client.get(body["annotated_image_url"]).status_code == 200
    assert det["annotated_image_url"] == body["annotated_image_url"]
    assert body["road_name"] == "Lake View Road" and body["position"] == 0.5
    assert 0 < det["visual_severity"] <= 1 and det["rps"] > 0
    segs = {s["id"]: s for s in _city(client)["segments"]}
    assert segs["LV-1"]["coverage"] == "recent"

    # Resetting demo data keeps live records.
    assert client.post("/api/admin/reset-demo").status_code == 200
    data = _city(client)
    assert any(d["source"] == "live" for d in data["defects"])
    assert sum(d["source"] == "demo" for d in data["defects"]) == 17


def test_repair_submit_and_verify(client):
    r = client.post("/api/repairs", data={"defect_id": "DEF-0014", "crew": "Test crew"})
    assert r.status_code == 200, r.text
    rep = r.json()
    assert rep["status"] == "pending_verification" and rep["source"] == "live"
    v = client.post(f"/api/repairs/{rep['id']}/verify")
    assert v.json()["status"] == "verified"
    defects = {d["id"]: d for d in _city(client)["defects"]}
    assert defects["DEF-0014"]["status"] == "repaired_verified"


# ---------------- added in the polish audit ----------------
from datetime import date, timedelta  # noqa: E402

from app.analysis import CityModel  # noqa: E402
from app.db import SessionLocal, ensure_columns, engine  # noqa: E402
from app.detector import DetectorError  # noqa: E402


def test_health_reports_real_state(client):
    h = client.get("/api/health").json()
    assert h["status"] == "ok" and h["database"] == "ok"
    assert h["records"]["demo"] >= 17
    assert h["dataset"] in ("demo", "mixed", "live")
    assert h["detector"]["configured"] is False  # no model file in tests: never shown as live


def test_metric_groups_are_consistent(client):
    m = client.get("/api/metrics").json()
    assert m["reports_open"] + m["reports_awaiting_verification"] == m["total_defects"]
    assert m["total_defects"] + m["reports_repaired"] == m["reports_total"]
    assert m["repairs_awaiting"] + m["repairs_reinspection"] + m["repairs_verified"] == m["repairs_total"]
    assert m["repairs_awaiting"] + m["repairs_reinspection"] == m["pending_repair_verification"]
    assert m["sections_by_band"].get("critical", 0) == m["critical_roads"]
    assert m["sections_by_band"].get("high", 0) == m["high_roads"]
    assert sum(m["reports_by_band"].values()) == m["total_defects"]
    assert m["inspected_pct"] == round(100 * m["inspected_sections"] / m["total_sections"], 1)


def test_explanations_match_the_score(client):
    for d in _city(client)["defects"]:
        assert set(d["factor_details"]) == set("DTVRW")
        assert d["calculation"].endswith(f"= {d['rps']:.1f}")


def test_coverage_boundary_is_30_days():
    with SessionLocal() as db:
        model = CityModel(db)
        seg = model.segment_rows["HA-3"]
        last = date.fromisoformat(seg["last_inspected_on"])
        assert CityModel(db, today=last + timedelta(days=30)).segment_rows["HA-3"]["coverage"] == "recent"
        assert CityModel(db, today=last + timedelta(days=31)).segment_rows["HA-3"]["coverage"] == "overdue"


def test_recurrence_only_within_radius(client):
    by_id = {d["id"]: d for d in _city(client)["defects"]}
    assert by_id["DEF-0002"]["recurrence_of"] == ["DEF-0001"]   # same spot after a repair
    assert by_id["DEF-0004"]["recurrence_of"] == []              # same road, 35 m away
    reps = {r["id"]: r for r in _city(client)["repairs"]}
    assert reps["REP-001"]["later_defects_nearby"] == ["DEF-0002"]


def test_model_failure_returns_503_not_fake_output(client, monkeypatch):
    monkeypatch.setattr(main_module.detector, "status", lambda: {"configured": True, "message": "ok"})

    def boom(path):
        raise DetectorError("corrupt weights")
    monkeypatch.setattr(main_module.detector, "predict", boom)
    img = io.BytesIO()
    Image.new("RGB", (64, 64)).save(img, "PNG")
    r = client.post("/api/detect", data={"segment_id": "MG-2"}, files={"image": ("r.png", img.getvalue(), "image/png")})
    assert r.status_code == 503 and "corrupt weights" in r.json()["detail"]


def test_duplicate_pending_repair_is_rejected(client):
    assert client.post("/api/repairs", data={"defect_id": "DEF-0001"}).status_code == 409


def test_unknown_api_path_is_404_not_html(client):
    r = client.get("/api/does-not-exist")
    assert r.status_code == 404


def test_old_database_is_upgraded_without_losing_rows(client):
    from sqlalchemy import text
    with engine.begin() as conn:
        before = conn.execute(text("select count(*) from defects")).scalar()
        conn.execute(text("ALTER TABLE defects DROP COLUMN annotated_image_url"))
    assert ensure_columns() == ["defects.annotated_image_url"]
    with engine.begin() as conn:
        assert conn.execute(text("select count(*) from defects")).scalar() == before
    assert client.get("/api/city").status_code == 200


def test_verify_accepts_defect_id_or_repair_id(client):
    r = client.post("/api/repairs", data={"defect_id": "DEF-0016"})
    assert r.status_code == 200, r.text
    v = client.post("/api/repairs/DEF-0016/verify")            # defect ID now works
    assert v.status_code == 200 and v.json()["status"] == "verified" and v.json()["defect_id"] == "DEF-0016"
    assert client.post("/api/repairs/DEF-0016/verify").status_code == 404   # nothing pending any more
    assert client.post("/api/repairs/REP-005/verify").json()["status"] == "verified"  # repair ID still works
    bad = client.post("/api/repairs/string/verify")
    assert bad.status_code == 404 and "DEF-0014" in bad.json()["detail"]
