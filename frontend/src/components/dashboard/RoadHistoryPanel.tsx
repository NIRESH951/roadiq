import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDate, fromDay, timeRange, timelineEvents, type TimelineEvent } from '../../lib/timeline'
import { useRoadIQ, useSelectedDefect } from '../../store/useRoadIQ'
import DefectImage from './DefectImage'

const KIND_COLOR: Record<TimelineEvent['kind'], string> = {
  detection: '#22d3ee',
  recurrence: '#f97316',
  repair: '#a78bfa',
  verified: '#22c55e',
  inspection: '#64748b',
}

/** Bottom panel: Road Memory time machine with a date slider, event list and before/after comparison. */
export default function RoadHistoryPanel() {
  const data = useRoadIQ((s) => s.data)!
  const day = useRoadIQ((s) => s.day)
  const setDay = useRoadIQ((s) => s.setDay)
  const open = useRoadIQ((s) => s.timelineOpen)
  const setOpen = useRoadIQ((s) => s.setTimelineOpen)
  const segmentId = useRoadIQ((s) => s.selectedSegmentId)
  const selectDefect = useRoadIQ((s) => s.selectDefect)
  const defect = useSelectedDefect()
  const [playing, setPlaying] = useState(false)
  const timer = useRef<number | null>(null)

  const range = useMemo(() => timeRange(data), [data])
  const events = useMemo(() => timelineEvents(data, segmentId), [data, segmentId])
  const current = day ?? range.end
  const first = events.length ? events[0].day : range.start
  const scopeName = segmentId ? `${data.segments.find((s) => s.id === segmentId)?.road_name ?? ''} (${segmentId})` : 'All roads'

  useEffect(() => {
    if (!playing) return
    const stops = [...new Set(events.map((e) => e.day))].sort((a, b) => a - b)
    if (!stops.length) {
      setPlaying(false)
      return
    }
    let idx = 0
    setDay(stops[0])
    timer.current = window.setInterval(() => {
      idx += 1
      if (idx >= stops.length) {
        setDay(null)
        setPlaying(false)
        return
      }
      setDay(stops[idx])
    }, 1400)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [playing, events, setDay])

  const earlier = defect?.recurrence_of.length ? data.defects.find((d) => d.id === defect.recurrence_of[0]) : null
  const repair = defect ? data.repairs.find((r) => r.defect_id === defect.id || (earlier && r.defect_id === earlier.id)) : null

  const pct = (d: number) => ((d - range.start) / Math.max(1, range.end - range.start)) * 100

  return (
    <div className="glass-strong pointer-events-auto">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
          className="flex items-center gap-2 text-left">
          <span className="section-title">Road Memory</span>
          <span className="text-xs text-slate-400">{scopeName}</span>
          <span className="text-slate-400" aria-hidden>{open ? '▾' : '▴'}</span>
        </button>
        <span className="ml-auto rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-xs tabular-nums text-cyan-100">
          {day === null ? `Today · ${formatDate(data.meta.as_of)}` : formatDate(fromDay(current))}
        </span>
        <button type="button" onClick={() => setPlaying((p) => !p)}
          className="rounded-md border border-slate-600/60 px-2 py-0.5 text-xs text-slate-200 hover:border-cyan-400/60">
          {playing ? '❚❚ Pause' : '▶ Play history'}
        </button>
        <button type="button" onClick={() => { setPlaying(false); setDay(null) }} disabled={day === null}
          className="rounded-md border border-slate-600/60 px-2 py-0.5 text-xs text-slate-200 enabled:hover:border-cyan-400/60 disabled:opacity-40">
          Today
        </button>
      </div>

      {open && (
        <div className="grid gap-3 px-3 pb-3 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <div className="relative px-1 pt-2">
              <div className="pointer-events-none absolute inset-x-1 top-0 h-2">
                {events.map((e, i) => (
                  <span key={`${e.refId}-${e.kind}-${i}`} className="absolute top-0 h-2 w-2 -translate-x-1/2 rounded-full"
                    style={{ left: `${pct(e.day)}%`, background: KIND_COLOR[e.kind] }} title={e.label} />
                ))}
              </div>
              <input
                type="range"
                className="timeline-range w-full"
                min={range.start}
                max={range.end}
                value={current}
                onChange={(e) => { setPlaying(false); setDay(Number(e.target.value)) }}
                aria-label="Timeline date"
                aria-valuetext={formatDate(fromDay(current))}
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>{formatDate(fromDay(range.start))}</span>
                <span>{formatDate(fromDay(range.end))}</span>
              </div>
            </div>
            <ol className="scroll-thin mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
              {events.map((e, i) => {
                const past = e.day <= current
                return (
                  <li key={`${e.refId}-${e.kind}-${i}`} className="shrink-0">
                    <button type="button"
                      onClick={() => {
                        setPlaying(false)
                        setDay(e.day)
                        if (e.kind !== 'inspection') selectDefect(e.refId)
                      }}
                      className={`max-w-[260px] rounded-lg border px-2 py-1 text-left transition ${past ? 'border-slate-600/70 bg-slate-800/60' : 'border-slate-800 bg-slate-900/40 opacity-50'}`}
                    >
                      <span className="flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: KIND_COLOR[e.kind] }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: KIND_COLOR[e.kind] }} aria-hidden />
                        Day {e.day - first + 1} · {formatDate(e.date)}
                        {e.source === 'demo' && <span className="text-amber-300/80">· demo</span>}
                      </span>
                      <span className="block truncate text-[11px] text-slate-200">{e.label}</span>
                    </button>
                  </li>
                )
              })}
              {!events.length && <li className="text-xs text-slate-400">No recorded events for this road yet.</li>}
            </ol>
          </div>

          {defect && (earlier || repair) && (
            <div className="grid w-full grid-cols-2 gap-2 lg:w-[360px]">
              {earlier ? (
                <>
                  <DefectImage defect={earlier} caption={`Earlier · ${earlier.id} · ${formatDate(earlier.detected_on)}`} />
                  <DefectImage defect={defect} caption={`Latest · ${defect.id} · ${formatDate(defect.detected_on)}`} />
                </>
              ) : repair ? (
                <>
                  <DefectImage url={repair.before_image_url} caption={`Before · ${formatDate(defect.detected_on)}`} showBox={false} />
                  <DefectImage url={repair.after_image_url} caption={`After repair · ${formatDate(repair.submitted_on)}`} showBox={false} />
                </>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

