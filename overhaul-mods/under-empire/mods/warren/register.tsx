import type { Register } from 'claude-code'

import { buildScene } from './scene'

const SCENE = 'warren'
const GLASS = { blur: 24, opacity: 0.78, tint: '#0a0806' } as const
/** Every session, interactive or not. Underlings holds `session.start` without a matcher, so the warren names one. */
const ANY_SESSION = { isInteractive: [true, false] }

/** The warren is on whenever the plugin is installed: no command, no setting, no state, no status line. */
export const register: Register = (on) => {
  on('session.start', ANY_SESSION, async ($, e, next) => {
    await $.theme.set({ backdrop: { scene: SCENE, glass: GLASS } })

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.scene !== SCENE || e.surface !== 'desktop') {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)

    return <Svg source={buildScene()} alt="A dim Skaven warren: tunnel mouths, rickety scaffolding and warp contraptions, with rats scurrying" isInteractive />
  })
}
