import { describe, expect, test } from 'claude-code/testing'

import type { WarrenEye, WarrenState } from '../../../types'
import { SPOTS } from '../eyes'
import { buildScene } from '../scene'

const BACKDROP_SVG_LIMIT = 131_072
const SCENE_BUDGET = Math.floor(BACKDROP_SVG_LIMIT * 0.6)

const REST: WarrenState = { running: false, eyes: [] }
const RUNNING: WarrenState = { running: true, eyes: [] }
const eye = (spot: number, phase: WarrenEye['phase'] = 'open'): WarrenEye => ({ id: `t${spot}`, spot, phase })
/** `n` pairs on the first `n` spots, with the turn running. */
const busy = (n: number, phase: WarrenEye['phase'] = 'open'): WarrenState => ({ running: true, eyes: SPOTS.slice(0, n).map((_, i) => eye(i, phase)) })
/** The worst case for size: every pair drawn, a mix of fading in and fading out, the machinery running. */
const WORST: WarrenState = { running: true, eyes: SPOTS.map((_, i) => eye(i, i % 2 ? 'opening' : 'closing')) }

test('the scene stays within 60% of the Backdrop SVG limit, at rest, running, with 13 pairs and in the worst mix', () => {
  expect(SCENE_BUDGET).toBe(78_643)
  for (const state of [REST, RUNNING, busy(13), WORST]) expect(buildScene(state).length).toBeLessThanOrEqual(SCENE_BUDGET)
})

test('the scene is one SVG document', () => {
  const svg = buildScene(RUNNING)
  expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
  expect(svg.endsWith('</svg>')).toBe(true)
})

