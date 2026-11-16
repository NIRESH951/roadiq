import { useMemo } from 'react'
import { BAND_COLOR, BAND_LABEL, CONTEXT_STYLE } from '../../lib/colors'
import { segmentFrame, segmentLayerColor } from '../../lib/segments'
import { useCityState, useRoadIQ } from '../../store/useRoadIQ'

const BLOCK_FILL: Record<string, string> = {
  park: '#143a29', lake: '#143a29', residential: '#14213a', commercial: '#16243f', offices: '#15223c',
  school: '#1a2742', hospital: '#1a2742', market: '#1a2742',
}
const DOT_R: Record<string, number> = { critical: 2.5, high: 2.1, medium: 1.8, low: 1.6, none: 1.4 }

/** 2D schematic of the same records: works without WebGL and on any laptop. */
export default function RoadMap2D({ interactive = true, className = '' }: { interactive?: boolean; className?: string }) {
  const data = useRoadIQ((s) => s.data)
  const state = useCityState()
  const mode = useRoadIQ((s) => s.layerMode)
  const toggles = useRoadIQ((s) => s.toggles)
  const selectedDefectId = useRoadIQ((s) => s.selectedDefectId)
  const selectedSegmentId = useRoadIQ((s) => s.selectedSegmentId)
  const hoveredId = useRoadIQ((s) => s.hoveredId)
  const selectDefect = useRoadIQ((s) => s.selectDefect)
  const selectSegment = useRoadIQ((s) => s.selectSegment)
  const setHovered = useRoadIQ((s) => s.setHovered)
  const reduced = useRoadIQ((s) => s.settings.reducedMotion)

  const geometry = useMemo(() => {
    if (!data) return null
    const half = data.meta.half_extent
    const hw = data.meta.road_half_width
    const xs = [...new Set(data.segments.filter((s) => s.z1 !== s.z2).map((s) => s.x1))].sort((a, b) => a - b)
    const zs = [...new Set(data.segments.filter((s) => s.z1 === s.z2).map((s) => s.z1))].sort((a, b) => a - b)
    const edges = (offs: number[]) => {
      const e = [-half, ...offs, half]
      return e.slice(0, -1).map((a, i) => [a + (i > 0 ? hw : 0), e[i + 1] - (i < e.length - 2 ? hw : 0)] as const)
    }
    return { half, hw, xs, zs, bx: edges(xs), bz: edges(zs) }
  }, [data])

  if (!data || !state || !geometry) return null
  const { half, hw, xs, zs, bx, bz } = geometry
  const selected = state.visibleDefects.find((d) => d.id === selectedDefectId)
  const pad = 6

  return (
    <svg viewBox={`${-half - pad} ${-half - pad} ${2 * (half + pad)} ${2 * (half + pad)}`} className={`h-full w-full ${className}`}
      role="img" aria-label="2D schematic map of road sections, damage and sensitive locations">
      <rect x={-half - 2} y={-half - 2} width={2 * half + 4} height={2 * half + 4} rx={3} fill="#0a1730" stroke="#22d3ee" strokeOpacity={0.35} strokeWidth={0.4} />
      {data.blocks.map((b) => {
        const [x0, x1] = bx[b.i] ?? [0, 0]
        const [z0, z1] = bz[b.j] ?? [0, 0]
        return (
          <g key={`${b.i}-${b.j}`}>
            <rect x={x0} y={z0} width={x1 - x0} height={z1 - z0} rx={1.2} fill={BLOCK_FILL[b.kind] ?? '#14213a'} />
            {b.kind === 'lake' && <ellipse cx={(x0 + x1) / 2} cy={(z0 + z1) / 2} rx={(x1 - x0) / 2 - 5} ry={(z1 - z0) / 2 - 4} fill="#0b4f80" opacity={0.8} />}
          </g>
        )
      })}
      {zs.map((z) => <rect key={`rx${z}`} x={-half} y={z - hw} width={2 * half} height={2 * hw} fill="#262b35" />)}
      {xs.map((x) => <rect key={`rz${x}`} x={x - hw} y={-half} width={2 * hw} height={2 * half} fill="#262b35" />)}

      {state.segments.map((s) => {
        const f = segmentFrame(s, half, hw)
        const { color, opacity } = segmentLayerColor(s, mode)
        const sel = s.id === selectedSegmentId
        const hov = s.id === hoveredId
        const w = f.axis === 'x' ? f.len : f.width
        const h = f.axis === 'x' ? f.width : f.len
        return (
          <rect key={s.id} x={f.cx - w / 2} y={f.cz - h / 2} width={w} height={h}
            fill={sel ? '#22d3ee' : color} fillOpacity={sel ? 0.45 : Math.max(opacity, hov ? 0.2 : 0)}
            stroke={sel ? '#67e8f9' : hov ? '#22d3ee' : 'none'} strokeWidth={0.5}
            className={interactive ? 'cursor-pointer' : ''}
            onClick={interactive ? () => selectSegment(s.id) : undefined}
            onMouseEnter={interactive ? () => setHovered(s.id) : undefined}
            onMouseLeave={interactive ? () => setHovered(null) : undefined}>
            <title>{`${s.road_name} (${s.id})`}</title>
          </rect>
        )
      })}

      {toggles.connections && selected && selected.nearby.map((n) => {
        const c = data.context.find((x) => x.id === n.id)
        if (!c) return null
        return <line key={n.id} x1={selected.x} y1={selected.z} x2={c.x} y2={c.z} stroke={CONTEXT_STYLE[c.kind]?.color} strokeWidth={0.5} strokeDasharray="1.5 1" />
      })}

      {toggles.context && data.context.map((c) => {
        const st = CONTEXT_STYLE[c.kind]
        const lit = selected?.nearby.some((n) => n.id === c.id)
        return (
          <g key={c.id} transform={`translate(${c.x} ${c.z})`}>
            {lit && <circle r={4.2} fill="none" stroke={st.color} strokeWidth={0.5} />}
            <circle r={2.4} fill={st.color} stroke="#050b18" strokeWidth={0.5} />
            <text y={0.9} textAnchor="middle" fontSize={2.6} fontWeight={800} fill="#0b1220">{st.glyph}</text>
            <title>{c.name}</title>
            {(toggles.labels || lit) && (
              <text y={-3.6} textAnchor="middle" fontSize={2.4} fill="#e2e8f0" stroke="#050b18" strokeWidth={0.6} paintOrder="stroke">{c.name}</text>
            )}
          </g>
        )
      })}

      {toggles.markers && state.visibleDefects.map((d) => {
        const sel = d.id === selectedDefectId
        const r = DOT_R[d.band]
        return (
          <g key={d.id} transform={`translate(${d.x} ${d.z})`}
            className={interactive ? 'cursor-pointer' : ''}
            onClick={interactive ? (e) => { e.stopPropagation(); selectDefect(d.id) } : undefined}
            onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') selectDefect(d.id) } : undefined}
            tabIndex={interactive ? 0 : undefined}
            role={interactive ? 'button' : undefined}
            aria-label={`${d.id}, ${d.type_label}, priority ${BAND_LABEL[d.band]} ${d.rps.toFixed(0)}`}>
            {d.band === 'critical' && !reduced && <circle r={r} fill="none" stroke={BAND_COLOR.critical} strokeWidth={0.6} className="pulse-ring" />}
            {d.possible_recurrence && <circle r={r + 1.6} fill="none" stroke="#f97316" strokeWidth={0.5} strokeDasharray="1 0.6" />}
            {sel && <circle r={r + 2.4} fill="none" stroke="#22d3ee" strokeWidth={0.6} />}
            <circle r={r} fill={BAND_COLOR[d.band]} fillOpacity={d.statusAt === 'repair_submitted' ? 0.35 : 1}
              stroke={d.statusAt === 'repair_submitted' ? BAND_COLOR[d.band] : '#050b18'} strokeWidth={0.5} />
            <title>{`${d.id} · ${d.type_label} · RPS ${d.rps.toFixed(0)} (${BAND_LABEL[d.band]})`}</title>
          </g>
        )
      })}

      <g transform={`translate(${half - 18} ${half + 3.5})`}>
        <line x1={0} x2={20} y1={0} y2={0} stroke="#94a3b8" strokeWidth={0.4} />
        <text x={10} y={-1} textAnchor="middle" fontSize={2.2} fill="#94a3b8">{20 * data.meta.metres_per_unit} m</text>
      </g>
      <text x={-half} y={half + 4.5} fontSize={2.2} fill="#64748b">{data.meta.city_name}</text>
    </svg>
  )
}
