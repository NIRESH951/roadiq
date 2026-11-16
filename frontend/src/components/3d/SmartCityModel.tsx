import { Edges } from '@react-three/drei'
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import Building3D from './Building3D'
import type { CityLayout, Lamp, TreeInstance } from './cityLayout'
import { asphaltTexture } from './textures'

const BLOCK_COLOR: Record<string, string> = {
  park: '#1b4a33',
  lake: '#1b4a33',
  residential: '#26324a',
  commercial: '#28344d',
  offices: '#27324b',
  school: '#2a3550',
  hospital: '#2b3752',
  market: '#2b3550',
}

function Trees({ trees, shadows }: { trees: TreeInstance[]; shadows: boolean }) {
  const trunks = useRef<THREE.InstancedMesh>(null)
  const crowns = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => {
    const trunk = new THREE.CylinderGeometry(0.16, 0.22, 1.6, 6)
    trunk.translate(0, 0.8 + 0.35, 0)
    const crown = new THREE.IcosahedronGeometry(1.25, 0)
    crown.translate(0, 2.6 + 0.35, 0)
    return { trunk, crown }
  }, [])
  const mats = useMemo(() => ({
    trunk: new THREE.MeshStandardMaterial({ color: '#5b4632', roughness: 1 }),
    crown: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true }),
  }), [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    const greens = ['#2f7d4f', '#3a8f5a', '#2a6e48', '#45a067']
    trees.forEach((t, i) => {
      m.makeScale(t.s, t.s, t.s)
      m.setPosition(t.x, 0, t.z)
      trunks.current?.setMatrixAt(i, m)
      crowns.current?.setMatrixAt(i, m)
      crowns.current?.setColorAt(i, c.set(greens[i % greens.length]))
    })
    for (const r of [trunks, crowns]) {
      if (!r.current) continue
      r.current.instanceMatrix.needsUpdate = true
      if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true
      r.current.computeBoundingSphere()
    }
  }, [trees])
  useEffect(() => () => {
    geo.trunk.dispose(); geo.crown.dispose(); mats.trunk.dispose(); mats.crown.dispose()
  }, [geo, mats])
  if (!trees.length) return null
  return (
    <group>
      <instancedMesh ref={trunks} args={[geo.trunk, mats.trunk, trees.length]} castShadow={shadows} />
      <instancedMesh ref={crowns} args={[geo.crown, mats.crown, trees.length]} castShadow={shadows} />
    </group>
  )
}

function StreetLights({ lamps }: { lamps: Lamp[] }) {
  const poles = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => {
    const pole = new THREE.CylinderGeometry(0.07, 0.09, 3.4, 5)
    pole.translate(0, 1.7 + 0.35, 0)
    const head = new THREE.BoxGeometry(0.5, 0.16, 0.5)
    head.translate(0, 3.45 + 0.35, 0)
    return { pole, head }
  }, [])
  const mats = useMemo(() => ({
    pole: new THREE.MeshStandardMaterial({ color: '#6b7a93', metalness: 0.6, roughness: 0.4 }),
    head: new THREE.MeshStandardMaterial({ color: '#dff7ff', emissive: '#9ee7ff', emissiveIntensity: 2.2 }),
  }), [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    lamps.forEach((l, i) => {
      m.makeTranslation(l.x, 0, l.z)
      poles.current?.setMatrixAt(i, m)
      heads.current?.setMatrixAt(i, m)
    })
    for (const r of [poles, heads]) {
      if (!r.current) continue
      r.current.instanceMatrix.needsUpdate = true
      r.current.computeBoundingSphere()
    }
  }, [lamps])
  useEffect(() => () => {
    geo.pole.dispose(); geo.head.dispose(); mats.pole.dispose(); mats.head.dispose()
  }, [geo, mats])
  return (
    <group>
      <instancedMesh ref={poles} args={[geo.pole, mats.pole, lamps.length]} />
      <instancedMesh ref={heads} args={[geo.head, mats.head, lamps.length]} />
    </group>
  )
}

