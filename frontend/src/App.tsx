import { lazy, Suspense, useEffect, useMemo } from 'react'
import SceneLoading from './components/3d/SceneLoading'
import CutawayModal from './components/dashboard/CutawayModal'
import TopNav from './components/layout/TopNav'
import AnalyticsView from './components/views/AnalyticsView'
import CityView from './components/views/CityView'
import DashboardView from './components/views/DashboardView'
import DetectionView from './components/views/DetectionView'
import RepairView from './components/views/RepairView'
import SettingsView from './components/views/SettingsView'
import { hasWebGL } from './lib/webgl'
import { useRoadIQ, viewFromHash } from './store/useRoadIQ'

const PresentationMode = lazy(() => import('./components/presentation/PresentationMode'))

function Splash({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-3xl font-bold text-white">Road<span className="text-cyan-400">IQ</span></div>
      <p className="text-sm text-slate-400">Detect the damage. Understand its impact. Prioritize the repair.</p>
      {error ? (
        <div className="max-w-md rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
          <p>{error}</p>
          <button type="button" onClick={onRetry} className="mt-2 rounded-md border border-red-300/50 px-3 py-1 text-xs hover:bg-red-500/20">Try again</button>
        </div>
      ) : (
        <div className="relative h-40 w-full max-w-sm"><SceneLoading label="Loading road records…" /></div>
      )}
    </div>
  )
}

export default function App() {
  const status = useRoadIQ((s) => s.status)
  const error = useRoadIQ((s) => s.error)
  const load = useRoadIQ((s) => s.load)
  const view = useRoadIQ((s) => s.view)
  const setView = useRoadIQ((s) => s.setView)
  const presenting = useRoadIQ((s) => s.presentationOpen)
  const reduced = useRoadIQ((s) => s.settings.reducedMotion)
  const webgl = useMemo(() => hasWebGL(), [])
  const checkHealth = useRoadIQ((s) => s.checkHealth)

  useEffect(() => {
    void load()
    const onHash = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [load, setView])

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduced)
  }, [reduced])

  // Keep the backend indicator honest: re-check every 15 s and when the tab regains focus.
  useEffect(() => {
    if (status !== 'ready') return
    void checkHealth()
    const id = window.setInterval(() => void checkHealth(), 15000)
    const onFocus = () => void checkHealth()
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
    }
  }, [status, checkHealth])

  if (status !== 'ready') return <Splash error={status === 'error' ? error : null} onRetry={() => void load()} />

  let content
  switch (view) {
    case 'dashboard':
      content = <DashboardView webgl={webgl} />
      break
    case 'detection':
      content = <DetectionView />
      break
    case 'repairs':
      content = <RepairView />
      break
    case 'analytics':
      content = <AnalyticsView />
      break
    case 'settings':
      content = <SettingsView webgl={webgl} />
      break
    case 'map':
      content = <CityView webgl={webgl} mode="2d" />
      break
    default:
      content = <CityView webgl={webgl} mode="3d" />
  }

  return (
    <div className="flex h-full flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-cyan-500 focus:px-3 focus:py-1 focus:text-slate-950">
        Skip to content
      </a>
      <TopNav webgl={webgl} />
      <div id="main-content" className="min-h-0 flex-1">{presenting ? null : content}</div>
      <CutawayModal webgl={webgl} />
      {presenting && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-[#050b18]"><SceneLoading label="Preparing presentation…" /></div>}>
          <PresentationMode webgl={webgl} />
        </Suspense>
      )}
    </div>
  )
}
