import { useState } from 'react'
import { assetUrl } from '../../api/client'
import type { Defect } from '../../api/types'

/** Photo (or labelled demo illustration) with the detection box drawn from stored bbox data. */
export default function DefectImage({ defect, url, caption, showBox = true, className = '' }: {
  defect?: Defect | null
  url?: string | null
  caption?: string
  showBox?: boolean
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const src = assetUrl(url ?? defect?.image_url)
  if (!src || failed) {
    return (
      <div className={`flex aspect-[16/10] items-center justify-center rounded-lg border border-dashed border-slate-600/60 bg-slate-900/50 p-3 text-center text-xs text-slate-400 ${className}`}>
        {failed ? 'Image could not be loaded.' : 'No image stored for this record.'}
      </div>
    )
  }
  const box = showBox && defect?.bbox
  return (
    <figure className={className}>
      <div className="relative overflow-hidden rounded-lg border border-slate-700/60 bg-black">
        <img src={src} alt={caption ?? `${defect?.type_label ?? 'Road'} image`} className="block w-full" onError={() => setFailed(true)} loading="lazy" />
        {box && defect && (
          <div
            className="absolute rounded-sm border-2 border-cyan-300 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_0_14px_rgba(34,211,238,0.6)]"
            style={{
              left: `${box[0] * 100}%`, top: `${box[1] * 100}%`, width: `${box[2] * 100}%`, height: `${box[3] * 100}%`,
            }}
          >
            <span className="absolute -top-5 left-[-2px] whitespace-nowrap rounded-t bg-cyan-300 px-1.5 text-[11px] font-semibold text-slate-950">
              {defect.type_label} {(defect.confidence * 100).toFixed(0)}%
            </span>
          </div>
        )}
        {defect && (
          <span className={`absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[11px] font-bold tracking-wide ${
            defect.source === 'demo' ? 'bg-amber-400/90 text-slate-950' : 'bg-emerald-400/90 text-slate-950'
          }`}>
            {defect.source === 'demo' ? 'DEMO ILLUSTRATION' : 'LIVE PHOTO'}
          </span>
        )}
      </div>
      {caption && <figcaption className="mt-1 text-[11px] text-slate-400">{caption}</figcaption>}
    </figure>
  )
}
