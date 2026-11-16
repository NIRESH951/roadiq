import type { CityData, Defect, Repair } from '../../api/types'
import { toDay } from '../../lib/timeline'
import type { CameraRequest, LayerMode, Settings, Toggles } from '../../store/useRoadIQ'

export interface SceneContext {
  data: CityData
  top: Defect | null
  recurrence: Defect | null
  earlier: Defect | null
  repair: Repair | null
  settings: Settings
}

export interface Callout {
  label: string
  value: string
  tone?: string
}

export interface SceneSetup {
  layerMode: LayerMode
  toggles: Partial<Toggles>
  select: string | null
  camera: Omit<CameraRequest, 'nonce'>
  autoOrbit: boolean
}

export interface SceneDef {
  key: 'problem' | 'detection' | 'impact' | 'memory' | 'radar' | 'repair' | 'vision'
  kicker: string
  title: string
  narrative: (c: SceneContext) => string
  callouts: (c: SceneContext) => Callout[]
  setup: (c: SceneContext) => SceneSetup
}

const focusOn = (d: Defect | null, dist = 1): Omit<CameraRequest, 'nonce'> =>
  d ? { kind: 'preset', position: [d.x + 24 * dist, 26 * dist, d.z + 30 * dist], lookAt: [d.x, 0, d.z] } : { kind: 'reset' }

export function buildContext(data: CityData, settings: Settings): SceneContext {
  const active = data.defects.filter((d) => d.status !== 'repaired_verified').sort((a, b) => b.rps - a.rps)
  const recurrence = data.defects.find((d) => d.possible_recurrence) ?? null
  const earlier = recurrence ? data.defects.find((d) => d.id === recurrence.recurrence_of[0]) ?? null : null
  const repair = (earlier && data.repairs.find((r) => r.defect_id === earlier.id))
    ?? data.repairs.find((r) => r.status !== 'verified') ?? data.repairs[0] ?? null
  return { data, top: active[0] ?? null, recurrence, earlier, repair, settings }
}

