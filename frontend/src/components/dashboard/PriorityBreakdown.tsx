import type { Defect, FactorKey, PriorityConfig } from '../../api/types'
import { BAND_COLOR, BAND_LABEL, FACTOR_META } from '../../lib/colors'

const ORDER: FactorKey[] = ['D', 'T', 'V', 'R', 'W']

export default function PriorityBreakdown({ defect, config, compact = false }: {
  defect: Defect
  config: PriorityConfig
  compact?: boolean
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="section-title">Priority breakdown</span>
        <code className="text-[11px] text-slate-400">{config.formula}</code>
      </div>
      <ul className="space-y-2.5">
        {ORDER.map((k) => {
          const value = defect.factors[k]
          const weight = config.weights[k]
          const contribution = value * weight
          const meta = FACTOR_META[k]
          return (
            <li key={k}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-slate-200">
                  <span className="mr-1.5 inline-block w-4 font-mono font-semibold text-cyan-300">{k}</span>
                  {meta.label}
                  <span className="ml-1 text-slate-400">× {weight.toFixed(2)}</span>
                </span>
                <span className="tabular-nums text-slate-300">
                  {value.toFixed(0)}
                  <span className="text-slate-400"> → +{contribution.toFixed(1)}</span>
                </span>
              </div>
              <div className="bar-track mt-1" role="progressbar" aria-label={`${meta.label} factor`} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, value)}%`, background: meta.color }} />
              </div>
              {!compact && (
                <p className="mt-0.5 text-[11.5px] text-slate-400">{defect.factor_details?.[k] ?? meta.help}</p>
              )}
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-xs">
        <span className="text-slate-300">Road Priority Score (this report)</span>
        <span className="font-semibold tabular-nums text-white">
          {defect.rps.toFixed(1)} / 100
          <span className="ml-2 rounded px-1.5 py-0.5 text-[11px] font-bold uppercase text-slate-950" style={{ background: BAND_COLOR[defect.band] }}>
            {BAND_LABEL[defect.band]}
          </span>
        </span>
      </div>
      {defect.calculation && (
        <p className="mt-1.5 break-words font-mono text-[11px] text-slate-300" aria-label="Calculation">{defect.calculation}</p>
      )}
      <p className="mt-1 text-[11.5px] text-slate-400">{config.note}</p>
    </div>
  )
}
