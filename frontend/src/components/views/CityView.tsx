import { lazy, Suspense, useEffect } from 'react'
import SceneLoading from '../3d/SceneLoading'
import MetricCards from '../dashboard/MetricCards'
import RoadHistoryPanel from '../dashboard/RoadHistoryPanel'
import RoadMap2D from '../dashboard/RoadMap2D'
import SelectedRoadPanel from '../dashboard/SelectedRoadPanel'
import SurveyGapList from '../dashboard/SurveyGapList'
import Sidebar from '../layout/Sidebar'
import { formatDate, fromDay } from '../../lib/timeline'
import { useRoadIQ } from '../../store/useRoadIQ'

const RoadIQCityScene = lazy(() => import('../3d/RoadIQCityScene'))

const TITLES: Record<string, { title: string; sub: string }> = {
  city: { title: '3D Smart City', sub: 'Rotate, pan and zoom. Click a road or a marker.' },
  memory: { title: 'Road Memory', sub: 'Drag the timeline to see each road as it was recorded.' },
  radar: { title: 'Survey Gap Radar', sub: 'Which roads need a new inspection.' },
  map: { title: 'Road Map (2D)', sub: 'Schematic view of the same records. No 3D required.' },
}

function CameraToolbar() {
  const camera = useRoadIQ((s) => s.camera)
  const mode = useRoadIQ((s) => s.cameraMode)
  const data = useRoadIQ((s) => s.data)
  const selectDefect = useRoadIQ((s) => s.selectDefect)
  const smartFocus = () => {
    const top = data?.defects.filter((d) => d.status !== 'repaired_verified').sort((a, b) => b.rps - a.rps)[0]
    if (top) selectDefect(top.id, true)
  }
  const btn = 'grid h-8 min-w-8 place-items-center rounded-md border border-slate-600/60 bg-slate-900/80 px-2 text-xs text-slate-200 hover:border-cyan-400/60 hover:text-white'
  return (
    <div className="flex flex-wrap justify-end gap-1" role="toolbar" aria-label="Camera controls">
      <button type="button" className={btn} onClick={smartFocus} title="Smart Focus: fly to the highest-priority road">◎ Smart Focus</button>
      <button type="button" className={btn} onClick={() => camera({ kind: mode === 'top' ? 'perspective' : 'top' })}
        title="Switch between perspective and top-down">{mode === 'top' ? '⬈ Perspective' : '⬒ Top-down'}</button>
      <button type="button" className={btn} onClick={() => camera({ kind: 'zoomIn' })} aria-label="Zoom in">＋</button>
      <button type="button" className={btn} onClick={() => camera({ kind: 'zoomOut' })} aria-label="Zoom out">－</button>
      <button type="button" className={btn} onClick={() => camera({ kind: 'reset' })} title="Reset camera">⟲ Reset</button>
    </div>
  )
}

