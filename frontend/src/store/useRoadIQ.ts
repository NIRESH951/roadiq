import { useMemo } from 'react'
import { create } from 'zustand'
import { getHealth, loadCity, OFFLINE_ONLY, setOfflineAssets } from '../api/client'
import type { CityData, HealthStatus } from '../api/types'
import { cityAt, toDay, type CityState } from '../lib/timeline'
import { prefersReducedMotion } from '../lib/webgl'

export type View = 'dashboard' | 'city' | 'detection' | 'map' | 'memory' | 'radar' | 'repairs' | 'analytics' | 'settings'
export type LayerMode = 'damage' | 'priority' | 'coverage' | 'repair' | 'monsoon'
export type Quality = 'high' | 'low'
/** connected: API answering · unavailable: API not answering (showing cached data) · static: preview build with no backend by design */
export type Connection = 'checking' | 'connected' | 'unavailable' | 'static'

export interface Toggles {
  markers: boolean
  context: boolean
  connections: boolean
  heatmap: boolean
  vehicles: boolean
  labels: boolean
}

export interface CameraRequest {
  kind: 'reset' | 'top' | 'perspective' | 'focus' | 'preset' | 'zoomIn' | 'zoomOut'
  target?: [number, number]
  position?: [number, number, number]
  lookAt?: [number, number, number]
  nonce: number
}

export interface Settings {
  quality: Quality
  reducedMotion: boolean
  statistic: string
  statisticSource: string
}

interface RoadIQState {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  data: CityData | null
  offline: boolean
  offlineReason: string | null
  connection: Connection
  health: HealthStatus | null
  lastHealthAt: number | null
  view: View
  layerMode: LayerMode
  toggles: Toggles
  selectedDefectId: string | null
  selectedSegmentId: string | null
  hoveredId: string | null
  day: number | null
  cameraMode: 'perspective' | 'top'
  cameraRequest: CameraRequest | null
  autoOrbit: boolean
  settings: Settings
  presentationOpen: boolean
  sceneIndex: number
  cutawayOpen: boolean
  timelineOpen: boolean
  sidebarOpen: boolean

  load: () => Promise<void>
  checkHealth: () => Promise<void>
  setView: (v: View) => void
  setLayerMode: (m: LayerMode) => void
  toggle: (k: keyof Toggles, value?: boolean) => void
  setToggles: (t: Partial<Toggles>) => void
  selectDefect: (id: string | null, focus?: boolean) => void
  selectSegment: (id: string | null) => void
  setHovered: (id: string | null) => void
  setDay: (d: number | null) => void
  camera: (req: Omit<CameraRequest, 'nonce'>) => void
  setAutoOrbit: (v: boolean) => void
  updateSettings: (s: Partial<Settings>) => void
  openPresentation: () => void
  closePresentation: () => void
  setScene: (i: number) => void
  setCutaway: (v: boolean) => void
  setTimelineOpen: (v: boolean) => void
  setSidebarOpen: (v: boolean) => void
}

const SETTINGS_KEY = 'roadiq.settings.v1'

function loadSettings(): Settings {
  const defaults: Settings = { quality: 'high', reducedMotion: prefersReducedMotion(), statistic: '', statisticSource: '' }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch {
    return defaults
  }
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable: keep settings in memory */
  }
}

const VIEWS: View[] = ['dashboard', 'city', 'detection', 'map', 'memory', 'radar', 'repairs', 'analytics', 'settings']
// Plain #name hashes (no #/path) so links also work where only simple fragments survive.
// "settings" is shown as #preferences because some hosts reserve #settings.
const HASH_ALIAS: Partial<Record<View, string>> = { settings: 'preferences' }
export const hashForView = (v: View) => `#${HASH_ALIAS[v] ?? v}`
export const viewFromHash = (): View => {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const h = (raw === 'preferences' ? 'settings' : raw) as View
  return VIEWS.includes(h) ? h : 'city'
}

let nonce = 0

