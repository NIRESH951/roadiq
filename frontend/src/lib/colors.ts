import type { Band, Coverage, DamageType, FactorKey, RepairDisplayStatus } from '../api/types'

export const BAND_COLOR: Record<Band, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  none: '#64748b',
}

export const BAND_LABEL: Record<Band, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'No open damage',
}

export const COVERAGE_COLOR: Record<Coverage, string> = {
  recent: '#22c55e',
  overdue: '#f97316',
  never: '#ef4444',
  unknown: '#64748b',
}

export const COVERAGE_LABEL: Record<Coverage, string> = {
  recent: 'Recently inspected',
  overdue: 'Inspection overdue',
  never: 'Never inspected',
  unknown: 'Unknown status',
}

export const REPAIR_COLOR: Record<RepairDisplayStatus | 'none', string> = {
  reinspection_recommended: '#f97316',
  pending_verification: '#a78bfa',
  submitted: '#38bdf8',
  verified: '#22c55e',
  none: '#334155',
}

export const REPAIR_LABEL: Record<RepairDisplayStatus | 'none', string> = {
  reinspection_recommended: 'Manual re-inspection recommended',
  pending_verification: 'Pending verification',
  submitted: 'Repair submitted',
  verified: 'Repair verified',
  none: 'No repair records',
}

export const MONSOON_COLOR = '#38bdf8'

export const DAMAGE_LABEL: Record<DamageType, string> = {
  pothole: 'Pothole',
  longitudinal_crack: 'Longitudinal crack',
  transverse_crack: 'Transverse crack',
  alligator_crack: 'Alligator crack',
}

export const DAMAGE_COLOR: Record<DamageType, string> = {
  pothole: '#22d3ee',
  alligator_crack: '#818cf8',
  transverse_crack: '#38bdf8',
  longitudinal_crack: '#94a3b8',
}

export const FACTOR_META: Record<FactorKey, { label: string; help: string; color: string }> = {
  D: { label: 'Damage', help: 'Damage type × visual severity', color: '#ef4444' },
  T: { label: 'Traffic', help: 'Exposure from road class', color: '#f59e0b' },
  V: { label: 'Vulnerability', help: 'Schools, hospitals, bus stops, crossings nearby', color: '#a78bfa' },
  R: { label: 'Recurrence', help: 'Earlier damage at the same spot', color: '#22d3ee' },
  W: { label: 'Weather & waterlogging', help: 'Recorded waterlogging and drainage reports', color: '#38bdf8' },
}

export const CONTEXT_STYLE: Record<string, { color: string; glyph: string; label: string }> = {
  school: { color: '#facc15', glyph: 'S', label: 'School' },
  hospital: { color: '#f87171', glyph: 'H', label: 'Hospital' },
  bus_stop: { color: '#22d3ee', glyph: 'B', label: 'Bus stop' },
  pedestrian_crossing: { color: '#e2e8f0', glyph: 'X', label: 'Pedestrian crossing' },
  market: { color: '#c084fc', glyph: 'M', label: 'Market' },
}

export const MONSOON_FLAG_LABEL: Record<string, string> = {
  repeated_potholes: 'Repeated potholes',
  waterlogging: 'Waterlogging reports',
  drainage_complaints: 'Drainage complaints',
  recurring_damage: 'Possible recurring damage',
  inspection_overdue: 'Inspection overdue or never done',
}
