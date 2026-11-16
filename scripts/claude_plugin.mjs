// Run `claude plugin validate` or `claude plugin test` on the targets behind the given files.
// Usage, from the repo root: node scripts/claude_plugin.mjs <validate|test> <file>...
//
// validate: a file under overhaul-mods/<id>/ validates that mod; any other file validates the marketplace (`.`).
//   Errors fail, and so do warnings, except ALLOWED_WARNINGS: plugins carry no `version`, so they track commits.
// test: a file under overhaul-mods/<id>/ tests that mod, when its hooks/hooks.json names a hooks module under `modules`.
//
// The CLI is the repo-local copy pinned in package.json, so local runs and CI use the same version.
// CLAUDE_CLI points at another CLI; a path ending in .mjs runs with node (the tests use this for a fake).

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MODS_DIR = 'overhaul-mods'
const PINNED_CLI = join('node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
const ALLOWED_WARNINGS = ['No version specified.']

function modOf(file) {
  const [top, id, ...rest] = file.replaceAll('\\', '/').replace(/^\.\//, '').split('/')
  return top === MODS_DIR && id && rest.length ? `${MODS_DIR}/${id}` : null
}

function hasHooksModule(mod) {
  try {
    const config = JSON.parse(readFileSync(join(mod, 'hooks', 'hooks.json'), 'utf-8'))
    return typeof config === 'object' && !Array.isArray(config) && Array.isArray(config?.modules) && config.modules.length > 0
  } catch {
    return false
  }
}

function claude(args, options) {
  const cli = process.env.CLAUDE_CLI ?? PINNED_CLI
  const [command, ...prefix] = cli.endsWith('.mjs') ? [process.execPath, cli] : [cli]
  return spawnSync(command, [...prefix, 'plugin', ...args], { encoding: 'utf-8', ...options })
}

function problems(report) {
  const sections = [report.manifest ?? {}, ...(report.contents ?? [])]
  return sections.flatMap((section) => [
    ...(section.errors ?? []).map((issue) => `error: ${issue.path}: ${issue.message}`),
    ...(section.warnings ?? []).filter((issue) => !ALLOWED_WARNINGS.some((prefix) => String(issue.message).startsWith(prefix))).map((issue) => `warning: ${issue.path}: ${issue.message}`),
  ])
}

function validate(target) {
  const result = claude(['validate', '--json', target])
  let report
  try {
    report = JSON.parse(result.stdout)
  } catch {
    console.log(`${target}: \`claude plugin validate\` printed no report\n${result.stdout ?? ''}${result.stderr ?? ''}${result.error ?? ''}`)
    return false
  }
  let messages = problems(report)
  if (result.status !== 0 && !messages.length) messages = [`exit ${result.status}: ${result.stderr.trim()}`]
  for (const message of messages) console.log(`${target}: ${message}`)
  return !messages.length
}

function test(mod) {
  const result = claude(['test', mod], { stdio: 'inherit' })
  if (result.status === 0) return true
  console.log(`${mod}: \`claude plugin test ${mod}\` failed${result.error ? ` (${result.error.message})` : ''}`)
  return false
}

function main([command, ...files]) {
  if (command !== 'validate' && command !== 'test') {
    console.log('usage: node scripts/claude_plugin.mjs <validate|test> <file>...')
    return 2
  }
  if (!process.env.CLAUDE_CLI && !existsSync(PINNED_CLI)) {
    console.log(`${PINNED_CLI} not found; run ./setup_dev_env.sh to install it`)
    return 1
  }
  const mods = files.map(modOf)
  const targets = command === 'validate' ? new Set(mods.map((mod) => mod ?? '.')) : new Set(mods.filter((mod) => mod && hasHooksModule(mod)))
  const check = command === 'validate' ? validate : test
  let failed = false
  for (const target of targets) if (!check(target)) failed = true
  return failed ? 1 : 0
}

process.exitCode = main(process.argv.slice(2))
