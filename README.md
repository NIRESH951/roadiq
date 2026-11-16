# RoadIQ

**AI-Powered Road Intelligence & Safer Street Prioritization**
*Detect the damage. Understand its impact. Prioritize the repair.*

RoadIQ turns road-damage detections into a repair order a city can defend. A YOLO detector finds potholes and cracks; RoadIQ then scores every defect by its human impact, remembers each road's history, shows which roads nobody has inspected, and tracks repair evidence, all on an interactive 3D smart-city model with a 2D fallback.

> **Data honesty.** This repository ships with a *fictional demo city* and clearly labelled **demo records** (`source = "demo"`). Every screen marks demo vs live data. Live detections only come from a trained model you supply; RoadIQ never fabricates detections.

---

## What's inside

| Area | Feature |
| --- | --- |
| 3D City View | React Three Fiber city: textured roads, lane markings, instanced buildings, trees, street lights, traffic, schools, hospital, market, bus stops, zebra crossings. Orbit, pan, zoom, reset, top-down/perspective, Smart Focus |
| Damage visualization | Potholes and longitudinal, transverse and alligator cracks drawn on the road; priority pins (Low green, Medium yellow, High orange, Critical red with pulse); glowing selection ring; AI detection outline; hover tooltips |
| Human-impact priority | `RPS = 0.35D + 0.20T + 0.20V + 0.15R + 0.10W`, computed in the backend. Factor bars, plain-language reasons, and arcs from the defect to recorded schools, hospitals, bus stops and crossings within 150 m |
| Confidence vs priority | Shown as two separate numbers everywhere. RPS is a repair-ranking score, never an accident probability |
| Road Memory | Timeline slider and history replay. The city is rebuilt for any past date; earlier defect locations, repairs and possible recurrence are highlighted; earlier vs latest images side by side |
| Survey Gap Radar | Coverage layer: green recent, orange overdue, red never inspected, grey unknown. Missing data is never shown as safe |
| Monsoon watchlist | Sections with at least two of: repeated potholes, waterlogging, drainage complaints, recurring damage, overdue inspection. Card: "Road section requires pre-monsoon inspection." |
| Repair verification | Before/after evidence, submit repair, mark verified, re-inspection recommended when similar damage returns (never an accusation) |
| Road cutaway | Illustrative layered cross-section (asphalt, base course, sub-base, soil) with explode/collapse, rotate and layer descriptions, clearly labelled illustrative |
| Presentation mode | Seven full-screen scenes for judges with next/previous, progress, full screen, keyboard control, exit. All figures read from the loaded records |
| Dashboard, Analytics | Metric cards, 2D city map, priority queue, Recharts charts (category, priority band, coverage, detections per week, factor averages, confidence vs priority) |
| Fallbacks | 2D map when WebGL is missing (`?no3d` forces it), offline demo snapshot when the API is down, reduced-motion setting, low-quality 3D setting |

## Reading the numbers

RoadIQ counts two different things, and every label says which:

| Term | Meaning |
| --- | --- |
| **Defect report** | One detected defect (one box from the model, or one demo record). Each report has its own **Road Priority Score**. |
| **Road section** | A stretch of road between two junctions (24 in the demo city). A section's priority is the **highest score among its unresolved reports**. |
| **Unresolved** | Not yet repaired *and* verified: open reports plus reports whose repair is awaiting verification. |
| **Repairs awaiting verification** | Every repair without a verification, including those flagged for manual re-inspection. The Repair page splits them into mutually exclusive groups that add up to the total. |
| **Sections inspected** | Sections with an inspection in the last 30 days, out of all sections. "Unknown" sections have no survey status and are never counted as safe. |

The metric cards always show **today**; the Road Memory timeline changes only the map and the priority queue.

### Status indicators

The header shows what is really available, re-checked every 15 seconds:

* **Backend connected** / **Backend unavailable · cached demo data** (API down at start, bundled snapshot shown) / **Backend unavailable · last loaded data** (API stopped answering) / **Static preview · no backend**.
* **Demo dataset · fictional**, **Demo + N live reports**, or **Live data**.
* **Detector configured / loaded / not configured** when the backend is connected.

Uploads, repair actions and demo resets are disabled whenever the backend is not connected, and re-enable automatically when it returns.

## Deploying

See **[DEPLOY.md](DEPLOY.md)** for Vercel: a static demo (Root Directory `frontend`) or the full stack (repository root).

## Quick start

