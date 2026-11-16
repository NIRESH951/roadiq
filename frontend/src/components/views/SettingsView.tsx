import { useState, type ReactNode } from 'react'
import { resetDemoData } from '../../api/client'
import { BAND_COLOR, BAND_LABEL, FACTOR_META } from '../../lib/colors'
import { useRoadIQ } from '../../store/useRoadIQ'
import type { FactorKey } from '../../api/types'
import { StatusDetails, useStatus } from '../layout/StatusIndicators'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass space-y-3 p-4">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  )
}

function Switch({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm text-slate-100">{label}</span>
        <span className="block text-[11px] text-slate-400">{help}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 accent-cyan-400" />
    </label>
  )
}

export default function SettingsView({ webgl }: { webgl: boolean }) {
  const settings = useRoadIQ((s) => s.settings)
  const update = useRoadIQ((s) => s.updateSettings)
  const data = useRoadIQ((s) => s.data)!
  const offline = useRoadIQ((s) => s.offline)
  const reason = useRoadIQ((s) => s.offlineReason)
  const { canWrite } = useStatus()
  const checkHealth = useRoadIQ((s) => s.checkHealth)
  const lastHealthAt = useRoadIQ((s) => s.lastHealthAt)
  const load = useRoadIQ((s) => s.load)
  const toggles = useRoadIQ((s) => s.toggles)
  const toggle = useRoadIQ((s) => s.toggle)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reset = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await resetDemoData()
      await load()
      setMsg('Demo records recreated. Live records were kept.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto p-3">
      <div className="mx-auto grid max-w-[1100px] gap-3 md:grid-cols-2">
        <Section title="Rendering">
          <div className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm text-slate-100">3D quality</span>
              <span className="block text-[11px] text-slate-400">Low turns off shadows and antialiasing, and draws fewer trees, lights and cars.</span>
            </span>
            <div className="flex rounded-lg border border-slate-600 p-0.5 text-xs" role="radiogroup" aria-label="3D quality">
              {(['high', 'low'] as const).map((q) => (
                <button key={q} type="button" role="radio" aria-checked={settings.quality === q} onClick={() => update({ quality: q })}
                  className={`rounded-md px-3 py-1 capitalize ${settings.quality === q ? 'bg-cyan-400/20 text-white' : 'text-slate-400'}`}>{q}</button>
              ))}
            </div>
          </div>
          <Switch label="Reduce motion" help="Stops pulses, traffic, auto-orbit and animated camera moves." checked={settings.reducedMotion} onChange={(v) => update({ reducedMotion: v })} />
          <Switch label="Show labels in the city" help="Names of schools, hospitals, bus stops and survey status chips." checked={toggles.labels} onChange={(v) => toggle('labels', v)} />
          <p className={`text-[11px] ${webgl ? 'text-emerald-300' : 'text-orange-300'}`}>
            {webgl ? 'WebGL is available on this device.' : 'WebGL is not available: RoadIQ uses the 2D map everywhere.'}
          </p>
        </Section>

        <Section title="Data source">
          <StatusDetails />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt className="text-slate-400">Data loaded from</dt>
            <dd className="text-slate-200">{offline ? `Bundled offline snapshot (${reason ?? 'API unreachable'})` : 'RoadIQ API database'}</dd>
            <dt className="text-slate-400">Last backend check</dt>
            <dd className="text-slate-200">{lastHealthAt ? new Date(lastHealthAt).toLocaleTimeString() : 'not yet'}</dd>
            <dt className="text-slate-400">Data as of</dt><dd className="text-slate-200">{data.meta.as_of}</dd>
            <dt className="text-slate-400">Generated</dt><dd className="text-slate-200">{data.meta.generated_at}</dd>
            <dt className="text-slate-400">Records</dt>
            <dd className="text-slate-200">{data.metrics.sources.demo ?? 0} demo · {data.metrics.sources.live ?? 0} live defects</dd>
            <dt className="text-slate-400">City layout</dt><dd className="text-slate-200">{data.meta.city_name}</dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void checkHealth(); void load() }} className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-400/60">Check backend and reload</button>
            <button type="button" onClick={reset} disabled={!canWrite || busy}
              className="rounded-md border border-amber-400/50 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100 enabled:hover:bg-amber-400/20 disabled:opacity-40">
              {busy ? 'Resetting…' : 'Reset demo records'}
            </button>
          </div>
          {msg && <p className="text-xs text-slate-300" role="status">{msg}</p>}
          <p className="text-[11.5px] text-slate-400">Demo and live records are stored with a source field and labelled everywhere. Resetting never touches live records.</p>
        </Section>

        <Section title="Presentation mode">
          <label className="block">
            <span className="text-xs text-slate-300">Scene 1 statistic (optional, use a sourced figure)</span>
            <textarea value={settings.statistic} onChange={(e) => update({ statistic: e.target.value })} rows={2}
              placeholder="Leave blank to show no statistic"
              className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-300">Source for that statistic</span>
            <input value={settings.statisticSource} onChange={(e) => update({ statisticSource: e.target.value })}
              placeholder="e.g. publisher, report title, year"
              className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100" />
          </label>
          <p className="text-[11.5px] text-slate-400">The statistic only appears in Scene 1 when both fields are filled in.</p>
        </Section>

        <Section title="Priority formula">
          <code className="block text-sm text-cyan-200">{data.config.formula}</code>
          <ul className="space-y-1 text-xs">
            {(Object.keys(data.config.weights) as FactorKey[]).map((k) => (
              <li key={k} className="flex justify-between"><span className="text-slate-300">{k} · {FACTOR_META[k].label}</span><span className="tabular-nums text-slate-400">{data.config.weights[k].toFixed(2)}</span></li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-1.5">
            {data.config.bands.map((b) => (
              <span key={b.name} className="rounded-full border px-2 py-0.5 text-[11.5px] text-slate-200" style={{ borderColor: BAND_COLOR[b.name] }}>
                {BAND_LABEL[b.name]} ≥ {b.min}
              </span>
            ))}
          </div>
          <p className="text-[11.5px] text-slate-400">
            Vulnerability radius {data.config.vulnerability_radius_m} m · recurrence radius {data.config.recurrence_radius_m} m · recent inspection ≤ {data.config.recent_inspection_days} days.
            Weights are set in backend/app/config.py. {data.config.note}
          </p>
        </Section>
      </div>
    </div>
  )
}
