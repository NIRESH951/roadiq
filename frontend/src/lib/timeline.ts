import type { Band, CityData, Coverage, Defect, DefectStatus, Repair, RepairDisplayStatus, Segment } from '../api/types'

const DAY = 86_400_000

export const toDay = (iso: string) => Math.round(Date.parse(iso + 'T00:00:00Z') / DAY)
export const fromDay = (day: number) => new Date(day * DAY).toISOString().slice(0, 10)

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export interface TimeRange {
  start: number
  end: number
}

export function timeRange(data: CityData): TimeRange {
  const days = [
    ...data.defects.map((d) => toDay(d.detected_on)),
    ...data.inspections.map((i) => toDay(i.inspected_on)),
    ...data.repairs.map((r) => toDay(r.submitted_on)),
  ]
  const end = toDay(data.meta.as_of)
  const start = days.length ? Math.min(...days) : end - 30
  return { start: Math.min(start, end - 7), end }
}

export interface DefectAt extends Defect {
  statusAt: DefectStatus
}

export interface SegmentAt extends Segment {
  bandAt: Band
  rpsAt: number | null
  coverageAt: Coverage
  repairAt: RepairDisplayStatus | 'none'
  activeDefects: DefectAt[]
}

export interface CityState {
  day: number
  isToday: boolean
  defects: DefectAt[]
  visibleDefects: DefectAt[]
  segments: SegmentAt[]
  repairs: (Repair & { statusAt: RepairDisplayStatus })[]
}

function repairStatusAt(r: Repair, day: number, data: CityData): RepairDisplayStatus | null {
  if (toDay(r.submitted_on) > day) return null
  if (r.verified_on && toDay(r.verified_on) <= day) return 'verified'
  const laterSeen = r.later_defects_nearby.some((id) => {
    const d = data.defects.find((x) => x.id === id)
    return d && toDay(d.detected_on) <= day
  })
  if (laterSeen) return 'reinspection_recommended'
  return r.status === 'verified' ? 'pending_verification' : r.status
}

/** Reconstruct the city as it looked on a given day, from the same records the API returned. */
export function cityAt(data: CityData, day: number): CityState {
  const today = toDay(data.meta.as_of)
  const isToday = day >= today
  const recentDays = data.config.recent_inspection_days

  const repairs = data.repairs
    .map((r) => ({ ...r, statusAt: repairStatusAt(r, day, data) }))
    .filter((r): r is Repair & { statusAt: RepairDisplayStatus } => r.statusAt !== null)

  const defects: DefectAt[] = data.defects
    .filter((d) => toDay(d.detected_on) <= day)
    .map((d) => {
      const reps = repairs.filter((r) => r.defect_id === d.id)
      let statusAt: DefectStatus = 'open'
      if (reps.some((r) => r.statusAt === 'verified')) statusAt = 'repaired_verified'
      else if (reps.length) statusAt = 'repair_submitted'
      return { ...d, statusAt }
    })
  const visibleDefects = defects.filter((d) => d.statusAt !== 'repaired_verified')

  const order: (RepairDisplayStatus | 'none')[] = ['reinspection_recommended', 'pending_verification', 'submitted', 'verified']
  const segments: SegmentAt[] = data.segments.map((s) => {
    const active = visibleDefects.filter((d) => d.segment_id === s.id)
    const top = active.reduce<DefectAt | null>((m, d) => (!m || d.rps > m.rps ? d : m), null)
    const insp = data.inspections.filter((i) => i.segment_id === s.id && toDay(i.inspected_on) <= day)
    const last = insp.length ? Math.max(...insp.map((i) => toDay(i.inspected_on))) : null
    let coverageAt: Coverage
    if (!s.survey_tracked && last === null) coverageAt = 'unknown'
    else if (last === null) coverageAt = 'never'
    else coverageAt = day - last <= recentDays ? 'recent' : 'overdue'
    const segRepairs = repairs.filter((r) => r.segment_id === s.id)
    const repairAt = order.find((st) => segRepairs.some((r) => r.statusAt === st)) ?? 'none'
    return { ...s, bandAt: top ? top.band : 'none', rpsAt: top ? top.rps : null, coverageAt, repairAt, activeDefects: active }
  })

  return { day, isToday, defects, visibleDefects, segments, repairs }
}

export interface TimelineEvent {
  day: number
  date: string
  kind: 'detection' | 'recurrence' | 'repair' | 'verified' | 'inspection'
  label: string
  refId: string
  segmentId: string
  source: string
}

export function timelineEvents(data: CityData, segmentId: string | null): TimelineEvent[] {
  const ev: TimelineEvent[] = []
  for (const d of data.defects) {
    if (segmentId && d.segment_id !== segmentId) continue
    ev.push({
      day: toDay(d.detected_on), date: d.detected_on,
      kind: d.possible_recurrence ? 'recurrence' : 'detection',
      label: d.possible_recurrence
        ? `Similar ${d.type_label.toLowerCase()} detected again (${d.id}), possible recurrence`
        : d.recurrence_of.length
          ? `${d.type_label} detected again at a known spot (${d.id})`
          : `${d.type_label} detected (${d.id})`,
      refId: d.id, segmentId: d.segment_id, source: d.source,
    })
  }
  for (const r of data.repairs) {
    if (segmentId && r.segment_id !== segmentId) continue
    ev.push({ day: toDay(r.submitted_on), date: r.submitted_on, kind: 'repair',
      label: `Repair submitted for ${r.defect_id} (${r.id})`, refId: r.defect_id, segmentId: r.segment_id, source: r.source })
    if (r.verified_on)
      ev.push({ day: toDay(r.verified_on), date: r.verified_on, kind: 'verified',
        label: `Repair verified (${r.id})`, refId: r.defect_id, segmentId: r.segment_id, source: r.source })
  }
  if (segmentId) {
    const detectionDays = new Set(ev.filter((e) => e.kind === 'detection' || e.kind === 'recurrence').map((e) => e.day))
    for (const i of data.inspections) {
      if (i.segment_id !== segmentId || detectionDays.has(toDay(i.inspected_on))) continue
      ev.push({ day: toDay(i.inspected_on), date: i.inspected_on, kind: 'inspection',
        label: `Inspection with no new damage recorded (${i.id})`, refId: i.id, segmentId: i.segment_id, source: i.source })
    }
  }
  return ev.sort((a, b) => a.day - b.day || a.kind.localeCompare(b.kind))
}
