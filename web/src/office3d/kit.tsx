// Piezas compartidas: una sola geometría por forma y un material por color.
import type { ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'

export const BOX = new THREE.BoxGeometry(1, 1, 1)
export const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10)
export const CYL6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6)
export const CONE = new THREE.ConeGeometry(0.5, 1, 7)
export const BLOB = new THREE.IcosahedronGeometry(0.5, 0)
export const SPHERE = new THREE.SphereGeometry(0.5, 16, 12)

const cache = new Map<string, THREE.Material>()

/** Material mate compartido. `emissive` hace que brille sin luces extra. */
export function mat(color: string, emissive = 0, flat = false): THREE.MeshLambertMaterial {
  const key = `${color}|${emissive}|${flat}`
  let m = cache.get(key) as THREE.MeshLambertMaterial | undefined
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: flat })
    if (emissive) {
      m.emissive = new THREE.Color(color)
      m.emissiveIntensity = emissive
    }
    cache.set(key, m)
  }
  return m
}

export const glass = new THREE.MeshLambertMaterial({ color: '#cfe6ef', transparent: true, opacity: 0.18, depthWrite: false })

type V3 = [number, number, number]
type MeshProps = Omit<ThreeElements['mesh'], 'scale' | 'position'>

/** Caja con su centro en `p` y tamaño `s`. */
export function Box({ s, p, c, e = 0, shadow = true, ...rest }: { s: V3; p: V3; c: string; e?: number; shadow?: boolean } & MeshProps) {
  return <mesh geometry={BOX} material={mat(c, e)} scale={s} position={p} castShadow={shadow} receiveShadow {...rest} />
}

/** Generador pseudoaleatorio estable a partir de un texto. */
export function seeded(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

/** Textura de canvas que se repinta cuando cambian sus datos. */
export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export const FONT = '"IBM Plex Sans", system-ui, sans-serif'
