import LayerControlPanel from '../dashboard/LayerControlPanel'
import { useRoadIQ, type LayerMode, type View } from '../../store/useRoadIQ'

interface Module {
  key: string
  label: string
  icon: string
  view: View
  layer?: LayerMode
  count?: (m: NonNullable<ReturnType<typeof useRoadIQ.getState>['data']>['metrics']) => number
  countLabel?: string
}

const MODULES: Module[] = [
  { key: 'detection', label: 'AI Detection', icon: '◉', view: 'detection', count: (m) => m.reports_total, countLabel: 'defect reports on record' },
  { key: 'priority', label: 'Priority Intelligence', icon: '▲', view: 'city', layer: 'damage', count: (m) => m.critical_roads + m.high_roads, countLabel: 'critical or high-priority road sections' },
  { key: 'memory', label: 'Road Memory', icon: '⟲', view: 'memory', count: (m) => m.recurring_damage, countLabel: 'reports flagged as possible recurrence' },
  { key: 'coverage', label: 'Inspection Coverage', icon: '◎', view: 'radar', layer: 'coverage', count: (m) => m.total_sections - m.inspected_sections, countLabel: 'road sections not inspected in the last 30 days' },
  { key: 'repair', label: 'Repair Tracking', icon: '⚒', view: 'city', layer: 'repair', count: (m) => m.pending_repair_verification, countLabel: 'repairs awaiting verification' },
  { key: 'monsoon', label: 'Monsoon Watchlist', icon: '☂', view: 'city', layer: 'monsoon', count: (m) => m.monsoon_watchlist, countLabel: 'road sections needing a pre-monsoon check' },
]

export default function Sidebar() {
  const data = useRoadIQ((s) => s.data)
  const view = useRoadIQ((s) => s.view)
  const layer = useRoadIQ((s) => s.layerMode)
  const setView = useRoadIQ((s) => s.setView)
  const setLayerMode = useRoadIQ((s) => s.setLayerMode)

  const isActive = (m: Module) => {
    if (m.key === 'priority') return view === 'city' && (layer === 'damage' || layer === 'priority')
    if (m.layer && m.view === 'city') return view === 'city' && layer === m.layer
    return view === m.view
  }

  return (
    <div className="scroll-thin flex h-full flex-col gap-4 overflow-y-auto p-3">
      <nav aria-label="Intelligence modules">
        <span className="section-title">Intelligence</span>
        <ul className="mt-1.5 space-y-0.5">
          {MODULES.map((m) => {
            const active = isActive(m)
            return (
              <li key={m.key}>
                <button type="button"
                  onClick={() => { setView(m.view); if (m.layer) setLayerMode(m.layer) }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition ${
                    active ? 'bg-gradient-to-r from-cyan-400/20 to-transparent text-white ring-1 ring-cyan-400/30' : 'text-slate-300 hover:bg-slate-800/60'
                  }`}>
                  <span className={`grid h-6 w-6 place-items-center rounded-md text-sm ${active ? 'bg-cyan-400/25 text-cyan-200' : 'bg-slate-800 text-slate-400'}`} aria-hidden>{m.icon}</span>
                  <span className="flex-1">{m.label}</span>
                  {data && m.count && (
                    <span title={`${m.count(data.metrics)} ${m.countLabel}`} className="rounded-full bg-slate-800 px-1.5 text-[11px] tabular-nums text-slate-200">
                      {m.count(data.metrics)}<span className="sr-only"> {m.countLabel}</span>
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      <LayerControlPanel />
    </div>
  )
}