Requirements: Python 3.10+ and Node 20+.

### Option A: one server (fastest on demo day)

The backend serves the pre-built frontend from `frontend/dist`.

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

Open http://localhost:8000. The database (`backend/roadiq.db`) and demo records are created on first start.

### Option B: development (hot reload)

```bash
# terminal 1
cd backend && uvicorn app.main:app --reload --port 8000

# terminal 2
cd frontend
npm install
npm run dev        # http://localhost:5173, proxies /api, /static and /uploads to :8000
```

Rebuild the frontend that Option A serves with `npm run build`.

### Useful URLs

| URL | What |
| --- | --- |
| `/#/city` | 3D City View (default) |
| `/#/dashboard` | 2D dashboard (no WebGL needed) |
| `/#/memory`, `/#/radar`, `/#/repairs`, `/#/detection`, `/#/analytics`, `/#/settings` | Other views |
| `/?no3d=1` | Force the 2D fallback to test it |
| `/docs` | FastAPI interactive API docs |

## The AI model

The detector is optional and pluggable. Without it, `/api/detect` returns **503 "model not configured"** and the UI says so.

1. Train a YOLO model on **RDD2022** (classes D00 longitudinal crack, D10 transverse crack, D20 alligator crack, D40 pothole). Example on a Colab GPU:
   ```bash
   pip install ultralytics
   yolo detect train data=rdd_india.yaml model=yolo11n.pt imgsz=640 epochs=40
   ```
2. Copy `runs/detect/train/weights/best.pt` to `backend/models/roadiq.pt` (or set `ROADIQ_MODEL_PATH`).
3. `pip install -r backend/requirements-ml.txt` and restart the backend.
4. Open **AI Detection**, upload a photo, choose the road section and position, and run detection. The result shows the **original photo**, the **annotated photo** (boxes drawn by the backend), and for each box the class, model confidence, visual severity, location and Road Priority Score. Results are stored as `source = "live"` and appear in the 3D city, the priority queue and the charts.
5. Optional: copy the numbers your training run printed (e.g. `{"mAP50": 0.61, "mAP50-95": 0.32, "subset": "RDD2022 India"}`) into `backend/models/roadiq.metrics.json`. The AI Detection page shows them as "reported by your training run". RoadIQ never computes or invents model accuracy.

Uploads are re-saved as upright JPEGs without metadata (EXIF rotation applied, GPS removed), so the model, the annotated copy and the browser see the same pixels. If the model fails to load or run, the API answers 503 with the reason; it never returns partial or made-up detections.

Class names `D00/D10/D20/D40` and plain names (`pothole`, `alligator crack`, …) are mapped automatically (`backend/app/detector.py`). Other classes are ignored. Optional: `ROADIQ_MODEL_CONFIDENCE` (default 0.25).

**Visual severity for live detections** is a heuristic from the share of the image the box covers. It is not a depth or structural measurement.

## Data and the demo seed

* `shared/demo_city.json` is the single source of demo data: road layout, sections, context locations, defects, repairs and extra inspections. Dates are stored as *days before seeding*, so coverage stays meaningful.
* Seeding writes rows with `source = "demo"` and draws labelled demo illustrations (`backend/static/demo/*.jpg`, each stamped "DEMO ILLUSTRATION · not a real photograph").
* **Reset demo records** in Settings (or `POST /api/admin/reset-demo`) recreates demo rows and never touches live rows.
* `python -m scripts.export_snapshot` (from `backend/`) regenerates `frontend/public/demo-snapshot.json`, the offline snapshot the UI uses when the API is unreachable.

To use your own city, replace the layout and records in `shared/demo_city.json` (or insert `source = "live"` rows), delete `backend/roadiq.db`, and restart.

## Priority score

```
RPS = 0.35·D + 0.20·T + 0.20·V + 0.15·R + 0.10·W      (each factor 0–100)
```

| Factor | Computed from (`backend/app/analysis.py`, weights in `backend/app/config.py`) |
| --- | --- |
| D Damage | 100 × visual severity × type weight (pothole 1.0, alligator 0.85, transverse 0.6, longitudinal 0.5) |
| T Traffic | Road class: arterial 90, collector 60, local 30 |
| V Vulnerability | Recorded schools and hospitals (50), bus stops and crossings (30), markets (20) within 150 m, decaying linearly with distance, capped at 100 |
| R Recurrence | Earlier damage within 10 m on the same section: 1 → 50, 2 → 75, 3+ → 100; +20 when a repair had been submitted before it reappeared |
| W Weather | 25 per waterlogging report + 15 per drainage complaint, capped at 100 |

