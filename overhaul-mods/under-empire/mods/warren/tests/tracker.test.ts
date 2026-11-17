import { expect, mock, test } from 'claude-code/testing'

type On = Parameters<Parameters<typeof test>[1]>[1]
type Engine = Parameters<Parameters<typeof test>[1]>[0]

const START = { cwd: 'C:/work', isInteractive: true } as never
const BATCH_MS = 250

/** Answers session.start beneath the plugin and the theme call the warren makes there. */
function boot(on: On) {
  on('session.start', () => ({ cwd: 'C:/work' }) as never)
  on('theme.set', () => ({ value: { isDrawn: true } }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('turn.start', () => ({ turnId: 't' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
}

let mounts = 0
const GLASS = { blur: 24, opacity: 0.78, tint: '#0a0806' }
const count = (svg: string, needle: string) => svg.split(needle).length - 1

/** What the Backdrop draws now: whether the machinery runs (lightning strikes), and the pairs of eyes by phase. */
const view = async ($: Engine) => {
  const mounted = await $.ui.mount({ plugin: 'under-empire', surface: 'desktop', component: 'Backdrop', requestId: `backdrop-${++mounts}`, props: { scene: 'warren', glass: GLASS } } as never)
  const svg = String(((await mounted.find({ type: 'Svg' })) as { props: { source: string } }).props.source)
  const pairs = count(svg, '<ellipse class="eye"') / 2
  const opening = count(svg, 'keyTimes="0;.25;1" dur="1.6s" fill="freeze"')
  const closing = count(svg, 'keyTimes="0;.15;1" dur="1.4s" fill="freeze"')
  return { running: svg.includes('class="bolt1"'), pairs, opening, closing, open: pairs - opening - closing }
}

const spawn = ($: Engine, description = 'Dig') => $.agent.spawn({ prompt: description, description, subagentType: 'general-purpose' } as never)

const bashTask = (id: string) => ({ result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: id } }) as never
const runBash = ($: Engine, toolUseId = 'tu1') => $.tool.call({ tool: 'Bash', tool_use_id: toolUseId, command: 'npm run dev', description: 'Dev server', run_in_background: true } as never)

const row = (door: string, content: unknown[], agentId?: string) =>
  ({ message: { type: 'user', role: 'user', content }, door, origin: { kind: 'tool', tool: 'Bash' }, uuid: `row-${Math.random()}`, agentId }) as never

test('the main turn starting and completing drives the running flag', async ($, on) => {
  const clock = mock.clock(on)
  boot(on)
  await $.session.start(START)

  await $.turn.start({ turnId: 't1' } as never)
  await clock.advance(BATCH_MS)
  expect((await view($)).running).toBe(true)

  await $.turn.complete({ turnId: 't1', reason: 'answer', answer: '' } as never)
  await clock.advance(BATCH_MS)
  expect((await view($)).running).toBe(false)
})

test('a spawned subagent opens a pair; its own turn completing closes it, and the pair is then dropped', async ($, on) => {
  const clock = mock.clock(on)
  boot(on)
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'agent-1' }))
  await $.session.start(START)

  await spawn($)
  await clock.advance(BATCH_MS)
  expect(await view($)).toMatchObject({ pairs: 1, opening: 1, closing: 0, open: 0 })

  await $.turn.complete({ turnId: 'sub', agentId: 'agent-1', reason: 'answer', answer: '' } as never)
  await clock.advance(BATCH_MS)
  expect(await view($)).toMatchObject({ pairs: 1, opening: 0, closing: 1, open: 0 })

  await $.turn.start({ turnId: 't2' } as never)
  await clock.advance(BATCH_MS)
  expect((await view($)).pairs).toBe(0)
})

test('a burst of starts inside one batch opens its pairs together, in one state update', async ($, on) => {
  const clock = mock.clock(on)
  boot(on)
  let n = 0
  on('agent.spawn', () => ({ model: 'm', agentId: `agent-${++n}` }))
  await $.session.start(START)

  await spawn($)
  await spawn($)
  await spawn($)
  expect((await view($)).pairs).toBe(0)
  await clock.advance(BATCH_MS)

  expect(await view($)).toMatchObject({ pairs: 3, opening: 3, closing: 0, open: 0 })
})

test('a subagent that starts and ends inside one batch is never drawn', async ($, on) => {
  const clock = mock.clock(on)
  boot(on)
  on('agent.spawn', () => ({ model: 'm', agentId: 'agent-1' }))
  await $.session.start(START)

  await spawn($)
  await $.turn.complete({ turnId: 'sub', agentId: 'agent-1', reason: 'answer', answer: '' } as never)
  await clock.advance(BATCH_MS)

  expect((await view($)).pairs).toBe(0)
})

test('a finished Agent tool call closes the pair even when the spawn hook was passed over', async ($, on) => {
  const clock = mock.clock(on)
  boot(on)
  on('agent.spawn', () => ({ model: 'm', agentId: 'agent-2' }))
  on('tool.call', () => ({ result: { agentId: 'agent-2', status: 'completed' } }) as never)
  await $.session.start(START)

  await spawn($)
  await clock.advance(BATCH_MS)
  await $.tool.call({ tool: 'Agent', prompt: 'x', description: 'x' } as never)
  await clock.advance(BATCH_MS)

  expect(await view($)).toMatchObject({ pairs: 1, opening: 0, closing: 1, open: 0 })
})

test('the main turn completing closes every subagent pair but leaves background tasks', async ($, on) => {
  const clock = mock.clock(on)
  boot(on)
  on('agent.spawn', () => ({ model: 'm', agentId: 'agent-1' }))
  on('tool.call', () => bashTask('bg1'))
  await $.session.start(START)

  await $.turn.start({ turnId: 't1' } as never)
  await spawn($)
  await runBash($)
  await clock.advance(BATCH_MS)
  expect(await view($)).toMatchObject({ pairs: 2, opening: 2, closing: 0, open: 0 })

  await $.turn.complete({ turnId: 't1', reason: 'answer', answer: '' } as never)
  await clock.advance(BATCH_MS)
  expect(await view($)).toMatchObject({ running: false, pairs: 2, opening: 0, closing: 1, open: 1 })
})

test('a background Bash call opens a pair; its task notification closes it', async ($, on) => {
  const clock = mock.clock(on)
  boot(on)
  on('tool.call', () => bashTask('bg1'))
  await $.session.start(START)

  await runBash($)
  await clock.advance(BATCH_MS)
  expect(await view($)).toMatchObject({ pairs: 1, opening: 1, closing: 0, open: 0 })

  const note = '<task-notification>\n<task-id>bg1</task-id>\n<status>completed</status>\n<summary>Background command "x" completed (exit code 0)</summary>\n</task-notification>'
  await $.session.append(row('delivery', [{ type: 'text', text: note }]))
  await clock.advance(BATCH_MS)
  expect(await view($)).toMatchObject({ pairs: 1, opening: 0, closing: 1, open: 0 })
})

test('a foreground Bash call opens nothing', async ($, on) => {
  const clock = mock.clock(on)
  boot(on)
  on('tool.call', () => ({ result: { stdout: 'ok', stderr: '', interrupted: false } }) as never)
  await $.session.start(START)

  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)
  await clock.advance(BATCH_MS)

  expect((await view($)).pairs).toBe(0)
})

