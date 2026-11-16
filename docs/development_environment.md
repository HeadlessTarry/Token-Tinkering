# 💻 Development Environment

## ⚙️ Pre-Requisites

The following must be installed, and available on your CLI `PATH`:

- [Git](https://git-scm.com/) and Bash (Git Bash on Windows)
- [Node.js](https://nodejs.org/) 24 with npm, which installs every tool the checks use, at the versions pinned in [package.json](../package.json)

## 🚀 Initial Setup

```bash
# cd <repo root or worktree>
./setup_dev_env.sh --skip-checks
```

This runs `npm ci --ignore-scripts` plus the `claude` CLI's own install step, then installs the `pre-commit` and `commit-msg` git hooks with [prek](https://github.com/j178/prek), a pre-commit-compatible runner. Upstream hooks that need Python get an environment that prek builds for them. CI runs the same script before [run_checks.sh](../run_checks.sh). Drop `--skip-checks` to also run [run_checks.sh](../run_checks.sh) straight away.

`node_modules/` is per worktree, so run the script again in each new worktree. The git hooks are shared by every worktree of a clone; when commits stop running them, run the script again.

## ✏️ Making Changes

Run [run_checks.sh](../run_checks.sh) at any time to check your changes. See [🏃 Running Checks](running-checks.md) for what it runs. After editing a mod, run `/reload-plugins` in a Claude Code session that has it installed.

## 🩺 Troubleshooting

**`git commit` fails with `don't commit to branch`:** you are on `main`. Commit from a worktree on a new branch.
