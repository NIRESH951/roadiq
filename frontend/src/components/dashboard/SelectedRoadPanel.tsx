import { useMemo, useState, type ReactNode } from 'react'
import type { Defect } from '../../api/types'
import {
  BAND_COLOR, BAND_LABEL, CONTEXT_STYLE, COVERAGE_COLOR, COVERAGE_LABEL, MONSOON_FLAG_LABEL, REPAIR_COLOR, REPAIR_LABEL,
} from '../../lib/colors'
import { formatDate } from '../../lib/timeline'
import { useCityState, useRoadIQ, useSelectedDefect } from '../../store/useRoadIQ'
import DefectImage from './DefectImage'
import PriorityBreakdown from './PriorityBreakdown'
import RepairStatusPanel from './RepairStatusPanel'

const STATUS_LABEL: Record<string, string> = {
  open: 'Open, awaiting repair',
  repair_submitted: 'Repair submitted, awaiting verification',
  repaired_verified: 'Repaired and verified',
}

export function SourceBadge({ source }: { source: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold tracking-wide ${
      source === 'demo' ? 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40' : 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/40'
    }`}>
      {source === 'demo' ? 'DEMO RECORD' : 'LIVE RECORD'}
    </span>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-xs">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className="text-right text-slate-100">{children}</span>
    </div>
  )
}

export function MonsoonCard({ flags }: { flags: string[] }) {
  return (
    <div className="rounded-lg border border-sky-400/40 bg-sky-500/10 p-2.5">
      <p className="text-xs font-semibold text-sky-200">💧 Road section requires pre-monsoon inspection.</p>
      <ul className="mt-1 list-disc pl-4 text-[11px] text-sky-100/80">
        {flags.map((f) => <li key={f}>{MONSOON_FLAG_LABEL[f] ?? f}</li>)}
      </ul>
      <p className="mt-1 text-[11.5px] text-sky-100/60">An inspection-planning flag from recorded data, not a flood or damage prediction.</p>
    </div>
  )
}

function DefectDetail({ defect }: { defect: Defect }) {
  const data = useRoadIQ((s) => s.data)!
  const camera = useRoadIQ((s) => s.camera)
  const setCutaway = useRoadIQ((s) => s.setCutaway)
  const setDay = useRoadIQ((s) => s.setDay)
  const setTimelineOpen = useRoadIQ((s) => s.setTimelineOpen)
  const selectDefect = useRoadIQ((s) => s.selectDefect)
  const view = useRoadIQ((s) => s.view)
  const seg = data.segments.find((s) => s.id === defect.segment_id)
  const repairs = data.repairs.filter((r) => r.defect_id === defect.id)
  const sectionReports = data.defects.filter((d) => d.segment_id === defect.segment_id && d.status !== 'repaired_verified')
  const fromStart = seg ? Math.round(Math.hypot(defect.x - seg.x1, defect.z - seg.z1) * data.meta.metres_per_unit) : null
  const is3D = view !== 'map' && view !== 'dashboard'

  return (
    <div className="space-y-4 fade-in">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-white">{defect.id}</h2>
          <SourceBadge source={defect.source} />
        </div>
        <p className="text-sm text-slate-300">{defect.type_label} on {defect.road_name}</p>
      </div>

      {/* Two numbers that must never be confused */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-2.5">
          <div className="text-[11.5px] uppercase tracking-wide text-cyan-300">AI model confidence</div>
          <div className="text-2xl font-semibold tabular-nums text-white">{(defect.confidence * 100).toFixed(0)}%</div>
          <p className="text-[11.5px] leading-snug text-slate-400">How sure the detector is that this damage exists.</p>
        </div>
        <div className="rounded-lg border p-2.5" style={{ borderColor: `${BAND_COLOR[defect.band]}66`, background: `${BAND_COLOR[defect.band]}12` }}>
          <div className="text-[11.5px] uppercase tracking-wide" style={{ color: BAND_COLOR[defect.band] }}>Road Priority Score · this report</div>
          <div className="text-2xl font-semibold tabular-nums text-white">
            {defect.rps.toFixed(0)}<span className="ml-1.5 text-xs font-bold uppercase" style={{ color: BAND_COLOR[defect.band] }}>{BAND_LABEL[defect.band]}</span>
          </div>
          <p className="text-[11.5px] leading-snug text-slate-400">How urgently this road needs attention. Not an accident probability.</p>
        </div>
      </div>

      {seg && seg.rps !== null && (
        <p className="-mt-2 rounded-md border border-slate-700/60 bg-slate-900/40 px-2.5 py-1.5 text-xs text-slate-200">
          Section {seg.id} priority: <span className="font-semibold" style={{ color: BAND_COLOR[seg.band] }}>{seg.rps.toFixed(0)} · {BAND_LABEL[seg.band]}</span>
          <span className="text-slate-400"> (highest of {sectionReports.length} unresolved report{sectionReports.length === 1 ? '' : 's'} on this section)</span>
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {is3D && (
          <button type="button" onClick={() => camera({ kind: 'focus', target: [defect.x, defect.z] })}
            className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-100 hover:bg-cyan-400/20">
            ◎ Smart Focus
          </button>
        )}
        <button type="button" onClick={() => setCutaway(true)}
          className="rounded-md border border-slate-500/50 bg-slate-800/60 px-2.5 py-1 text-xs text-slate-100 hover:border-cyan-400/60">
          ▤ Illustrative cutaway
        </button>
        {(defect.recurrence_of.length > 0 || repairs.length > 0) && (
          <button type="button" onClick={() => { setTimelineOpen(true); setDay(null) }}
            className="rounded-md border border-orange-400/40 bg-orange-400/10 px-2.5 py-1 text-xs text-orange-100 hover:bg-orange-400/20">
            ⟲ Road Memory
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-700/40">
        <Row label="Damage category">{defect.type_label}</Row>
        <Row label="Visual severity">
          <span className="capitalize">{defect.severity_label}</span> <span className="text-slate-400">({(defect.visual_severity * 100).toFixed(0)}/100)</span>
        </Row>
        <Row label="Location">
          {defect.road_name}, section {defect.segment_id}
          {fromStart !== null && <span className="block text-slate-400">≈{fromStart} m from the section start</span>}
        </Row>
        <Row label="Detection date">{formatDate(defect.detected_on)}</Row>
        <Row label="Inspection status">
          {seg ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: COVERAGE_COLOR[seg.coverage] }} aria-hidden />
              {COVERAGE_LABEL[seg.coverage]}{seg.last_inspected_on ? ` · last ${formatDate(seg.last_inspected_on)}` : ''}
            </span>
          ) : '—'}
        </Row>
        <Row label="Record status">{STATUS_LABEL[defect.status] ?? defect.status}</Row>
        {defect.model_label && <Row label="Model label">{defect.model_label}</Row>}
      </div>
      <p className="-mt-2 text-[11.5px] text-slate-400">
        Visual severity is estimated from how much of the image the damage covers. A photo cannot measure depth.
      </p>

      {defect.possible_recurrence && (
        <div className="rounded-lg border border-orange-400/50 bg-orange-500/10 p-2.5 text-[11.5px] text-orange-100">
          ⚠ Possible recurring damage: a similar defect was recorded here before ({defect.recurrence_of.join(', ')}) and a repair had been
          submitted. Flagged for manual re-inspection. RoadIQ does not confirm a repair failure or assign responsibility.
        </div>
      )}

      <section>
        <span className="section-title">Why this road needs attention</span>
        <ul className="mt-1.5 space-y-1 text-xs text-slate-200">
          {defect.reasons.map((r) => (
            <li key={r} className="flex gap-2"><span className="text-cyan-400" aria-hidden>›</span>{r}</li>
          ))}
        </ul>
      </section>

      <PriorityBreakdown defect={defect} config={data.config} />

      <section>
        <span className="section-title">Nearby sensitive locations</span>
        {defect.nearby.length ? (
          <ul className="mt-1.5 space-y-1">
            {defect.nearby.map((n) => {
              const st = CONTEXT_STYLE[n.kind]
              return (
                <li key={n.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-2 text-slate-200">
                    <span className="grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold text-slate-950" style={{ background: st?.color }}>{st?.glyph}</span>
                    {n.name}
                  </span>
                  <span className="tabular-nums text-slate-400">{n.distance_m} m · +{n.points.toFixed(0)} V</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-1.5 text-xs text-slate-400">
            No recorded sensitive locations within {data.config.vulnerability_radius_m} m. Context data covers recorded locations only; this is not proof the area is safe.
          </p>
        )}
      </section>

      <section>
        <span className="section-title">{defect.source === 'demo' ? 'Annotated demo illustration' : 'Annotated photo'}</span>
        {defect.source === 'live' && defect.annotated_image_url ? (
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <DefectImage defect={defect} showBox={false} caption="Original photo" />
            <DefectImage defect={defect} url={defect.annotated_image_url} showBox={false} caption="Annotated by the model" />
          </div>
        ) : (
          <DefectImage defect={defect} className="mt-1.5"
            caption={defect.source === 'demo' ? 'Illustrative demo image; the box shows the stored detection region.' : 'Uploaded photo with the model’s stored bounding box.'} />
        )}
      </section>

      <section>
        <span className="section-title">Previous damage records on this section</span>
        {defect.previous_records.length ? (
          <ul className="mt-1.5 space-y-1">
            {defect.previous_records.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => selectDefect(p.id)}
                  className="flex w-full items-center justify-between rounded-md px-1.5 py-1 text-left text-xs hover:bg-slate-800/60">
                  <span className="text-slate-200">{p.id} · {p.type.replace('_', ' ')}</span>
                  <span className="text-slate-400">{formatDate(p.detected_on)} · {STATUS_LABEL[p.status]?.split(',')[0]}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-xs text-slate-400">No earlier damage recorded on this section.</p>
        )}
      </section>

      <section>
        <span className="section-title">Repair status</span>
        <div className="mt-1.5"><RepairStatusPanel repairs={repairs} /></div>
      </section>
    </div>
  )
}

function SegmentDetail({ segmentId }: { segmentId: string }) {
  const data = useRoadIQ((s) => s.data)!
  const camera = useRoadIQ((s) => s.camera)
  const view = useRoadIQ((s) => s.view)
  const state = useCityState()
  const selectDefect = useRoadIQ((s) => s.selectDefect)
  const seg = data.segments.find((s) => s.id === segmentId)
  const segAt = state?.segments.find((s) => s.id === segmentId)
  if (!seg || !segAt) return null
  const defects = data.defects.filter((d) => d.segment_id === seg.id).sort((a, b) => b.rps - a.rps)
  return (
    <div className="space-y-4 fade-in">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-white">{seg.road_name}</h2>
          <span className="rounded bg-slate-700/70 px-1.5 py-0.5 text-[11px] font-semibold text-slate-200">{seg.id}</span>
        </div>
        <p className="text-xs capitalize text-slate-300">{seg.road_class} road · {seg.length_m} m section</p>
        {view !== 'map' && view !== 'dashboard' && (
          <button type="button" onClick={() => camera({ kind: 'focus', target: [(seg.x1 + seg.x2) / 2, (seg.z1 + seg.z2) / 2] })}
            className="mt-2 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-100 hover:bg-cyan-400/20">◎ Focus camera on this section</button>
        )}
      </div>
      <div className="divide-y divide-slate-700/40">
        <Row label="Section priority (highest unresolved report)">
          {segAt.rpsAt !== null ? (
            <span style={{ color: BAND_COLOR[segAt.bandAt] }} className="font-semibold">{segAt.rpsAt.toFixed(0)} · {BAND_LABEL[segAt.bandAt]}</span>
          ) : <span className="text-slate-400">No open damage recorded</span>}
        </Row>
        <Row label="Inspection coverage">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: COVERAGE_COLOR[segAt.coverageAt] }} aria-hidden />
            {COVERAGE_LABEL[segAt.coverageAt]}
          </span>
        </Row>
        <Row label="Last inspected">{seg.last_inspected_on ? `${formatDate(seg.last_inspected_on)} (${seg.days_since_inspection} days ago)` : 'No inspection on record'}</Row>
        <Row label="Inspections on record">{seg.inspection_count}</Row>
        <Row label="Repair status">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: REPAIR_COLOR[segAt.repairAt] }} aria-hidden />
            {REPAIR_LABEL[segAt.repairAt]}
          </span>
        </Row>
        <Row label="Waterlogging / drainage reports">{seg.waterlogging_reports} / {seg.drainage_complaints}</Row>
      </div>
      {(segAt.coverageAt === 'never' || segAt.coverageAt === 'unknown') && (
        <p className="rounded-md border border-slate-600/60 bg-slate-800/40 p-2 text-[11px] text-slate-300">
          No damage shown here does not mean the road is safe: this section has {segAt.coverageAt === 'never' ? 'never been inspected' : 'no survey status on record'}.
        </p>
      )}
      {seg.monsoon_watch && <MonsoonCard flags={seg.monsoon_flags} />}
      <section>
        <span className="section-title">Damage records on this section</span>
        {defects.length ? (
          <ul className="mt-1.5 space-y-1">
            {defects.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => selectDefect(d.id, true)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-xs hover:border-cyan-400/30 hover:bg-slate-800/60">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: BAND_COLOR[d.band] }} aria-hidden />
                    <span className="text-slate-100">{d.id}</span>
                    <span className="text-slate-400">{d.type_label}</span>
                  </span>
                  <span className="tabular-nums text-slate-300">RPS {d.rps.toFixed(0)}{d.status === 'repaired_verified' ? ' · repaired' : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-1.5 text-xs text-slate-400">No damage records on this section.</p>}
      </section>
    </div>
  )
}

function PriorityQueue() {
  const data = useRoadIQ((s) => s.data)!
  const state = useCityState()
  const selectDefect = useRoadIQ((s) => s.selectDefect)
  const selectSegment = useRoadIQ((s) => s.selectSegment)
  const camera = useRoadIQ((s) => s.camera)
  const view = useRoadIQ((s) => s.view)
  const [mode, setMode] = useState<'sections' | 'reports'>('sections')
  const reports = useMemo(() => [...(state?.visibleDefects ?? [])].sort((a, b) => b.rps - a.rps), [state])
  const sections = useMemo(
    () => (state?.segments ?? []).filter((s) => s.rpsAt !== null).sort((a, b) => (b.rpsAt ?? 0) - (a.rpsAt ?? 0)),
    [state],
  )
  const asOf = state?.isToday ? 'today' : formatDate(new Date(state!.day * 86400000).toISOString().slice(0, 10))
  const in3D = view !== 'map' && view !== 'dashboard'

  return (
    <div className="space-y-3 fade-in">
      <div>
        <h2 className="text-base font-semibold text-white">Priority queue</h2>
        <p className="text-xs text-slate-300">
          {mode === 'sections'
            ? `Road sections ranked by section priority: the highest score among each section's unresolved reports (${asOf}).`
            : `Individual defect reports ranked by their own Road Priority Score (${asOf}).`}
        </p>
      </div>
      <div className="grid grid-cols-2 rounded-lg border border-slate-700 p-0.5 text-xs" role="radiogroup" aria-label="Rank by">
        {([['sections', `Road sections · ${sections.length}`], ['reports', `Defect reports · ${reports.length}`]] as const).map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)}
            className={`rounded-md px-2 py-1.5 ${mode === k ? 'bg-cyan-400/20 text-white' : 'text-slate-300 hover:text-white'}`}>{l}</button>
        ))}
      </div>
      {mode === 'sections' ? (
        <ol className="space-y-1">
          {sections.map((s, i) => (
            <li key={s.id}>
              <button type="button"
                onClick={() => { selectSegment(s.id); if (in3D) camera({ kind: 'focus', target: [(s.x1 + s.x2) / 2, (s.z1 + s.z2) / 2] }) }}
                className="flex w-full items-center gap-2.5 rounded-lg border border-slate-700/50 bg-slate-900/40 px-2.5 py-2 text-left hover:border-cyan-400/40">
                <span className="w-4 text-right text-xs tabular-nums text-slate-400">{i + 1}</span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: BAND_COLOR[s.bandAt] }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-slate-100">{s.road_name} <span className="text-slate-400">{s.id}</span></span>
                  <span className="block text-[11.5px] text-slate-400">
                    {s.activeDefects.length} unresolved report{s.activeDefects.length === 1 ? '' : 's'}{s.possible_recurrence ? ' · possible recurrence' : ''}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold tabular-nums text-white">{s.rpsAt!.toFixed(0)}</span>
                  <span className="block text-[11px] font-bold uppercase" style={{ color: BAND_COLOR[s.bandAt] }}>{BAND_LABEL[s.bandAt]}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="space-y-1">
          {reports.map((d, i) => (
            <li key={d.id}>
              <button type="button" onClick={() => selectDefect(d.id, in3D)}
                className="flex w-full items-center gap-2.5 rounded-lg border border-slate-700/50 bg-slate-900/40 px-2.5 py-2 text-left hover:border-cyan-400/40">
                <span className="w-4 text-right text-xs tabular-nums text-slate-400">{i + 1}</span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: BAND_COLOR[d.band] }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-slate-100">{d.type_label} · {d.road_name}</span>
                  <span className="block text-[11.5px] text-slate-400">
                    {d.id} · {d.segment_id}{d.possible_recurrence ? ' · possible recurrence' : ''}{d.statusAt === 'repair_submitted' ? ' · repair awaiting check' : ''}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold tabular-nums text-white">{d.rps.toFixed(0)}</span>
                  <span className="block text-[11px] font-bold uppercase" style={{ color: BAND_COLOR[d.band] }}>{BAND_LABEL[d.band]}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {!(mode === 'sections' ? sections : reports).length && <p className="text-xs text-slate-300">No unresolved damage on record for this date.</p>}
      <p className="text-[11.5px] text-slate-400">{data.config.note}</p>
    </div>
  )
}

export default function SelectedRoadPanel({ empty }: { empty?: ReactNode }) {
  const defect = useSelectedDefect()
  const segmentId = useRoadIQ((s) => s.selectedSegmentId)
  const selectDefect = useRoadIQ((s) => s.selectDefect)
  return (
    <div className="flex h-full flex-col">
      {(defect || segmentId) && (
        <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-2">
          <span className="section-title">{defect ? 'Selected defect' : 'Selected road section'}</span>
          <button type="button" onClick={() => selectDefect(null)} className="rounded px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Clear selection">
            ✕ Clear
          </button>
        </div>
      )}
      <div className="scroll-thin flex-1 overflow-y-auto px-4 py-3">
        {defect ? <DefectDetail defect={defect} /> : segmentId ? <SegmentDetail segmentId={segmentId} /> : empty ?? <PriorityQueue />}
      </div>
    </div>
  )
}
