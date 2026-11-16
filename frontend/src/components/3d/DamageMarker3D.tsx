import { Html, Line } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { memo, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BAND_COLOR, BAND_LABEL, REPAIR_COLOR, REPAIR_LABEL } from '../../lib/colors'
import type { DefectAt } from '../../lib/timeline'
import { damageTexture, glowTexture } from './textures'

export function decalSize(d: DefectAt): [number, number] {
  const s = d.visual_severity
  switch (d.type) {
    case 'pothole':
      return [2 + 2.2 * s, 1.7 + 1.8 * s]
    case 'longitudinal_crack':
      return [4.5 + 3 * s, 1.6]
    case 'transverse_crack':
      return [1.6, 4 + 2.4 * s]
    default:
      return [3 + 2 * s, 2.6 + 1.6 * s]
  }
}

interface Props {
  d: DefectAt
  axis: 'x' | 'z'
  selected: boolean
  hovered: boolean
  showPin: boolean
  reducedMotion: boolean
  /** The repair layer draws its own status chips; avoid duplicates there. */
  hideRepairChip?: boolean
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

function DamageMarker3D({ d, axis, selected, hovered, showPin, reducedMotion, hideRepairChip = false, onSelect, onHover }: Props) {
  const head = useRef<THREE.Mesh>(null)
  const pulse = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const phase = useMemo(() => (d.x * 13.1 + d.z * 7.7) % 6.28, [d.x, d.z])
  const color = BAND_COLOR[d.band]
  const inRepair = d.statusAt === 'repair_submitted'
  const [w, h] = decalSize(d)
  const critical = d.band === 'critical' && !inRepair

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (head.current) {
      head.current.position.y = 7 + (reducedMotion ? 0 : Math.sin(t * 2 + phase) * 0.22)
      head.current.rotation.y = reducedMotion ? 0 : t * 0.8
    }
    if (pulse.current) {
      const k = reducedMotion ? 0.5 : (t * 0.65 + phase) % 1
      pulse.current.scale.setScalar(1 + k * 3.2)
      ;(pulse.current.material as THREE.MeshBasicMaterial).opacity = reducedMotion ? 0.35 : 0.65 * (1 - k)
    }
    if (ring.current && !reducedMotion) ring.current.rotation.z = t * 0.9
  })

  const handlers = {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      onSelect(d.id)
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      onHover(d.id)
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      onHover(null)
      document.body.style.cursor = ''
    },
  }

  const decalRot: [number, number, number] = [-Math.PI / 2, 0, axis === 'z' ? Math.PI / 2 : 0]
  // Detection outline: the AI box around the damage, drawn flat on the road.
  const outline = useMemo(() => {
    const [hx, hz] = axis === 'x' ? [w / 2 + 0.4, h / 2 + 0.4] : [h / 2 + 0.4, w / 2 + 0.4]
    return [
      [-hx, 0.2, -hz], [hx, 0.2, -hz], [hx, 0.2, hz], [-hx, 0.2, hz], [-hx, 0.2, -hz],
    ] as [number, number, number][]
  }, [axis, w, h])

  return (
    <group position={[d.x, 0, d.z]}>
      <mesh position={[0, 0.125, 0]} rotation={decalRot} {...handlers}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={damageTexture(d.type)} transparent alphaTest={0.05} depthWrite={false} roughness={1}
          polygonOffset polygonOffsetFactor={-2} />
      </mesh>

      {showPin && (
        <group>
          <mesh position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[Math.max(w, h) * 0.5 + 0.6, 32]} />
            <meshBasicMaterial color={color} transparent opacity={inRepair ? 0.08 : 0.22} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, 3.4, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 6.8, 6]} />
            <meshBasicMaterial color={color} transparent opacity={inRepair ? 0.35 : 0.75} toneMapped={false} />
          </mesh>
          <mesh ref={head} position={[0, 7, 0]} {...handlers}>
            <octahedronGeometry args={[selected ? 1.35 : 1.1, 0]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={inRepair ? 0.5 : 1.6}
              wireframe={inRepair} toneMapped={false} />
          </mesh>
          <sprite position={[0, 7, 0]} scale={[4.6, 4.6, 1]}>
            <spriteMaterial map={glowTexture()} color={color} transparent opacity={inRepair ? 0.2 : 0.55}
              depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
          {inRepair && !hideRepairChip && (
            <Html position={[0, 9, 0]} center zIndexRange={[30, 1]} style={{ pointerEvents: 'none' }}>
              <div className="chip3d" style={{ borderColor: REPAIR_COLOR.submitted }}>🔧 {REPAIR_LABEL.submitted}</div>
            </Html>
          )}
        </group>
      )}

      {showPin && critical && (
        <mesh ref={pulse} position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.15, 40]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} toneMapped={false} />
        </mesh>
      )}

      {selected && (
        <group>
          <mesh ref={ring} position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[Math.max(w, h) * 0.5 + 1.6, 0.12, 8, 64]} />
            <meshBasicMaterial color="#22d3ee" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[Math.max(w, h) * 0.5 + 1.6, 48]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.12} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, 9, 0]}>
            <cylinderGeometry args={[0.35, 0.9, 18, 16, 1, true]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <Line points={outline} color="#67e8f9" lineWidth={2} dashed dashSize={0.5} gapSize={0.25} />
          <Html position={[0, 0.2, (axis === 'x' ? h : w) / 2 + 1.2]} center zIndexRange={[30, 1]} style={{ pointerEvents: 'none' }}>
            <div className="chip3d" style={{ borderColor: '#22d3ee' }}>
              AI box · {d.type_label} · {(d.confidence * 100).toFixed(0)}% conf.
            </div>
          </Html>
        </group>
      )}

      {hovered && !selected && (
        <Html position={[0, 9.4, 0]} center zIndexRange={[40, 1]} style={{ pointerEvents: 'none' }}>
          <div className="tooltip3d">
            <div className="font-semibold text-white">{d.id} · {d.type_label}</div>
            <div className="text-slate-300">{d.road_name} ({d.segment_id})</div>
            <div style={{ color }}>RPS {d.rps.toFixed(0)} · {BAND_LABEL[d.band]}</div>
            <div className="text-slate-400">Model confidence {(d.confidence * 100).toFixed(0)}%</div>
          </div>
        </Html>
      )}
    </group>
  )
}

export default memo(DamageMarker3D)
