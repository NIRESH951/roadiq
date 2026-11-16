import { useEffect, useMemo, useState } from 'react'
import { assetUrl, getDetectorStatus, runDetection, type DetectResponse } from '../../api/client'
import type { DetectorStatus } from '../../api/types'
import { BAND_COLOR, BAND_LABEL } from '../../lib/colors'
import { formatDate } from '../../lib/timeline'
import { useRoadIQ } from '../../store/useRoadIQ'
import DefectImage from '../dashboard/DefectImage'
import { SourceBadge } from '../dashboard/SelectedRoadPanel'
import { useStatus } from '../layout/StatusIndicators'

const STEPS = [
  { t: 'Road photo', d: 'Phone or vehicle camera image of a road section' },
  { t: 'YOLO detector', d: 'Trained on RDD2022: D00, D10, D20, D40' },
  { t: 'Boxes + confidence', d: 'Damage category and model confidence per box' },
  { t: 'Stored as live records', d: 'Linked to the road section you choose' },
  { t: 'Priority scoring', d: 'RPS from damage, traffic, vulnerability, recurrence, weather' },
]

export default function DetectionView() {
  const data = useRoadIQ((s) => s.data)!
  const { canWrite } = useStatus()
  const offline = !canWrite
  const load = useRoadIQ((s) => s.load)
  const setView = useRoadIQ((s) => s.setView)
  const selectDefect = useRoadIQ((s) => s.selectDefect)
  const [status, setStatus] = useState<DetectorStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [segmentId, setSegmentId] = useState(data.segments[0]?.id ?? '')
  const [t, setT] = useState(0.5)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DetectResponse | null>(null)
  const [filter, setFilter] = useState<'all' | 'live' | 'demo'>('all')

  useEffect(() => {
    if (offline) return
    getDetectorStatus().then((s) => { setStatus(s); setStatusError(null) }).catch((e: Error) => setStatusError(e.message))
  }, [offline])

  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const records = useMemo(
    () => data.defects.filter((d) => filter === 'all' || d.source === filter).sort((a, b) => b.detected_on.localeCompare(a.detected_on)),
    [data, filter],
  )

  const submit = async () => {
    if (!file || !segmentId) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await runDetection(file, segmentId, t, 0)
      setResult(res)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const ready = !offline && status?.configured

  return (
    <div className="scroll-thin h-full overflow-y-auto p-3">
      <div className="mx-auto max-w-[1400px] space-y-3">
        <div className="px-1">
          <h1 className="text-xl font-semibold text-white">AI Detection</h1>
          <p className="text-xs text-slate-400">Upload a real road photo. Detections come only from the trained model; RoadIQ never fabricates results.</p>
        </div>

        <ol className="grid gap-2 sm:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.t} className="glass relative px-3 py-2">
              <span className="text-[11px] font-semibold text-cyan-400">STEP {i + 1}</span>
              <div className="text-xs font-semibold text-white">{s.t}</div>
              <div className="text-[11.5px] text-slate-400">{s.d}</div>
            </li>
          ))}
        </ol>

        <div className="grid gap-3 lg:grid-cols-[420px_1fr]">
          <section className="glass space-y-3 p-4" aria-label="Upload a photo">
            <div className={`rounded-lg border p-2.5 text-xs ${ready ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100' : 'border-amber-400/40 bg-amber-400/10 text-amber-100'}`}>
              <div className="font-semibold">{offline ? 'Backend unavailable' : status ? (status.configured ? (status.loaded ? 'Detector loaded' : 'Detector configured') : 'Detector not configured') : statusError ? 'Status unavailable' : 'Checking detector…'}</div>
              <p className="mt-0.5 text-xs opacity-90">
                {offline ? 'Live detection needs the FastAPI backend. Start it; this page reconnects automatically.' : status?.message ?? statusError ?? ''}
              </p>
              {status && <p className="mt-1 break-all text-[11px] opacity-80">Model path: {status.model_path}</p>}
              {status && (
                <div className="mt-2 border-t border-current/20 pt-2 text-[11px]">
                  <span className="font-semibold">Validation metrics: </span>
                  {status.validation_metrics ? (
                    <span>
                      {Object.entries(status.validation_metrics).map(([k, v]) => `${k} ${typeof v === 'number' ? v.toFixed(3) : String(v)}`).join(' · ')}
                      <span className="block opacity-80">Reported by your training run (models/roadiq.metrics.json); RoadIQ does not compute these.</span>
                    </span>
                  ) : (
                    <span>none recorded. RoadIQ does not estimate model accuracy; add your training run's numbers in models/roadiq.metrics.json.</span>
                  )}
                </div>
              )}
            </div>

            <label className="block">
              <span className="text-xs text-slate-300">Road photo (JPG, PNG or WebP)</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1.5 file:text-cyan-100" />
            </label>
            {preview && <img src={preview} alt="Selected road photo preview" className="max-h-48 w-full rounded-lg border border-slate-700 object-contain" />}

            <label className="block">
              <span className="text-xs text-slate-300">Road section where the photo was taken</span>
              <select value={segmentId} onChange={(e) => setSegmentId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100">
                {data.segments.map((s) => <option key={s.id} value={s.id}>{s.road_name} · {s.id}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">Position along the section: {(t * 100).toFixed(0)}%</span>
              <input type="range" min={0.02} max={0.98} step={0.01} value={t} onChange={(e) => setT(Number(e.target.value))} className="timeline-range mt-1 w-full" />
            </label>
            <button type="button" onClick={submit} disabled={!file || busy || !ready}
              className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white enabled:hover:brightness-110 disabled:opacity-40">
              {busy ? 'Running detection…' : 'Run detection'}
            </button>
            {!ready && !offline && <p className="text-[11px] text-slate-400">See the README section "AI model" to train on RDD2022 and enable this button.</p>}
            {error && <p role="alert" className="rounded-md border border-red-400/40 bg-red-500/10 p-2 text-xs text-red-200">{error}</p>}
          </section>

          <section className="glass p-4" aria-label="Detection result">
            <span className="section-title">Latest result</span>
            {result ? (
              <div className="mt-2 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <figure>
                    <img src={assetUrl(result.image_url) ?? ''} alt="Original uploaded road photo" className="block w-full rounded-lg border border-slate-700 bg-black" />
                    <figcaption className="mt-1 text-xs text-slate-300">Original photo</figcaption>
                  </figure>
                  <figure>
                    <img src={assetUrl(result.annotated_image_url) ?? ''} alt="Photo annotated with the model's bounding boxes" className="block w-full rounded-lg border border-cyan-400/40 bg-black" />
                    <figcaption className="mt-1 text-xs text-slate-300">Annotated by the model: boxes, class and confidence drawn by the backend</figcaption>
                  </figure>
                </div>
                <p className="text-sm text-slate-200">{result.message} Stored as LIVE records on {result.road_name} ({result.segment_id}), {Math.round(result.position * 100)}% along the section.</p>
                {result.detections.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-xs">
                      <thead className="text-slate-300">
                        <tr className="border-b border-slate-700">
                          <th className="py-1.5 pr-3 font-semibold">Record</th>
                          <th className="py-1.5 pr-3 font-semibold">Defect class</th>
                          <th className="py-1.5 pr-3 font-semibold">AI model confidence</th>
                          <th className="py-1.5 pr-3 font-semibold">Visual severity</th>
                          <th className="py-1.5 pr-3 font-semibold">Location</th>
                          <th className="py-1.5 pr-3 font-semibold">Report RPS</th>
                          <th className="py-1.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {result.detections.map((d) => (
                          <tr key={d.id} className="border-b border-slate-800 text-slate-100">
                            <td className="py-2 pr-3">{d.id} <SourceBadge source={d.source} /></td>
                            <td className="py-2 pr-3">{d.type_label}<span className="block text-slate-400">model label {d.model_label}</span></td>
                            <td className="py-2 pr-3 tabular-nums text-cyan-200">{(d.confidence * 100).toFixed(0)}%</td>
                            <td className="py-2 pr-3"><span className="capitalize">{d.severity_label}</span> ({(d.visual_severity * 100).toFixed(0)}/100)<span className="block text-slate-400">from box size, not depth</span></td>
                            <td className="py-2 pr-3">{d.road_name}<span className="block text-slate-400">{d.segment_id} · {Math.round(d.t * 100)}% along</span></td>
                            <td className="py-2 pr-3 font-semibold tabular-nums" style={{ color: BAND_COLOR[d.band] }}>{d.rps.toFixed(0)} · {BAND_LABEL[d.band]}</td>
                            <td className="py-2">
                              <button type="button" onClick={() => { selectDefect(d.id, true); setView('city') }}
                                className="whitespace-nowrap rounded-md border border-cyan-400/40 px-2 py-1 text-cyan-100 hover:bg-cyan-400/10">Explain in 3D →</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">No photo processed in this session yet.</p>
            )}
          </section>
        </div>

        <section className="glass p-4" aria-label="Detection records">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="section-title">Defect reports on record · {records.length}
              <span className="ml-2 normal-case tracking-normal text-slate-400">({data.metrics.reports_repaired} already repaired and verified)</span>
            </span>
            <div className="flex gap-1" role="radiogroup" aria-label="Record source">
              {(['all', 'live', 'demo'] as const).map((f) => (
                <button key={f} type="button" role="radio" aria-checked={filter === f} onClick={() => setFilter(f)}
                  className={`rounded-md px-2 py-1 text-[11px] capitalize ${filter === f ? 'bg-cyan-400/20 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{f}</button>
              ))}
            </div>
          </div>
          {!records.length && <p className="mt-2 text-xs text-slate-400">No {filter} records yet.</p>}
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {records.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => { selectDefect(d.id, true); setView('city') }}
                  className="w-full rounded-lg border border-slate-700/60 bg-slate-900/40 p-2 text-left hover:border-cyan-400/50">
                  <DefectImage defect={d} />
                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{d.id}</span>
                    <span className="text-slate-400">{formatDate(d.detected_on)}</span>
                  </div>
                  <div className="text-[11px] text-slate-300">{d.type_label} · {d.road_name}</div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-cyan-200">Confidence {(d.confidence * 100).toFixed(0)}%</span>
                    <span style={{ color: BAND_COLOR[d.band] }}>RPS {d.rps.toFixed(0)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
