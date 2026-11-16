import { BAND_COLOR, COVERAGE_COLOR, MONSOON_COLOR, REPAIR_COLOR } from './colors'
import type { SegmentAt } from './timeline'
import type { LayerMode } from '../store/useRoadIQ'

export function segmentFrame(seg: SegmentAt, half: number, hw: number) {
  const axis: 'x' | 'z' = seg.z1 === seg.z2 ? 'x' : 'z'
  let a = axis === 'x' ? seg.x1 : seg.z1
  let b = axis === 'x' ? seg.x2 : seg.z2
  if (a > b) [a, b] = [b, a]
  // Trim at intersections so neighbouring overlays do not overlap.
  if (a > -half + 0.5) a += hw
  if (b < half - 0.5) b -= hw
  const mid = (a + b) / 2
  const len = b - a
  const cx = axis === 'x' ? mid : seg.x1
  const cz = axis === 'x' ? seg.z1 : mid
  return { axis, len, cx, cz, width: seg.width }
}

export function segmentLayerColor(seg: SegmentAt, mode: LayerMode): { color: string; opacity: number } {
  switch (mode) {
    case 'priority':
      return seg.bandAt === 'none' ? { color: '#1e293b', opacity: 0.35 } : { color: BAND_COLOR[seg.bandAt], opacity: 0.62 }
    case 'coverage':
      return { color: COVERAGE_COLOR[seg.coverageAt], opacity: 0.6 }
    case 'repair':
      return seg.repairAt === 'none' ? { color: '#1e293b', opacity: 0.3 } : { color: REPAIR_COLOR[seg.repairAt], opacity: 0.62 }
    case 'monsoon':
      return seg.monsoon_watch ? { color: MONSOON_COLOR, opacity: 0.62 } : { color: '#1e293b', opacity: 0.3 }
    default:
      return seg.bandAt === 'none' ? { color: '#000000', opacity: 0 } : { color: BAND_COLOR[seg.bandAt], opacity: 0.2 }
  }
}