export const SCENES: SceneDef[] = [
  {
    key: 'problem',
    kicker: 'Scene 1 · The problem',
    title: 'Every city has damaged roads. Few know which to fix first.',
    narrative: () =>
      'Repairs are usually ordered by complaints or by whoever reports first. A pothole outside a school and one on an empty service road can wait in the same queue.',
    callouts: ({ data }) => [
      { label: 'Unresolved defect reports', value: String(data.metrics.total_defects) },
      { label: 'Road sections', value: String(data.metrics.total_sections) },
      { label: 'Never inspected', value: String(data.metrics.by_coverage.never ?? 0), tone: '#ef4444' },
    ],
    setup: () => ({
      layerMode: 'damage',
      toggles: { markers: true, connections: false, heatmap: false, labels: false, context: true, vehicles: true },
      select: null,
      camera: { kind: 'reset' },
      autoOrbit: true,
    }),
  },
  {
    key: 'detection',
    kicker: 'Scene 2 · AI detection',
    title: 'Detect the damage.',
    narrative: ({ data }) =>
      `A YOLO detector trained on road-damage images finds potholes and longitudinal, transverse and alligator cracks, and reports a confidence for each box. ${
        (data.metrics.sources.live ?? 0) > 0
          ? 'Records marked LIVE came from photos uploaded to this system.'
          : 'No live photos are stored yet, so this view shows a labelled demo record.'
      }`,
    callouts: ({ top, data }) => [
      { label: 'Damage type', value: top?.type_label ?? '—' },
      { label: 'AI model confidence', value: top ? `${(top.confidence * 100).toFixed(0)}%` : '—', tone: '#22d3ee' },
      { label: 'Live / demo records', value: `${data.metrics.sources.live ?? 0} / ${data.metrics.sources.demo ?? 0}` },
    ],
    setup: ({ top }) => ({
      layerMode: 'damage',
      toggles: { markers: true, connections: false, heatmap: false, labels: false },
      select: top?.id ?? null,
      camera: focusOn(top, 0.7),
      autoOrbit: false,
    }),
  },
  {
    key: 'impact',
    kicker: 'Scene 3 · Human impact',
    title: 'Understand its impact.',
    narrative: ({ top }) =>
      top
        ? `${top.type_label} on ${top.road_name}. RoadIQ links it to recorded schools, hospitals, bus stops and crossings nearby, then scores it with a transparent formula. The score ranks repair order; it is not an accident probability.`
        : 'No open damage on record.',
    callouts: ({ top, data }) => [
      { label: 'Road Priority Score (report)', value: top ? `${top.rps.toFixed(0)} · ${top.band.toUpperCase()}` : '—', tone: '#ef4444' },
      { label: 'AI model confidence', value: top ? `${(top.confidence * 100).toFixed(0)}%` : '—', tone: '#22d3ee' },
      { label: `Recorded sensitive places within ${data.config.vulnerability_radius_m} m`, value: top ? String(top.nearby.length) : '—' },
    ],
    setup: ({ top }) => ({
      layerMode: 'damage',
      toggles: { markers: true, connections: true, context: true, labels: false, heatmap: false },
      select: top?.id ?? null,
      camera: focusOn(top, 1.25),
      autoOrbit: false,
    }),
  },
  {
    key: 'memory',
    kicker: 'Scene 4 · Road Memory',
    title: 'The city remembers.',
    narrative: ({ recurrence }) =>
      recurrence
        ? 'The same spot, across inspection dates. Damage appeared again after a repair was submitted, so RoadIQ flags it for manual re-inspection. It does not confirm a repair failure or blame anyone.'
        : 'No recurring damage is on record yet. Road Memory will flag a spot when damage is detected again after a repair.',
    callouts: ({ recurrence, earlier, repair }) => {
      if (!recurrence || !earlier) return []
      const d0 = toDay(earlier.detected_on)
      const out: Callout[] = [{ label: `Day 1 · ${earlier.id}`, value: 'Initial detection' }]
      if (repair && repair.defect_id === earlier.id) out.push({ label: `Day ${toDay(repair.submitted_on) - d0 + 1} · ${repair.id}`, value: 'Repair submitted', tone: '#a78bfa' })
      out.push({ label: `Day ${toDay(recurrence.detected_on) - d0 + 1} · ${recurrence.id}`, value: 'Similar damage again', tone: '#f97316' })
      return out
    },
    setup: ({ recurrence }) => ({
      layerMode: 'damage',
      toggles: { markers: true, connections: false, labels: false, heatmap: false },
      select: recurrence?.id ?? null,
      camera: focusOn(recurrence, 0.8),
      autoOrbit: false,
    }),
  },
  {
    key: 'radar',
    kicker: 'Scene 5 · Survey Gap Radar',
    title: 'Unknown is not safe.',
    narrative: () =>
      'Green roads were inspected recently. Orange roads are overdue. Red roads were never inspected, and grey roads have no survey status. No damage on a red road means no one has looked.',
    callouts: ({ data }) => [
      { label: 'Recently inspected', value: String(data.metrics.by_coverage.recent ?? 0), tone: '#22c55e' },
      { label: 'Overdue', value: String(data.metrics.by_coverage.overdue ?? 0), tone: '#f97316' },
      { label: 'Never inspected', value: String(data.metrics.by_coverage.never ?? 0), tone: '#ef4444' },
      { label: 'Unknown', value: String(data.metrics.by_coverage.unknown ?? 0), tone: '#94a3b8' },
    ],
    setup: () => ({
      layerMode: 'coverage',
      toggles: { markers: false, connections: false, labels: true, heatmap: false },
      select: null,
      camera: { kind: 'top' },
      autoOrbit: false,
    }),
  },
  {
    key: 'repair',
    kicker: 'Scene 6 · Repair verification',
    title: 'Prove the repair.',
    narrative: () =>
      'Crews submit an after-photo, inspectors verify it, and the evidence stays attached to the road’s history. If similar damage returns, the repair is flagged for re-inspection.',
    callouts: ({ data }) => [
      // Mutually exclusive groups: they add up to the number of repairs on record.
      { label: 'Awaiting verification', value: String(data.metrics.repairs_awaiting), tone: '#a78bfa' },
      { label: 'Flagged for re-inspection', value: String(data.metrics.repairs_reinspection), tone: '#f97316' },
      { label: 'Verified', value: String(data.metrics.repairs_verified), tone: '#22c55e' },
    ],
    setup: ({ repair, data }) => {
      const d = repair ? data.defects.find((x) => x.id === repair.defect_id) ?? null : null
      return {
        layerMode: 'repair',
        toggles: { markers: true, connections: false, labels: false, heatmap: false },
        select: null,
        camera: focusOn(d, 1.4),
        autoOrbit: false,
      }
    },
  },
  {
    key: 'vision',
    kicker: 'Scene 7 · RoadIQ',
    title: 'Detect the damage. Understand its impact. Prioritize the repair.',
    narrative: () =>
      'Every intelligence layer on one city model: damage, human impact, history, inspection gaps and repairs, all computed from the same records.',
    callouts: ({ data }) => [
      { label: 'Critical road sections', value: String(data.metrics.critical_roads), tone: '#ef4444' },
      { label: 'High-priority road sections', value: String(data.metrics.high_roads), tone: '#f97316' },
      { label: 'Sections for pre-monsoon checks', value: String(data.metrics.monsoon_watchlist), tone: '#38bdf8' },
    ],
    setup: () => ({
      layerMode: 'priority',
      toggles: { markers: true, connections: true, context: true, labels: false, heatmap: true, vehicles: true },
      select: null,
      camera: { kind: 'preset', position: [78, 74, 96], lookAt: [0, 0, 0] },
      autoOrbit: true,
    }),
  },
]
