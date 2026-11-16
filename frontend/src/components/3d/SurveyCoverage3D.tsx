import { Html } from '@react-three/drei'
import { memo, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { COVERAGE_COLOR, COVERAGE_LABEL, MONSOON_COLOR } from '../../lib/colors'
import type { SegmentAt } from '../../lib/timeline'
import { segmentFrame } from '../../lib/segments'

/** Vertical gradient so the coverage "walls" fade upward. */
function useGradient() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 64
    const g = c.getContext('2d') as CanvasRenderingContext2D
    const grad = g.createLinearGradient(0, 64, 0, 0)
    grad.addColorStop(0, 'rgba(255,255,255,0.95)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 4, 64)
    return new THREE.CanvasTexture(c)
  }, [])
  useEffect(() => () => tex.dispose(), [tex])
  return tex
}

function Walls({ seg, half, hw, color, height, alpha }: {
  seg: SegmentAt; half: number; hw: number; color: string; height: number; alpha: THREE.Texture
}) {
  const f = segmentFrame(seg, half, hw)
  return (
    <group position={[f.cx, 0, f.cz]} rotation={f.axis === 'z' ? [0, Math.PI / 2, 0] : [0, 0, 0]}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, height / 2 + 0.1, side * (f.width / 2 - 0.15)]}>
          <planeGeometry args={[f.len, height]} />
          <meshBasicMaterial color={color} alphaMap={alpha} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

interface Props {
  segments: SegmentAt[]
  half: number
  hw: number
  mode: 'coverage' | 'monsoon'
  labels: boolean
}

function SurveyCoverage3D({ segments, half, hw, mode, labels }: Props) {
  const alpha = useGradient()
  if (mode === 'coverage') {
    return (
      <group>
        {segments.map((s) => (
          <Walls key={s.id} seg={s} half={half} hw={hw} alpha={alpha} color={COVERAGE_COLOR[s.coverageAt]}
            height={s.coverageAt === 'recent' ? 0.8 : s.coverageAt === 'unknown' ? 0.6 : 2.4} />
        ))}
        {labels && segments.filter((s) => s.coverageAt !== 'recent').map((s) => {
          const f = segmentFrame(s, half, hw)
          return (
            <Html key={`l-${s.id}`} position={[f.cx, 3.2, f.cz]} center zIndexRange={[20, 1]} style={{ pointerEvents: 'none' }}>
              <div className="chip3d" style={{ borderColor: COVERAGE_COLOR[s.coverageAt] }}>
                {s.id} · {COVERAGE_LABEL[s.coverageAt]}
              </div>
            </Html>
          )
        })}
      </group>
    )
  }
  const watch = segments.filter((s) => s.monsoon_watch)
  return (
    <group>
      {watch.map((s) => (
        <Walls key={s.id} seg={s} half={half} hw={hw} alpha={alpha} color={MONSOON_COLOR} height={2.6} />
      ))}
      {watch.map((s) => {
        const f = segmentFrame(s, half, hw)
        return (
          <Html key={`m-${s.id}`} position={[f.cx, 3.6, f.cz]} center zIndexRange={[20, 1]} style={{ pointerEvents: 'none' }}>
            <div className="chip3d" style={{ borderColor: MONSOON_COLOR }}>
              <span aria-hidden>💧</span> {s.id} pre-monsoon check
            </div>
          </Html>
        )
      })}
    </group>
  )
}

export default memo(SurveyCoverage3D)
