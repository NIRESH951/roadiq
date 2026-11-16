import type { SceneDef } from './scenes'

export default function PresentationControls({ scenes, index, onGo, onExit, onFullscreen, fullscreen }: {
  scenes: SceneDef[]
  index: number
  onGo: (i: number) => void
  onExit: () => void
  onFullscreen: () => void
  fullscreen: boolean
}) {
  const btn = 'rounded-lg border border-slate-600/70 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-100 hover:border-cyan-400/70 disabled:opacity-40'
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 p-4">
      <div className="h-1 w-full max-w-[720px] overflow-hidden rounded-full bg-slate-800" role="progressbar"
        aria-label="Presentation progress" aria-valuemin={1} aria-valuemax={scenes.length} aria-valuenow={index + 1}>
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-[width] duration-500" style={{ width: `${((index + 1) / scenes.length) * 100}%` }} />
      </div>
      <div className="glass-strong flex flex-wrap items-center justify-center gap-2 px-3 py-2">
        <button type="button" className={btn} onClick={() => onGo(index - 1)} disabled={index === 0} aria-label="Previous scene">← Previous</button>
        <div className="flex items-center gap-1.5 px-1" role="tablist" aria-label="Scenes">
          {scenes.map((s, i) => (
            <button key={s.key} type="button" role="tab" aria-selected={i === index} aria-label={s.kicker} title={s.kicker}
              onClick={() => onGo(i)}
              className={`h-2.5 rounded-full transition-all ${i === index ? 'w-7 bg-cyan-400' : 'w-2.5 bg-slate-600 hover:bg-slate-400'}`} />
          ))}
        </div>
        <span className="text-xs tabular-nums text-slate-400">{index + 1} / {scenes.length}</span>
        <button type="button" className={btn} onClick={() => onGo(index + 1)} disabled={index === scenes.length - 1} aria-label="Next scene">Next →</button>
        <button type="button" className={btn} onClick={onFullscreen}>{fullscreen ? '⤢ Exit full screen' : '⤢ Full screen'}</button>
        <button type="button" className={btn} onClick={onExit}>✕ Exit</button>
      </div>
      <p className="text-[11.5px] text-slate-400">Keys: ← → to move, F for full screen, Esc to exit</p>
    </div>
  )
}
