import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import type { DamageType } from '../../api/types'
import { ROAD_LAYERS, type RoadLayer } from './roadLayers'

const W = 14
const D = 9

function extrudeWithHole(hole: THREE.Path, depth: number) {
  const shape = new THREE.Shape()
  shape.moveTo(-W / 2, -D / 2)
  shape.lineTo(W / 2, -D / 2)
  shape.lineTo(W / 2, D / 2)
  shape.lineTo(-W / 2, D / 2)
  shape.lineTo(-W / 2, -D / 2)
  shape.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 28 })
  g.rotateX(-Math.PI / 2)
  return g
}

function LayerMesh({ layer, y, highlighted, onPick, children }: {
  layer: RoadLayer; y: number; highlighted: boolean; onPick: () => void; children?: ReactNode
}) {
  return (
    <group position={[0, y, 0]}>
      {children ?? (
        <mesh position={[0, layer.thickness / 2, 0]} onClick={(e) => { e.stopPropagation(); onPick() }}>
          <boxGeometry args={[W, layer.thickness, D]} />
          <meshStandardMaterial color={layer.color} roughness={0.95}
            emissive={highlighted ? '#22d3ee' : '#000000'} emissiveIntensity={highlighted ? 0.18 : 0} />
        </mesh>
      )}
    </group>
  )
}

function SurfaceLayer({ type, layer, highlighted, onPick }: {
  type: DamageType; layer: RoadLayer; highlighted: boolean; onPick: () => void
}) {
  const t = layer.thickness
  const mat = (
    <meshStandardMaterial color={layer.color} roughness={0.9}
      emissive={highlighted ? '#22d3ee' : '#000000'} emissiveIntensity={highlighted ? 0.18 : 0} />
  )
  const pick = (e: { stopPropagation: () => void }) => { e.stopPropagation(); onPick() }
  const potholeGeo = useMemo(() => {
    const hole = new THREE.Path()
    hole.absellipse(0.8, 0.4, 2.2, 1.6, 0, Math.PI * 2, true, 0)
    return extrudeWithHole(hole, t)
  }, [t])
  const frameGeo = useMemo(() => {
    const hole = new THREE.Path()
    hole.moveTo(-3, -2.2); hole.lineTo(-3, 2.2); hole.lineTo(3, 2.2); hole.lineTo(3, -2.2); hole.lineTo(-3, -2.2)
    return extrudeWithHole(hole, t)
  }, [t])

  if (type === 'pothole') {
    return <mesh geometry={potholeGeo} onClick={pick}>{mat}</mesh>
  }
  if (type === 'longitudinal_crack' || type === 'transverse_crack') {
    const along = type === 'longitudinal_crack'
    const gap = 0.16
    // Longitudinal: crack parallel to traffic (z axis here); transverse: across it.
    const parts = along
      ? [{ w: W / 2 + 0.6 - gap / 2, d: D, x: -W / 4 + 0.3 - gap / 4, z: 0 }, { w: W / 2 - 0.6 - gap / 2, d: D, x: W / 4 + 0.3 + gap / 4, z: 0 }]
      : [{ w: W, d: D / 2 - 0.5 - gap / 2, x: 0, z: -D / 4 - 0.25 - gap / 4 }, { w: W, d: D / 2 + 0.5 - gap / 2, x: 0, z: D / 4 - 0.25 + gap / 4 }]
    return (
      <group>
        {parts.map((p, i) => (
          <mesh key={i} position={[p.x, t / 2, p.z]} onClick={pick}>
            <boxGeometry args={[p.w, t, p.d]} />
            {mat}
          </mesh>
        ))}
      </group>
    )
  }
  const tiles = []
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 4; j++) {
      const sag = 0.05 + ((i * 7 + j * 3) % 5) * 0.03
      tiles.push(
        <mesh key={`${i}-${j}`} position={[-3 + 0.6 + i * 1.2, t / 2 - sag, -2.2 + 0.55 + j * 1.1]} onClick={pick}>
          <boxGeometry args={[1.1, t, 1.0]} />
          {mat}
        </mesh>,
      )
    }
  }
  return (
    <group>
      <mesh geometry={frameGeo} onClick={pick}>{mat}</mesh>
      {tiles}
    </group>
  )
}

