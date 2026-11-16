import { Html } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import * as THREE from 'three'
import { REPAIR_COLOR, REPAIR_LABEL } from '../../lib/colors'
import { useCityState, useRoadIQ } from '../../store/useRoadIQ'
import CityCameraControls, { HOME_POSITION } from './CityCameraControls'
import { buildLayout } from './cityLayout'
import ContextMarker3D from './ContextMarker3D'
import DamageMarker3D from './DamageMarker3D'
import ImpactConnections3D from './ImpactConnections3D'
import PriorityHeatmap3D from './PriorityHeatmap3D'
import RoadMemoryTimeline3D from './RoadMemoryTimeline3D'
import RoadSegment3D from './RoadSegment3D'
import SceneLoading from './SceneLoading'
import SmartCityModel from './SmartCityModel'
import SurveyCoverage3D from './SurveyCoverage3D'
import Vehicle3D from './Vehicle3D'

export default function RoadIQCityScene() {
  const data = useRoadIQ((s) => s.data)
  const state = useCityState()
  const layerMode = useRoadIQ((s) => s.layerMode)
  const toggles = useRoadIQ((s) => s.toggles)
  const selectedDefectId = useRoadIQ((s) => s.selectedDefectId)
  const selectedSegmentId = useRoadIQ((s) => s.selectedSegmentId)
  const hoveredId = useRoadIQ((s) => s.hoveredId)
  const quality = useRoadIQ((s) => s.settings.quality)
  const reducedMotion = useRoadIQ((s) => s.settings.reducedMotion)
  const view = useRoadIQ((s) => s.view)
  const selectDefect = useRoadIQ((s) => s.selectDefect)
  const selectSegment = useRoadIQ((s) => s.selectSegment)
  const setHovered = useRoadIQ((s) => s.setHovered)
  const [ready, setReady] = useState(false)

  const layout = useMemo(() => (data ? buildLayout(data, quality) : null), [data, quality])
  const axisOf = useMemo(() => {
    const m: Record<string, 'x' | 'z'> = {}
    data?.segments.forEach((s) => (m[s.id] = s.z1 === s.z2 ? 'x' : 'z'))
    return m
  }, [data])

  if (!data || !state || !layout) return <SceneLoading label="Loading road data…" />

  const shadows = quality === 'high'
  const selectedAt = state.visibleDefects.find((d) => d.id === selectedDefectId) ?? null
  const selectedRecord = data.defects.find((d) => d.id === selectedDefectId) ?? null
  const segmentTop = selectedSegmentId
    ? state.segments.find((s) => s.id === selectedSegmentId)?.activeDefects.reduce<typeof selectedAt>(
        (m, d) => (!m || d.rps > m.rps ? d : m), null) ?? null
    : null
  const linkDefect = selectedAt ?? segmentTop
  const highlighted = new Set(toggles.connections && linkDefect ? linkDefect.nearby.map((n) => n.id) : [])
  const showMemory = view === 'memory' || !state.isToday || layerMode === 'repair'
  const pinsVisible = toggles.markers && (layerMode === 'damage' || layerMode === 'priority' || layerMode === 'repair')
  const distTo = (v: number, offsets: number[]) => Math.min(...offsets.map((o) => Math.abs(v - o)))

  return (
    <div className="absolute inset-0 z-0">
      {!ready && <SceneLoading />}
      <Canvas
        shadows={shadows}
        dpr={quality === 'high' ? [1, 1.75] : 1}
        gl={{ antialias: quality === 'high', powerPreference: 'high-performance' }}
        camera={{ position: HOME_POSITION, fov: 40, near: 1, far: 900 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
          setReady(true)
        }}
        onPointerMissed={() => selectDefect(null)}
        aria-label="Interactive 3D model of the city's roads"
      >
        <color attach="background" args={['#050b18']} />
        <fog attach="fog" args={['#050b18', 220, 520]} />
        <ambientLight intensity={0.5} />
        <hemisphereLight args={['#a9c9ff', '#0b1630', 0.75]} />
        <directionalLight
          position={[70, 130, 55]}
          intensity={1.35}
          color="#d7e8ff"
          castShadow={shadows}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-80}
          shadow-camera-right={80}
          shadow-camera-top={80}
          shadow-camera-bottom={-80}
          shadow-bias={-0.0005}
        />

        <SmartCityModel layout={layout} shadows={shadows} />

        {state.segments.map((s) => (
          <RoadSegment3D
            key={s.id}
            seg={s}
            half={layout.half}
            hw={layout.hw}
            mode={layerMode}
            selected={s.id === selectedSegmentId}
            hovered={s.id === hoveredId}
            onSelect={selectSegment}
            onHover={setHovered}
          />
        ))}

        {(layerMode === 'coverage' || layerMode === 'monsoon') && (
          <SurveyCoverage3D segments={state.segments} half={layout.half} hw={layout.hw} mode={layerMode} labels={toggles.labels || layerMode === 'coverage'} />
        )}

        {(toggles.heatmap || layerMode === 'priority') && <PriorityHeatmap3D defects={state.visibleDefects} half={layout.half} />}

        {state.visibleDefects.map((d) => (
          <DamageMarker3D
            key={d.id}
            d={d}
            axis={axisOf[d.segment_id] ?? 'x'}
            selected={d.id === selectedDefectId}
            hovered={d.id === hoveredId}
            showPin={pinsVisible || d.id === selectedDefectId}
            reducedMotion={reducedMotion}
            hideRepairChip={layerMode === 'repair'}
            onSelect={selectDefect}
            onHover={setHovered}
          />
        ))}

        {layerMode === 'repair' && state.repairs.filter((r) => r.statusAt !== 'verified').map((r) => {
          const d = data.defects.find((x) => x.id === r.defect_id)
          if (!d) return null
          return (
            <Html key={r.id} position={[d.x, 11.5, d.z]} center zIndexRange={[30, 1]} style={{ pointerEvents: 'none' }}>
              <div className="chip3d" style={{ borderColor: REPAIR_COLOR[r.statusAt] }}>🔧 {r.id} · {REPAIR_LABEL[r.statusAt]}</div>
            </Html>
          )
        })}

        <RoadMemoryTimeline3D state={state} selected={selectedRecord} showAll={showMemory} />

        {data.context.map((c) => (
          <ContextMarker3D
            key={c.id}
            ctx={c}
            highlighted={highlighted.has(c.id)}
            showLabel={toggles.labels}
            showBeacon={toggles.context}
            reducedMotion={reducedMotion}
            alongX={distTo(c.z, layout.crossOffsets.z) < distTo(c.x, layout.crossOffsets.x)}
          />
        ))}

        {toggles.connections && linkDefect && (
          <ImpactConnections3D defect={linkDefect} context={data.context} reducedMotion={reducedMotion} />
        )}

        {toggles.vehicles && (
          <Vehicle3D roads={layout.roads} half={layout.half} count={quality === 'high' ? 18 : 8} animate={!reducedMotion} />
        )}

        <CityCameraControls />
      </Canvas>
    </div>
  )
}
