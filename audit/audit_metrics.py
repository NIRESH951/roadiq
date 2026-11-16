"""Independent audit: recompute dashboard numbers with raw SQL and compare with the API's metrics."""
import os, sys, sqlite3, tempfile, json
from datetime import date
ROOT = sys.argv[1]
tmp = tempfile.mkdtemp()
os.environ["ROADIQ_DATABASE_URL"] = f"sqlite:///{tmp}/a.db"
sys.path.insert(0, f"{ROOT}/backend")
from app.db import Base, engine, SessionLocal
from app.seed import seed_demo
from app.analysis import CityModel
Base.metadata.create_all(engine)
with SessionLocal() as db:
    seed_demo(db)
    m = CityModel(db)
    metrics = m.metrics()
    payload = m.payload()
con = sqlite3.connect(f"{tmp}/a.db")
q = lambda s: con.execute(s).fetchall()
issues = []
def check(name, api, raw):
    ok = api == raw
    print(f"{'OK ' if ok else 'BAD'} {name}: api={api} raw={raw}")
    if not ok: issues.append(name)

raw_total = q("select count(*) from defects")[0][0]
raw_verified = q("select count(distinct defect_id) from repairs where status='verified'")[0][0]
raw_submitted_only = q("select count(distinct defect_id) from repairs where defect_id not in (select defect_id from repairs where status='verified')")[0][0]
check("defect reports not verified-repaired", metrics["total_defects"], raw_total - raw_verified)
print("   of which awaiting repair verification:", raw_submitted_only, "| open (no repair):", raw_total - raw_verified - raw_submitted_only)
check("by_type sums to total", sum(metrics["by_type"].values()), metrics["total_defects"])
check("by_band sums to total", sum(metrics["by_band"].values()), metrics["total_defects"])
raw_unverified = q("select count(*) from repairs where status!='verified'")[0][0]
check("pending repair verification", metrics["pending_repair_verification"], raw_unverified)
check("repair display statuses sum to repairs", sum(metrics["by_repair_status"].values()), q("select count(*) from repairs")[0][0])
# sections
segs = payload["segments"]
check("total sections", metrics["total_sections"], q("select count(*) from road_segments")[0][0])
# recent inspections from SQL
recent = q("select count(distinct segment_id) from inspections where julianday(date('now')) - julianday(inspected_on) <= 30")[0][0]
check("recently inspected sections", metrics["inspected_sections"], recent)
# section bands = max active report rps
by_seg = {}
for d in payload["defects"]:
    if d["status"] != "repaired_verified":
        by_seg[d["segment_id"]] = max(by_seg.get(d["segment_id"], 0), d["rps"])
def band(v): return "critical" if v>=75 else "high" if v>=60 else "medium" if v>=40 else "low"
check("critical sections", metrics["critical_roads"], sum(1 for v in by_seg.values() if band(v)=="critical"))
check("high sections", metrics["high_roads"], sum(1 for v in by_seg.values() if band(v)=="high"))
rep_high = sum(1 for d in payload["defects"] if d["status"]!="repaired_verified" and d["band"]=="high")
rep_crit = sum(1 for d in payload["defects"] if d["status"]!="repaired_verified" and d["band"]=="critical")
print(f"   report-level: critical reports={rep_crit}, high reports={rep_high}  <- differs from section counts (expected, needs labels)")
for d in payload["defects"]:
    f = d["factors"]; r = 0.35*f["D"]+0.2*f["T"]+0.2*f["V"]+0.15*f["R"]+0.1*f["W"]
    if abs(r-d["rps"])>0.11: issues.append("rps "+d["id"]); print("BAD rps", d["id"], r, d["rps"])
print("RPS formula check done for", len(payload["defects"]), "reports")
print("ISSUES:", issues)