test('the scene has no script, no event handlers and no external loads', () => {
  for (const state of [REST, WORST]) {
    const svg = buildScene(state)
    expect(svg).not.toMatch(/<script/i)
    expect(svg).not.toMatch(/\son[a-z]+\s*=/i)
    expect(svg).not.toMatch(/<foreignObject/i)
    for (const [, target] of svg.matchAll(/\b(?:xlink:)?href="([^"]*)"/g)) {
      expect(target, `href ${target}`).toMatch(/^#/)
    }
    for (const [, target] of svg.matchAll(/url\(\s*['"]?([^)'"]*)['"]?\s*\)/g)) {
      expect(target, `url(${target})`).toMatch(/^#/)
    }
    expect(svg).not.toMatch(/@import/i)
  }
})

test('every reference resolves to an id defined in the scene', () => {
  for (const state of [REST, WORST]) {
    const svg = buildScene(state)
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])
    expect(new Set(ids).size, 'ids are unique').toBe(ids.length)
    const refs = [...svg.matchAll(/url\(#([^)]+)\)/g), ...svg.matchAll(/href="#([^"]+)"/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(0)
    for (const ref of refs) expect(ids, `reference #${ref}`).toContain(ref)
  }
})

test('the scene is identical on every render', () => {
  for (const state of [REST, RUNNING, WORST]) {
    const first = buildScene(state)
    expect(buildScene(state)).toBe(first)
    expect(buildScene(state)).toBe(first)
  }
})

test('the scene stacks its layers in order', () => {
  const svg = buildScene(RUNNING)
  const order = [
    '<!--layer:background-->',
    '<!--layer:far-cavern-->',
    '<!--layer:back-fog-->',
    '<!--layer:near-walls-->',
    '<!--layer:front-fog-->',
    '<!--layer:centre-fade-->',
    '<!--layer:vertical-fade-->',
  ]
  const at = order.map((marker) => svg.indexOf(marker))
  for (const [i, marker] of order.entries()) expect(at[i], marker).toBeGreaterThanOrEqual(0)
  expect(at).toEqual([...at].sort((a, b) => a - b))
})

test('the walls and cavern are anchored as specified', () => {
  const svg = buildScene(RUNNING)
  expect(svg).toContain('viewBox="0 0 560 900" preserveAspectRatio="xMinYMid meet"')
  expect(svg).toContain('viewBox="0 0 560 900" preserveAspectRatio="xMaxYMid meet"')
  expect(svg).toContain('<svg width="50%" height="100%" viewBox="0 0 560 900" preserveAspectRatio="xMaxYMid meet"')
  expect(svg).toContain('<svg x="50%" width="50%" height="100%" viewBox="0 0 560 900" preserveAspectRatio="xMinYMid meet"')
  expect(svg).toContain('viewBox="-1 0 2 900" preserveAspectRatio="xMidYMid meet"')
})

test('the scene draws at whisper level', () => {
  expect(buildScene(RUNNING)).toContain('.scene{opacity:0.38}')
})

test('reduced motion stops CSS animation and hides moving actors', () => {
  const svg = buildScene(RUNNING)
  expect(svg).toContain('@media (prefers-reduced-motion:reduce)')
  expect(svg).toContain('@media (prefers-reduced-motion:reduce){*{animation:none!important}.mv,.drift{display:none}}')
})

test('a running turn animates the machinery, rats and warp-lightning with SMIL and CSS', () => {
  const svg = buildScene(RUNNING)
  expect(svg).toContain('<animateTransform')
  expect(svg).toContain('<animateMotion')
  expect(svg).toContain('@keyframes fl')
  expect(svg).toContain('class="bolt1"')
})

test('only fire-lit tunnels glow, and none glows green', () => {
  const svg = buildScene(RUNNING)
  expect(svg).toContain('fill="url(#fireIn)"')
  expect(svg).not.toMatch(/fill="url\(#(?:warpIn|tunnelGreen)\)"/)
  const tunnelGlows = [...svg.matchAll(/<ellipse class="gl gf"[^>]*fill="url\(#([^)]+)\)"/g)].map((m) => m[1])
  expect(tunnelGlows.length).toBeGreaterThan(0)
  expect(new Set(tunnelGlows)).toEqual(new Set(['fireIn']))
})

const eyeCount = (svg: string) => (svg.match(/<ellipse class="eye"/g) ?? []).length / 2
const durs = (svg: string) => [...svg.matchAll(/\bdur="([\d.]+)s"/g)].map((m) => Number(m[1]))
/** The right wall's piston: the first animation of the y attribute. */
const piston = (svg: string) => Number(/attributeName="y" values="120;100;120" dur="([\d.]+)s"/.exec(svg)?.[1])
const glow = (svg: string) => Number(/\.key,\.pu,\.pu2\{fill-opacity:([\d.]+)\}/.exec(svg)?.[1])

/** The first bolt's flicker: how often it comes round, and how many real seconds the strike lasts. */
function firstStrike(svg: string): { cycle: number; seconds: number } {
  const m = /<animate attributeName="opacity"[^>]*dur="([\d.]+)s"[^>]*values="0;0;1;0.1;0.9;0;1;0;0" keyTimes="([^"]+)"/.exec(svg)
  const cycle = Number(m?.[1])
  const kt = (m?.[2] ?? '').split(';').map(Number)
  return { cycle, seconds: ((kt[7] ?? 0) - (kt[1] ?? 0)) * cycle }
}

describe('at rest', () => {
  test('nothing animates: no SMIL, no stylesheet animation, no lightning, no eyes', () => {
    const svg = buildScene(REST)
    expect(svg).not.toMatch(/<animate/)
    expect(svg).not.toMatch(/animation:(?!none)/)
    expect(svg).not.toContain('class="bolt1"')
    expect(eyeCount(svg)).toBe(0)
  })

  test('the warpstone is nearly dark, and the idle scene is lighter than a running one', () => {
    expect(glow(buildScene(REST))).toBe(0.12)
    expect(buildScene(REST).length).toBeLessThan(buildScene(RUNNING).length)
  })

  test('background tasks that outlive the turn keep their eyes while the machinery is still', () => {
    const svg = buildScene({ running: false, eyes: [eye(0)] })
    expect(eyeCount(svg)).toBe(1)
    expect(svg).not.toContain('<animateTransform')
    expect(svg).not.toContain('class="bolt1"')
  })
})