Bands: Critical ≥ 75, High ≥ 60, Medium ≥ 40, Low < 40. A section's priority is its highest open defect. All weights are policy choices meant to be tuned.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/city` | Everything the UI needs (segments, defects with RPS, context, inspections, repairs, metrics, config) |
| GET | `/api/metrics`, `/api/priority/config` | Headline numbers; formula and thresholds |
| GET | `/api/segments`, `/api/segments/{id}` | Road sections with coverage, repair and monsoon status |
| GET | `/api/defects?source=live`, `/api/defects/{id}` | Defects with factors, reasons, nearby locations, history |
| GET | `/api/inspections`, `/api/repairs`, `/api/context` | Raw lists |
| GET | `/api/detect/status` | Whether a trained model is configured |
| POST | `/api/detect` | Multipart `image`, `segment_id`, `t`, `lane` → live detections |
| POST | `/api/repairs` | Multipart `defect_id`, `crew`, optional `image` → repair pending verification |
| POST | `/api/repairs/{id}/verify` | Mark a repair verified |
| POST | `/api/admin/reset-demo` | Recreate demo records |

## Project structure

```
backend/
  app/            main.py (API) · analysis.py (RPS, coverage, monsoon, metrics) · seed.py · detector.py
                  models.py · db.py · config.py · images.py (demo illustrations)
  scripts/        export_snapshot.py
  tests/          test_api.py
shared/demo_city.json
frontend/src/
  api/            client.ts, types.ts
  store/          useRoadIQ.ts (zustand)
  lib/            timeline.ts (Road Memory reconstruction), colors.ts, segments.ts, webgl.ts
  components/3d/  RoadIQCityScene, SmartCityModel, RoadSegment3D, Building3D, Vehicle3D, DamageMarker3D,
                  ContextMarker3D, PriorityHeatmap3D, ImpactConnections3D, RoadMemoryTimeline3D,
                  SurveyCoverage3D, RoadCutaway3D, CityCameraControls, SceneLoading
  components/dashboard/  MetricCards, PriorityBreakdown, SelectedRoadPanel, DamageDistribution,
                  RepairStatusPanel, RoadHistoryPanel, LayerControlPanel, RoadMap2D, SurveyGapList, CutawayModal
  components/presentation/  PresentationMode, PresentationScene, PresentationControls, scenes.ts
  components/views/  Dashboard, City, Detection, Repair, Analytics, Settings
```

## Performance notes

* 3D code is lazy-loaded; the 2D dashboard works without loading three.js.
* Buildings, trees, street lights, lane dashes and cars are `InstancedMesh` (a handful of draw calls); textures are small procedural canvases created once and shared.
* One shadow-casting light with a 1024 px map; **Low quality** turns off shadows and antialiasing, caps pixel ratio at 1 and draws fewer trees, lights and cars.
* Reduced motion stops pulses, traffic, auto-orbit and animated camera moves.
* Frame rate was not measured on real GPU hardware. Test on the presentation laptop and use Low quality if needed.

## Tests and build

```bash
cd backend && pip install -r requirements-dev.txt && pytest -q   # 17 tests
cd frontend && npm test                                          # 8 Road Memory / coverage tests (Node 22+)
cd frontend && npm run build
```

Backend tests cover the payload, the RPS formula and its written explanation, section vs report priority, metric groups adding up, the 30-day coverage boundary, the 10 m recurrence radius, non-accusatory repair wording, health status, detection refusal without a model, model failure returning 503, the upload → annotated image → live record path (with a stand-in detector), duplicate repair rejection, unknown API paths returning 404, and upgrading an older database in place without losing rows. Frontend tests check that the client-side Road Memory reconstruction matches the API for today and hides or changes records correctly on past dates.

## Known limitations

* The city layout and all seeded records are fictional demonstration data. Context locations exist only where recorded; there is no OpenStreetMap import yet.
* The trained-model path was tested with a stand-in detector, not with real weights. No model accuracy figures are shown unless you provide them.
* No geographic (Leaflet) map: the demo city has no real coordinates. Segments have `latitude`/`longitude` columns ready for real data.
* No authentication; admin and repair endpoints are open. Add auth before any real deployment.
* Uploaded photos have GPS and other metadata removed, but faces and number plates are not blurred.
