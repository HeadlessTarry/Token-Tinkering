# 🏃 Running Checks

Run all project checks to confirm changes are working correctly. CI runs the same script.

## ⚡ Quick Reference

```bash
./run_checks.sh
```

## 🧭 Two Tiers

- **Pre-commit is the commit-time guard.** It runs on every commit and aims at about 3 seconds in total for a typical commit. This is a guideline, not an enforced limit. Scope each hook's `files:` filter to the files it reads.
- **`run_checks.sh` is everything.** It runs every hook on all files; a check over the commit-time budget joins it as a plain command. CI runs exactly this script, so any CI failure reproduces locally. SonarQube is the one CI-only exception: it runs after `run_checks.sh` passes.

## 🪝 Commit-Time Hooks

Each hook's arguments, file filters and versions live in [.pre-commit-config.yaml](../.pre-commit-config.yaml).

| Hook | Guards |
|------|--------|
| `end-of-file-fixer`, `trailing-whitespace`, `mixed-line-ending` | File hygiene; these fix files in place |
| `check-merge-conflict`, `check-added-large-files`, `check-case-conflict` | Merge-conflict markers, large files, and names that collide on case-insensitive file systems |
| `check-json` | Every JSON file parses |
| `shellcheck` | Shell script correctness, plus `[[ ]]` and a default `case` branch |
| `zizmor`, `actionlint` | Insecure patterns and validity in GitHub workflows |
| `biome` | JavaScript, TypeScript and JSON lint and formatting, fixed in place; settings, and the reason each rule is off for the mods, in [biome.jsonc](../biome.jsonc) |
| `marketplace-rule` | Every marketplace entry is an overhaul mod: its `source` is a folder directly under `overhaul-mods/` ([scripts/check_marketplace.mjs](../scripts/check_marketplace.mjs)) |
| `marketplace-validate` | `claude plugin validate .` when the marketplace changes |
| `mod-validate` | `claude plugin validate <mod>` for each mod whose `.claude-plugin/`, `hooks/hooks.json`, `output-styles/` or `README.md` is staged |
| `mod-test` | `claude plugin test <mod>` for each mod with a staged `.ts`/`.tsx` file, when its `hooks/hooks.json` names a hooks module |
| `script-test` | The check scripts' tests (`node --test`), with at least 90% line coverage; writes `lcov.info` for SonarQube |

The three `claude plugin` hooks run [scripts/claude_plugin.mjs](../scripts/claude_plugin.mjs) with the `claude` CLI pinned in [package.json](../package.json). Validation errors and warnings fail, except the missing-`version` warning, since plugins track commits.

These hooks run on commit only:

| Hook | Guards |
|------|--------|
| `no-commit-to-branch` | No commits directly to `main` (skipped by `run_checks.sh`) |
| `commit-msg-format` | Commit summary is `type: Summary`, with `type` one of `feat`, `fix`, `docs`, `chore` |

## 🧩 Individual Commands

```bash
# One hook, all files
node_modules/.bin/prek run biome --all-files

# All hooks, specific files
node_modules/.bin/prek run --files overhaul-mods/under-empire/README.md
```
