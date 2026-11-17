// The under-empire $.state contract, one self-contained file as the engine requires. Each mod
// declares its own values under the plugin's name, every key prefixed with the mod's name.

// ---------------------------------------------------------------- warren

/** One pair of eyes in a warren tunnel. `spot` indexes the warren's 13 spots; `phase` says which one-shot fade its next render plays. */
export type WarrenEye = { id: string; spot: number; phase: 'opening' | 'open' | 'closing' }

/** Whether the agent is running a turn (the machinery moves), and the eyes open for active subagents and background tasks. */
export type WarrenState = { running: boolean; eyes: WarrenEye[] }

declare module 'claude-code' {
  interface PluginState {
    'under-empire': {
      'warren.state': WarrenState
    }
  }
}
