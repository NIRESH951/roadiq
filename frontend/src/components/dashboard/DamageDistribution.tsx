import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DamageType } from '../../api/types'
import { DAMAGE_LABEL } from '../../lib/colors'
import { useRoadIQ } from '../../store/useRoadIQ'

const TYPES: DamageType[] = ['pothole', 'alligator_crack', 'transverse_crack', 'longitudinal_crack']

export const chartTooltip = {
  contentStyle: { background: 'rgba(5,14,30,0.95)', border: '1px solid rgba(56,189,248,0.35)', borderRadius: 10, fontSize: 12 },
  labelStyle: { color: '#e2e8f0' },
  itemStyle: { color: '#cbd5e1' },
  cursor: { fill: 'rgba(148,163,184,0.08)' },
}

export const axisProps = {
  stroke: '#334155',
  tick: { fill: '#94a3b8', fontSize: 11 },
  tickLine: false,
}

/** Open defects by damage category: one series, one colour, value labels in text colour. */
export default function DamageDistribution({ height = 180 }: { height?: number }) {
  const data = useRoadIQ((s) => s.data)
  if (!data) return null
  const rows = TYPES.map((t) => ({ type: DAMAGE_LABEL[t].replace(' crack', ''), full: DAMAGE_LABEL[t], count: data.metrics.by_type[t] ?? 0 }))
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 16, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="#1e293b" />
          <XAxis dataKey="type" {...axisProps} />
          <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
          <Tooltip {...chartTooltip} formatter={(v) => [v, 'Defect reports']} labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ''} />
          <Bar dataKey="count" maxBarSize={24} radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#cbd5e1', fontSize: 11 }}>
            {rows.map((r) => <Cell key={r.type} fill="#22d3ee" />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
