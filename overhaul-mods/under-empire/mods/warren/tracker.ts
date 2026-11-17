// The warren's tracker: which subagents and background tasks are running, and whether the main turn is.
// It holds ids and running state only. Events queue up and are applied as one batch every BATCH_MS, so a
// burst of starts or finishes changes the scene once.
//
// Eye ids: `a:<agentId>` for a subagent, `b:<taskId>` for a background Bash task.

import type { EngineInterface as Engine, Register } from 'claude-code'
import { atom, read, update } from 'claude-code'

import type { WarrenState } from '../../types'
import { applyBatch, EMPTY, type Op } from './eyes'
import { isKilled, isSilent, parseExitMarker, parseOutputPath, parseTaskNotification, tailCommands, tailLines } from './tracker-parse'

/** The warren's whole state: whether a turn is running, and the pairs of eyes open. Ids and phases only. */
export const warrenState = atom({ plugin: 'under-empire', key: 'warren.state' } as const, EMPTY as WarrenState)

const BATCH_MS = 250
/** Background output files are checked every POLL_EVERY batches, one task at a time. */
const POLL_EVERY = 8
const OUTPUT_LINES = 400
const MAX_READ_BYTES = 4 * 1024 * 1024
const SUBAGENT = 'a:'
const TASK = 'b:'

type Task = { toolUseId: string; outputPath?: string; size?: number; lastChangeAt: number }

/** Background tasks still open, by task id. */
const tasks = new Map<string, Task>()
let pending: Op[] = []
let ticker: { cancel: () => void } | undefined
let isTicking = false
let ticks = 0
let rotation = 0

const queue = (op: Op) => {
  pending.push(op)
}

const closeTask = (id: string) => {
  tasks.delete(id)
  queue({ kind: 'close', id: `${TASK}${id}` })
}

async function flush($: Engine) {
  if (pending.length === 0) return
  const ops = pending
  pending = []
  await update($, warrenState, (state) => applyBatch(state, ops))
}

/** Starts the batch timer once per module load; /reload-plugins may not raise session.start again. */
function ensureTicker($: Engine) {
  ticker ??= $.clock.every(BATCH_MS, () => tick($))
}

async function tick($: Engine) {
  // A tick still running when the next comes due is left to finish; ticks never queue behind each other.
  if (isTicking) return
  isTicking = true
  try {
    ticks += 1
    if (ticks % POLL_EVERY === 0) await pollRound($)
    await flush($)
  } finally {
    isTicking = false
  }
}

// ---------------------------------------------------------------- background output

async function readText($: Engine, path: string, size: number): Promise<string> {
  if (size <= MAX_READ_BYTES) return $.fs.read(path)
  // $.fs.read refuses files past 4 MiB, so a host command reads the tail.
  for (const argv of tailCommands(path, OUTPUT_LINES)) {
    const ran = await $.process.run(argv).catch(() => undefined)
    if (ran?.exitCode === 0) return ran.stdout
  }
  throw new Error(`No command could read the tail of ${path}`)
}

/** Checks one running task's output file per round, in turn: notifications end most tasks, this catches any whose notice never came. */
async function pollRound($: Engine) {
  const ids = [...tasks.keys()]
  if (ids.length === 0) return
  rotation = (rotation + 1) % ids.length
  const id = ids[rotation]
  if (id !== undefined) await pollOutput($, id)
}

async function pollOutput($: Engine, id: string) {
  const task = tasks.get(id)
  if (!task) return
  const now = Date.now()
  try {
    if (task.outputPath) {
      const { size } = await $.fs.stat(task.outputPath)
      if (size !== task.size) {
        const text = tailLines(await readText($, task.outputPath, size), OUTPUT_LINES)
        // Recorded only once read, so a failed read is tried again on the next poll.
        task.size = size
        task.lastChangeAt = now
        if (parseExitMarker(text) !== undefined || isKilled(text)) return closeTask(id)
      }
    }
  } catch {
    // The file appears a moment after the task starts, or no command could read it; the next poll tries again.
  }
  if (isSilent(task.lastChangeAt, now)) closeTask(id)
}

// ---------------------------------------------------------------- engine events

function onToolCall(e: { tool: string; tool_use_id?: string } & Record<string, unknown>, ran: unknown) {
  const answer = ran as { deny?: string; result?: Record<string, unknown> }
  if (answer.deny || !answer.result) return
  if (e.tool === 'Bash' && typeof answer.result.backgroundTaskId === 'string') {
    const id = answer.result.backgroundTaskId
    tasks.set(id, { toolUseId: String(e.tool_use_id ?? ''), lastChangeAt: Date.now() })
    queue({ kind: 'open', id: `${TASK}${id}` })
  }
  if (e.tool === 'Agent' && typeof answer.result.agentId === 'string') {
    // agent.spawn opens the pair; this catches a subagent whose spawn hook was passed over, and one that already finished.
    const id = `${SUBAGENT}${answer.result.agentId}`
    queue(answer.result.status === 'completed' ? { kind: 'close', id } : { kind: 'open', id })
  }
}

function contentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((block) => contentText((block as { text?: unknown; content?: unknown }).text ?? (block as { content?: unknown }).content)).join('\n')
  return ''
}

function onRow(door: string, blocks: ReadonlyArray<Record<string, unknown>>) {
  if (door === 'tool-result') {
    for (const block of blocks) {
      if (block.type !== 'tool_result' || typeof block.tool_use_id !== 'string') continue
      const path = parseOutputPath(contentText(block.content))
      if (!path) continue
      for (const task of tasks.values()) if (task.toolUseId === block.tool_use_id) task.outputPath = path
    }
    return
  }
  const notice = parseTaskNotification(blocks.map((block) => contentText(block.text ?? block.content)).join('\n'))
  if (notice) closeTask(notice.taskId)
}

/** A new session starts with an empty warren: no pair outlives its session. */
export function startSession($: Engine) {
  tasks.clear()
  pending = []
  queue({ kind: 'reset' })
  ensureTicker($)
}

/** The tracker's hooks. Each only queues; none may fail the engine's own call. */
export const registerTracker: Register = (on) => {
  on('agent.spawn', async ($, e, next) => {
    ensureTicker($)
    const spawned = await next(e)
    if (spawned.deny === undefined && spawned.agentId) queue({ kind: 'open', id: `${SUBAGENT}${spawned.agentId}` })
    return spawned
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    ensureTicker($)
    const agentId = (e as { agentId?: string }).agentId
    // A subagent's own turn opens its pair (agent.spawn may also have; opening twice is harmless); the main turn runs the machinery.
    queue(agentId ? { kind: 'open', id: `${SUBAGENT}${agentId}` } : { kind: 'running', on: true })
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    ensureTicker($)
    const agentId = (e as { agentId?: string }).agentId
    if (agentId) {
      queue({ kind: 'close', id: `${SUBAGENT}${agentId}` })
    } else {
      // The main turn ended: the machinery goes still, and no subagent outlives it.
      queue({ kind: 'running', on: false })
      queue({ kind: 'closePrefix', prefix: SUBAGENT })
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    ensureTicker($)
    const ran = await next(e)
    onToolCall(e as never, ran)
    return ran
  }).catch(($, e, next) => next(e))

  on('session.append', async ($, e, next) => {
    const stored = await next(e)
    if (!e.agentId) onRow(e.door, e.message.content as never)
    return stored
  }).catch(($, e, next) => next(e))
}

/** Reads the warren's state; the scene render and the tests both come through here. */
export function readWarren($: Engine) {
  return read($, warrenState)
}
