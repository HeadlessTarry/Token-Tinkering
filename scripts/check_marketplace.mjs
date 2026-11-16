// Fail when a marketplace entry is not an overhaul mod: its source must be a folder directly under overhaul-mods/.
// Run from the repo root: node scripts/check_marketplace.mjs

import { readFileSync } from 'node:fs'
import { posix } from 'node:path'

const MARKETPLACE = '.claude-plugin/marketplace.json'
const MODS_DIR = 'overhaul-mods'

function isOverhaulMod(source) {
  return typeof source === 'string' && posix.dirname(posix.normalize(source)) === MODS_DIR
}

const marketplace = JSON.parse(readFileSync(MARKETPLACE, 'utf-8'))
const problems = (marketplace.plugins ?? [])
  .filter((entry) => !isOverhaulMod(entry.source))
  .map((entry) => `${MARKETPLACE}: ${entry.name} is not an overhaul mod; its source must be a folder under ${MODS_DIR}/`)
for (const problem of problems) console.log(problem)
process.exitCode = problems.length ? 1 : 0
