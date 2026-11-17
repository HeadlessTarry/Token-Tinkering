// The under-empire $.state contract, one self-contained file as the engine requires. Each mod
// declares its own values under the plugin's name, every key prefixed with the mod's name.

// ---------------------------------------------------------------- warren

/** One pair of eyes in a warren tunnel. `spot` indexes the warren's 13 spots; `phase` says which one-shot fade its next render plays. */
export type WarrenEye = { id: string; spot: number; phase: 'opening' | 'open' | 'closing' }

/** Whether the agent is running a turn (the machinery moves), and the eyes open for active subagents and background tasks. */
export type WarrenState = { running: boolean; eyes: WarrenEye[] }

// ---------------------------------------------------------------- doomwheel

/** Where an offering's review process stands. `victory` (merged) and `scrapped` (closed) are retired. */
export type Phase = 'offering' | 'armed' | 'waking' | 'cracked' | 'cold' | 'victory' | 'scrapped'

export type Offering = {
  /** `owner/name#pr` */
  key: string
  repo: string
  pr: number
  url: string
  phase: Phase
  autoFix: boolean
  /** Submitted reviews, from any reviewer, at the latest poll. */
  laps: number
  /** Review threads at the latest poll. */
  unresolvedThreads: number
  totalThreads: number
  /** Failing checks on the head commit at the latest poll. */
  failingChecks: number
  /** True while GitHub reports a merge conflict. */
  conflict: boolean
  /** When GitHub last answered a poll; undefined until it has. */
  polledAt?: number
  /** True while `gh` is missing or not signed in, so the wheel runs on session signals alone. */
  ghUnavailable?: boolean
  createdAt: number
  updatedAt: number
}

export type LogKind = 'raised' | 'armed' | 'disarmed' | 'wake' | 'review' | 'tired' | 'threads' | 'checks' | 'conflict' | 'crack' | 'victory' | 'scrapped' | 'warn'

export type LogEntry = { at: number; key: string; kind: LogKind; text: string }

declare module 'claude-code' {
  interface PluginState {
    'under-empire': {
      'warren.state': WarrenState
      'doomwheel.offerings': Offering[]
      'doomwheel.log': LogEntry[]
    }
  }
}
