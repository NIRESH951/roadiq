import type { DamageType } from '../../api/types'

export interface RoadLayer {
  key: string
  name: string
  thickness: number
  color: string
  description: string
}

export const ROAD_LAYERS: RoadLayer[] = [
  { key: 'surface', name: 'Asphalt surface', thickness: 0.55, color: '#2b2e35',
    description: 'The bituminous layer vehicles drive on. It seals the road against water and spreads wheel loads. Once it cracks, water can reach the layers below.' },
  { key: 'base', name: 'Base course', thickness: 1.0, color: '#7b818b',
    description: 'Compacted crushed aggregate that carries most of the traffic load. When water weakens it, the surface above loses support.' },
  { key: 'subbase', name: 'Sub-base', thickness: 1.2, color: '#a88c63',
    description: 'Granular material that drains water away and spreads the load further down.' },
  { key: 'soil', name: 'Soil foundation', thickness: 2.0, color: '#6b4a31',
    description: 'The natural or compacted ground (subgrade). If it becomes saturated or weak, the layers above deform.' },
]

export const DAMAGE_EXPLANATION: Record<DamageType, string> = {
  pothole: 'Illustration: water enters through surface cracks, the base course weakens under repeated wheel loads, and pieces of asphalt break away, leaving a bowl-shaped hole.',
  longitudinal_crack: 'Illustration: a crack running along the direction of traffic, often from a poorly bonded construction joint or fatigue in the wheel path.',
  transverse_crack: 'Illustration: a crack running across the road, commonly from temperature shrinkage of the asphalt or cracks reflecting up from layers below.',
  alligator_crack: 'Illustration: interconnected cracks that look like alligator skin, typical of fatigue when the base or soil below cannot support the traffic load.',
}

