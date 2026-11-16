import { useMemo, useState } from 'react'
import { submitRepair, verifyRepair } from '../../api/client'
import type { RepairDisplayStatus } from '../../api/types'
import { REPAIR_COLOR, REPAIR_LABEL } from '../../lib/colors'
import { formatDate } from '../../lib/timeline'
import { useRoadIQ } from '../../store/useRoadIQ'
import DefectImage from '../dashboard/DefectImage'
import { SourceBadge } from '../dashboard/SelectedRoadPanel'
import { useStatus } from '../layout/StatusIndicators'

type Filter = 'all' | 'unverified' | 'reinspection_recommended' | 'verified'

const FLOW: { s: RepairDisplayStatus; t: string }[] = [
  { s: 'submitted', t: 'Crew submits repair with an after photo' },
  { s: 'pending_verification', t: 'Awaiting an inspector’s verification' },
  { s: 'reinspection_recommended', t: 'Similar damage seen again: re-inspect' },
  { s: 'verified', t: 'Inspector verifies the repair' },
]

export default function RepairView() {
  const data = useRoadIQ((s) => s.data)!
  const { canWrite } = useStatus()
  const offline = !canWrite
  const load = useRoadIQ((s) => s.load)
  const selectDefect = useRoadIQ((s) => s.selectDefect)
  const setView = useRoadIQ((s) => s.setView)
  const [filter, setFilter] = useState<Filter>('unverified')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [defectId, setDefectId] = useState('')
  const [crew, setCrew] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)

  const repairable = useMemo(
    () => data.defects.filter((d) => d.status === 'open').sort((a, b) => b.rps - a.rps),
    [data],
  )
  // Same definitions as the dashboard: "not yet verified" = every repair without a verification,
  // including the ones flagged for re-inspection.
  const match = (f: Filter, r: (typeof data.repairs)[number]) =>
    f === 'all' || (f === 'unverified' && r.status !== 'verified') || (f !== 'unverified' && r.display_status === f)
  const list = data.repairs
    .filter((r) => match(filter, r))
    .sort((a, b) => b.submitted_on.localeCompare(a.submitted_on))

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto p-3">
      <div className="mx-auto max-w-[1400px] space-y-3">
        <div className="px-1">
          <h1 className="text-xl font-semibold text-white">Repair Verification</h1>
          <p className="text-xs text-slate-400">
            Before-and-after evidence for each repair. RoadIQ flags possible recurrence for re-inspection; it never confirms a repair failure or blames a contractor.
          </p>
        </div>

        <ol className="grid gap-2 sm:grid-cols-4">
          {FLOW.map((f, i) => (
            <li key={f.s} className="glass px-3 py-2">
              <div className="flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: REPAIR_COLOR[f.s] }}>
                <span className="h-2 w-2 rounded-full" style={{ background: REPAIR_COLOR[f.s] }} aria-hidden />STAGE {i + 1}
              </div>
              <div className="text-xs font-semibold text-white">{REPAIR_LABEL[f.s]}</div>
              <div className="text-[11.5px] text-slate-400">{f.t}</div>
            </li>
          ))}
        </ol>

        {error && <p role="alert" className="rounded-md border border-red-400/40 bg-red-500/10 p-2 text-xs text-red-200">{error}</p>}

        <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
          <section className="glass p-4" aria-label="Repairs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="section-title">Repairs · {list.length}</span>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Filter repairs">
                {([['unverified', 'Not yet verified'], ['reinspection_recommended', 'Re-inspection recommended'], ['verified', 'Verified'], ['all', 'All']] as [Filter, string][]).map(([k, l]) => (
                  <button key={k} type="button" role="radio" aria-checked={filter === k} onClick={() => setFilter(k)}
                    className={`rounded-md px-2 py-1 text-xs ${filter === k ? 'bg-cyan-400/20 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                    {l} <span className="tabular-nums text-slate-400">{data.repairs.filter((r) => match(k, r)).length}</span>
                  </button>
                ))}
              </div>
            </div>
            <ul className="mt-3 space-y-3">
              {list.map((r) => {
                const d = data.defects.find((x) => x.id === r.defect_id)
                return (
                  <li key={r.id} className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">{r.id}</span>
                      <SourceBadge source={r.source} />
                      <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] text-slate-100" style={{ borderColor: REPAIR_COLOR[r.display_status] }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: REPAIR_COLOR[r.display_status] }} aria-hidden />{REPAIR_LABEL[r.display_status]}
                      </span>
                      <span className="ml-auto text-[11px] text-slate-400">
                        Submitted {formatDate(r.submitted_on)}{r.verified_on ? ` · verified ${formatDate(r.verified_on)}` : ''}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">
                      {d ? `${d.type_label} ${d.id} on ${d.road_name} (${d.segment_id})` : r.defect_id}{r.crew ? ` · ${r.crew}` : ''}
                    </p>
                    {r.display_status === 'reinspection_recommended' && (
                      <p className="mt-1.5 rounded-md border border-orange-400/40 bg-orange-500/10 px-2 py-1 text-[11px] text-orange-200">
                        Similar damage recorded nearby after submission ({r.later_defects_nearby.join(', ')}). Flagged for manual re-inspection; cause not determined.
                      </p>
                    )}
                    <div className="mt-2 grid grid-cols-2 gap-2 md:max-w-[640px]">
                      <DefectImage defect={d} url={r.before_image_url} caption="Before · at detection" />
                      <DefectImage url={r.after_image_url} caption="After · repair evidence" showBox={false} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {d && (
                        <button type="button" onClick={() => { selectDefect(d.id, true); setView('city') }}
                          className="rounded-md border border-slate-600 px-2.5 py-1 text-xs text-slate-200 hover:border-cyan-400/60">View in 3D city</button>
                      )}
                      {r.status !== 'verified' && (
                        <button type="button" disabled={offline || busy !== null} onClick={() => act(r.id, () => verifyRepair(r.id))}
                          title={offline ? 'Needs the backend' : undefined}
                          className="rounded-md border border-emerald-400/50 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-100 enabled:hover:bg-emerald-400/20 disabled:opacity-40">
                          {busy === r.id ? 'Saving…' : 'Mark verified after inspection'}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
              {!list.length && <li className="text-xs text-slate-400">No repairs match this filter.</li>}
            </ul>
          </section>

          <section className="glass h-fit space-y-3 p-4" aria-label="Submit a repair">
            <span className="section-title">Submit repair evidence</span>
            <label className="block">
              <span className="text-xs text-slate-300">Open defect</span>
              <select value={defectId} onChange={(e) => setDefectId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100">
                <option value="">Choose a defect…</option>
                {repairable.map((d) => <option key={d.id} value={d.id}>{d.id} · {d.type_label} · {d.road_name} (RPS {d.rps.toFixed(0)})</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">Crew or team (optional)</span>
              <input value={crew} onChange={(e) => setCrew(e.target.value)} placeholder="e.g. Ward 4 maintenance crew"
                className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100" />
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">After-repair photo (optional)</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1.5 file:text-cyan-100" />
            </label>
            <button type="button" disabled={!defectId || offline || busy !== null}
              onClick={() => act('submit', async () => { await submitRepair(defectId, crew, photo); setDefectId(''); setCrew(''); setPhoto(null) })}
              className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white enabled:hover:brightness-110 disabled:opacity-40">
              {busy === 'submit' ? 'Submitting…' : 'Submit for verification'}
            </button>
            {offline && <p className="text-xs text-amber-200">Submitting and verifying repairs needs the backend to be connected.</p>}
            <p className="text-[11.5px] text-slate-400">Submitted repairs are stored as live records with status “pending verification”.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