test("a background task's output file ending in an exit marker closes its pair", async ($, on) => {
  const clock = mock.clock(on)
  boot(on)
  on('tool.call', () => bashTask('bg1'))
  on('fs.stat', () => ({ value: { kind: 'file', size: 40, mtimeMs: 0, isSymlink: false } }) as never)
  on('fs.read', () => ({ value: 'shaft 180 dug\n[exited with code 0]\n' }) as never)
  await $.session.start(START)

  await runBash($, 'tu-out')
  await $.session.append(row('tool-result', [{ type: 'tool_result', tool_use_id: 'tu-out', content: 'Output is being written to: /tmp/claude/tasks/bg1.output. You will be notified.' }]))
  await clock.advance(5_000)

  expect(await view($)).toMatchObject({ pairs: 1, opening: 0, closing: 1, open: 0 })
})

test('the 13-pair cap holds across subagents and background tasks, and a freed spot is reused', async ($, on) => {
  const clock = mock.clock(on)
  boot(on)
  let n = 0
  on('tool.call', () => bashTask(`bg${++n}`))
  await $.session.start(START)

  for (let i = 0; i < 15; i++) await runBash($, `tu${i}`)
  await clock.advance(BATCH_MS)
  expect((await view($)).pairs).toBe(13)

  const note = (id: string) => `<task-notification><task-id>${id}</task-id><status>completed</status></task-notification>`
  await $.session.append(row('delivery', [{ type: 'text', text: note('bg1') }]))
  await clock.advance(BATCH_MS)
  expect(await view($)).toMatchObject({ pairs: 13, closing: 1 })

  await runBash($, 'late')
  await clock.advance(BATCH_MS)
  expect((await view($)).pairs).toBe(13)
})

test('a new session starts with no pairs and no running machinery', async ($, on) => {
  const clock = mock.clock(on)
  boot(on)
  on('tool.call', () => bashTask('bg1'))
  await $.session.start(START)
  await $.turn.start({ turnId: 't1' } as never)
  await runBash($)
  await clock.advance(BATCH_MS)
  expect((await view($)).pairs).toBe(1)

  await $.session.start(START)
  await clock.advance(BATCH_MS)

  expect(await view($)).toMatchObject({ running: false, pairs: 0 })
})

test("a subagent's own turn starting opens its pair, even when no spawn hook ran", async ($, on) => {
  const clock = mock.clock(on)
  boot(on)
  await $.session.start(START)

  await $.turn.start({ turnId: 'sub', agentId: 'agent-9' } as never)
  await clock.advance(BATCH_MS)

  expect(await view($)).toMatchObject({ running: false, pairs: 1, opening: 1 })
})
