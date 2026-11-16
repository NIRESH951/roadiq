# Deploying RoadIQ on Vercel

Pick one of two setups. Both are already configured in this repository.

| | **A. Static demo** (recommended for judging) | **B. Full stack on Vercel** |
| --- | --- | --- |
| What runs | The UI only, with the bundled demo snapshot | The UI plus the FastAPI backend as one Vercel Function |
| Vercel Root Directory | `frontend` | repository root (`./`) |
| Config used | `frontend/vercel.json` (`npm run build:static` → `dist-static`) | `pyproject.toml` + root `vercel.json` |
| Environment variables | none | none (Vercel sets `VERCEL=1`; RoadIQ then uses `/tmp`) |
| Header shows | Static preview · no backend | Backend connected |
| Uploads, repairs, reset | Disabled and labelled | Work, but **temporary**: stored in `/tmp`, cleared on cold starts, separate per instance |
| AI detector | No | No: PyTorch + YOLO are larger than Vercel's 500 MB Python function limit |

Either way every record is labelled DEMO, and the app never claims live data it does not have.

---

## Before you start

1. A Vercel account (free Hobby plan is enough).
2. Either:
   * **Git route:** the `roadiq` folder pushed to a GitHub repository, or
   * **CLI route:** Node 20+, then `npm i -g vercel` and `vercel login`.

If you push with Git, commit `frontend/dist` (the full-stack setup serves it as-is). `node_modules`, `dist-static`, the local database and uploads are already in `.gitignore`.

---

## A. Static demo (about 5 minutes)

### Git route
1. vercel.com → **Add New… → Project** → import your RoadIQ repository.
2. Next to **Root Directory**, click **Edit** and choose `frontend`.
3. Leave Framework, Build Command and Output Directory as detected (they come from `frontend/vercel.json`: Vite, `npm run build:static`, `dist-static`). Add no environment variables.
4. Click **Deploy**.

### CLI route
```bash
cd roadiq/frontend
vercel          # first run: create a new project, accept the detected settings → preview URL
vercel --prod   # production URL
```

### Check it
Open the URL. The header should read **Static preview · no backend** and **Demo dataset · fictional**. 3D City, Road Memory, Survey Gap Radar, Analytics and Present all work. Upload and repair buttons are disabled with an explanation.

---

## B. Full stack on Vercel (about 10 minutes)

### Git route
1. vercel.com → **Add New… → Project** → import the same repository (this creates a second project).
2. Leave **Root Directory** as the repository root. Vercel reads `pyproject.toml`, installs FastAPI, SQLAlchemy, python-multipart and Pillow, and loads `backend.app.main:app`.
3. Add no environment variables.
4. Click **Deploy**.

### CLI route
```bash
cd roadiq
vercel --prod
```

### Check it
* `https://<your-project>.vercel.app/api/health` returns `"status": "ok"` and `"dataset": "demo"`.
* The app at `/` shows **Backend connected** and **Demo dataset · fictional**.
* The first request after a quiet period can take a second or two while the instance seeds its demo database.

### What to expect
* Each function instance keeps its own SQLite database in `/tmp`. A repair you submit may disappear after a cold start or appear only on one instance. Use this setup for browsing, not for recording real data.
* After any UI change, run `cd frontend && npm run build` and commit `frontend/dist` before redeploying. (Option A builds on Vercel and does not need this.)

---

## Live AI detection

Vercel cannot run the YOLO detector in a standard Python function. For a live detection demo:

1. Run the backend where the model fits: the team laptop or a server with the trained `roadiq.pt` (see README, "The AI model"). It must be reachable over **HTTPS**, because browsers block an HTTPS page from calling an HTTP API.
2. On that backend set `ROADIQ_CORS_ORIGINS=https://<your-frontend>.vercel.app`.
3. Create a Vercel project with Root Directory `frontend`. In **Settings → Build and Deployment**, override the Build Command to `npm run build` and the Output Directory to `dist`. Then add the environment variable `VITE_API_BASE=https://<your-backend-host>`.
4. Redeploy. `VITE_` variables are baked in at build time, so every change needs a redeploy.

If the backend goes down during judging, the header switches to **Backend unavailable** and the app keeps working on its last loaded or bundled data.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Serverless Function has exceeded the unzipped maximum size" | Make sure `frontend/node_modules` was not uploaded (`.vercelignore` covers the CLI). Do not add `ultralytics` or `torch` to `pyproject.toml`. |
| Option A shows **Backend unavailable** instead of **Static preview** | The project is not using `frontend/vercel.json`. Check that Root Directory is `frontend` and that the Build Command is `npm run build:static`. |
| Option B shows the static preview label | `frontend/dist` was built with `build:static`. Run `npm run build` in `frontend`, commit `dist`, redeploy. |
| Demo data looks reset | Expected on Option B after a cold start. |
| 3D view blank on the projector laptop | Use **2D Map** in the header, or Settings → 3D quality → Low. |
