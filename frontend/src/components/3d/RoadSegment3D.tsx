import { Edges } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { memo } from 'react'
import { segmentFrame, segmentLayerColor } from '../../lib/segments'
import type { SegmentAt } from '../../lib/timeline'
import type { LayerMode } from '../../store/useRoadIQ'

interface Props {
  seg: SegmentAt
  half: number
  hw: number
  mode: LayerMode
  selected: boolean
  hovered: boolean
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

function RoadSegment3D({ seg, half, hw, mode, selected, hovered, onSelect, onHover }: Props) {
  const f = segmentFrame(seg, half, hw)
  const { color, opacity } = segmentLayerColor(seg, mode)
  const highlight = selected ? 0.35 : hovered ? 0.15 : 0
  const finalColor = selected || (hovered && opacity === 0) ? '#22d3ee' : color
  return (
    <mesh
      position={[f.cx, 0.11, f.cz]}
      rotation={f.axis === 'z' ? [0, Math.PI / 2, 0] : [0, 0, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        onSelect(seg.id)
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        onHover(seg.id)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        onHover(null)
        document.body.style.cursor = ''
      }}
    >
      <boxGeometry args={[f.len, 0.04, f.width]} />
      <meshBasicMaterial
        color={finalColor}
        transparent
        opacity={Math.min(0.85, opacity + highlight)}
        depthWrite={false}
        toneMapped={false}
      />
      {selected && <Edges color="#67e8f9" threshold={10} />}
    </mesh>
  )
}

export default memo(RoadSegment3D)
