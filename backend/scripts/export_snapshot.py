"""Write the offline demo snapshot used by the frontend when the API is unreachable.

The snapshot is the exact /api/city payload for the demo records, flagged
offline_snapshot=True so the UI labels it. Run from the backend folder:

    python -m scripts.export_snapshot
"""

import json
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))


def main() -> None:
    import os

    tmp = tempfile.mkdtemp()
    os.environ["ROADIQ_DATABASE_URL"] = f"sqlite:///{tmp}/snapshot.db"
    from app.analysis import CityModel
    from app.config import DEMO_IMAGE_DIR
    from app.db import Base, SessionLocal, engine
    from app.seed import seed_demo

    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_demo(db)
        payload = CityModel(db).payload()
    payload["meta"]["offline_snapshot"] = True

    public = ROOT / "frontend" / "public"
    (public / "static" / "demo").mkdir(parents=True, exist_ok=True)
    (public / "demo-snapshot.json").write_text(json.dumps(payload, indent=1), encoding="utf-8")
    for png in DEMO_IMAGE_DIR.glob("*.jpg"):
        shutil.copy2(png, public / "static" / "demo" / png.name)
    print(f"Wrote {public / 'demo-snapshot.json'} with {len(payload['defects'])} demo defects")


if __name__ == "__main__":
    main()
