import { memo, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { BAND_COLOR } from '../../lib/colors'
import type { DefectAt } from '../../lib/timeline'

/** Damage concentration overlay: one soft radial blob per active defect, sized and coloured by its RPS. */
function PriorityHeatmap3D({ defects, half }: { defects: DefectAt[]; half: number }) {
  const size = half * 2
  const texture = useMemo(() => {
    const px = 512
    const c = document.createElement('canvas')
    c.width = c.height = px
    const g = c.getContext('2d') as CanvasRenderingContext2D
    g.globalCompositeOperation = 'lighter'
    const toPx = (v: number) => ((v + half) / size) * px
    for (const d of defects) {
      const radius = ((6 + d.rps / 6) / size) * px
      const grad = g.createRadialGradient(toPx(d.x), toPx(d.z), 0, toPx(d.x), toPx(d.z), radius)
      const col = new THREE.Color(BAND_COLOR[d.band])
      const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`
      const strength = 0.25 + (d.rps / 100) * 0.55
      grad.addColorStop(0, `rgba(${rgb},${strength})`)
      grad.addColorStop(1, `rgba(${rgb},0)`)
      g.fillStyle = grad
      g.beginPath()
      g.arc(toPx(d.x), toPx(d.z), radius, 0, Math.PI * 2)
      g.fill()
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [defects, half, size])
  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh position={[0, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  )
}

export default memo(PriorityHeatmap3D)
