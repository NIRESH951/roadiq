import { lazy, Suspense, useEffect, useState } from 'react'
import type { DamageType } from '../../api/types'
import { DAMAGE_LABEL } from '../../lib/colors'
import { useRoadIQ, useSelectedDefect } from '../../store/useRoadIQ'
import SceneLoading from '../3d/SceneLoading'
import { DAMAGE_EXPLANATION, ROAD_LAYERS } from '../3d/roadLayers'

const RoadCutaway3D = lazy(() => import('../3d/RoadCutaway3D'))
const TYPES: DamageType[] = ['pothole', 'longitudinal_crack', 'transverse_crack', 'alligator_crack']

export default function CutawayModal({ webgl }: { webgl: boolean }) {
  const open = useRoadIQ((s) => s.cutawayOpen)
  const setOpen = useRoadIQ((s) => s.setCutaway)
  const reduced = useRoadIQ((s) => s.settings.reducedMotion)
  const defect = useSelectedDefect()
  const [type, setType] = useState<DamageType>('pothole')
  const [explode, setExplode] = useState(0.35)
  const [layer, setLayer] = useState<string | null>('surface')
  const [rotate, setRotate] = useState(false)

  useEffect(() => {
    if (open && defect) setType(defect.type)
  }, [open, defect])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null
  const active = ROAD_LAYERS.find((l) => l.key === layer)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cutaway-title">
      <div className="glass-strong flex h-[min(760px,94vh)] w-[min(1180px,98vw)] flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-700/60 px-4 py-3">
          <div>
            <h2 id="cutaway-title" className="text-base font-semibold text-white">Road cross-section · {DAMAGE_LABEL[type]}</h2>
            <p className="text-[11px] text-amber-200">
              Illustrative engineering visualization. A standard RGB photo cannot measure pothole depth or reveal what is under the surface.
            </p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:border-cyan-400/60">Close ✕</button>
        </div>
        <div className="grid min-h-0 flex-1 md:grid-cols-[1fr_330px]">
          <div className="relative min-h-[300px]">
            {webgl ? (
              <Suspense fallback={<SceneLoading label="Loading cutaway…" />}>
                <RoadCutaway3D type={type} explode={explode} highlighted={layer} onPick={setLayer} rotate={rotate} reducedMotion={reduced} />
              </Suspense>
            ) : (
              <div className="flex h-full flex-col justify-center gap-1 p-6">
                {ROAD_LAYERS.map((l) => (
                  <div key={l.key} className="rounded px-3 text-xs text-white" style={{ background: l.color, height: `${l.thickness * 40}px`, lineHeight: `${l.thickness * 40}px` }}>{l.name}</div>
                ))}
              </div>
            )}
            <span className="pointer-events-none absolute left-3 top-3 rounded bg-amber-400/90 px-2 py-0.5 text-[11px] font-bold text-slate-950">ILLUSTRATIVE</span>
          </div>
          <div className="scroll-thin space-y-4 overflow-y-auto border-l border-slate-700/60 p-4">
            <div>
              <span className="section-title">Damage type</span>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                {TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t}
                    className={`rounded-md px-2 py-1.5 text-xs ${type === t ? 'bg-cyan-400/20 text-white ring-1 ring-cyan-400/40' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'}`}>{DAMAGE_LABEL[t]}</button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-300">{DAMAGE_EXPLANATION[type]}</p>
            </div>
            <div>
              <span className="section-title">Layers</span>
              <div className="mt-1.5 flex gap-1.5">
                <button type="button" onClick={() => setExplode(1)} className="flex-1 rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-cyan-400/60">Explode</button>
                <button type="button" onClick={() => setExplode(0)} className="flex-1 rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-cyan-400/60">Collapse</button>
                <button type="button" onClick={() => setRotate((r) => !r)} aria-pressed={rotate}
                  className={`flex-1 rounded-md border px-2 py-1 text-xs ${rotate ? 'border-cyan-400/60 bg-cyan-400/15 text-white' : 'border-slate-600 text-slate-200'}`}>{rotate ? 'Stop rotating' : 'Rotate'}</button>
              </div>
              <label className="mt-2 block text-[11px] text-slate-400">
                Separation
                <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(Number(e.target.value))} className="timeline-range w-full" />
              </label>
              <p className="text-[11.5px] text-slate-400">Drag the model to rotate it; scroll to zoom. Click a layer to highlight it.</p>
            </div>
            <ul className="space-y-1.5">
              {ROAD_LAYERS.map((l) => (
                <li key={l.key}>
                  <button type="button" onClick={() => setLayer(l.key)} aria-pressed={layer === l.key}
                    className={`w-full rounded-lg border p-2 text-left ${layer === l.key ? 'border-cyan-400/60 bg-cyan-400/10' : 'border-slate-700/60 hover:border-slate-500'}`}>
                    <span className="flex items-center gap-2 text-xs font-semibold text-white">
                      <span className="h-3 w-3 rounded-sm" style={{ background: l.color }} aria-hidden />{l.name}
                    </span>
                    {layer === l.key && <span className="mt-1 block text-[11px] text-slate-300">{l.description}</span>}
                  </button>
                </li>
              ))}
            </ul>
            {active && <p className="sr-only" aria-live="polite">{active.name}: {active.description}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
