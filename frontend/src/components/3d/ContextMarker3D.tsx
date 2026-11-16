import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { memo, useRef } from 'react'
import * as THREE from 'three'
import type { ContextLocation } from '../../api/types'
import { CONTEXT_STYLE } from '../../lib/colors'

export const BEACON_HEIGHT: Record<string, number> = {
  school: 8,
  hospital: 15,
  market: 6,
  bus_stop: 5,
  pedestrian_crossing: 4,
}

function School() {
  return (
    <group position={[0, 0.35, 0]}>
      <mesh position={[0, 1.8, 0]} castShadow>
        <boxGeometry args={[11, 3.6, 6]} />
        <meshStandardMaterial color="#d8c8a2" roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.85, 0]}>
        <boxGeometry args={[11.6, 0.5, 6.6]} />
        <meshStandardMaterial color="#b4532a" roughness={0.7} />
      </mesh>
      {[-3.5, 0, 3.5].map((x) => (
        <mesh key={x} position={[x, 2, 3.02]}>
          <planeGeometry args={[1.8, 1.2]} />
          <meshStandardMaterial color="#1f2937" emissive="#fde68a" emissiveIntensity={0.6} />
        </mesh>
      ))}
      <mesh position={[6.4, 3, 2.6]}>
        <cylinderGeometry args={[0.06, 0.06, 6, 6]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <mesh position={[7.0, 5.5, 2.6]}>
        <planeGeometry args={[1.2, 0.8]} />
        <meshStandardMaterial color="#facc15" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.02, -6.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 5]} />
        <meshStandardMaterial color="#2f6b45" />
      </mesh>
    </group>
  )
}

function Hospital() {
  return (
    <group position={[0, 0.35, 0]}>
      <mesh position={[0, 5, 0]} castShadow>
        <boxGeometry args={[9, 10, 7]} />
        <meshStandardMaterial color="#e5ecf5" roughness={0.6} emissive="#9fb6d9" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[-6.5, 2, 0]} castShadow>
        <boxGeometry args={[4, 4, 9]} />
        <meshStandardMaterial color="#d6dfeb" roughness={0.6} />
      </mesh>
      {[[0, 7.5, 3.52], [0, 7.5, -3.52]].map((p, i) => (
        <group key={i} position={p as [number, number, number]} rotation={[0, i ? Math.PI : 0, 0]}>
          <mesh>
            <planeGeometry args={[2.6, 0.8]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.2} toneMapped={false} />
          </mesh>
          <mesh>
            <planeGeometry args={[0.8, 2.6]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.2} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 10.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2, 2.4, 32]} />
        <meshBasicMaterial color="#facc15" />
      </mesh>
    </group>
  )
}

function Market() {
  const colours = ['#c084fc', '#f472b6', '#38bdf8', '#facc15']
  return (
    <group position={[0, 0.35, 0]}>
      {colours.map((c, i) => (
        <group key={c} position={[(i % 2) * 4.5 - 2.25, 0, Math.floor(i / 2) * 4.5 - 2.25]}>
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[3, 1.2, 3]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
          <mesh position={[0, 2, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[2.5, 1.2, 4]} />
            <meshStandardMaterial color={c} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function BusStop({ alongX }: { alongX: boolean }) {
  return (
    <group position={[0, 0.35, 0]} rotation={[0, alongX ? 0 : Math.PI / 2, 0]}>
      <mesh position={[0, 2.3, 0]}>
        <boxGeometry args={[3.2, 0.12, 1.3]} />
        <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.5} />
      </mesh>
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} position={[x, 1.15, -0.5]}>
          <boxGeometry args={[0.1, 2.3, 0.1]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      ))}
      <mesh position={[0, 1.2, -0.55]}>
        <boxGeometry args={[3, 1.8, 0.05]} />
        <meshStandardMaterial color="#67e8f9" transparent opacity={0.35} />
      </mesh>
    </group>
  )
}

function Crossing({ ctx }: { ctx: ContextLocation }) {
  // Stripes run parallel to traffic and are spaced across the road.
  const roadAlongZ = ctx.axis === 'z'
  return (
    <group rotation={[0, roadAlongZ ? 0 : Math.PI / 2, 0]}>
      {[-3, -1.8, -0.6, 0.6, 1.8, 3].map((o) => (
        <mesh key={o} position={[o, 0.1, 0]}>
          <boxGeometry args={[0.6, 0.02, 2.6]} />
          <meshStandardMaterial color="#f1f5f9" emissive="#64748b" emissiveIntensity={0.4} />
        </mesh>
      ))}
    </group>
  )
}

interface Props {
  ctx: ContextLocation
  highlighted: boolean
  showLabel: boolean
  showBeacon: boolean
  reducedMotion: boolean
  /** Bus stops: true when the nearest road runs along x. */
  alongX?: boolean
}

function ContextMarker3D({ ctx, highlighted, showLabel, showBeacon, reducedMotion, alongX = true }: Props) {
  const glow = useRef<THREE.Mesh>(null)
  const style = CONTEXT_STYLE[ctx.kind] ?? { color: '#94a3b8', glyph: '?', label: ctx.kind }
  const h = BEACON_HEIGHT[ctx.kind] ?? 5

  useFrame(({ clock }) => {
    if (!glow.current) return
    const k = reducedMotion ? 0.6 : 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3)
    glow.current.scale.setScalar(1 + k * 0.25)
    ;(glow.current.material as THREE.MeshBasicMaterial).opacity = 0.25 + k * 0.25
  })

  return (
    <group position={[ctx.x, 0, ctx.z]}>
      {ctx.kind === 'school' && <School />}
      {ctx.kind === 'hospital' && <Hospital />}
      {ctx.kind === 'market' && <Market />}
      {ctx.kind === 'bus_stop' && <BusStop alongX={alongX} />}
      {ctx.kind === 'pedestrian_crossing' && <Crossing ctx={ctx} />}

      {showBeacon && (
        <group>
          <mesh position={[0, h + 1.4, 0]}>
            <sphereGeometry args={[highlighted ? 0.75 : 0.5, 16, 12]} />
            <meshBasicMaterial color={style.color} toneMapped={false} />
          </mesh>
          <mesh position={[0, (h + 1.4) / 2, 0]}>
            <cylinderGeometry args={[0.03, 0.03, h + 1.4, 4]} />
            <meshBasicMaterial color={style.color} transparent opacity={0.45} />
          </mesh>
        </group>
      )}

      {highlighted && (
        <mesh ref={glow} position={[0, 0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ctx.kind === 'hospital' || ctx.kind === 'school' ? 8 : 3.4, ctx.kind === 'hospital' || ctx.kind === 'school' ? 8.6 : 3.9, 48]} />
          <meshBasicMaterial color={style.color} transparent opacity={0.4} depthWrite={false} toneMapped={false} />
        </mesh>
      )}

      {(showLabel || highlighted) && (
        <Html position={[0, h + 3, 0]} center zIndexRange={[25, 1]} style={{ pointerEvents: 'none' }}>
          <div className="chip3d" style={{ borderColor: style.color }}>
            <span className="glyph" style={{ background: style.color }}>{style.glyph}</span>
            {ctx.name}
          </div>
        </Html>
      )}
    </group>
  )
}

export default memo(ContextMarker3D)
