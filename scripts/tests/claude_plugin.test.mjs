import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../claude_plugin.mjs', import.meta.url))

// Stands in for the claude CLI: logs each call, prints the report it is given, exits as told.
const FAKE_CLAUDE = `
import { appendFileSync } from 'node:fs'
const args = process.argv.slice(2)
appendFileSync(process.env.FAKE_CLAUDE_LOG, \`\${args.join(' ')}\\n\`)
if (args[1] === 'validate') {
  console.log(process.env.FAKE_CLAUDE_REPORT)
  process.exit(Number(process.env.FAKE_CLAUDE_VALIDATE_EXIT))
}
process.exit(Number(process.env.FAKE_CLAUDE_TEST_EXIT))
`

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'claude-plugin-'))
  writeFileSync(join(root, 'fake_claude.mjs'), FAKE_CLAUDE, 'utf-8')
  addMod(root, 'plain')
  addMod(root, 'with-modules', JSON.stringify({ modules: ['./register.ts'] }))
  return root
}

function addMod(root, name, hooks) {
  const mod = join(root, 'overhaul-mods', name)
  mkdirSync(join(mod, 'hooks'), { recursive: true })
  if (hooks !== undefined) writeFileSync(join(mod, 'hooks', 'hooks.json'), hooks, 'utf-8')
}

function run(root, args, { report = {}, validateExit = 0, testExit = 0 } = {}) {
  const log = join(root, 'claude.log')
  const env = {
    ...process.env,
    CLAUDE_CLI: join(root, 'fake_claude.mjs'),
    FAKE_CLAUDE_LOG: log,
    FAKE_CLAUDE_REPORT: typeof report === 'string' ? report : JSON.stringify(report),
    FAKE_CLAUDE_VALIDATE_EXIT: String(validateExit),
    FAKE_CLAUDE_TEST_EXIT: String(testExit),
  }
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: 'utf-8', env })
  const calls = existsSync(log) ? readFileSync(log, 'utf-8').trim().split('\n').filter(Boolean) : []
  return { ...result, calls }
}

test('validate maps each file to its mod, once per mod', () => {
  const root = makeRepo()
  const { status, calls } = run(root, ['validate', 'overhaul-mods/plain/README.md', 'overhaul-mods/plain/.claude-plugin/plugin.json', 'overhaul-mods/with-modules/hooks/hooks.json'])
  assert.equal(status, 0)
  assert.deepEqual(calls, ['plugin validate --json overhaul-mods/plain', 'plugin validate --json overhaul-mods/with-modules'])
})

test('validate maps a file outside every mod to the marketplace', () => {
  const root = makeRepo()
  const { status, calls } = run(root, ['validate', '.claude-plugin/marketplace.json'])
  assert.equal(status, 0)
  assert.deepEqual(calls, ['plugin validate --json .'])
})

test('Windows-style paths map to the same mod', () => {
  const root = makeRepo()
  const { calls } = run(root, ['validate', 'overhaul-mods\\plain\\README.md'])
  assert.deepEqual(calls, ['plugin validate --json overhaul-mods/plain'])
})

test('errors and warnings fail, but the missing-version warning is allowed', () => {
  const root = makeRepo()
  const report = {
    manifest: { errors: [{ path: 'name', message: 'bad name' }], warnings: [{ path: 'version', message: 'No version specified. Add one.' }] },
    contents: [{ errors: [], warnings: [{ path: 'hooks', message: 'odd hook' }] }],
  }
  const { status, stdout } = run(root, ['validate', 'overhaul-mods/plain/README.md'], { report })
  assert.equal(status, 1)
  assert.match(stdout, /error: name: bad name/)
  assert.match(stdout, /warning: hooks: odd hook/)
  assert.doesNotMatch(stdout, /No version specified/)
})

test('output that is not a report fails', () => {
  const root = makeRepo()
  const { status, stdout } = run(root, ['validate', 'overhaul-mods/plain/README.md'], { report: 'not json' })
  assert.equal(status, 1)
  assert.match(stdout, /printed no report/)
})

test('a non-zero exit without a reported problem fails', () => {
  const root = makeRepo()
  const { status, stdout } = run(root, ['validate', 'overhaul-mods/plain/README.md'], { validateExit: 3 })
  assert.equal(status, 1)
  assert.match(stdout, /exit 3/)
})

test('test runs only on mods with a hooks module, once per mod', () => {
  const root = makeRepo()
  const { status, calls } = run(root, ['test', 'overhaul-mods/plain/a.ts', 'overhaul-mods/with-modules/a.ts', 'overhaul-mods/with-modules/b.tsx'])
  assert.equal(status, 0)
  assert.deepEqual(calls, ['plugin test overhaul-mods/with-modules'])
})

for (const hooks of [undefined, 'not json', JSON.stringify({ modules: [] }), JSON.stringify(['modules'])]) {
  test(`a mod without a hooks module gets no plugin test: ${hooks}`, () => {
    const root = makeRepo()
    addMod(root, 'mod', hooks)
    const { status, calls } = run(root, ['test', 'overhaul-mods/mod/a.ts'])
    assert.equal(status, 0)
    assert.deepEqual(calls, [])
  })
}

test('a failing plugin test fails', () => {
  const root = makeRepo()
  const { status, stdout } = run(root, ['test', 'overhaul-mods/with-modules/a.ts'], { testExit: 1 })
  assert.equal(status, 1)
  assert.match(stdout, /plugin test overhaul-mods\/with-modules` failed/)
})

test('a missing pinned CLI fails and says how to install it', () => {
  const root = makeRepo()
  const { CLAUDE_CLI: _, ...env } = process.env
  const result = spawnSync(process.execPath, [SCRIPT, 'validate', 'overhaul-mods/plain/README.md'], { cwd: root, encoding: 'utf-8', env })
  assert.equal(result.status, 1)
  assert.match(result.stdout, /not found; run \.\/setup_dev_env\.sh/)
})

test('an unknown command fails with usage', () => {
  const root = makeRepo()
  const { status, stdout } = run(root, ['lint'])
  assert.equal(status, 2)
  assert.match(stdout, /usage/)
})
