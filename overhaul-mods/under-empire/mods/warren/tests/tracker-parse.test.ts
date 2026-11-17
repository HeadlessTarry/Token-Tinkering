import { describe, expect, test } from 'claude-code/testing'

import { isKilled, isSilent, parseExitMarker, parseOutputPath, parseTaskNotification, tailCommands, tailLines } from '../tracker-parse'

describe('engine messages', () => {
  test('finds the output file in a background Bash result', () => {
    const text = 'Command running in background with ID: b07xha8h8. Output is being written to: /tmp/claude/proj/tasks/b07xha8h8.output. You will be notified when it completes.'
    expect(parseOutputPath(text)).toBe('/tmp/claude/proj/tasks/b07xha8h8.output')
    expect(parseOutputPath('no path here')).toBeUndefined()
    expect(parseOutputPath('Output is being written to: D:\\Users\\Jane Smith\\tasks\\b1.output. You will be notified.')).toBe('D:\\Users\\Jane Smith\\tasks\\b1.output')
  })

  test('reads the exit marker at the end of an output file', () => {
    expect(parseExitMarker('tick 10\n\n[exited with code 0]\n')).toBe(0)
    expect(parseExitMarker('boom\n[exited with code 2]')).toBe(2)
    expect(parseExitMarker('still running')).toBeUndefined()
    expect(isKilled('digging shaft 40/180\n[killed]\n')).toBe(true)
    expect(isKilled('digging shaft 40/180')).toBe(false)
  })

  test('reads a task notification', () => {
    const text = '<task-notification>\n<task-id>b07xha8h8</task-id>\n<status>completed</status>\n<summary>Background command "x" completed (exit code 0)</summary>\n</task-notification>'
    expect(parseTaskNotification(text)).toEqual({ taskId: 'b07xha8h8', status: 'completed', exitCode: 0 })
    expect(parseTaskNotification('<task-id>a1</task-id>')).toBeUndefined()
  })

  test('keeps the last lines of output', () => {
    expect(tailLines('a\r\nb\r\nc\r\n', 2)).toBe('b\nc')
    expect(tailLines('a\nb', 0)).toBe('')
  })
})

describe('tailCommands', () => {
  test('tails a POSIX path with tail, then PowerShell', () => {
    const [first, second] = tailCommands('/tmp/claude/tasks/b1.output', 400)
    expect(first).toEqual(['tail', '-n', '400', '/tmp/claude/tasks/b1.output'])
    expect(second?.[0]).toBe('powershell')
  })

  test('tails a Windows path with PowerShell, quoting the path, then tail', () => {
    const [first, second] = tailCommands("D:\\Temp\\O'Brien\\b1.output", 400)
    expect(first).toEqual(['powershell', '-NoProfile', '-Command', "Get-Content -LiteralPath 'D:\\Temp\\O''Brien\\b1.output' -Tail 400"])
    expect(second?.[0]).toBe('tail')
    expect(tailCommands('D:/Temp/b1.output', 10)[0]?.[0]).toBe('powershell')
    expect(tailCommands('\\\\server\\share\\b1.output', 10)[0]?.[0]).toBe('powershell')
  })
})

describe('the silent-task safety net', () => {
  const TEN_MINUTES = 600_000
  test('a task whose output has been silent for 10 minutes is retired; a quieter gap is not', () => {
    expect(isSilent(1_000, 1_000 + TEN_MINUTES - 1)).toBe(false)
    expect(isSilent(1_000, 1_000 + TEN_MINUTES)).toBe(true)
  })
})