export const useRoadIQ = create<RoadIQState>((set, get) => ({
  status: 'loading',
  error: null,
  data: null,
  offline: false,
  offlineReason: null,
  connection: OFFLINE_ONLY ? 'static' : 'checking',
  health: null,
  lastHealthAt: null,
  view: viewFromHash(),
  layerMode: 'damage',
  toggles: { markers: true, context: true, connections: true, heatmap: false, vehicles: true, labels: false },
  selectedDefectId: null,
  selectedSegmentId: null,
  hoveredId: null,
  day: null,
  cameraMode: 'perspective',
  cameraRequest: null,
  autoOrbit: false,
  settings: loadSettings(),
  presentationOpen: false,
  sceneIndex: 0,
  cutawayOpen: false,
  timelineOpen: true,
  sidebarOpen: false,

  load: async () => {
    set({ status: get().data ? 'ready' : 'loading', error: null })
    try {
      const res = await loadCity()
      setOfflineAssets(res.offline)
      const { selectedDefectId, selectedSegmentId } = get()
      set({
        data: res.data,
        offline: res.offline,
        offlineReason: res.reason ?? null,
        connection: OFFLINE_ONLY ? 'static' : res.offline ? 'unavailable' : 'connected',
        status: 'ready',
        selectedDefectId: res.data.defects.some((d) => d.id === selectedDefectId) ? selectedDefectId : null,
        selectedSegmentId: res.data.segments.some((s) => s.id === selectedSegmentId) ? selectedSegmentId : null,
      })
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  },
  checkHealth: async () => {
    if (OFFLINE_ONLY) return
    const before = get().connection
    try {
      const health = await getHealth()
      set({ connection: 'connected', health, lastHealthAt: Date.now() })
      // Backend came back while we were showing cached data: reload the real records.
      if (get().offline || before === 'unavailable') await get().load()
    } catch {
      set({ connection: 'unavailable', health: null, lastHealthAt: Date.now() })
    }
  },
  setView: (v) => {
    const patch: Partial<RoadIQState> = { view: v, sidebarOpen: false }
    if (v === 'radar') {
      patch.layerMode = 'coverage'
      patch.selectedDefectId = null
      patch.selectedSegmentId = null
    }
    if (v === 'memory') {
      patch.timelineOpen = true
      if (get().layerMode === 'coverage') patch.layerMode = 'damage'
      const data = get().data
      if (data && !get().selectedDefectId) {
        const rec = data.defects.find((d) => d.possible_recurrence)
        if (rec) {
          patch.selectedDefectId = rec.id
          patch.selectedSegmentId = rec.segment_id
        }
      }
    }
    if ((v === 'city' || v === 'map') && get().view === 'radar') patch.layerMode = 'damage'
    set(patch)
    try {
      if (window.location.hash !== hashForView(v)) window.history.replaceState(null, '', hashForView(v))
    } catch {
      /* some embedded viewers block history changes; the in-app view still switches */
    }
  },
  setLayerMode: (m) => set({ layerMode: m }),
  toggle: (k, value) => set((s) => ({ toggles: { ...s.toggles, [k]: value ?? !s.toggles[k] } })),
  setToggles: (t) => set((s) => ({ toggles: { ...s.toggles, ...t } })),
  selectDefect: (id, focus = false) => {
    const data = get().data
    const d = id ? data?.defects.find((x) => x.id === id) : null
    set({ selectedDefectId: d ? d.id : null, selectedSegmentId: d ? d.segment_id : get().selectedSegmentId, sidebarOpen: false })
    if (!id) set({ selectedSegmentId: null })
    if (d && focus) get().camera({ kind: 'focus', target: [d.x, d.z] })
  },
  selectSegment: (id) => set({ selectedSegmentId: id, selectedDefectId: null }),
  setHovered: (id) => set({ hoveredId: id }),
  setDay: (d) => {
    const data = get().data
    if (d !== null && data && d >= toDay(data.meta.as_of)) d = null
    set({ day: d })
  },
  camera: (req) => {
    nonce += 1
    const patch: Partial<RoadIQState> = { cameraRequest: { ...req, nonce } }
    if (req.kind === 'top') patch.cameraMode = 'top'
    if (req.kind === 'perspective' || req.kind === 'reset') patch.cameraMode = 'perspective'
    set(patch)
  },
  setAutoOrbit: (v) => set({ autoOrbit: v }),
  updateSettings: (s) => {
    const settings = { ...get().settings, ...s }
    saveSettings(settings)
    set({ settings })
  },
  openPresentation: () => set({ presentationOpen: true, sceneIndex: 0 }),
  closePresentation: () => set({ presentationOpen: false, autoOrbit: false, day: null }),
  setScene: (i) => set({ sceneIndex: i }),
  setCutaway: (v) => set({ cutawayOpen: v }),
  setTimelineOpen: (v) => set({ timelineOpen: v }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
}))

/** The city reconstructed for the timeline day currently selected (today by default). */
export function useCityState(): CityState | null {
  const data = useRoadIQ((s) => s.data)
  const day = useRoadIQ((s) => s.day)
  return useMemo(() => (data ? cityAt(data, day ?? toDay(data.meta.as_of)) : null), [data, day])
}

export function useSelectedDefect() {
  const data = useRoadIQ((s) => s.data)
  const id = useRoadIQ((s) => s.selectedDefectId)
  return useMemo(() => (data && id ? data.defects.find((d) => d.id === id) ?? null : null), [data, id])
}
