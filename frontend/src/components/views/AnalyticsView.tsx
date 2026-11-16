import type { ReactNode } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts'
import type { Band, Coverage, FactorKey } from '../../api/types'
import { BAND_COLOR, BAND_LABEL, COVERAGE_COLOR, COVERAGE_LABEL, FACTOR_META } from '../../lib/colors'
import { fromDay, toDay } from '../../lib/timeline'
import { useRoadIQ } from '../../store/useRoadIQ'
import DamageDistribution, { axisProps, chartTooltip } from '../dashboard/DamageDistribution'

function Card({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <section className="glass p-4">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="mb-2 text-[11px] text-slate-400">{sub}</p>
      {children}
    </section>
  )
}

export default function AnalyticsView() {
  const data = useRoadIQ((s) => s.data)!
  const selectDefect = useRoadIQ((s) => s.selectDefect)
  const setView = useRoadIQ((s) => s.setView)
  const active = data.defects.filter((d) => d.status !== 'repaired_verified')

  const bands: Band[] = ['critical', 'high', 'medium', 'low']
  const bandRows = bands.map((b) => ({ band: BAND_LABEL[b], key: b, count: data.metrics.reports_by_band?.[b] ?? data.metrics.by_band[b] ?? 0 }))
  const sectionBands: Band[] = ['critical', 'high', 'medium', 'low', 'none']
  const sectionRows = sectionBands.map((b) => ({ band: b === 'none' ? 'None' : BAND_LABEL[b], key: b, count: data.metrics.sections_by_band?.[b] ?? 0 }))
  const covs: Coverage[] = ['recent', 'overdue', 'never', 'unknown']
  const SHORT: Record<Coverage, string> = { recent: 'Recent', overdue: 'Overdue', never: 'Never', unknown: 'Unknown' }
  const covRows = covs.map((c) => ({ label: SHORT[c], full: COVERAGE_LABEL[c], key: c, count: data.metrics.by_coverage[c] ?? 0 }))

  const end = toDay(data.meta.as_of)
  const startWeek = Math.min(...data.defects.map((d) => toDay(d.detected_on)), end)
  const weeks: { week: string; detections: number }[] = []
  for (let w = startWeek - ((startWeek - end) % 7 + 7) % 7; w <= end; w += 7) {
    const count = data.defects.filter((d) => {
      const day = toDay(d.detected_on)
      return day >= w && day < w + 7
    }).length
    weeks.push({ week: new Date(fromDay(w) + 'T00:00:00Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }), detections: count })
  }

  const factors: FactorKey[] = ['D', 'T', 'V', 'R', 'W']
  const factorRows = factors.map((k) => ({
    key: k, label: FACTOR_META[k].label.split(' ')[0],
    avg: active.length ? active.reduce((s, d) => s + d.factors[k], 0) / active.length : 0,
  }))
  const scatter = active.map((d) => ({ x: Math.round(d.confidence * 100), y: Math.round(d.rps), id: d.id, band: d.band, type: d.type_label }))

  return (
    <div className="scroll-thin h-full overflow-y-auto p-3">
      <div className="mx-auto max-w-[1400px] space-y-3">
        <div className="px-1">
          <h1 className="text-xl font-semibold text-white">Analytics</h1>
          <p className="text-xs text-slate-400">Every chart is computed from the same API records as the 3D city. Hover a mark for its value.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Card title="Unresolved defect reports by category" sub={`${data.metrics.total_defects} reports not yet repaired and verified`}>
            <DamageDistribution height={220} />
          </Card>
          <Card title="Defect reports by priority" sub="Each report's own score · counts reports, not roads">
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={bandRows} margin={{ top: 16, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="band" {...axisProps} />
                  <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
                  <Tooltip {...chartTooltip} formatter={(v) => [v, 'Defect reports']} />
                  <Bar dataKey="count" maxBarSize={24} radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#cbd5e1', fontSize: 11 }}>
                    {bandRows.map((r) => <Cell key={r.key} fill={BAND_COLOR[r.key]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Road sections by priority" sub="Section score = its highest unresolved report · None = no unresolved damage recorded">
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={sectionRows} margin={{ top: 16, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="band" {...axisProps} />
                  <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
                  <Tooltip {...chartTooltip} formatter={(v) => [v, 'Road sections']} />
                  <Bar dataKey="count" maxBarSize={24} radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#cbd5e1', fontSize: 11 }}>
                    {sectionRows.map((r) => <Cell key={r.key} fill={BAND_COLOR[r.key]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Road sections by inspection status" sub="Survey Gap Radar: unknown is not safe">
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={covRows} margin={{ top: 16, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
                  <Tooltip {...chartTooltip} formatter={(v) => [v, 'Road sections']} labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ''} />
                  <Bar dataKey="count" maxBarSize={24} radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#cbd5e1', fontSize: 11 }}>
                    {covRows.map((r) => <Cell key={r.key} fill={COVERAGE_COLOR[r.key]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Detections per week" sub="All damage records, by week of detection">
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={weeks} margin={{ top: 16, right: 12, bottom: 0, left: -18 }}>
                  <CartesianGrid vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="week" {...axisProps} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
                  <Tooltip {...chartTooltip} cursor={{ stroke: '#475569' }} formatter={(v) => [v, 'Detections']} />
                  <Line type="linear" dataKey="detections" stroke="#22d3ee" strokeWidth={2} dot={{ r: 4, fill: '#22d3ee', stroke: '#08142a', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Average factor values" sub="Mean of each RPS factor (0–100) across unresolved reports">
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={factorRows} margin={{ top: 16, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis domain={[0, 100]} {...axisProps} axisLine={false} />
                  <Tooltip {...chartTooltip} formatter={(v) => [Number(v).toFixed(1), 'Average']} />
                  <Bar dataKey="avg" maxBarSize={24} radius={[4, 4, 0, 0]} fill="#38bdf8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Model confidence is not priority" sub="Each dot is an unresolved report. Click one to inspect it">
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 12, right: 12, bottom: 8, left: -12 }}>
                  <CartesianGrid stroke="#1e293b" />
                  <XAxis type="number" dataKey="x" name="Model confidence" unit="%" domain={[50, 100]} {...axisProps} />
                  <YAxis type="number" dataKey="y" name="RPS" domain={[0, 100]} {...axisProps} axisLine={false} />
                  <ZAxis range={[70, 70]} />
                  <Tooltip {...chartTooltip} cursor={{ strokeDasharray: '3 3' }}
                    formatter={(v, n) => [v, n]} labelFormatter={() => ''} />
                  <Scatter data={scatter} onClick={(p) => { const id = (p as { payload?: { id?: string } }).payload?.id; if (id) { selectDefect(id, true); setView('city') } }} className="cursor-pointer">
                    {scatter.map((s) => <Cell key={s.id} fill={BAND_COLOR[s.band]} stroke="#08142a" strokeWidth={2} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11.5px] text-slate-400">X: how sure the model is. Y: how urgent the road is. A confident detection on a quiet road can still rank low.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
