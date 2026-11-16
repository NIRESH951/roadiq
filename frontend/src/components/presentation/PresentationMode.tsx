import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { timelineEvents } from '../../lib/timeline'
import { useRoadIQ, type LayerMode, type Toggles } from '../../store/useRoadIQ'
import SceneLoading from '../3d/SceneLoading'
import RoadMap2D from '../dashboard/RoadMap2D'
import PresentationControls from './PresentationControls'
import PresentationScene from './PresentationScene'
import { buildContext, SCENES } from './scenes'

const RoadIQCityScene = lazy(() => import('../3d/RoadIQCityScene'))

/** Full-screen guided walkthrough for judges. Every number is read from the loaded records. */
export default function PresentationMode({ webgl }: { webgl: boolean }) {
  const data = useRoadIQ((s) => s.data)!
  const settings = useRoadIQ((s) => s.settings)
  const index = useRoadIQ((s) => s.sceneIndex)
  const setScene = useRoadIQ((s) => s.setScene)
  const close = useRoadIQ((s) => s.closePresentation)
  const rootRef = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const saved = useRef<{ layerMode: LayerMode; toggles: Toggles; selected: string | null; view: string } | null>(null)

  const ctx = useMemo(() => buildContext(data, settings), [data, settings])
  const scene = SCENES[Math.min(index, SCENES.length - 1)]

  // Remember the dashboard state and restore it on exit.
  useEffect(() => {
    const s = useRoadIQ.getState()
    saved.current = { layerMode: s.layerMode, toggles: s.toggles, selected: s.selectedDefectId, view: s.view }
    return () => {
      const prev = saved.current
      if (!prev) return
      const st = useRoadIQ.getState()
      st.setLayerMode(prev.layerMode)
      st.setToggles(prev.toggles)
      st.selectDefect(prev.selected)
      st.camera({ kind: 'reset' })
    }
  }, [])

  // Apply the scene: layers, selection, camera, and the Road Memory replay.
  useEffect(() => {
    const st = useRoadIQ.getState()
    const setup = scene.setup(ctx)
    st.setLayerMode(setup.layerMode)
    st.setToggles(setup.toggles)
    st.selectDefect(setup.select)
    st.setAutoOrbit(setup.autoOrbit)
    st.camera(setup.camera)
    st.setDay(null)
    if (scene.key !== 'memory' || !ctx.recurrence) return
    const stops = [...new Set(timelineEvents(data, ctx.recurrence.segment_id).map((e) => e.day))].sort((a, b) => a - b)
    if (settings.reducedMotion || !stops.length) return
    const timers = stops.map((d, i) => window.setTimeout(() => useRoadIQ.getState().setDay(d), 600 + i * 1700))
    timers.push(window.setTimeout(() => useRoadIQ.getState().setDay(null), 600 + stops.length * 1700))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [scene, ctx, data, settings.reducedMotion])

  const go = useCallback((i: number) => setScene(Math.max(0, Math.min(SCENES.length - 1, i))), [setScene])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void rootRef.current?.requestFullscreen?.().catch(() => undefined)
  }, [])

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    close()
  }, [close])

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(useRoadIQ.getState().sceneIndex + 1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(useRoadIQ.getState().sceneIndex - 1) }
      else if (e.key === 'Escape' && !document.fullscreenElement) exit()
      else if (e.key.toLowerCase() === 'f') toggleFullscreen()
    }
    document.addEventListener('fullscreenchange', onFs)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      window.removeEventListener('keydown', onKey)
    }
  }, [go, exit, toggleFullscreen])

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 bg-[#050b18]" role="dialog" aria-modal="true" aria-label="RoadIQ presentation mode">
      {webgl ? (
        <Suspense fallback={<SceneLoading label="Preparing presentation…" />}>
          <RoadIQCityScene />
        </Suspense>
      ) : (
        <div className="absolute inset-0 p-6 pb-40"><RoadMap2D interactive={false} /></div>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-[#050b18] to-transparent" />
      <div className="pointer-events-none absolute left-5 top-4 z-10 flex items-center gap-2 text-sm font-semibold text-white">
        Road<span className="-ml-2 text-cyan-400">IQ</span>
        <span className="ml-2 text-xs font-normal text-slate-400">Presentation</span>
      </div>
      <PresentationScene scene={scene} ctx={ctx} />
      <PresentationControls scenes={SCENES} index={index} onGo={go} onExit={exit} onFullscreen={toggleFullscreen} fullscreen={fullscreen} />
    </div>
  )
}
