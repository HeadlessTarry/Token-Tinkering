// How busy the warren looks. The tuning knobs live here, in one place: they are the first values tried
// in the prototype, not derived constants.

import type { WarrenState } from '../../types'
import { activeCount } from './eyes'

export type Level = {
  /** True when the machinery is still: no animation and no lightning. */
  inert: boolean
  /** Machinery speed multiplier: every SMIL and stylesheet duration is divided by it. */
  speed: number
  /** Warpstone brightness, 0 to 1. */
  glow: number
  /** Multiplier on how often lightning strikes (it shortens the gap between strikes, never a strike). */
  boost: number
}

const REST_GLOW = 0.12
const BASE_GLOW = 0.4
const SPEED_PER_TASK = 0.18
const GLOW_PER_TASK = 0.05
const BOOST_PER_TASK = 0.55

export const REST: Level = { inert: true, speed: 1, glow: REST_GLOW, boost: 1 }

/** At rest the warren is still. While the agent runs a turn, each active task speeds the machinery up, brightens the warpstone and brings more lightning. */
export function levelFor(state: WarrenState): Level {
  if (!state.running) return REST
  const n = activeCount(state.eyes)
  return {
    inert: false,
    speed: 1 + SPEED_PER_TASK * n,
    glow: Math.min(1, BASE_GLOW + GLOW_PER_TASK * n),
    boost: 1 + BOOST_PER_TASK * n,
  }
}
