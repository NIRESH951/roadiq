import { useEffect, useRef, useState } from 'react'
import { useRoadIQ, type View } from '../../store/useRoadIQ'
import StatusIndicators, { StatusDetails } from './StatusIndicators'

export const NAV: { key: View; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'city', label: '3D City View' },
  { key: 'detection', label: 'AI Detection' },
  { key: 'map', label: 'Road Map' },
  { key: 'memory', label: 'Road Memory' },
  { key: 'radar', label: 'Survey Gap Radar' },
  { key: 'repairs', label: 'Repair Verification' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'settings', label: 'Settings' },
]

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" className={small ? 'h-7 w-7' : 'h-8 w-8'} aria-hidden>
        <rect width="64" height="64" rx="14" fill="#07142b" stroke="#22d3ee" strokeOpacity="0.4" />
        <path d="M20 54 29 10h6l9 44" fill="none" stroke="#22d3ee" strokeWidth="5" strokeLinejoin="round" />
        <path d="M32 18v6M32 31v6M32 44v6" stroke="#e2f7ff" strokeWidth="3" />
        <circle cx="47" cy="17" r="6" fill="#ef4444" />
      </svg>
      <div className="text-left leading-tight">
        <div className={`${small ? 'text-base' : 'text-lg'} font-bold tracking-tight text-white`}>
          Road<span className="text-cyan-400">IQ</span>
        </div>
        {!small && <div className="hidden text-[11px] text-slate-400 xl:block">AI-Powered Road Intelligence & Safer Street Prioritization</div>}
      </div>
    </div>
  )
}

/**
 * Two rows on desktop (brand + status + view switch, then all nine tabs) so nothing is ever clipped.
 * Below 1024 px the tabs move into a menu.
 */
export default function TopNav({ webgl }: { webgl: boolean }) {
  const view = useRoadIQ((s) => s.view)
  const setView = useRoadIQ((s) => s.setView)
  const openPresentation = useRoadIQ((s) => s.openPresentation)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const is3D = view === 'city' || view === 'memory' || view === 'radar'

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [menuOpen])

  const go = (v: View) => {
    setView(v)
    setMenuOpen(false)
  }

  return (
    <header className="relative z-40 shrink-0 border-b border-cyan-400/10 bg-[#060f22]/95 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-3">
        <div ref={menuRef} className="relative lg:hidden">
          <button type="button" data-testid="nav-menu" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-controls="mobile-nav"
            className="grid h-9 w-9 place-items-center rounded-md border border-slate-700 text-slate-200 hover:border-cyan-400/60" aria-label="Open navigation menu">
            ☰
          </button>
          {menuOpen && (
            <div id="mobile-nav" className="glass-strong absolute left-0 top-11 w-[min(320px,calc(100vw-24px))] p-2 shadow-2xl">
              <div className="border-b border-slate-700/60 p-2"><StatusDetails /></div>
              <nav aria-label="Main" className="mt-1 grid">
                {NAV.map((n) => (
                  <button key={n.key} type="button" onClick={() => go(n.key)} aria-current={view === n.key ? 'page' : undefined}
                    className={`rounded-md px-3 py-2.5 text-left text-sm ${view === n.key ? 'bg-cyan-400/15 text-white' : 'text-slate-200 hover:bg-slate-800'}`}>
                    {n.label}
                  </button>
                ))}
              </nav>
            </div>
          )}
        </div>

        <button type="button" onClick={() => go('city')} className="shrink-0" aria-label="RoadIQ home"><Logo /></button>

        <div className="ml-auto hidden min-w-0 items-center md:flex"><StatusIndicators /></div>

        <div className="ml-auto flex shrink-0 items-center rounded-lg border border-slate-700/70 bg-slate-900/60 p-0.5 text-[12.5px] md:ml-2" role="group" aria-label="View mode">
          <button type="button" onClick={() => go('map')}
            className={`rounded-md px-2.5 py-1.5 ${view === 'map' ? 'bg-cyan-400/20 text-white' : 'text-slate-300 hover:text-white'}`}>2D<span className="hidden sm:inline"> Map</span></button>
          <button type="button" onClick={() => go('city')} disabled={!webgl} title={webgl ? undefined : 'WebGL is not available on this device'}
            className={`rounded-md px-2.5 py-1.5 disabled:opacity-40 ${is3D ? 'bg-cyan-400/20 text-white' : 'text-slate-300 hover:text-white'}`}>3D<span className="hidden sm:inline"> City</span></button>
          <button type="button" onClick={openPresentation}
            className="whitespace-nowrap rounded-md bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-1.5 font-semibold text-white shadow hover:brightness-110">▶ Present</button>
        </div>
      </div>

      <nav className="hidden h-10 items-stretch gap-0.5 border-t border-cyan-400/5 px-2 lg:flex" aria-label="Main">
        {NAV.map((n) => (
          <button key={n.key} type="button" onClick={() => go(n.key)} aria-current={view === n.key ? 'page' : undefined}
            className={`relative whitespace-nowrap rounded-md px-2.5 text-[13px] transition ${
              view === n.key ? 'text-white' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}>
            {n.label}
            {view === n.key && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded bg-cyan-400" aria-hidden />}
          </button>
        ))}
      </nav>
      <div className="flex items-center gap-2 overflow-x-auto border-t border-cyan-400/5 px-3 py-1.5 md:hidden"><StatusIndicators /></div>
    </header>
  )
}
