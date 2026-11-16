import { QuadraticBezierLine } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { memo, useRef } from 'react'
import type { ContextLocation, Defect } from '../../api/types'
import { CONTEXT_STYLE } from '../../lib/colors'
import { BEACON_HEIGHT } from './ContextMarker3D'

type LineRef = { material: { dashOffset: number } } | null

function Arc({ from, to, color, reducedMotion }: {
  from: [number, number, number]; to: [number, number, number]; color: string; reducedMotion: boolean
}) {
  const ref = useRef<LineRef>(null)
  useFrame((_, dt) => {
    if (!reducedMotion && ref.current) ref.current.material.dashOffset -= dt * 2
  })
  const dist = Math.hypot(to[0] - from[0], to[2] - from[2])
  const mid: [number, number, number] = [(from[0] + to[0]) / 2, Math.max(from[1], to[1]) + 4 + dist * 0.18, (from[2] + to[2]) / 2]
  return (
    <QuadraticBezierLine
      // drei's line ref type is broader than we need; we only touch dashOffset.
      ref={ref as never}
      start={from}
      end={to}
      mid={mid}
      color={color}
      lineWidth={2.2}
      dashed
      dashSize={1}
      gapSize={0.6}
      transparent
      opacity={0.95}
    />
  )
}

/** Connects a selected defect to the recorded sensitive locations that raised its Vulnerability score. */
function ImpactConnections3D({ defect, context, reducedMotion }: {
  defect: Defect; context: ContextLocation[]; reducedMotion: boolean
}) {
  return (
    <group>
      {defect.nearby.map((n) => {
        const c = context.find((x) => x.id === n.id)
        if (!c) return null
        const style = CONTEXT_STYLE[c.kind]
        return (
          <Arc key={n.id} from={[defect.x, 0.6, defect.z]} to={[c.x, (BEACON_HEIGHT[c.kind] ?? 5) + 1.4, c.z]}
            color={style?.color ?? '#94a3b8'} reducedMotion={reducedMotion} />
        )
      })}
    </group>
  )
}

export default memo(ImpactConnections3D)
