import * as THREE from 'three'
import type { DamageType } from '../../api/types'

/** Small procedural textures, created once and shared, so the scene downloads no image assets. */

function seeded(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

function canvas(size: number) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return [c, c.getContext('2d') as CanvasRenderingContext2D] as const
}

const cache = new Map<string, THREE.Texture>()

function remember(key: string, make: () => THREE.Texture): THREE.Texture {
  const hit = cache.get(key)
  if (hit) return hit
  const tex = make()
  cache.set(key, tex)
  return tex
}

export function asphaltTexture(): THREE.Texture {
  return remember('asphalt', () => {
    const [c, g] = canvas(256)
    const rnd = seeded(7)
    g.fillStyle = '#23262d'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 5200; i++) {
      const v = 28 + rnd() * 34
      g.fillStyle = `rgb(${v},${v},${v + 4})`
      g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 1.4, 1 + rnd() * 1.4)
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  })
}

/** Facade with lit windows; used as emissive map so the city reads as a night-time model. */
export function windowTexture(lit: boolean): THREE.Texture {
  return remember(`windows-${lit}`, () => {
    const [c, g] = canvas(128)
    const rnd = seeded(lit ? 31 : 11)
    g.fillStyle = lit ? '#000000' : '#1a2a48'
    g.fillRect(0, 0, 128, 128)
    for (let y = 6; y < 128; y += 16) {
      for (let x = 6; x < 128; x += 14) {
        if (lit) {
          const on = rnd() > 0.55
          g.fillStyle = on ? (rnd() > 0.6 ? '#ffd9a0' : '#9fe7ff') : '#000000'
        } else {
          g.fillStyle = '#2c4470'
        }
        g.fillRect(x, y, 8, 9)
      }
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })
}

/** Transparent damage decals drawn on the road surface. */
export function damageTexture(type: DamageType): THREE.Texture {
  return remember(`damage-${type}`, () => {
    const [c, g] = canvas(256)
    const rnd = seeded(type.length * 97)
    g.clearRect(0, 0, 256, 256)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    const crack = (x0: number, y0: number, x1: number, y1: number, steps: number, w: number) => {
      g.strokeStyle = 'rgba(8,8,10,0.95)'
      g.lineWidth = w
      g.beginPath()
      g.moveTo(x0, y0)
      for (let i = 1; i <= steps; i++) {
        const f = i / steps
        g.lineTo(x0 + (x1 - x0) * f + (rnd() - 0.5) * 18, y0 + (y1 - y0) * f + (rnd() - 0.5) * 18)
      }
      g.stroke()
    }
    if (type === 'pothole') {
      const grad = g.createRadialGradient(128, 128, 10, 128, 128, 110)
      grad.addColorStop(0, 'rgba(18,24,34,1)')
      grad.addColorStop(0.55, 'rgba(12,12,14,1)')
      grad.addColorStop(0.8, 'rgba(70,70,74,0.9)')
      grad.addColorStop(1, 'rgba(70,70,74,0)')
      g.fillStyle = grad
      g.beginPath()
      for (let k = 0; k <= 20; k++) {
        const a = (k / 20) * Math.PI * 2
        const r = 82 + rnd() * 26
        const x = 128 + Math.cos(a) * r
        const y = 128 + Math.sin(a) * r * 0.82
        if (k === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.fill()
      g.fillStyle = 'rgba(56,90,130,0.45)'
      g.beginPath()
      g.ellipse(120, 132, 44, 30, 0.3, 0, Math.PI * 2)
      g.fill()
    } else if (type === 'longitudinal_crack') {
      // Runs along the texture's u axis, which is laid along the direction of traffic.
      crack(8, 128, 248, 120, 14, 7)
      crack(90, 126, 120, 90, 4, 3)
      crack(170, 122, 200, 160, 4, 3)
    } else if (type === 'transverse_crack') {
      // Runs along v, across the road.
      crack(128, 8, 140, 248, 14, 7)
      crack(130, 90, 170, 130, 4, 3)
      crack(136, 170, 100, 205, 4, 3)
    } else {
      for (let j = 0; j <= 5; j++) crack(30, 30 + j * 39, 226, 34 + j * 38, 8, 4)
      for (let i = 0; i <= 5; i++) crack(30 + i * 39, 30, 34 + i * 38, 226, 8, 4)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })
}

/** Soft radial dot used for glows and pulses. */
export function glowTexture(): THREE.Texture {
  return remember('glow', () => {
    const [c, g] = canvas(128)
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
  })
}

export function disposeTextures() {
  cache.forEach((t) => t.dispose())
  cache.clear()
}

export { seeded }
