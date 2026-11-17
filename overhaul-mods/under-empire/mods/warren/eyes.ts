// The warren's watching eyes. One pair of red eyes opens in a tunnel per active task or subagent
// (cap 13) and closes when that task ends. Pure state transitions plus the drawing of a tunnel's eyes.

import type { WarrenEye, WarrenState } from '../../types'

/** A place for a pair of eyes: a tunnel (keyed "cx,by", matching tunnel() in scene.ts), an offset inside it as a
 *  fraction of the tunnel's width and height, and a scale (further back means smaller). */
type Spot = { tunnel: string; ox: number; oy: number; s: number; w: number; h: number }

const TUNNELS = {
  l1: { key: '330,420', w: 96, h: 122, side: 'left' },
  l2: { key: '120,250', w: 70, h: 86, side: 'left' },
  l3: { key: '330,822', w: 112, h: 142, side: 'left' },
  r1: { key: '300,300', w: 110, h: 140, side: 'right' },
  r2: { key: '440,540', w: 80, h: 96, side: 'right' },
  r3: { key: '450,834', w: 120, h: 150, side: 'right' },
} as const

const spot = (t: keyof typeof TUNNELS, ox: number, oy: number, s: number): Spot => ({ tunnel: TUNNELS[t].key, ox, oy, s, w: TUNNELS[t].w, h: TUNNELS[t].h })

/** 13 spots: 7 on the left wall (2 + 2 + 3), 6 on the right (2 + 2 + 2). */
export const SPOTS: Spot[] = [
  spot('l1', -0.16, 0, 1),
  spot('l1', 0.2, -0.1, 0.7),
  spot('l2', -0.14, 0, 0.9),
  spot('l2', 0.18, -0.08, 0.65),
  spot('l3', -0.2, 0, 1),
  spot('l3', 0.2, -0.1, 0.75),
  spot('l3', 0, 0.2, 0.55),
  spot('r1', -0.18, 0, 1),
  spot('r1', 0.2, -0.1, 0.7),
  spot('r2', -0.14, 0, 0.85),
  spot('r2', 0.18, -0.08, 0.6),
  spot('r3', -0.2, 0, 1),
  spot('r3', 0.2, -0.1, 0.7),
]

export const MAX_EYES = SPOTS.length

export const EMPTY: WarrenState = { running: false, eyes: [] }

/** Every event first settles what has finished: opening eyes are now open, closed ones are gone. */
export function settle(eyes: WarrenEye[]): WarrenEye[] {
  return eyes.filter((e) => e.phase !== 'closing').map((e) => (e.phase === 'opening' ? { ...e, phase: 'open' as const } : e))
}

/** One thing that happened, queued until the next batch. */
export type Op = { kind: 'open'; id: string } | { kind: 'close'; id: string } | { kind: 'closePrefix'; prefix: string } | { kind: 'running'; on: boolean } | { kind: 'reset' }

/**
 * Applies a burst of events as one state update, so the scene changes once. Earlier phases settle once,
 * up front; a task that starts and ends inside the batch is never drawn.
 */
export function applyBatch(state: WarrenState, ops: Op[], rand: () => number = Math.random): WarrenState {
  let running = state.running
  let eyes = settle(state.eyes)
  const freshIds = new Set<string>()
  for (const op of ops) {
    if (op.kind === 'reset') {
      running = false
      eyes = []
      freshIds.clear()
    } else if (op.kind === 'running') {
      running = op.on
    } else if (op.kind === 'open') {
      if (eyes.some((e) => e.id === op.id)) continue
      const free = SPOTS.map((_, i) => i).filter((i) => !eyes.some((e) => e.spot === i))
      const spotIndex = free[Math.floor(rand() * free.length)]
      if (spotIndex === undefined) continue
      eyes = [...eyes, { id: op.id, spot: spotIndex, phase: 'opening' }]
      freshIds.add(op.id)
    } else {
      const ends = (id: string) => (op.kind === 'close' ? id === op.id : id.startsWith(op.prefix))
      eyes = eyes.filter((e) => !(freshIds.has(e.id) && ends(e.id))).map((e) => (ends(e.id) ? { ...e, phase: 'closing' as const } : e))
    }
  }
  return { running, eyes }
}

export const openEye = (state: WarrenState, id: string, rand?: () => number): WarrenState => applyBatch(state, [{ kind: 'open', id }], rand)

/** Closes the named pair. */
export const closeEye = (state: WarrenState, id: string): WarrenState => applyBatch(state, [{ kind: 'close', id }])

/** Closes every open pair whose id starts with `prefix` (the sweep when a turn ends). */
export const closeEyes = (state: WarrenState, prefix: string): WarrenState => applyBatch(state, [{ kind: 'closePrefix', prefix }])

export const setRunning = (state: WarrenState, running: boolean): WarrenState => applyBatch(state, [{ kind: 'running', on: running }])

const r2 = (n: number) => Math.round(n * 100) / 100

/** How many pairs are open or opening: the activity count that drives the machinery. */
export const activeCount = (eyes: WarrenEye[]) => eyes.filter((e) => e.phase !== 'closing').length

function pair(e: WarrenEye, by: number, cx: number): string {
  const sp = SPOTS[e.spot]
  if (!sp) return ''
  const x = r2(cx + sp.ox * sp.w)
  const y = r2(by - sp.h * (0.42 + sp.oy))
  // Eyes never sync: each pair blinks on its own beat, set by its spot.
  const blinkDur = r2(3.7 + (e.spot % 5) * 0.37)
  const blink = `<animate attributeName="ry" values="1.4;1.4;.1;1.4;1.4;.1;1.4;1.4" keyTimes="0;.4;.43;.46;.8;.83;.86;1" dur="${blinkDur}s" repeatCount="indefinite"/>`
  const fade =
    e.phase === 'opening'
      ? `<animate attributeName="opacity" values="0;0;1" keyTimes="0;.25;1" dur="1.6s" fill="freeze"/>`
      : e.phase === 'closing'
        ? `<animate attributeName="opacity" values="1;1;0" keyTimes="0;.15;1" dur="1.4s" fill="freeze"/>`
        : ''
  return (
    `<g transform="translate(${x} ${y}) scale(${sp.s})">${fade}` +
    `<circle class="halo" cx="-4" r="4"/><circle class="halo" cx="4" r="4"/>` +
    `<ellipse class="eye" cx="-4" rx="1.4" ry="1.4">${blink}</ellipse><ellipse class="eye" cx="4" rx="1.4" ry="1.4">${blink}</ellipse></g>`
  )
}

/** The eyes in one tunnel (key "cx,by"), wrapped in markers so the scene's speed-and-stillness pass leaves them alone. */
export function eyesAt(tunnelKey: string, eyes: WarrenEye[], cx: number, by: number): string {
  const here = eyes.filter((e) => SPOTS[e.spot]?.tunnel === tunnelKey)
  if (here.length === 0) return ''
  return `<!--E-->${here.map((e) => pair(e, by, cx)).join('')}<!--/E-->`
}
