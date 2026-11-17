import type { Register } from 'claude-code'

import { buildScene } from './scene'
import { readWarren, registerTracker, startSession } from './tracker'

const SCENE = 'warren'
const GLASS = { blur: 24, opacity: 0.78, tint: '#0a0806' } as const
/** Every session, interactive or not. */
const ANY_SESSION = { isInteractive: [true, false] }

/**
 * The warren is on whenever the plugin is installed: no command, no setting, no status line. It also shows the
 * agent's work in flight: the tracker holds the one unmatched hook per event that its events need, and no other
 * mod in the plugin holds an unmatched hook on `agent.spawn`, `turn.start`, `turn.complete`, `tool.call` or `session.append`.
 */
export const register: Register = (on, options) => {
  registerTracker(on, options)

  on('session.start', ANY_SESSION, async ($, e, next) => {
    startSession($)
    await $.theme.set({ backdrop: { scene: SCENE, glass: GLASS } })

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.scene !== SCENE || e.surface !== 'desktop') {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)

    return (
      <Svg
        source={buildScene(await readWarren($))}
        alt="A dim Skaven warren: tunnel mouths, rickety scaffolding and warp contraptions. At rest it is still; while the agent works the machinery runs, and a pair of eyes opens in a tunnel for each running subagent or background task"
        isInteractive
      />
    )
  })
}
