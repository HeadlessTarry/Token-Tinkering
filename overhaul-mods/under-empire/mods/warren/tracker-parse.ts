// What the warren's tracker reads from the engine: task notifications, output-file markers and how to tail a file.

const OUTPUT_PATH = /Output is being written to: (.+?\.output)(?=\.?\s|\.?$)/
const EXIT_MARKER = /\[exited with code (-?\d+)\]\s*$/
const KILLED_MARKER = /\[killed\]\s*$/
const NOTIFICATION_ID = /<task-id>([^<]+)<\/task-id>/
const NOTIFICATION_STATUS = /<status>([^<]+)<\/status>/
const NOTIFICATION_EXIT = /exit code (-?\d+)/
const WINDOWS_PATH = /^[A-Za-z]:[\\/]|^\\\\/

export function parseOutputPath(text: string): string | undefined {
  return OUTPUT_PATH.exec(text)?.[1]
}

export function parseExitMarker(text: string): number | undefined {
  const match = EXIT_MARKER.exec(text)
  return match ? Number(match[1]) : undefined
}

/** A stopped task's output file ends with `[killed]` in place of an exit code. */
export function isKilled(text: string): boolean {
  return KILLED_MARKER.test(text)
}

/**
 * The commands that print a file's last lines, best first: PowerShell's `Get-Content -Tail` for a
 * Windows path (drive letter or UNC share), `tail` otherwise, and the other one as the fallback.
 */
export function tailCommands(path: string, lines: number): string[][] {
  const tail = ['tail', '-n', String(lines), path]
  const quoted = path.replaceAll("'", "''")
  const powershell = ['powershell', '-NoProfile', '-Command', `Get-Content -LiteralPath '${quoted}' -Tail ${lines}`]
  return WINDOWS_PATH.test(path) ? [powershell, tail] : [tail, powershell]
}

export type TaskNotification = { taskId: string; status: string; exitCode?: number }

export function parseTaskNotification(text: string): TaskNotification | undefined {
  const taskId = NOTIFICATION_ID.exec(text)?.[1]
  const status = NOTIFICATION_STATUS.exec(text)?.[1]
  if (!taskId || !status) return undefined
  const exit = NOTIFICATION_EXIT.exec(text)?.[1]
  return { taskId, status, exitCode: exit === undefined ? undefined : Number(exit) }
}

export function tailLines(text: string, count: number): string {
  if (count <= 0) return ''
  const lines = text.replaceAll('\r\n', '\n').replace(/\n$/, '').split('\n')
  return lines.slice(-count).join('\n')
}

const SILENT_LIMIT_MS = 10 * 60_000

/** True once a background task's output has not changed for 10 minutes: the engine's notice never came, so the task is retired. */
export const isSilent = (lastChangeAt: number, now: number): boolean => now - lastChangeAt >= SILENT_LIMIT_MS
