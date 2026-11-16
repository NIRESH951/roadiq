"""Central configuration for RoadIQ scoring and thresholds.

Every weight here is a policy choice, not a scientific constant. City engineers
are expected to tune these values; the formula stays transparent.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BASE_DIR.parent
SEED_FILE = (BASE_DIR / "shared" / "demo_city.json") if (BASE_DIR / "shared" / "demo_city.json").is_file() else (PROJECT_DIR / "shared" / "demo_city.json")
STATIC_DIR = BASE_DIR / "static"
DEMO_IMAGE_DIR = STATIC_DIR / "demo"
# On Vercel (VERCEL=1) the project files are read-only and only /tmp is writable, so the demo database and
# uploads live there. /tmp is per instance and is cleared on cold starts: demo data is re-seeded automatically,
# but anything written at runtime (live uploads, repair submissions) is temporary.
ON_VERCEL = os.getenv("VERCEL") == "1"
_WRITABLE = Path("/tmp/roadiq") if ON_VERCEL else BASE_DIR
UPLOAD_DIR = Path(os.getenv("ROADIQ_UPLOAD_DIR", str(_WRITABLE / "uploads")))
DATABASE_URL = os.getenv("ROADIQ_DATABASE_URL", f"sqlite:///{_WRITABLE / 'roadiq.db'}")

# Browsers allowed to call the API from another origin (comma-separated), e.g. a separately hosted frontend.
CORS_ORIGINS = [o.strip() for o in os.getenv(
    "ROADIQ_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173").split(",") if o.strip()]

# Road Priority Score: RPS = 0.35D + 0.20T + 0.20V + 0.15R + 0.10W
RPS_WEIGHTS = {"D": 0.35, "T": 0.20, "V": 0.20, "R": 0.15, "W": 0.10}

# Priority bands (inclusive lower bound).
PRIORITY_BANDS = [("critical", 75.0), ("high", 60.0), ("medium", 40.0), ("low", 0.0)]

# D: how much each damage category contributes per unit of visual severity.
DAMAGE_TYPE_WEIGHT = {
    "pothole": 1.0,
    "alligator_crack": 0.85,
    "transverse_crack": 0.6,
    "longitudinal_crack": 0.5,
}

# T: traffic exposure by road class (replace with traffic counts when available).
TRAFFIC_BY_CLASS = {"arterial": 90.0, "collector": 60.0, "local": 30.0}

# V: sensitive locations near the defect. Weight decays linearly to zero at the radius.
VULNERABILITY_WEIGHT = {
    "school": 50.0,
    "hospital": 50.0,
    "bus_stop": 30.0,
    "pedestrian_crossing": 30.0,
    "market": 20.0,
}
VULNERABILITY_RADIUS_M = 150.0

# R: earlier damage recorded within this distance of the same spot.
RECURRENCE_RADIUS_M = 10.0
RECURRENCE_BY_COUNT = {0: 0.0, 1: 50.0, 2: 75.0}
RECURRENCE_MAX = 100.0
RECURRENCE_AFTER_REPAIR_BONUS = 20.0

# W: weather and waterlogging context from recorded reports.
WATERLOGGING_POINTS = 25.0
DRAINAGE_POINTS = 15.0

# Survey coverage: an inspection newer than this is "recent".
RECENT_INSPECTION_DAYS = 30

# Monsoon watchlist: a section is listed when at least this many flags apply.
MONSOON_MIN_FLAGS = 2

# Detection model (optional). Set ROADIQ_MODEL_PATH to a YOLO .pt file.
MODEL_PATH = os.getenv("ROADIQ_MODEL_PATH", str(BASE_DIR / "models" / "roadiq.pt"))
MODEL_CONFIDENCE = float(os.getenv("ROADIQ_MODEL_CONFIDENCE", "0.25"))
