import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { RoadStrip } from './cityLayout'
import { seeded } from './textures'

interface Car {
  road: RoadStrip
  dir: 1 | -1
  lane: number
  phase: number
  speed: number
  color: string
}

/** Instanced traffic: two draw calls for all cars. Frozen when reduced motion is on. */
function Vehicle3D({ roads, half, count, animate }: { roads: RoadStrip[]; half: number; count: number; animate: boolean }) {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const cabins = useRef<THREE.InstancedMesh>(null)
  const cars = useMemo<Car[]>(() => {
    const rnd = seeded(4242)
    const palette = ['#e2e8f0', '#38bdf8', '#f43f5e', '#facc15', '#94a3b8', '#22d3ee', '#a78bfa', '#f97316']
    return Array.from({ length: count }, (_, i) => {
      const dir = (rnd() > 0.5 ? 1 : -1) as 1 | -1
      return {
        road: roads[i % roads.length],
        dir,
        lane: dir * 1.9,
        phase: rnd() * half * 2,
        speed: 3.5 + rnd() * 5,
        color: palette[i % palette.length],
      }
    })
  }, [roads, half, count])
  const geo = useMemo(() => {
    const body = new THREE.BoxGeometry(2.4, 0.7, 1.15)
    body.translate(0, 0.5, 0)
    const cabin = new THREE.BoxGeometry(1.3, 0.55, 1.0)
    cabin.translate(-0.15, 1.1, 0)
    return { body, cabin }
  }, [])
  const mats = useMemo(() => ({
    body: new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.5, roughness: 0.35 }),
    cabin: new THREE.MeshStandardMaterial({ color: '#0b1220', metalness: 0.3, roughness: 0.2, emissive: '#1e3a5f', emissiveIntensity: 0.4 }),
  }), [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])

  const place = (t: number) => {
    const span = half * 2
    cars.forEach((c, i) => {
      const s = (((c.phase + c.speed * t) % span) + span) % span - half
      const p = c.dir * s
      if (c.road.axis === 'x') {
        pos.set(p, 0.05, c.road.offset + c.lane)
        q.setFromAxisAngle(up, c.dir > 0 ? 0 : Math.PI)
      } else {
        pos.set(c.road.offset - c.lane, 0.05, p)
        q.setFromAxisAngle(up, c.dir > 0 ? -Math.PI / 2 : Math.PI / 2)
      }
      m.compose(pos, q, one)
      bodies.current?.setMatrixAt(i, m)
      cabins.current?.setMatrixAt(i, m)
    })
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true
    if (cabins.current) cabins.current.instanceMatrix.needsUpdate = true
  }

  useLayoutEffect(() => {
    const c = new THREE.Color()
    cars.forEach((car, i) => bodies.current?.setColorAt(i, c.set(car.color)))
    if (bodies.current?.instanceColor) bodies.current.instanceColor.needsUpdate = true
    place(0)
    bodies.current?.computeBoundingSphere()
    cabins.current?.computeBoundingSphere()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cars])

  useFrame(({ clock }) => {
    if (animate) place(clock.elapsedTime)
  })

  useEffect(() => () => {
    geo.body.dispose(); geo.cabin.dispose(); mats.body.dispose(); mats.cabin.dispose()
  }, [geo, mats])

  return (
    <group>
      <instancedMesh ref={bodies} args={[geo.body, mats.body, cars.length]} frustumCulled={false} />
      <instancedMesh ref={cabins} args={[geo.cabin, mats.cabin, cars.length]} frustumCulled={false} />
    </group>
  )
}

export default memo(Vehicle3D)