function DamageInfill({ type, baseTop }: { type: DamageType; baseTop: number }) {
  if (type === 'pothole') {
    return (
      <group>
        <mesh position={[0.8, baseTop - 0.12, -0.4]} scale={[1, 0.3, 0.72]}>
          <sphereGeometry args={[2.1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#3b3f46" roughness={1} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0.8, baseTop + 0.02, -0.4]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.72, 1]}>
          <circleGeometry args={[1.6, 28]} />
          <meshStandardMaterial color="#1d3b5c" metalness={0.4} roughness={0.15} transparent opacity={0.85} />
        </mesh>
      </group>
    )
  }
  if (type === 'alligator_crack') return null
  const along = type === 'longitudinal_crack'
  return (
    <mesh position={[along ? 0.6 : 0, baseTop - 0.3, along ? 0 : -0.5]}>
      <boxGeometry args={[along ? 0.1 : W * 0.8, 0.6, along ? D * 0.8 : 0.1]} />
      <meshStandardMaterial color="#141518" />
    </mesh>
  )
}

function Stack({ type, explode, highlighted, onPick, reducedMotion }: {
  type: DamageType; explode: number; highlighted: string | null; onPick: (k: string) => void; reducedMotion: boolean
}) {
  const current = useRef(explode)
  const groups = useRef<(THREE.Group | null)[]>([])
  const bottomUp = [...ROAD_LAYERS].reverse()
  const baseY = (k: number, e: number) => bottomUp.slice(0, k).reduce((s, l) => s + l.thickness, 0) + k * e * 1.5 - 2.4

  useFrame((_, dt) => {
    current.current = reducedMotion ? explode : THREE.MathUtils.damp(current.current, explode, 6, dt)
    groups.current.forEach((g, k) => {
      if (g) g.position.y = baseY(k, current.current)
    })
  })

  return (
    <group>
      {bottomUp.map((layer, k) => (
        <group key={layer.key} ref={(g) => { groups.current[k] = g }} position={[0, baseY(k, explode), 0]}>
          {layer.key === 'surface' ? (
            <SurfaceLayer type={type} layer={layer} highlighted={highlighted === layer.key} onPick={() => onPick(layer.key)} />
          ) : (
            <LayerMesh layer={layer} y={0} highlighted={highlighted === layer.key} onPick={() => onPick(layer.key)} />
          )}
          {layer.key === 'base' && <DamageInfill type={type} baseTop={layer.thickness} />}
        </group>
      ))}
    </group>
  )
}

export default function RoadCutaway3D({ type, explode, highlighted, onPick, rotate, reducedMotion }: {
  type: DamageType; explode: number; highlighted: string | null; onPick: (k: string) => void; rotate: boolean; reducedMotion: boolean
}) {
  return (
    <Canvas camera={{ position: [16, 11, 18], fov: 38 }} dpr={[1, 1.5]} aria-label="Illustrative road layer cutaway">
      <color attach="background" args={['#06101f']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 12]} intensity={1.4} />
      <directionalLight position={[-12, 6, -8]} intensity={0.4} color="#7dd3fc" />
      <Stack type={type} explode={explode} highlighted={highlighted} onPick={onPick} reducedMotion={reducedMotion} />
      <gridHelper args={[60, 30, '#123056', '#0c2140']} position={[0, -2.6, 0]} />
      <OrbitControls makeDefault enablePan={false} minDistance={12} maxDistance={45} autoRotate={rotate && !reducedMotion} autoRotateSpeed={0.8} />
    </Canvas>
  )
}
