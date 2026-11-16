import type { Repair } from '../../api/types'
import { REPAIR_COLOR, REPAIR_LABEL } from '../../lib/colors'
import { formatDate } from '../../lib/timeline'
import DefectImage from './DefectImage'

export default function RepairStatusPanel({ repairs, showImages = true }: { repairs: Repair[]; showImages?: boolean }) {
  if (!repairs.length) {
    return <p className="text-xs text-slate-400">No repair has been submitted for this record.</p>
  }
  return (
    <ul className="space-y-3">
      {repairs.map((r) => (
        <li key={r.id} className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-white">{r.id}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] text-slate-100"
              style={{ borderColor: REPAIR_COLOR[r.display_status] }}>
              <span className="h-2 w-2 rounded-full" style={{ background: REPAIR_COLOR[r.display_status] }} aria-hidden />
              {REPAIR_LABEL[r.display_status]}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Submitted {formatDate(r.submitted_on)}{r.crew ? ` by ${r.crew}` : ''}
            {r.verified_on ? ` · verified ${formatDate(r.verified_on)}` : ''}
          </p>
          {r.display_status === 'reinspection_recommended' && (
            <p className="mt-1.5 rounded-md border border-orange-400/40 bg-orange-500/10 px-2 py-1 text-[11px] text-orange-200">
              Similar damage was detected at this spot after the repair was submitted ({r.later_defects_nearby.join(', ')}).
              Flagged for manual re-inspection. This does not confirm a repair failure, its cause or who is responsible.
            </p>
          )}
          {showImages && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <DefectImage url={r.before_image_url} caption="Before (at detection)" showBox={false} />
              <DefectImage url={r.after_image_url} caption="After (repair evidence)" showBox={false} />
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
