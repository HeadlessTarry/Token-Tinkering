// PROTOTYPE, throwaway: the under-empire warren as a desktop Backdrop.
// Variants switch live with /warren, e.g. `/warren etched bold fast` or `/warren glass off`.

import type { Atom, Register, ThemeSetArgs } from 'claude-code'
import { atom, read, update } from 'claude-code'

import type { Settings } from '../types'
import { buildScene } from './scene'

const SCENE = 'warren'
const DEFAULTS: Settings = { style: 'blight', level: 'whisper', speed: 'real', glass: 'on' }
const settings = atom({ plugin: 'warren-prototype', key: 'settings' } as const, DEFAULTS, { shape: 'settings-1' }) as unknown as Atom<Settings>

const AXES: Record<string, keyof Settings> = {
  silhouette: 'style',
  engraved: 'style',
  blight: 'style',
  ruin: 'style',
  whisper: 'level',
  present: 'level',
  bold: 'level',
  real: 'speed',
  fast: 'speed',
}

const GLASS = {
  whisper: { blur: 24, opacity: 0.78 },
  present: { blur: 18, opacity: 0.62 },
  bold: { blur: 12, opacity: 0.45 },
} as const

function look(s: Settings): ThemeSetArgs {
  return {
    backdrop: {
      scene: SCENE,
      glass: s.glass === 'off' ? false : { ...GLASS[s.level], tint: '#0a0806' },
    },
  }
}

const describe = (s: Settings) => `warren: ${s.style} / ${s.level} / ${s.speed} / glass ${s.glass} (${buildScene(s).length} chars)`

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'warren',
      description: 'PROTOTYPE: switch the warren backdrop (silhouette|engraved|blight|ruin, whisper|present|bold, real|fast, glass on|off, reset)',
    })
    const s = await read($, settings)
    const set = await $.theme.set(look(s))
    $.ui.status(set.isDrawn ? describe(s) : `warren: not drawn: ${set.reason}`)

    return next(e)
  })

  on('command.run', { command: 'warren' }, async ($, e) => {
    const words = e.args.toLowerCase().split(/\s+/).filter(Boolean)
    const unknown: string[] = []
    const s = await update($, settings, (old) => {
      let next: Settings = { ...old }
      for (let i = 0; i < words.length; i++) {
        const w = words[i] ?? ''
        const axis = AXES[w]
        if (w === 'reset') {
          next = { ...DEFAULTS }
        } else if (w === 'glass' && (words[i + 1] === 'on' || words[i + 1] === 'off')) {
          next = { ...next, glass: (words[++i] ?? 'on') as Settings['glass'] }
        } else if (axis) {
          next = { ...next, [axis]: w } as Settings
        } else {
          unknown.push(w)
        }
      }
      return next
    })
    const set = await $.theme.set(look(s))
    $.ui.status(set.isDrawn ? describe(s) : `warren: not drawn: ${set.reason}`)
    const warn = unknown.length > 0 ? `\nIgnored: ${unknown.join(' ')}` : ''

    return { text: `${describe(s)}${warn}` }
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.scene !== SCENE || (e.surface !== 'desktop' && e.surface !== 'mobile')) {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)
    const s = await read($, settings)

    return <Svg source={buildScene(s)} alt="A dim Skaven warren: tunnel mouths, rickety scaffolding and warp contraptions, with rats scurrying" isInteractive />
  })
}
