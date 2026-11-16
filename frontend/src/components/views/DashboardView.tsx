import DamageDistribution from '../dashboard/DamageDistribution'
import { LAYER_MODES, Legend } from '../dashboard/LayerControlPanel'
import MetricCards from '../dashboard/MetricCards'
import RoadMap2D from '../dashboard/RoadMap2D'
import SelectedRoadPanel, { MonsoonCard } from '../dashboard/SelectedRoadPanel'
import { COVERAGE_COLOR, COVERAGE_LABEL, REPAIR_COLOR, REPAIR_LABEL } from '../../lib/colors'
import { formatDate } from '../../lib/timeline'
import { useRoadIQ } from '../../store/useRoadIQ'

export default function DashboardView({ webgl }: { webgl: boolean }) {
  const data = useRoadIQ((s) => s.data)!
  const mode = useRoadIQ((s) => s.layerMode)
  const setMode = useRoadIQ((s) => s.setLayerMode)
  const setView = useRoadIQ((s) => s.setView)
  const selectSegment = useRoadIQ((s) => s.selectSegment)
  const m = data.metrics
  const watch = data.segments.filter((s) => s.monsoon_watch)
  const pending = data.repairs.filter((r) => r.status !== 'verified')

  return (
    <div className="scroll-thin h-full overflow-y-auto p-3">
      <div className="mx-auto max-w-[1600px] space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2 px-1">
          <div>
            <h1 className="text-xl font-semibold text-white">Road intelligence overview</h1>
            <p className="text-xs text-slate-400">
              Detect the damage. Understand its impact. Prioritize the repair. · As of {formatDate(data.meta.as_of)} · {data.meta.city_name}
            </p>
          </div>
          {webgl && (
            <button type="button" onClick={() => setView('city')}
              className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110">
              Open the 3D City →
            </button>
          )}
        </div>
        <MetricCards />

        <div className="grid gap-3 xl:h-[660px] xl:grid-cols-[1fr_400px]">
          <section className="glass flex min-h-0 flex-col p-3" aria-label="City overview map">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="section-title">City overview · 2D</span>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Map layer">
                {LAYER_MODES.map((l) => (
                  <button key={l.key} type="button" role="radio" aria-checked={mode === l.key} onClick={() => setMode(l.key)}
                    className={`rounded-md px-2 py-1 text-[11px] ${mode === l.key ? 'bg-cyan-400/20 text-white ring-1 ring-cyan-400/40' : 'text-slate-400 hover:bg-slate-800'}`}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[1fr_200px]">
              <div className="aspect-square w-full md:aspect-auto md:h-[520px] xl:h-full"><RoadMap2D /></div>
              <div className="scroll-thin overflow-y-auto"><Legend mode={mode} /></div>
            </div>
          </section>
          <section className="glass h-[600px] min-h-0 overflow-hidden xl:h-full" aria-label="Priority queue and selected road"><SelectedRoadPanel /></section>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <section className="glass p-3">
            <span className="section-title">Unresolved reports by category</span>
            <DamageDistribution />
          </section>
          <section className="glass p-3">
            <span className="section-title">Inspection coverage · {m.total_sections} road sections</span>
            <ul className="mt-2 space-y-2">
              {(['recent', 'overdue', 'never', 'unknown'] as const).map((c) => {
                const n = m.by_coverage[c] ?? 0
                return (
                  <li key={c}>
                    <div className="flex justify-between text-xs"><span className="text-slate-300">{COVERAGE_LABEL[c]}</span>
                      <span className="tabular-nums text-white">{n} <span className="text-slate-400">({Math.round((n / m.total_sections) * 100)}%)</span></span></div>
                    <div className="bar-track mt-1"><div className="h-full rounded-full" style={{ width: `${(n / m.total_sections) * 100}%`, background: COVERAGE_COLOR[c] }} /></div>
                  </li>
                )
              })}
            </ul>
            <button type="button" onClick={() => setView('radar')} className="mt-3 text-xs text-cyan-300 hover:underline">Open Survey Gap Radar →</button>
          </section>
          <section className="glass p-3">
            <span className="section-title">Monsoon watchlist · {watch.length} sections</span>
            <ul className="mt-2 space-y-1">
              {watch.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => selectSegment(s.id)} className="w-full rounded-md px-1.5 py-1 text-left text-xs text-slate-200 hover:bg-slate-800/60">
                    {s.road_name} <span className="text-slate-400">{s.id}</span>
                    <span className="block text-[11.5px] text-slate-400">{s.monsoon_flags.length} flags</span>
                  </button>
                </li>
              ))}
            </ul>
            {watch[0] && <div className="mt-2"><MonsoonCard flags={watch[0].monsoon_flags} /></div>}
          </section>
          <section className="glass p-3">
            <span className="section-title">Repairs awaiting verification · {m.pending_repair_verification}</span>
            <ul className="mt-2 space-y-1.5">
              {pending.map((r) => (
                <li key={r.id} className="rounded-md border border-slate-700/50 px-2 py-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-100">{r.id} · {r.defect_id}</span><span className="text-slate-400">{formatDate(r.submitted_on)}</span></div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-slate-300">
                    <span className="h-2 w-2 rounded-full" style={{ background: REPAIR_COLOR[r.display_status] }} aria-hidden />{REPAIR_LABEL[r.display_status]}
                  </div>
                </li>
              ))}
              {!pending.length && <li className="text-xs text-slate-400">No repairs awaiting verification.</li>}
            </ul>
            <button type="button" onClick={() => setView('repairs')} className="mt-3 text-xs text-cyan-300 hover:underline">Open Repair Verification →</button>
          </section>
        </div>
      </div>
    </div>
  )
}
