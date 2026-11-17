import { describe, expect, test } from 'claude-code/testing'

import type { WarrenState } from '../../../types'
import { applyBatch, closeEye, closeEyes, EMPTY, MAX_EYES, openEye, SPOTS, setRunning } from '../eyes'

const first = () => 0

/** Opens `n` pairs, one per id `t1`..`tn`. */
function fill(n: number, state: WarrenState = EMPTY): WarrenState {
  let next = state
  for (let i = 1; i <= n; i++) next = openEye(next, `t${i}`)
  return next
}

describe('opening and closing eyes', () => {
  test('a started task opens one pair, opening', () => {
    const state = openEye(EMPTY, 'a', first)
    expect(state.eyes).toEqual([{ id: 'a', spot: 0, phase: 'opening' }])
  })

  test('the same task opened twice still has one pair', () => {
    const state = openEye(openEye(EMPTY, 'a', first), 'a', first)
    expect(state.eyes.map((e) => e.id)).toEqual(['a'])
  })

  test('a pair keeps its spot for the task life, however many events pass', () => {
    let state = openEye(EMPTY, 'a', () => 0.5)
    const spot = state.eyes[0]?.spot
    state = openEye(state, 'b', () => 0)
    state = closeEye(state, 'b')
    state = setRunning(state, true)
    expect(state.eyes.find((e) => e.id === 'a')?.spot).toBe(spot)
  })

  test('each event settles earlier phases: opening becomes open, closed pairs are dropped', () => {
    let state = openEye(openEye(EMPTY, 'a', first), 'b', first)
    state = closeEye(state, 'a')
    expect(state.eyes.find((e) => e.id === 'a')?.phase).toBe('closing')
    expect(state.eyes.find((e) => e.id === 'b')?.phase).toBe('open')
    state = setRunning(state, true)
    expect(state.eyes.map((e) => e.id)).toEqual(['b'])
  })

  test('closing a task that is not open changes nothing', () => {
    const state = openEye(EMPTY, 'a', first)
    expect(closeEye(state, 'zzz').eyes.map((e) => `${e.id}:${e.phase}`)).toEqual(['a:open'])
  })

  test('closeEyes closes every pair whose id starts with the prefix, and no other', () => {
    let state = openEye(openEye(openEye(EMPTY, 'a:1'), 'a:2'), 'b:9')
    state = closeEyes(state, 'a:')
    expect(state.eyes.map((e) => `${e.id}:${e.phase}`).sort()).toEqual(['a:1:closing', 'a:2:closing', 'b:9:open'])
  })
})

describe('the cap', () => {
  test('there are 13 spots: 7 on the left wall (2 + 2 + 3) and 6 on the right (2 + 2 + 2)', () => {
    expect(SPOTS).toHaveLength(13)
    expect(MAX_EYES).toBe(13)
    const perTunnel = Object.values(Object.groupBy(SPOTS, (s) => s.tunnel)).map((g) => g?.length)
    expect(perTunnel).toEqual([2, 2, 3, 2, 2, 2])
  })

  test('every spot is used once before any is shared, and nothing past 13 is drawn', () => {
    const state = fill(20)
    expect(state.eyes).toHaveLength(13)
    expect(new Set(state.eyes.map((e) => e.spot)).size).toBe(13)
  })

  test('a freed spot is reused by the next start', () => {
    let state = fill(13)
    const freed = state.eyes.find((e) => e.id === 't4')?.spot
    state = closeEye(state, 't4')
    state = openEye(state, 'late', () => 0.99)
    expect(state.eyes.find((e) => e.id === 'late')?.spot).toBe(freed)
    expect(state.eyes).toHaveLength(13)
  })
})

describe('the turn flag', () => {
  test('is set and cleared, leaving the eyes alone', () => {
    let state = openEye(EMPTY, 'a', first)
    state = setRunning(state, true)
    expect(state.running).toBe(true)
    state = setRunning(state, false)
    expect(state.running).toBe(false)
    expect(state.eyes.map((e) => e.id)).toEqual(['a'])
  })
})

describe('a batch of events', () => {
  test('starts in one batch all open together, none settling another', () => {
    const state = applyBatch(EMPTY, [
      { kind: 'open', id: 'a' },
      { kind: 'open', id: 'b' },
      { kind: 'open', id: 'c' },
    ])
    expect(state.eyes.map((e) => e.phase)).toEqual(['opening', 'opening', 'opening'])
  })

  test('a task that starts and finishes inside one batch is never drawn', () => {
    const state = applyBatch(EMPTY, [
      { kind: 'open', id: 'a' },
      { kind: 'close', id: 'a' },
    ])
    expect(state.eyes).toEqual([])
  })

  test('the batch first settles what earlier events left, then applies its own', () => {
    const before = openEye(EMPTY, 'old', first)
    const state = applyBatch(before, [
      { kind: 'open', id: 'new' },
      { kind: 'close', id: 'old' },
      { kind: 'running', on: true },
    ])
    expect(state.running).toBe(true)
    expect(state.eyes.map((e) => `${e.id}:${e.phase}`).sort()).toEqual(['new:opening', 'old:closing'])
  })

  test('a prefix close sweeps every matching pair, and a reset clears the warren', () => {
    const before = applyBatch(EMPTY, [
      { kind: 'open', id: 'a:1' },
      { kind: 'open', id: 'b:1' },
      { kind: 'running', on: true },
    ])
    const swept = applyBatch(before, [{ kind: 'closePrefix', prefix: 'a:' }])
    expect(swept.eyes.map((e) => `${e.id}:${e.phase}`).sort()).toEqual(['a:1:closing', 'b:1:open'])
    expect(applyBatch(before, [{ kind: 'reset' }])).toEqual(EMPTY)
  })
})
