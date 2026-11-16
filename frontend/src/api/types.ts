export type Band = 'critical' | 'high' | 'medium' | 'low' | 'none'
export type Coverage = 'recent' | 'overdue' | 'never' | 'unknown'
export type DamageType = 'pothole' | 'longitudinal_crack' | 'transverse_crack' | 'alligator_crack'
export type DefectStatus = 'open' | 'repair_submitted' | 'repaired_verified'
export type RepairDisplayStatus = 'submitted' | 'pending_verification' | 'verified' | 'reinspection_recommended'
export type Source = 'demo' | 'live'
export type FactorKey = 'D' | 'T' | 'V' | 'R' | 'W'

export interface NearbyContext {
  id: string
  kind: string
  name: string
  distance_m: number
  points: number
}

export interface PreviousRecord {
  id: string
  type: DamageType
  detected_on: string
  status: DefectStatus
  source: Source
}

export interface Defect {
  id: string
  segment_id: string
  road_name: string
  type: DamageType
  type_label: string
  confidence: number
  visual_severity: number
  severity_label: string
  x: number
  z: number
  t: number
  lane: number
  detected_on: string
  inspection_id: string | null
  bbox: [number, number, number, number] | null
  image_url: string | null
  model_label: string | null
  source: Source
  status: DefectStatus
  rps: number
  band: Band
  factors: Record<FactorKey, number>
  /** Plain-language inputs behind each factor value, e.g. "100 × visual severity 0.90 × pothole weight 1.00". */
  factor_details?: Record<FactorKey, string>
  /** The weighted sum written out, e.g. "0.35×90.0 + … = 84.8". */
  calculation?: string
  annotated_image_url?: string | null
  nearby: NearbyContext[]
  reasons: string[]
  recurrence_of: string[]
  possible_recurrence: boolean
  previous_records: PreviousRecord[]
}

export interface Segment {
  id: string
  road_code: string
  road_name: string
  road_class: string
  index: number
  x1: number
  z1: number
  x2: number
  z2: number
  width: number
  length_m: number
  rps: number | null
  band: Band
  top_defect_id: string | null
  open_defects: number
  all_defects: number
  coverage: Coverage
  survey_tracked: boolean
  last_inspected_on: string | null
  days_since_inspection: number | null
  inspection_count: number
  repair_status: RepairDisplayStatus | 'none'
  waterlogging_reports: number
  drainage_complaints: number
  monsoon_flags: string[]
  monsoon_watch: boolean
  possible_recurrence: boolean
  source: Source
}

export interface ContextLocation {
  id: string
  kind: 'school' | 'hospital' | 'bus_stop' | 'pedestrian_crossing' | 'market'
  kind_label: string
  name: string
  x: number
  z: number
  axis: 'x' | 'z' | null
  source: Source
}

export interface Inspection {
  id: string
  segment_id: string
  inspected_on: string
  method: string
  notes: string | null
  source: Source
}

export interface Repair {
  id: string
  defect_id: string
  segment_id: string
  submitted_on: string
  verified_on: string | null
  status: 'submitted' | 'pending_verification' | 'verified'
  display_status: RepairDisplayStatus
  crew: string | null
  before_image_url: string | null
  after_image_url: string | null
  later_defects_nearby: string[]
  source: Source
}

export interface Metrics {
  total_defects: number
  critical_roads: number
  high_roads: number
  recurring_damage: number
  inspected_sections: number
  tracked_sections: number
  total_sections: number
  pending_repair_verification: number
  monsoon_watchlist: number
  by_type: Partial<Record<DamageType, number>>
  by_band: Partial<Record<Band, number>>
  by_coverage: Partial<Record<Coverage, number>>
  by_repair_status: Partial<Record<RepairDisplayStatus, number>>
  sources: Partial<Record<Source, number>>
  reports_total: number
  reports_open: number
  reports_awaiting_verification: number
  reports_repaired: number
  reports_by_band: Partial<Record<Band, number>>
  sections_by_band: Partial<Record<Band, number>>
  sections_with_open_damage: number
  repairs_total: number
  repairs_awaiting: number
  repairs_reinspection: number
  repairs_verified: number
  inspected_pct: number
  sections_needing_inspection: number
  dataset: 'demo' | 'mixed' | 'live'
}

export interface HealthStatus {
  status: string
  database: string
  as_of: string
  records: { demo: number; live: number }
  dataset: 'demo' | 'mixed' | 'live'
  detector: { configured: boolean; loaded: boolean; message: string }
}

export interface PriorityConfig {
  weights: Record<FactorKey, number>
  formula: string
  bands: { name: Band; min: number }[]
  vulnerability_radius_m: number
  recurrence_radius_m: number
  recent_inspection_days: number
  monsoon_min_flags: number
  note: string
}

export interface Block {
  i: number
  j: number
  kind: 'park' | 'lake' | 'residential' | 'commercial' | 'offices' | 'school' | 'hospital' | 'market'
}

export interface CityData {
  meta: {
    as_of: string
    generated_at: string
    city_name: string
    metres_per_unit: number
    half_extent: number
    road_half_width: number
    layout_source: Source
    offline_snapshot: boolean
  }
  config: PriorityConfig
  blocks: Block[]
  roads: { code: string; name: string; road_class: string }[]
  segments: Segment[]
  context: ContextLocation[]
  defects: Defect[]
  inspections: Inspection[]
  repairs: Repair[]
  metrics: Metrics
}

export interface DetectorStatus {
  configured: boolean
  loaded?: boolean
  /** Only present when the team saved their own training run's metrics next to the model. */
  validation_metrics?: Record<string, unknown> | null
  model_path: string
  model_file_found: boolean
  library_installed: boolean
  message: string
  classes: string[]
}
