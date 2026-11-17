# 🐀 Under-Empire

The Skaven overhaul mod. Install it by hand from the GitHub source:

```bash
claude plugin marketplace add HeadlessTarry/Token-Tinkering
claude plugin install under-empire@token-tinkering
```

| Feature | What it is |
|---------|------------|
| `Warlock Engineer` output style | A scheming Skaven voice for prose; code, commands and artefacts stay plain ([output-styles/warlock-engineer.md](output-styles/warlock-engineer.md)) |
| Reminder hook | A `UserPromptSubmit` command hook that adds [hooks/reminder.txt](hooks/reminder.txt) to every prompt, so the voice holds in long sessions |
| Warren | A permanent desktop backdrop: a dim Skaven warren behind the transcript, still when the agent is idle, alive with machinery and watching eyes when it works (below) |

Claude Code loads one hooks module per plugin, so [hooks/register.ts](hooks/register.ts) registers every mod in `mods/`. Each mod keeps its own source and tests in `mods/<mod>/`, and its `$.state` keys, prefixed `<mod>.`, in the plugin's one contract, [types/index.d.ts](types/index.d.ts).

The engine takes one hook without a matcher per event from a plugin. The warren's tracker holds those on `agent.spawn`, `turn.start`, `turn.complete`, `tool.call` and `session.append`. Another mod would hook those events with a matcher naming what it watches.

## 🏚️ Warren

A permanent desktop backdrop: a dim Skaven warren drawn behind the transcript. Tunnel mouths, rickety wooden scaffolding and Clan Skryre machinery sit on two cavern walls, which fade toward an empty dark centre so the transcript stays legible. It is on whenever the plugin is installed, with no command or setting. It also shows whether the agent has work in flight, so it takes over the job of the former Underlings pane.

### What it shows

The warren reads as a gauge of activity, and draws no creature.

- **Machinery:** at rest, when the agent is waiting for you, everything is still: no animation, the warpstone very dim, no lightning. Whenever the agent is running a turn the machinery moves, and it stills again when the turn ends.
- **Eyes:** with nothing running there are no eyes. Each running subagent or background task opens one pair of red eyes in a tunnel, up to 13 pairs, and the pair closes when its task ends. A freed spot is reused by the next task. Past 13 nothing extra is drawn and no tally is shown. Eyes fade open and closed, blink out of step with one another, and keep their tunnel spot for the task's life. Deeper spots show smaller, dimmer eyes. A background task that outlives the turn keeps its eyes while the machinery goes still.
- **Scaling:** while a turn runs, each active task speeds the machinery up, brightens the warpstone and brings lightning more often. A strike lasts as long at 13 tasks as at none.

| While a turn runs | Machinery speed | Warpstone brightness | Lightning frequency |
|---|---|---|---|
| no tasks | 1x | 40% | base rate |
| 13 tasks | about 3.3x | 100% | about 8x |

The formulas (`1 + 0.18 × tasks`, `0.4 + 0.05 × tasks` capped at 1, `1 + 0.55 × tasks`) are the first values tried, kept in [mods/warren/level.ts](mods/warren/level.ts) to tune. At rest the warpstone sits at 12% brightness.

- **Light:** warp machinery is each wall's main light; braziers and torches add a much dimmer orange light, and warp-lightning flashes (from the machinery only) add brief extra light. Only fire-lit tunnels glow, in orange.
- **Drawing:** one hand-authored SVG with no script or external loads, drawn at about 38% opacity under frosted glass. The shapes are seeded, so the warren looks the same on every render. The scene is rebuilt only when something real happens (a turn or a task starts or ends), and bursts of starts and finishes within about 250 ms change it once.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, stylesheet animation stops and the moving actors are hidden.
- **Desktop only:** the terminal, VS Code and mobile surfaces draw no warren.

### How tasks are tracked

The tracker holds ids and running state only. A subagent runs from `agent.spawn` to its own `turn.complete`. A background Bash task runs from its `backgroundTaskId` until its task notification arrives or its output file ends in an exit or killed marker. Safety nets: the main turn ending closes every subagent pair, a new session starts empty, and a background task whose output has been silent for 10 minutes is retired.

### Needs dark mode

The warren is designed for dark mode only. A mod cannot detect the person's light or dark mode, and the desktop app ignores `overrideColorScheme`, so the warren draws in both.

### Known limits

- **The Underlings view is lost on non-desktop surfaces.** The former Underlings pane (roster, Stop, Clear, transcripts, tokens and the `/underlings` command) is gone. The warren shows only how many tasks run, on the desktop app; the terminal, VS Code and mobile show nothing.
- **The Doomwheel is lost on every surface.** The former Doomwheel pane (the per-PR review view, its squeak-scroll log, the `/doomwheel` command, and its toasts and native notifications) is gone, with no replacement. The warren does not react to PR review state.
- **Panes and the sidebar cover the backdrop.** The Backdrop always fills the whole window and is not told where the chat area sits, so an open pane covers the right wall and the sidebar covers the left.
- **No pause on blur.** The API has no window-focus signal, so the animation keeps running while the window is unfocused.
- **Silent tasks:** the engine gives no way to confirm that a background task's process is still running, so a task that prints nothing for 10 minutes loses its eyes even if it is still alive.
- **Large output:** `$.fs.read` refuses files over 4 MiB, so past that size the tail is read with `tail`, or with PowerShell's `Get-Content -Tail` for a Windows path, each falling back to the other. Supported on Windows and Linux; macOS is untested.

### Files

| File | Role |
|---|---|
| `mods/warren/register.tsx` | The `session.start` hook that sets the backdrop and glass, and the `Backdrop` render hook |
| `mods/warren/scene.ts` | `buildScene(state)`: the whole warren as one SVG string, built from named layers, from the turn flag and the open eyes |
| `mods/warren/level.ts` | The activity level (machinery speed, warpstone brightness, lightning frequency): the tuning knobs |
| `mods/warren/eyes.ts` | The 13 eye spots, the pure state transitions (open, close, settle, batch) and the drawing of a tunnel's eyes |
| `mods/warren/tracker.ts` | The hooks, the 250 ms batching, the output-file polling and the safety nets; owns the `warren.state` atom |
| `mods/warren/tracker-parse.ts` | Pure parsers for task notifications, output paths and exit markers |
| `mods/warren/tests/` | Tests of the scene, the eye transitions, the parsers and the tracker's hooks |

## 🧪 Develop

[run_checks.sh](../../run_checks.sh) validates the plugin and runs its tests (see [docs/running-checks.md](../../docs/running-checks.md)). After editing, run `/reload-plugins` in a session. Each commit is a new version (see the [README](../../README.md)).
