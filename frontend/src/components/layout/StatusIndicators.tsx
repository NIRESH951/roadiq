import { useRoadIQ } from '../../store/useRoadIQ'

/**
 * Honest status chips: whether the backend is answering, which dataset is shown, and whether a model is loaded.
 * Nothing here says "live" unless live records actually exist.
 */
export function useStatus() {
  const connection = useRoadIQ((s) => s.connection)
  const offline = useRoadIQ((s) => s.offline)
  const health = useRoadIQ((s) => s.health)
  const data = useRoadIQ((s) => s.data)
  const live = data?.metrics.sources.live ?? 0
  const demo = data?.metrics.sources.demo ?? 0

  const backend =
    connection === 'connected'
      ? { tone: 'good', label: 'Backend connected', help: 'The RoadIQ API is answering. Data is loaded from the database.' }
      : connection === 'static'
        ? { tone: 'warn', label: 'Static preview · no backend', help: 'This build has no backend. It shows a bundled snapshot of the demo dataset.' }
        : connection === 'checking'
          ? { tone: 'neutral', label: 'Checking backend…', help: 'Contacting the RoadIQ API.' }
          : offline
            ? { tone: 'bad', label: 'Backend unavailable · cached demo data', help: 'The API did not answer, so RoadIQ is showing its bundled offline demo snapshot. Uploads and repair actions are disabled.' }
            : { tone: 'bad', label: 'Backend unavailable · last loaded data', help: 'The API stopped answering. Figures are from the last successful load. Uploads and repair actions are disabled until it reconnects.' }

  const dataset =
    live === 0
      ? { tone: 'warn', label: 'Demo dataset · fictional', help: `${demo} demonstration records in a fictional city. No live inspection records yet.` }
      : demo === 0
        ? { tone: 'good', label: `Live data · ${live} reports`, help: 'All reports come from uploaded photos.' }
        : { tone: 'warn', label: `Demo + ${live} live reports`, help: `${demo} fictional demo reports and ${live} live reports from uploaded photos. Every record carries a DEMO or LIVE badge.` }

  const model =
    connection !== 'connected' || !health
      ? null
      : health.detector.configured
        ? { tone: 'good', label: health.detector.loaded ? 'Detector loaded' : 'Detector configured', help: health.detector.message }
        : { tone: 'neutral', label: 'Detector not configured', help: health.detector.message }

  return { backend, dataset, model, canWrite: connection === 'connected' }
}

const TONE: Record<string, string> = {
  good: 'border-emerald-400/50 text-emerald-200 bg-emerald-400/10',
  warn: 'border-amber-400/50 text-amber-200 bg-amber-400/10',
  bad: 'border-red-400/60 text-red-200 bg-red-500/15',
  neutral: 'border-slate-500/60 text-slate-200 bg-slate-700/30',
}
const DOT: Record<string, string> = { good: 'bg-emerald-400', warn: 'bg-amber-400', bad: 'bg-red-400', neutral: 'bg-slate-400' }

function Chip({ tone, label, help }: { tone: string; label: string; help: string }) {
  return (
    <span title={help} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} aria-hidden />
      {label}
    </span>
  )
}

export default function StatusIndicators({ stacked = false }: { stacked?: boolean }) {
  const { backend, dataset, model } = useStatus()
  const setView = useRoadIQ((s) => s.setView)
  return (
    <button type="button" onClick={() => setView('settings')} title="Open data source details"
      className={`flex ${stacked ? 'flex-col items-start' : 'items-center'} gap-1.5 rounded-lg text-left`} aria-label={`${backend.label}. ${dataset.label}.${model ? ` ${model.label}.` : ''}`}>
      <Chip {...backend} />
      <Chip {...dataset} />
      {model && <span className="hidden 2xl:inline-flex"><Chip {...model} /></span>}
    </button>
  )
}

export function StatusDetails() {
  const { backend, dataset, model } = useStatus()
  return (
    <ul className="space-y-2 text-xs">
      {[backend, dataset, ...(model ? [model] : [])].map((s) => (
        <li key={s.label}>
          <Chip {...s} />
          <p className="mt-1 text-slate-300">{s.help}</p>
        </li>
      ))}
    </ul>
  )
}
