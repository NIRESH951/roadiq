import { Html } from '@react-three/drei'
import { memo } from 'react'
import type { Defect } from '../../api/types'
import { formatDate, type CityState } from '../../lib/timeline'

/**
 * Road Memory in 3D: earlier defect locations, repaired patches and possible-recurrence highlights,
 * reconstructed for the day chosen on the timeline.
 */
function RoadMemoryTimeline3D({ state, selected, showAll }: {
  state: CityState
  selected: Defect | null
  showAll: boolean
}) {
  const repaired = state.defects.filter((d) => d.statusAt === 'repaired_verified')
  const recurrences = state.visibleDefects.filter((d) => d.possible_recurrence)
  const priors = selected ? state.defects.filter((d) => selected.recurrence_of.includes(d.id)) : []

  return (
    <group>
      {showAll && repaired.map((d) => (
        <group key={`rep-${d.id}`} position={[d.x, 0, d.z]}>
          <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3.2, 2.6]} />
            <meshStandardMaterial color="#3b3f47" roughness={0.9} polygonOffset polygonOffsetFactor={-2} />
          </mesh>
          <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.2, 2.45, 40]} />
            <meshBasicMaterial color="#22c55e" transparent opacity={0.6} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {recurrences.map((d) => (
        <group key={`rec-${d.id}`} position={[d.x, 0, d.z]}>
          <mesh position={[0, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[3.6, 4.1, 6]} />
            <meshBasicMaterial color="#f97316" transparent opacity={0.85} depthWrite={false} toneMapped={false} />
          </mesh>
          {(showAll || selected?.id === d.id) && (
            <Html position={[0, 10.6, 0]} center zIndexRange={[35, 1]} style={{ pointerEvents: 'none' }}>
              <div className="chip3d" style={{ borderColor: '#f97316' }}>
                ⚠ Possible recurrence after repair · manual re-inspection
              </div>
            </Html>
          )}
        </group>
      ))}

      {priors.map((p, i) => (
        <group key={`prior-${p.id}`} position={[p.x - 1.2 - i * 0.6, 0, p.z - 1.2 - i * 0.6]}>
          <mesh position={[0, 2, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 4, 6]} />
            <meshBasicMaterial color="#94a3b8" transparent opacity={0.5} />
          </mesh>
          <mesh position={[0, 4.1, 0]}>
            <octahedronGeometry args={[0.5, 0]} />
            <meshBasicMaterial color="#94a3b8" wireframe />
          </mesh>
          <Html position={[0, 5.4, 0]} center zIndexRange={[35, 1]} style={{ pointerEvents: 'none' }}>
            <div className="chip3d" style={{ borderColor: '#94a3b8' }}>
              Earlier record {p.id} · {formatDate(p.detected_on)}
            </div>
          </Html>
        </group>
      ))}
    </group>
  )
}

export default memo(RoadMemoryTimeline3D)
