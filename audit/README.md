# Audit scripts

Used for the final hackathon audit. Run from the project root with the backend running on :8000.

| Script | What it checks |
| --- | --- |
| `python audit/audit_metrics.py .` | Recomputes every dashboard number with raw SQL and compares it with the API |
| `python audit/api_check.py` | Status codes and shapes of every API endpoint |
| `python audit/layout_probe.py` | Header overflow, clipped navigation and small text at phone, tablet, laptop and desktop sizes (needs Playwright + Chrome) |
| `python audit/status_check.py` | Backend status indicator through disconnect, reconnect and cold start (needs `npx vite preview` on :4173) |
