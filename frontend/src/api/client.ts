import type { CityData, DetectorStatus, HealthStatus, Repair } from './types'

const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
export const OFFLINE_ONLY = import.meta.env.VITE_OFFLINE_ONLY === 'true'

export interface LoadResult {
  data: CityData
  offline: boolean
  reason?: string
}

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Load the city from the FastAPI backend; fall back to the labelled offline demo snapshot. */
export async function loadCity(): Promise<LoadResult> {
  if (!OFFLINE_ONLY) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/city`, 5000)
      if (res.ok) {
        const data = (await res.json()) as CityData
        return { data, offline: false }
      }
      throw new Error(`API answered ${res.status}`)
    } catch (err) {
      const snap = await fetch('demo-snapshot.json')
      if (!snap.ok) throw new Error('The RoadIQ API is unreachable and no offline snapshot was found.')
      return {
        data: (await snap.json()) as CityData,
        offline: true,
        reason: err instanceof Error ? err.message : 'API unreachable',
      }
    }
  }
  const snap = await fetch('demo-snapshot.json')
  if (!snap.ok) throw new Error('Offline snapshot missing.')
  return { data: (await snap.json()) as CityData, offline: true, reason: 'Static preview build' }
}

let offlineAssets = OFFLINE_ONLY
export function setOfflineAssets(v: boolean) {
  offlineAssets = v
}

/** Resolve an image path from the API (or the bundled snapshot copies when offline). */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^https?:/.test(path)) return path
  if (offlineAssets) return path.replace(/^\//, '')
  return `${API_BASE}${path}`
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail ?? body)
  } catch {
    return `Request failed (${res.status})`
  }
}

export async function getHealth(): Promise<HealthStatus> {
  const res = await fetchWithTimeout(`${API_BASE}/api/health`, 4000, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Health check answered ${res.status}`)
  return res.json()
}

export async function getDetectorStatus(): Promise<DetectorStatus> {
  const res = await fetchWithTimeout(`${API_BASE}/api/detect/status`, 5000)
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export interface DetectResponse {
  inspection_id: string
  image_url: string
  annotated_image_url: string
  segment_id: string
  road_name: string
  position: number
  detections: CityData['defects']
  message: string
}

// Vercel accepts request bodies up to about 4.5 MB, so large phone photos are resized in the browser first.
async function shrinkPhoto(file: File): Promise<Blob> {
  if (file.size <= 3_500_000 || typeof createImageBitmap !== 'function') return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.9))
    return blob ?? file
  } catch {
    return file
  }
}

export async function runDetection(file: File, segmentId: string, t: number, lane: number): Promise<DetectResponse> {
  const form = new FormData()
  const photo = await shrinkPhoto(file)
  form.append('image', photo, photo === file ? file.name : 'photo.jpg')
  form.append('segment_id', segmentId)
  form.append('t', String(t))
  form.append('lane', String(lane))
  const res = await fetch(`${API_BASE}/api/detect`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function submitRepair(defectId: string, crew: string, image: File | null): Promise<Repair> {
  const form = new FormData()
  form.append('defect_id', defectId)
  form.append('crew', crew)
  if (image) form.append('image', image)
  const res = await fetch(`${API_BASE}/api/repairs`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function verifyRepair(repairId: string): Promise<Repair> {
  const res = await fetch(`${API_BASE}/api/repairs/${encodeURIComponent(repairId)}/verify`, { method: 'POST' })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function resetDemoData(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/reset-demo`, { method: 'POST' })
  if (!res.ok) throw new Error(await readError(res))
}
