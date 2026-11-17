# 🔧 Token Tinkering

> Bolt-on mischief for Claude Code

The maintainer's overhaul mods for Claude Code, served through the `token-tinkering` marketplace.

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=HeadlessTarry_Token-Tinkering&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=HeadlessTarry_Token-Tinkering)

## 🎭 Overhaul mods

An overhaul mod is one Claude Code plugin that reskins Claude Code around a single theme by bundling several features, such as an output style and mods (see [GLOSSARY.md](GLOSSARY.md)). It is all-or-nothing: you get the whole overhaul mod or none of it. The marketplace ([.claude-plugin/marketplace.json](.claude-plugin/marketplace.json)) lists only overhaul mods. Install one by hand, which keeps the choice per machine:

```bash
claude plugin marketplace add HeadlessTarry/Token-Tinkering
claude plugin install <id>@token-tinkering
```

| Overhaul mod | What you get |
|--------------|--------------|
| [`under-empire`](overhaul-mods/under-empire/README.md) | The `Warlock Engineer` output style (a scheming Skaven voice for prose, plain professional artefacts), a reminder hook that keeps the voice on, the warren backdrop that shows running subagents and background tasks as watching eyes, and the Doomwheel pane of each PR's review process |

Plugins here set no `version`, so each commit is a new version and `claude plugin update` picks it up.

## 🗂️ Directory Structure

```text
AGENTS.md            → conventions for agents working here
.claude-plugin/      → marketplace "token-tinkering" (overhaul mods only)
overhaul-mods/<id>/  → one overhaul mod per folder; its mods live in mods/<mod>/
scripts/             → check scripts and their tests
setup_dev_env.sh     → installs the pinned npm tools and the git hooks
run_checks.sh        → local and CI checks
docs/                → developer docs
```

## 🤝 Contributing

See [Development Environment](docs/development_environment.md) and [Running Checks](docs/running-checks.md).
