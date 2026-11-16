import type { ReactNode } from 'react'
import { useRoadIQ } from '../../store/useRoadIQ'

interface Card {
  key: string
  label: string
  value: ReactNode
  hint: string
  accent: string
  action: () => void
  actionLabel: string
}

/**
 * Six headline numbers, all computed by the API from the same records as the 3D city, as of today.
 * "Report" = one detected defect. "Road section" = a stretch of road between junctions; its priority is
 * the highest score among its unresolved reports.
 */
export default function MetricCards({ compact = false }: { compact?: boolean }) {
  const data = useRoadIQ((s) => s.data)
  const setView = useRoadIQ((s) => s.setView)
  const setLayerMode = useRoadIQ((s) => s.setLayerMode)
  const selectSegment = useRoadIQ((s) => s.selectSegment)
  const camera = useRoadIQ((s) => s.camera)
  if (!data) return null
  const m = data.metrics
  const unknown = m.by_coverage.unknown ?? 0

  const focusSection = (band: string) => () => {
    const s = data.segments.filter((x) => x.band === band).sort((a, b) => (b.rps ?? 0) - (a.rps ?? 0))[0]
    if (!s) return
    setView('city')
    setLayerMode('damage')
    selectSegment(s.id)
    camera({ kind: 'focus', target: [(s.x1 + s.x2) / 2, (s.z1 + s.z2) / 2] })
  }

  const cards: Card[] = [
    { key: 'defects', label: 'Unresolved defect reports', value: m.total_defects,
      hint: `${m.reports_open} open · ${m.reports_awaiting_verification} awaiting repair check`, accent: '#22d3ee',
      action: () => { setView('city'); setLayerMode('damage') }, actionLabel: 'Show the damage layer' },
    { key: 'critical', label: 'Critical road sections', value: m.critical_roads,
      hint: 'Section score ≥ 75 (its highest report)', accent: '#ef4444',
      action: focusSection('critical'), actionLabel: 'Focus the critical road section' },
    { key: 'high', label: 'High-priority road sections', value: m.high_roads,
      hint: 'Section score 60–74 (its highest report)', accent: '#f97316',
      action: focusSection('high'), actionLabel: 'Focus the high-priority road section' },
    { key: 'recurring', label: 'Possible recurring damage', value: m.recurring_damage,
      hint: 'Reports flagged for manual re-inspection', accent: '#fb923c',
      action: () => setView('memory'), actionLabel: 'Open Road Memory' },
    { key: 'inspected', label: `Sections inspected (${data.config.recent_inspection_days} days)`,
      value: <>{m.inspected_sections}<span className="text-base text-slate-300">/{m.total_sections}</span></>,
      hint: `${m.inspected_pct}% · ${m.sections_needing_inspection} overdue or never${unknown ? ` · ${unknown} unknown` : ''}`, accent: '#22c55e',
      action: () => setView('radar'), actionLabel: 'Open Survey Gap Radar' },
    { key: 'pending', label: 'Repairs awaiting verification', value: m.pending_repair_verification,
      hint: m.repairs_reinspection ? `incl. ${m.repairs_reinspection} flagged for re-inspection` : 'Submitted, not yet verified', accent: '#a78bfa',
      action: () => setView('repairs'), actionLabel: 'Open Repair Verification' },
  ]

  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6'}`}>
      {cards.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.action}
          title={`${c.hint}. ${c.actionLabel}.`}
          className="glass group relative overflow-hidden px-3 py-2 text-left transition hover:border-cyan-400/40"
        >
          <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: c.accent }} aria-hidden />
          <div className="text-xs leading-tight text-slate-300">{c.label}</div>
          <div className={`${compact ? 'text-xl' : 'text-2xl'} mt-0.5 font-semibold tabular-nums text-white`}>{c.value}</div>
          <div className={`${compact ? 'hidden 2xl:block 2xl:truncate' : 'line-clamp-2'} text-[11.5px] leading-snug text-slate-400`}>{c.hint}</div>
          <span className="sr-only">{c.actionLabel}</span>
        </button>
      ))}
    </div>
  )
}