function LaneDashes({ dashes }: { dashes: CityLayout['dashes'] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.BoxGeometry(2, 0.02, 0.28), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8edf5', emissive: '#55606e', roughness: 0.6 }), [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const yRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    dashes.forEach((d, i) => {
      m.compose(new THREE.Vector3(d.x, 0.09, d.z), d.axis === 'x' ? q : yRot, new THREE.Vector3(1, 1, 1))
      ref.current?.setMatrixAt(i, m)
    })
    if (ref.current) {
      ref.current.instanceMatrix.needsUpdate = true
      ref.current.computeBoundingSphere()
    }
  }, [dashes])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  return <instancedMesh ref={ref} args={[geo, mat, dashes.length]} />
}

function Roads({ layout, shadows }: { layout: CityLayout; shadows: boolean }) {
  const len = layout.half * 2
  const width = layout.hw * 2
  const material = useMemo(() => {
    const map = asphaltTexture().clone()
    map.repeat.set(len / 8, width / 8)
    map.needsUpdate = true
    return new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0.05, color: '#b8bcc6' })
  }, [len, width])
  useEffect(() => () => { material.map?.dispose(); material.dispose() }, [material])
  return (
    <group>
      {layout.roads.map((r) => (
        <mesh
          key={r.code}
          material={material}
          position={r.axis === 'x' ? [0, 0.02, r.offset] : [r.offset, 0.035, 0]}
          rotation={r.axis === 'z' ? [0, Math.PI / 2, 0] : [0, 0, 0]}
          receiveShadow={shadows}
        >
          <boxGeometry args={[len, 0.06, width]} />
        </mesh>
      ))}
    </group>
  )
}

function Blocks({ layout, shadows }: { layout: CityLayout; shadows: boolean }) {
  return (
    <group>
      {layout.blocks.map((b) => {
        const w = b.x1 - b.x0
        const d = b.z1 - b.z0
        const cx = (b.x0 + b.x1) / 2
        const cz = (b.z0 + b.z1) / 2
        return (
          <group key={`${b.i}-${b.j}`}>
            <mesh position={[cx, 0.175, cz]} receiveShadow={shadows}>
              <boxGeometry args={[w, 0.35, d]} />
              <meshStandardMaterial color={BLOCK_COLOR[b.kind] ?? '#26324a'} roughness={0.95} />
            </mesh>
            {b.kind === 'lake' && (
              <mesh position={[cx, 0.37, cz]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, (d - 8) / (w - 10), 1]}>
                <circleGeometry args={[(w - 10) / 2, 40]} />
                <meshStandardMaterial color="#0b4f80" emissive="#05365a" emissiveIntensity={0.6} metalness={0.5} roughness={0.15} />
              </mesh>
            )}
            {b.kind === 'park' && (
              <mesh position={[cx, 0.36, cz]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[Math.min(w, d) * 0.22, Math.min(w, d) * 0.22 + 0.8, 40]} />
                <meshStandardMaterial color="#8a9a7e" roughness={1} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

function SmartCityModel({ layout, shadows }: { layout: CityLayout; shadows: boolean }) {
  const size = layout.half * 2 + 10
  return (
    <group>
      {/* Model base */}
      <mesh position={[0, -1.6, 0]} receiveShadow={shadows}>
        <boxGeometry args={[size, 3.2, size]} />
        <meshStandardMaterial color="#0c1a33" roughness={0.9} metalness={0.1} />
        <Edges color="#22d3ee" threshold={15} />
      </mesh>
      <gridHelper args={[600, 60, '#0f2b4d', '#0b1f3a']} position={[0, -3.25, 0]} />
      <Blocks layout={layout} shadows={shadows} />
      <Roads layout={layout} shadows={shadows} />
      <LaneDashes dashes={layout.dashes} />
      <Building3D buildings={layout.buildings} shadows={shadows} />
      <Trees trees={layout.trees} shadows={shadows} />
      <StreetLights lamps={layout.lamps} />
    </group>
  )
}

export default memo(SmartCityModel)
