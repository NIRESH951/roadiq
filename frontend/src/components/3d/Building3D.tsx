import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { HEIGHT_CLASSES, type BuildingInstance } from './cityLayout'
import { windowTexture } from './textures'

/** One InstancedMesh per height class, so window textures keep their proportions without per-building draw calls. */
function BuildingClass({ height, items, shadows }: { height: number; items: BuildingInstance[]; shadows: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(1, height, 1)
    g.translate(0, height / 2 + 0.35, 0)
    return g
  }, [height])
  const materials = useMemo(() => {
    const map = windowTexture(false).clone()
    const emissiveMap = windowTexture(true).clone()
    for (const t of [map, emissiveMap]) {
      t.repeat.set(1, Math.max(1, Math.round(height / 3.2)))
      t.needsUpdate = true
    }
    const side = new THREE.MeshStandardMaterial({
      map, emissiveMap, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.55, roughness: 0.7, metalness: 0.2,
    })
    const roof = new THREE.MeshStandardMaterial({ color: '#2a3954', roughness: 0.85 })
    return [side, side, roof, roof, side, side]
  }, [height])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    items.forEach((b, i) => {
      m.makeScale(Math.max(1.2, b.w), 1, Math.max(1.2, b.d))
      m.setPosition(b.x, 0, b.z)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, c.set(b.color))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])

  useEffect(() => () => {
    geometry.dispose()
    const side = materials[0] as THREE.MeshStandardMaterial
    side.map?.dispose()
    side.emissiveMap?.dispose()
    materials.forEach((mat) => mat.dispose())
  }, [geometry, materials])

  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geometry, materials, items.length]} castShadow={shadows} receiveShadow={shadows} />
}

export default function Building3D({ buildings, shadows }: { buildings: BuildingInstance[]; shadows: boolean }) {
  const byClass = useMemo(
    () => HEIGHT_CLASSES.map((_, k) => buildings.filter((b) => b.heightClass === k)),
    [buildings],
  )
  return (
    <group>
      {HEIGHT_CLASSES.map((h, k) => (
        <BuildingClass key={h} height={h} items={byClass[k]} shadows={shadows} />
      ))}
    </group>
  )
}
