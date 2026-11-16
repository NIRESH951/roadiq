import { formatDate, fromDay } from '../../lib/timeline'
import { useRoadIQ } from '../../store/useRoadIQ'
import DefectImage from '../dashboard/DefectImage'
import { Legend } from '../dashboard/LayerControlPanel'
import PriorityBreakdown from '../dashboard/PriorityBreakdown'
import RepairStatusPanel from '../dashboard/RepairStatusPanel'
import { Logo } from '../layout/TopNav'
import type { SceneContext, SceneDef } from './scenes'

function SidePanel({ scene, ctx }: { scene: SceneDef; ctx: SceneContext }) {
  const day = useRoadIQ((s) => s.day)
  switch (scene.key) {
    case 'problem':
      return ctx.settings.statistic && ctx.settings.statisticSource ? (
        <div className="glass-strong p-5">
          <p className="text-xl font-semibold leading-snug text-white">{ctx.settings.statistic}</p>
          <p className="mt-2 text-xs text-slate-400">Source: {ctx.settings.statisticSource}</p>
        </div>
      ) : null
    case 'detection':
      return ctx.top ? (
        <div className="glass-strong p-3">
          <span className="section-title">Detection output</span>
          <DefectImage defect={ctx.top} className="mt-2"
            caption={ctx.top.source === 'demo' ? 'Labelled demo illustration with its stored detection box.' : 'Uploaded photo with the model’s box.'} />
        </div>
      ) : null
    case 'impact':
      return ctx.top ? (
        <div className="glass-strong space-y-3 p-4">
          <PriorityBreakdown defect={ctx.top} config={ctx.data.config} compact />
          <ul className="space-y-1 text-xs text-slate-200">
            {ctx.top.reasons.slice(0, 3).map((r) => <li key={r}>› {r}</li>)}
          </ul>
        </div>
      ) : null
    case 'memory':
      return ctx.recurrence && ctx.earlier ? (
        <div className="glass-strong space-y-2 p-3">
          <div className="flex items-center justify-between">
            <span className="section-title">Earlier vs latest inspection</span>
            <span className="rounded bg-cyan-400/15 px-2 py-0.5 text-[11px] text-cyan-100">
              {day === null ? 'Today' : formatDate(fromDay(day))}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <DefectImage defect={ctx.earlier} caption={`${ctx.earlier.id} · ${formatDate(ctx.earlier.detected_on)}`} />
            <DefectImage defect={ctx.recurrence} caption={`${ctx.recurrence.id} · ${formatDate(ctx.recurrence.detected_on)}`} />
          </div>
        </div>
      ) : null
    case 'radar':
      return <div className="glass-strong p-4"><Legend mode="coverage" /></div>
    case 'repair':
      return ctx.repair ? (
        <div className="glass-strong p-3">
          <span className="section-title">Repair evidence</span>
          <div className="mt-2"><RepairStatusPanel repairs={[ctx.repair]} /></div>
        </div>
      ) : null
    case 'vision':
      return (
        <div className="glass-strong space-y-2 p-5">
          <Logo />
          <p className="text-sm text-slate-300">Detect the damage. Understand its impact. Prioritize the repair.</p>
        </div>
      )
  }
}

export default function PresentationScene({ scene, ctx }: { scene: SceneDef; ctx: SceneContext }) {
  const callouts = scene.callouts(ctx)
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end gap-3 p-4 pb-24 md:flex-row md:items-end md:justify-between md:p-6 md:pb-24">
      <section key={scene.key} className="glass-strong pointer-events-auto max-w-[620px] p-5 fade-in" aria-live="polite">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-300">{scene.kicker}</div>
        <h2 className="mt-1 text-2xl font-semibold leading-tight text-white md:text-3xl">{scene.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{scene.narrative(ctx)}</p>
        {callouts.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {callouts.map((c) => (
              <div key={c.label} className="rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2">
                <div className="text-[11.5px] text-slate-400">{c.label}</div>
                <div className="text-lg font-semibold text-white">
                  {c.tone && <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: c.tone }} aria-hidden />}
                  {c.value}
                </div>
              </div>
            ))}
          </div>
        )}
        {ctx.data.metrics.sources.live ? null : (
          <p className="mt-3 text-[11.5px] text-amber-200/80">Figures come from labelled demonstration records.</p>
        )}
      </section>
      <div key={`side-${scene.key}`} className="pointer-events-auto w-full max-w-[420px] fade-in">
        <SidePanel scene={scene} ctx={ctx} />
      </div>
    </div>
  )
}
