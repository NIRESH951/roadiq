import { COVERAGE_COLOR, COVERAGE_LABEL } from '../../lib/colors'
import type { Coverage } from '../../api/types'
import { useCityState, useRoadIQ } from '../../store/useRoadIQ'

const ORDER: Coverage[] = ['never', 'overdue', 'unknown', 'recent']

/** Survey Gap Radar list: which road sections need a new inspection first. */
export default function SurveyGapList() {
  const data = useRoadIQ((s) => s.data)!
  const state = useCityState()
  const selectSegment = useRoadIQ((s) => s.selectSegment)
  const camera = useRoadIQ((s) => s.camera)
  if (!state) return null
  const counts = ORDER.map((c) => ({ c, n: state.segments.filter((s) => s.coverageAt === c).length }))
  const gaps = state.segments
    .filter((s) => s.coverageAt !== 'recent')
    .sort((a, b) => ORDER.indexOf(a.coverageAt) - ORDER.indexOf(b.coverageAt) || (b.days_since_inspection ?? 999) - (a.days_since_inspection ?? 999))

  return (
    <div className="space-y-3 fade-in">
      <div>
        <h2 className="text-base font-semibold text-white">Survey Gap Radar</h2>
        <p className="text-xs text-slate-400">
          Sections not inspected in the last {data.config.recent_inspection_days} days. Missing information is never treated as proof that a road is safe.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {counts.map(({ c, n }) => (
          <div key={c} className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 text-[11.5px] text-slate-400">
              <span className="h-2 w-2 rounded-full" style={{ background: COVERAGE_COLOR[c] }} aria-hidden />{COVERAGE_LABEL[c]}
            </div>
            <div className="text-lg font-semibold tabular-nums text-white">{n}</div>
          </div>
        ))}
      </div>
      <span className="section-title">Inspect next</span>
      <ul className="space-y-1">
        {gaps.map((s) => (
          <li key={s.id}>
            <button type="button"
              onClick={() => { selectSegment(s.id); camera({ kind: 'focus', target: [(s.x1 + s.x2) / 2, (s.z1 + s.z2) / 2] }) }}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-700/50 bg-slate-900/40 px-2.5 py-1.5 text-left hover:border-cyan-400/40">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: COVERAGE_COLOR[s.coverageAt] }} aria-hidden />
                <span className="text-xs text-slate-100">{s.road_name} <span className="text-slate-400">{s.id}</span></span>
              </span>
              <span className="text-[11.5px] text-slate-400">
                {s.coverageAt === 'never' ? 'Never inspected' : s.coverageAt === 'unknown' ? 'No survey status' : `${s.days_since_inspection} days ago`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
