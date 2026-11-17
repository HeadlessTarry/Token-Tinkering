import type { Register } from 'claude-code'

import { register as registerWarren } from '../mods/warren/register'

/** Claude Code loads one hooks module per plugin, so this one registers every mod the overhaul ships. */
export const register: Register = (on, options) => {
  registerWarren(on, options)
}
