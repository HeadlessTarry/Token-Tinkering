import { expect, test } from 'claude-code/testing'
import { buildScene } from '../scene'

const BACKDROP_SVG_LIMIT = 131_072
const SCENE_BUDGET = Math.floor(BACKDROP_SVG_LIMIT * 0.6)

test('the scene stays within 60% of the Backdrop SVG limit', () => {
  expect(SCENE_BUDGET).toBe(78_643)
  expect(buildScene().length).toBeLessThanOrEqual(SCENE_BUDGET)
})

test('the scene is one SVG document', () => {
  const svg = buildScene()
  expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
  expect(svg.endsWith('</svg>')).toBe(true)
})

test('the scene has no script, no event handlers and no external loads', () => {
  const svg = buildScene()
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
})

test('every reference resolves to an id defined in the scene', () => {
  const svg = buildScene()
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])
  expect(new Set(ids).size, 'ids are unique').toBe(ids.length)
  const refs = [...svg.matchAll(/url\(#([^)]+)\)/g), ...svg.matchAll(/href="#([^"]+)"/g)].map((m) => m[1])
  expect(refs.length).toBeGreaterThan(0)
  for (const ref of refs) expect(ids, `reference #${ref}`).toContain(ref)
})

test('the scene is identical on every render', () => {
  const first = buildScene()
  expect(buildScene()).toBe(first)
  expect(buildScene()).toBe(first)
})

test('the scene stacks its layers in order', () => {
  const svg = buildScene()
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
  const svg = buildScene()
  expect(svg).toContain('viewBox="0 0 560 900" preserveAspectRatio="xMinYMid meet"')
  expect(svg).toContain('viewBox="0 0 560 900" preserveAspectRatio="xMaxYMid meet"')
  expect(svg).toContain('<svg width="50%" height="100%" viewBox="0 0 560 900" preserveAspectRatio="xMaxYMid meet"')
  expect(svg).toContain('<svg x="50%" width="50%" height="100%" viewBox="0 0 560 900" preserveAspectRatio="xMinYMid meet"')
  expect(svg).toContain('viewBox="-1 0 2 900" preserveAspectRatio="xMidYMid meet"')
})

test('the scene draws at whisper level', () => {
  expect(buildScene()).toContain('.scene{opacity:0.38}')
})

test('reduced motion stops CSS animation and hides moving actors', () => {
  const svg = buildScene()
  expect(svg).toContain('@media (prefers-reduced-motion:reduce)')
  expect(svg).toContain('@media (prefers-reduced-motion:reduce){*{animation:none!important}.mv,.drift{display:none}}')
})

test('the scene animates its machinery, rats, eyes and warp-lightning with SMIL and CSS', () => {
  const svg = buildScene()
  expect(svg).toContain('<animateTransform')
  expect(svg).toContain('<animateMotion')
  expect(svg).toContain('@keyframes fl')
  expect(svg).toContain('class="bolt1"')
  expect(svg).toContain('class="eye"')
})

test('only fire-lit tunnels glow, and none glows green', () => {
  const svg = buildScene()
  expect(svg).toContain('fill="url(#fireIn)"')
  expect(svg).not.toMatch(/fill="url\(#(?:warpIn|tunnelGreen)\)"/)
  const tunnelGlows = [...svg.matchAll(/<ellipse class="gl gf"[^>]*fill="url\(#([^)]+)\)"/g)].map((m) => m[1])
  expect(tunnelGlows.length).toBeGreaterThan(0)
  expect(new Set(tunnelGlows)).toEqual(new Set(['fireIn']))
})
