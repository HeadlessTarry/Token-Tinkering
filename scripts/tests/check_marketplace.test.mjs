import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../check_marketplace.mjs', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))

function run(cwd) {
  return spawnSync(process.execPath, [SCRIPT], { cwd, encoding: 'utf-8' })
}

function repoWith(...sources) {
  const root = mkdtempSync(join(tmpdir(), 'marketplace-'))
  mkdirSync(join(root, '.claude-plugin'))
  const plugins = sources.map((source, index) => ({ name: `plugin-${index}`, source }))
  writeFileSync(join(root, '.claude-plugin', 'marketplace.json'), JSON.stringify({ name: 'token-tinkering', plugins }), 'utf-8')
  return root
}

test('the committed marketplace passes', () => {
  const result = run(REPO_ROOT)
  assert.equal(result.status, 0, result.stdout)
})

test('sources that are folders under overhaul-mods/ pass', () => {
  const result = run(repoWith('./overhaul-mods/under-empire', 'overhaul-mods/other'))
  assert.equal(result.status, 0, result.stdout)
  assert.equal(result.stdout, '')
})

for (const source of ['./plugins/claude/overhaul-mods/under-empire', './overhaul-mods', './overhaul-mods/a/b', '../overhaul-mods/x', './mods/x']) {
  test(`a source outside overhaul-mods/ fails: ${source}`, () => {
    const result = run(repoWith(source))
    assert.equal(result.status, 1)
    assert.match(result.stdout, /plugin-0 is not an overhaul mod; its source must be a folder under overhaul-mods\//)
  })
}

test('a source that is not a folder path fails', () => {
  const result = run(repoWith({ source: 'github', repo: 'HeadlessTarry/Token-Tinkering' }))
  assert.equal(result.status, 1)
  assert.match(result.stdout, /plugin-0 is not an overhaul mod/)
})

test('one message per bad entry', () => {
  const result = run(repoWith('./elsewhere/a', './overhaul-mods/ok', './elsewhere/b'))
  assert.equal(result.status, 1)
  assert.equal(result.stdout.trim().split('\n').length, 2)
})