describe('eyes', () => {
  test('a running turn with no tasks has no eyes', () => {
    expect(eyeCount(buildScene(RUNNING))).toBe(0)
  })

  test('each open pair is drawn in its own tunnel and nowhere else', () => {
    // Tunnels are numbered in drawing order: the left wall's four (the fourth has no ledge), then the right wall's three.
    const tunnelOf = (svg: string, hole: number) => {
      const start = svg.indexOf(`clip-path="url(#hole${hole})"`)
      const next = svg.indexOf('clip-path="url(#hole', start + 1)
      return svg.slice(start, next === -1 ? undefined : next)
    }
    const holeFor = [0, 0, 1, 1, 2, 2, 2, 4, 4, 5, 5, 6, 6]
    for (const [spot, hole] of holeFor.entries()) {
      const svg = buildScene({ running: true, eyes: [eye(spot)] })
      expect(eyeCount(svg), `spot ${spot}`).toBe(1)
      expect(eyeCount(tunnelOf(svg, hole)), `spot ${spot} in tunnel ${hole}`).toBe(1)
    }
  })

  test('13 pairs draw 13 pairs', () => {
    expect(eyeCount(buildScene(busy(13)))).toBe(13)
  })

  test('an opening pair fades in once, a closing pair fades out once, an open pair does not fade', () => {
    expect(buildScene({ running: true, eyes: [eye(0, 'opening')] })).toContain('values="0;0;1" keyTimes="0;.25;1" dur="1.6s" fill="freeze"')
    expect(buildScene({ running: true, eyes: [eye(0, 'closing')] })).toContain('values="1;1;0" keyTimes="0;.15;1" dur="1.4s" fill="freeze"')
    expect(buildScene({ running: true, eyes: [eye(0, 'open')] })).not.toContain('fill="freeze"')
  })

  test('pairs blink out of step with one another', () => {
    const blinks = [...buildScene(busy(13)).matchAll(/attributeName="ry"[^>]*dur="([\d.]+)s"/g)].map((m) => m[1])
    expect(new Set(blinks).size).toBeGreaterThan(3)
  })

  test('eyes keep their own pace: the machinery speed-up does not touch their fades', () => {
    expect(durs(buildScene({ running: true, eyes: [eye(0, 'opening'), ...busy(12).eyes.slice(1)] }))).toContain(1.6)
  })
})

describe('activity levels', () => {
  test('machinery runs faster as tasks multiply: the 3.7s piston becomes 1.108s at 13 tasks', () => {
    expect(piston(buildScene(RUNNING))).toBe(3.7)
    expect(piston(buildScene(busy(13)))).toBe(1.108)
  })

  test('warpstone glows brighter with every task, to full', () => {
    expect(glow(buildScene(RUNNING))).toBe(0.4)
    expect(glow(buildScene(busy(4)))).toBe(0.6)
    expect(glow(buildScene(busy(13)))).toBe(1)
  })

  test('lightning strikes more often with more tasks, yet each strike lasts as long as ever', () => {
    const calm = firstStrike(buildScene(RUNNING))
    const stormy = firstStrike(buildScene(busy(13)))
    expect(stormy.cycle).toBeLessThan(calm.cycle / 5)
    expect(Math.abs(calm.seconds - 0.25)).toBeLessThan(0.02)
    expect(Math.abs(stormy.seconds - 0.25)).toBeLessThan(0.02)
  })

  test('closing pairs no longer count toward the activity', () => {
    const closing = buildScene({ running: true, eyes: SPOTS.map((_, i) => eye(i, 'closing')) })
    expect(glow(closing)).toBe(0.4)
  })
})
