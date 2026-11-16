import { expect, test } from 'claude-code/testing'

type On = Parameters<Parameters<typeof test>[1]>[1]

const START = { cwd: 'C:/work', isInteractive: true } as never
const GLASS = { blur: 24, opacity: 0.78, tint: '#0a0806' }
const mount = (surface: 'desktop' | 'mobile' | 'terminal', scene: string) =>
  ({ plugin: 'under-empire', surface, component: 'Backdrop', requestId: 'backdrop', props: { scene, glass: GLASS } }) as never

/** Answers session.start beneath the plugin, and records every theme, status line and command the warren asks for. */
function watch(on: On) {
  const seen = { themes: [] as unknown[], statuses: [] as unknown[], commands: [] as unknown[] }
  on('session.start', () => ({ cwd: 'C:/work' }) as never)
  on('theme.set', (_, e) => {
    seen.themes.push(e)
    return { value: { isDrawn: true } } as never
  })
  on('ui.status', (_, e) => {
    seen.statuses.push(e)
    return { value: undefined } as never
  })
  on('command.register', (_, e) => {
    seen.commands.push(e)
    return { value: undefined } as never
  })
  return seen
}

test('session.start sets the warren backdrop with the whisper glass', async ($, on) => {
  const seen = watch(on)

  await $.session.start(START)

  expect(seen.themes).toEqual([{ backdrop: { scene: 'warren', glass: GLASS } }])
})

test('the warren registers no command and no status line', async ($, on) => {
  const seen = watch(on)

  await $.session.start(START)

  expect(seen.statuses).toEqual([])
  expect(seen.commands.filter((c) => (c as { name?: string }).name === 'warren')).toEqual([])
})

test('desktop: the Backdrop hook answers the warren scene with the SVG', async ($) => {
  const view = await $.ui.mount(mount('desktop', 'warren'))

  expect(await view.find({ type: 'Svg' })).toBeDefined()
})

for (const [surface, scene] of [
  ['mobile', 'warren'],
  ['terminal', 'warren'],
  ['desktop', 'other'],
] as const) {
  test(`${surface}: the Backdrop hook passes the ${scene} scene on to next`, async ($) => {
    const view = await $.ui.mount(mount(surface, scene))

    expect(await view.find({ type: 'Svg' })).toBeUndefined()
  })
}
