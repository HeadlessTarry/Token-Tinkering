# 🔧 Token Tinkering

Token-Tinkering holds the maintainer's overhaul mods for Claude Code and the `token-tinkering` marketplace that serves them. Terms are defined in [GLOSSARY.md](GLOSSARY.md); review rules live in [CODING_STANDARDS.md](CODING_STANDARDS.md).

## 🔒 Conventions

- **Worktrees**: make every change in a git worktree under `.worktrees/` on a new branch. Commit to that branch; `main` takes changes only through merged pull requests.
- **Commit messages**: write the summary line as `type: Summary message` (no scope), where `type` is `feat` (feature), `fix` (bug or review fix), `docs` (documentation) or `chore` (maintenance).
- **Pull requests**: the description includes `Closes #<issue num>` for the issue it delivers, and the issue closes when the PR merges.
- **Markdown headers**: start each level 1 and level 2 header with a relevant unicode icon (e.g. `## 🧪 Develop`).

## 🛠️ Local development

**Before making changes:** run `./setup_dev_env.sh --skip-checks` in the worktree. See [docs/development_environment.md](docs/development_environment.md).

**Before committing:** run `./run_checks.sh` and fix all failures. See [docs/running-checks.md](docs/running-checks.md).

**Adding an overhaul mod:** create `overhaul-mods/<id>/` with a `.claude-plugin/plugin.json`, and add an entry to `.claude-plugin/marketplace.json` whose `source` is `./overhaul-mods/<id>`. Plugins set no `version`, so each commit is a new version.