export default function CityView({ webgl, mode }: { webgl: boolean; mode: '3d' | '2d' }) {
  const view = useRoadIQ((s) => s.view)
  const data = useRoadIQ((s) => s.data)!
  const day = useRoadIQ((s) => s.day)
  const setDay = useRoadIQ((s) => s.setDay)
  const camera = useRoadIQ((s) => s.camera)
  const sidebarOpen = useRoadIQ((s) => s.sidebarOpen)
  const setSidebarOpen = useRoadIQ((s) => s.setSidebarOpen)
  const offline = useRoadIQ((s) => s.offline)
  const connection = useRoadIQ((s) => s.connection)
  const use3D = mode === '3d' && webgl
  const t = TITLES[view] ?? TITLES.city
  const liveCount = data.metrics.sources.live ?? 0

  useEffect(() => {
    if (!use3D) return
    if (view === 'radar') camera({ kind: 'top' })
    if (view === 'memory') {
      const d = useRoadIQ.getState().data?.defects.find((x) => x.id === useRoadIQ.getState().selectedDefectId)
      camera(d ? { kind: 'focus', target: [d.x, d.z] } : { kind: 'perspective' })
    }
  }, [view, use3D, camera])

  return (
    <div className="scroll-thin flex h-full min-h-0 flex-col overflow-y-auto xl:overflow-hidden">
      <div className="px-3 pt-3"><MetricCards compact /></div>
      <div className="flex flex-1 flex-col gap-3 p-3 xl:min-h-0 xl:flex-row">
      <div className="relative flex flex-col gap-3 lg:h-[680px] lg:flex-row xl:h-auto xl:min-h-0 xl:flex-1">
        <aside className="glass hidden w-[250px] shrink-0 overflow-hidden lg:block" aria-label="Layers and modules"><Sidebar /></aside>
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="glass-strong absolute inset-y-3 left-3 w-[min(290px,calc(100vw-24px))] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <Sidebar />
              <button type="button" onClick={() => setSidebarOpen(false)} className="absolute right-2 top-2 rounded px-2 py-1 text-slate-200 hover:bg-slate-800" aria-label="Close layers panel">✕</button>
            </div>
          </div>
        )}

        <main className="glass relative flex min-w-0 flex-col overflow-hidden lg:flex-1 lg:block" aria-label={t.title}>
          <div className="relative h-[62vh] min-h-[380px] lg:absolute lg:inset-0 lg:h-auto lg:min-h-0">
            {use3D ? (
              <Suspense fallback={<SceneLoading label="Loading 3D engine…" />}>
                <RoadIQCityScene />
              </Suspense>
            ) : (
              <div className="absolute inset-0 p-4 lg:pb-32"><RoadMap2D /></div>
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 p-3">
              <div className="pointer-events-auto max-w-full rounded-lg bg-[#050b18]/60 px-2 py-1 backdrop-blur-sm sm:max-w-[60%]">
                <h1 className="text-sm font-semibold text-white">{t.title} <span className="font-normal text-slate-300">· {data.meta.city_name}</span></h1>
                <p className="text-xs text-slate-300">{t.sub}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {liveCount === 0 && (
                    <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-100">
                      Demo dataset: fictional city, no live records yet
                    </span>
                  )}
                  {connection === 'unavailable' && (
                    <span className="rounded-full border border-red-400/50 bg-red-500/15 px-2 py-0.5 text-[11px] text-red-100">
                      Backend unavailable · {offline ? 'cached demo data' : 'last loaded data'}
                    </span>
                  )}
                  {mode === '3d' && !webgl && (
                    <span className="rounded-full border border-orange-400/40 bg-orange-400/10 px-2 py-0.5 text-[11px] text-orange-100">
                      3D is unavailable on this device, showing the 2D map of the same data
                    </span>
                  )}
                  {day !== null && (
                    <button type="button" onClick={() => setDay(null)}
                      className="rounded-full border border-cyan-400/50 bg-cyan-400/15 px-2 py-0.5 text-[11px] text-cyan-50 hover:bg-cyan-400/25">
                      Map shows records as of {formatDate(fromDay(day))} (cards show today) · back to today
                    </button>
                  )}
                </div>
              </div>
              <div className="pointer-events-auto flex flex-wrap justify-end gap-1">
                <button type="button" onClick={() => setSidebarOpen(true)}
                  className="grid h-8 place-items-center rounded-md border border-slate-600/60 bg-slate-900/80 px-2 text-xs text-slate-100 hover:border-cyan-400/60 lg:hidden">☰ Layers</button>
                {use3D && <CameraToolbar />}
              </div>
            </div>
          </div>

          <div className="relative z-10 p-2 lg:pointer-events-none lg:absolute lg:inset-x-3 lg:bottom-3 lg:p-0">
            <RoadHistoryPanel />
          </div>
        </main>
      </div>

        <aside className="glass h-[620px] shrink-0 overflow-hidden xl:h-auto xl:w-[380px]" aria-label="Priority queue and selected road">
          <SelectedRoadPanel empty={view === 'radar' ? <SurveyGapList /> : undefined} />
        </aside>
      </div>
    </div>
  )
}
