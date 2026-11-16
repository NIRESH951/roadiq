import { CameraControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { useRoadIQ } from '../../store/useRoadIQ'

export const HOME_POSITION: [number, number, number] = [70, 72, 92]
const TOP_POSITION: [number, number, number] = [0, 205, 0.01]

/** Smooth orbit / pan / zoom with animated transitions for reset, top-down, Smart Focus and presentation presets. */
export default function CityCameraControls() {
  const ref = useRef<CameraControls>(null)
  const request = useRoadIQ((s) => s.cameraRequest)
  const reduced = useRoadIQ((s) => s.settings.reducedMotion)
  const autoOrbit = useRoadIQ((s) => s.autoOrbit)

  useEffect(() => {
    const c = ref.current
    if (!c || !request) return
    const smooth = !reduced
    switch (request.kind) {
      case 'reset':
      case 'perspective':
        void c.setLookAt(...HOME_POSITION, 0, 0, 0, smooth)
        break
      case 'top':
        void c.setLookAt(...TOP_POSITION, 0, 0, 0, smooth)
        break
      case 'focus': {
        const [x, z] = request.target ?? [0, 0]
        void c.setLookAt(x + 26, 30, z + 32, x, 0, z, smooth)
        break
      }
      case 'preset':
        if (request.position && request.lookAt) void c.setLookAt(...request.position, ...request.lookAt, smooth)
        break
      case 'zoomIn':
        void c.dolly(25, smooth)
        break
      case 'zoomOut':
        void c.dolly(-25, smooth)
        break
    }
  }, [request, reduced])

  useFrame((_, dt) => {
    if (autoOrbit && !reduced && ref.current) ref.current.azimuthAngle += dt * 0.08
  })

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={14}
      maxDistance={330}
      maxPolarAngle={Math.PI / 2.15}
      smoothTime={0.55}
      draggingSmoothTime={0.12}
      dollySpeed={0.6}
    />
  )
}
