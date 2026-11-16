import type { Block, CityData, ContextLocation } from '../../api/types'
import { seeded } from './textures'

/** Deterministic visual layout of the miniature city, derived from the API's roads, blocks and context. */

export interface Rect {
  x0: number
  x1: number
  z0: number
  z1: number
}

export interface BuildingInstance {
  x: number
  z: number
  w: number
  d: number
  heightClass: number
  color: string
}

export interface TreeInstance {
  x: number
  z: number
  s: number
}

export interface Lamp {
  x: number
  z: number
}

export interface RoadStrip {
  code: string
  axis: 'x' | 'z'
  offset: number
}

export interface CityLayout {
  half: number
  hw: number
  roads: RoadStrip[]
  crossOffsets: { x: number[]; z: number[] }
  blocks: (Block & Rect)[]
  buildings: BuildingInstance[]
  trees: TreeInstance[]
  lamps: Lamp[]
  dashes: { x: number; z: number; axis: 'x' | 'z' }[]
}

export const HEIGHT_CLASSES = [3, 5, 7.5, 10.5, 14]

const PALETTE: Record<string, string[]> = {
  residential: ['#9aa4b8', '#8d97ad', '#a7aec0', '#8a93a6'],
  commercial: ['#7f97c4', '#7088b7', '#8aa1cc'],
  offices: ['#5f7db3', '#6a8bc4', '#56709f', '#7393c9'],
  school: ['#b9a98a'],
  hospital: ['#c3cbd8'],
  market: ['#a68fbf'],
}

const HEIGHT_RANGE: Record<string, [number, number]> = {
  residential: [0, 2],
  commercial: [1, 3],
  offices: [2, 4],
  school: [0, 1],
  hospital: [0, 2],
  market: [0, 1],
}

function axisEdges(half: number, offsets: number[], hw: number): [number, number][] {
  const edges = [-half, ...offsets.sort((a, b) => a - b), half]
  const out: [number, number][] = []
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i] + (i > 0 ? hw : 0)
    const b = edges[i + 1] - (i < edges.length - 2 ? hw : 0)
    out.push([a, b])
  }
  return out
}

function nearLandmark(x: number, z: number, landmarks: ContextLocation[], r: number) {
  return landmarks.some((c) => Math.hypot(c.x - x, c.z - z) < r)
}

export function buildLayout(data: CityData, quality: 'high' | 'low'): CityLayout {
  const half = data.meta.half_extent
  const hw = data.meta.road_half_width
  const roadsMeta = data.segments.reduce<Record<string, RoadStrip>>((acc, s) => {
    if (!acc[s.road_code]) {
      const axis = s.z1 === s.z2 ? 'x' : 'z'
      acc[s.road_code] = { code: s.road_code, axis, offset: axis === 'x' ? s.z1 : s.x1 }
    }
    return acc
  }, {})
  const roads = Object.values(roadsMeta)
  const xOffsets = roads.filter((r) => r.axis === 'z').map((r) => r.offset)
  const zOffsets = roads.filter((r) => r.axis === 'x').map((r) => r.offset)
  const xs = axisEdges(half, [...xOffsets], hw)
  const zs = axisEdges(half, [...zOffsets], hw)

  const landmarks = data.context.filter((c) => ['school', 'hospital', 'market'].includes(c.kind))
  const stops = data.context.filter((c) => c.kind === 'bus_stop' || c.kind === 'pedestrian_crossing')
  const rnd = seeded(20261115)

  const blocks: (Block & Rect)[] = data.blocks
    .filter((b) => xs[b.i] && zs[b.j])
    .map((b) => ({ ...b, x0: xs[b.i][0], x1: xs[b.i][1], z0: zs[b.j][0], z1: zs[b.j][1] }))

  const buildings: BuildingInstance[] = []
  const trees: TreeInstance[] = []
  const treeStep = quality === 'high' ? 6.5 : 11

  for (const b of blocks) {
    const inset = 2.2
    const ix0 = b.x0 + inset, ix1 = b.x1 - inset, iz0 = b.z0 + inset, iz1 = b.z1 - inset
    if (b.kind === 'park' || b.kind === 'lake') {
      const n = quality === 'high' ? (b.kind === 'park' ? 26 : 14) : 8
      for (let k = 0; k < n; k++) {
        const x = ix0 + rnd() * (ix1 - ix0)
        const z = iz0 + rnd() * (iz1 - iz0)
        if (b.kind === 'lake') {
          const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2
          const rx = (b.x1 - b.x0) / 2 - 5, rz = (b.z1 - b.z0) / 2 - 4
          if (((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 < 1.1) continue
        }
        trees.push({ x, z, s: 0.8 + rnd() * 0.6 })
      }
      continue
    }
    const cell = b.kind === 'offices' ? 8 : 6.5
    const nx = Math.max(1, Math.floor((ix1 - ix0) / cell))
    const nz = Math.max(1, Math.floor((iz1 - iz0) / cell))
    const cw = (ix1 - ix0) / nx, cd = (iz1 - iz0) / nz
    const colors = PALETTE[b.kind] ?? PALETTE.residential
    const [hmin, hmax] = HEIGHT_RANGE[b.kind] ?? [0, 2]
    for (let a = 0; a < nx; a++) {
      for (let c = 0; c < nz; c++) {
        const x = ix0 + cw * (a + 0.5)
        const z = iz0 + cd * (c + 0.5)
        if (nearLandmark(x, z, landmarks, b.kind === 'hospital' ? 12 : 10)) continue
        if (rnd() < 0.2) continue
        const heightClass = hmin + Math.floor(rnd() * (hmax - hmin + 1))
        buildings.push({
          x, z,
          w: cw - 1.4 - rnd() * 1.2,
          d: cd - 1.4 - rnd() * 1.2,
          heightClass,
          color: colors[Math.floor(rnd() * colors.length)],
        })
      }
    }
    // Street trees along the block edge
    for (let x = b.x0 + 2; x <= b.x1 - 2; x += treeStep) {
      for (const z of [b.z0 + 1, b.z1 - 1]) {
        if (!nearLandmark(x, z, stops, 4)) trees.push({ x, z, s: 0.55 + rnd() * 0.25 })
      }
    }
  }

  const lamps: Lamp[] = []
  const dashes: CityLayout['dashes'] = []
  const lampStep = quality === 'high' ? 12 : 20
  for (const r of roads) {
    const crosses = r.axis === 'x' ? xOffsets : zOffsets
    for (let s = -half + 4; s <= half - 4; s += lampStep) {
      if (crosses.some((c) => Math.abs(c - s) < hw + 2.5)) continue
      for (const side of [-1, 1]) {
        const off = r.offset + side * (hw + 0.9)
        lamps.push(r.axis === 'x' ? { x: s, z: off } : { x: off, z: s })
      }
    }
    for (let s = -half + 1; s < half - 1; s += 4) {
      if (crosses.some((c) => Math.abs(c - (s + 1)) < hw + 1)) continue
      dashes.push(r.axis === 'x' ? { x: s + 1, z: r.offset, axis: 'x' } : { x: r.offset, z: s + 1, axis: 'z' })
    }
  }

  return { half, hw, roads, crossOffsets: { x: xOffsets, z: zOffsets }, blocks, buildings, trees, lamps, dashes }
}
