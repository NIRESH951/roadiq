"""API connectivity check against a running backend."""
import json, sys, urllib.request, urllib.error
B = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
def get(path, method="GET"):
    req = urllib.request.Request(B + path, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.headers.get("content-type", ""), r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("content-type", ""), e.read()
checks = [
    ("/api/health", 200, lambda j: j["status"] == "ok" and j["database"] == "ok"),
    ("/api/city", 200, lambda j: len(j["segments"]) == 24 and j["metrics"]["total_defects"] > 0),
    ("/api/metrics", 200, lambda j: j["repairs_awaiting"] + j["repairs_reinspection"] + j["repairs_verified"] == j["repairs_total"]),
    ("/api/priority/config", 200, lambda j: abs(sum(j["weights"].values()) - 1) < 1e-9),
    ("/api/segments", 200, lambda j: len(j) == 24),
    ("/api/segments/HA-2", 200, lambda j: j["segment"]["band"] == "critical"),
    ("/api/segments/NOPE", 404, None),
    ("/api/defects", 200, lambda j: all("calculation" in d for d in j)),
    ("/api/defects?source=live", 200, lambda j: isinstance(j, list)),
    ("/api/defects/DEF-0002", 200, lambda j: j["possible_recurrence"] is True),
    ("/api/inspections", 200, lambda j: len(j) > 0),
    ("/api/repairs", 200, lambda j: len(j) == 5),
    ("/api/context", 200, lambda j: len(j) == 10),
    ("/api/detect/status", 200, lambda j: "configured" in j and "validation_metrics" in j),
    ("/api/unknown-endpoint", 404, None),
    ("/static/demo/DEF-0002.jpg", 200, None),
    ("/", 200, None),
    ("/docs", 200, None),
]
fails = 0
for path, code, test in checks:
    status, ctype, body = get(path)
    ok = status == code
    if ok and test:
        try: ok = bool(test(json.loads(body)))
        except Exception as e: ok = False
    print(("OK  " if ok else "FAIL"), status, path)
    fails += not ok
print("API checks failing:", fails)
