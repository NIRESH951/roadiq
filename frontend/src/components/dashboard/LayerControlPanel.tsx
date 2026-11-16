import {
  BAND_COLOR, BAND_LABEL, CONTEXT_STYLE, COVERAGE_COLOR, COVERAGE_LABEL, MONSOON_COLOR, REPAIR_COLOR, REPAIR_LABEL,
} from '../../lib/colors'
import { useRoadIQ, type LayerMode, type Toggles } from '../../store/useRoadIQ'

export const LAYER_MODES: { key: LayerMode; label: string; help: string }[] = [
  { key: 'damage', label: 'Road damage', help: 'Damage markers coloured by priority' },
  { key: 'priority', label: 'Priority heatmap', help: 'Road sections and heat by RPS' },
  { key: 'coverage', label: 'Inspection coverage', help: 'Survey Gap Radar' },
  { key: 'repair', label: 'Repair status', help: 'Submitted, pending, verified' },
  { key: 'monsoon', label: 'Monsoon watchlist', help: 'Sections needing pre-monsoon checks' },
]

const TOGGLES: { key: keyof Toggles; label: string }[] = [
  { key: 'markers', label: 'Damage markers' },
  { key: 'context', label: 'Context locations' },
  { key: 'connections', label: 'Impact connections' },
  { key: 'heatmap', label: 'Damage heatmap' },
  { key: 'labels', label: 'Labels' },
  { key: 'vehicles', label: 'Traffic' },
]

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-2 text-[11px] text-slate-300">
      <span className="h-2.5 w-5 rounded-sm" style={{ background: color }} aria-hidden />
      {label}
    </li>
  )
}

export function Legend({ mode }: { mode: LayerMode }) {
  return (
    <div>
      <span className="section-title">Legend</span>
      <ul className="mt-1.5 space-y-1">
        {mode === 'coverage' && (['recent', 'overdue', 'never', 'unknown'] as const).map((k) => <Swatch key={k} color={COVERAGE_COLOR[k]} label={COVERAGE_LABEL[k]} />)}
        {mode === 'repair' && (['submitted', 'pending_verification', 'reinspection_recommended', 'verified'] as const).map((k) => <Swatch key={k} color={REPAIR_COLOR[k]} label={REPAIR_LABEL[k]} />)}
        {mode === 'monsoon' && (
          <>
            <Swatch color={MONSOON_COLOR} label="Needs pre-monsoon inspection" />
            <Swatch color="#1e293b" label="Not on the watchlist" />
          </>
        )}
        {(mode === 'damage' || mode === 'priority') && (['critical', 'high', 'medium', 'low'] as const).map((k) => (
          <Swatch key={k} color={BAND_COLOR[k]} label={`${BAND_LABEL[k]} priority${k === 'critical' ? ' (pulses)' : ''}`} />
        ))}
      </ul>
      {mode === 'coverage' && <p className="mt-1.5 text-[11.5px] text-slate-400">Grey or red does not mean safe: missing data is not evidence of a good road.</p>}
      {mode === 'monsoon' && <p className="mt-1.5 text-[11.5px] text-slate-400">Planning flag from recorded reports, not a flood forecast.</p>}
      <ul className="mt-2 grid grid-cols-2 gap-1">
        {Object.entries(CONTEXT_STYLE).map(([k, v]) => (
          <li key={k} className="flex items-center gap-1.5 text-[11.5px] text-slate-400">
            <span className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold text-slate-950" style={{ background: v.color }}>{v.glyph}</span>
            {v.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function LayerControlPanel() {
  const mode = useRoadIQ((s) => s.layerMode)
  const setMode = useRoadIQ((s) => s.setLayerMode)
  const toggles = useRoadIQ((s) => s.toggles)
  const toggle = useRoadIQ((s) => s.toggle)
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="section-title">Map layer</legend>
        <div className="mt-1.5 space-y-1" role="radiogroup">
          {LAYER_MODES.map((l) => (
            <label key={l.key}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2 py-1.5 transition ${mode === l.key ? 'border-cyan-400/50 bg-cyan-400/10' : 'border-transparent hover:bg-slate-800/50'}`}>
              <input type="radio" name="layer" className="mt-0.5 accent-cyan-400" checked={mode === l.key} onChange={() => setMode(l.key)} />
              <span>
                <span className="block text-xs text-slate-100">{l.label}</span>
                <span className="block text-[11.5px] text-slate-400">{l.help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="section-title">Show</legend>
        <div className="mt-1.5 grid grid-cols-1 gap-0.5">
          {TOGGLES.map((t) => (
            <label key={t.key} className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-xs text-slate-200 hover:bg-slate-800/50">
              {t.label}
              <input type="checkbox" className="accent-cyan-400" checked={toggles[t.key]} onChange={() => toggle(t.key)} />
            </label>
          ))}
        </div>
      </fieldset>
      <Legend mode={mode} />
    </div>
  )
}
