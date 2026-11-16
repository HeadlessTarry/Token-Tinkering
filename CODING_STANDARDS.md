# 📐 Coding Standards

Judgement calls for the Standards reviewer in `/code-review`. Each rule names its scope; flag a diff that breaks one, quoting the rule's name. Mechanical rules live in [.pre-commit-config.yaml](.pre-commit-config.yaml) and [biome.jsonc](biome.jsonc) (see [docs/running-checks.md](docs/running-checks.md)) and stay out of this file.

## 🤖 Agent-facing docs

Scope: `AGENTS.md`, `overhaul-mods/**`.

- **Positive phrasing.** Apply the Negation guidance in the `writing-for-agents` skill.
- **Actionable instructions.** Every instruction is one the reading agent can carry out from inside its own session, with the tools it has.
- **Safe defaults.** A command shown to an agent leads with its lightest form, heavier variants opt-in; [docs/development_environment.md](docs/development_environment.md) is the reference example.

## 📚 All docs

Scope: every `*.md`.

- **Single source of truth.** Apply the Pruning guidance in the `writing-for-agents` skill: link to the canonical doc, file, or directory.
- **Present state.** Describe what the repo contains today. Mention future mods only as a scope limit ("scope is limited to X; others may follow").

## 🔐 Config and permissions

Scope: `.github/workflows/**`, `.claude-plugin/marketplace.json`, plugin manifests (`overhaul-mods/*/.claude-plugin/plugin.json`, `overhaul-mods/*/hooks/hooks.json`).

- **Least privilege.** Every permission, tool grant, or allowed command traces to a step that uses it.
- **Established fields.** Use only config fields defined by the consuming tool's schema or already in use in this repo.
