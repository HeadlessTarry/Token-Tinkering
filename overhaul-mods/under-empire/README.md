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
| Doomwheel | A side pane showing each PR's review process, read from the session and GitHub, as a Skaven Doomwheel (below) |

Claude Code loads one hooks module per plugin, so [hooks/register.ts](hooks/register.ts) registers every mod in `mods/`. Each mod keeps its own source and tests in `mods/<mod>/`, and its `$.state` keys, prefixed `<mod>.`, in the plugin's one contract, [types/index.d.ts](types/index.d.ts).

The engine takes one hook without a matcher per event from a plugin. The warren's tracker holds those on `agent.spawn`, `turn.start`, `turn.complete`, `tool.call` and `session.append`. Another mod hooks those events with a matcher naming what it watches, as Doomwheel does.

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

## ⚙️ Doomwheel

A pane that shows each PR's review process as a Skaven Doomwheel: a wooden wheel with a rat running inside, powered by a warpstone crystal. It reads the session and GitHub, and needs no skill: any PR review process drives it.

### Which PRs get a wheel

- A PR this session created with `gh pr create`.
- A PR this session armed Auto-Fix on.
- A PR named in a `<ci-monitor-event>`.
- A PR added by hand with `/doomwheel <url>` (or `/doomwheel owner/name#N`). `/doomwheel` alone opens the pane.

Wheels are kept per session. A wheel that is not retired resumes polling when the session starts again.

### What it shows

| Gauge | Meaning | Look |
|---|---|---|
| **HEAT** | Unresolved review threads + failing checks + 1 for a merge conflict | The crystal glows green at 0, rising to red at 5 or more (a cosmetic threshold) |
| **LAPS** | Submitted reviews, from any reviewer, with no cap | From lap 7 the wheel slows and the rat sweats. Cosmetic only: nothing halts |
| **THREADS** | `unresolved/total` review threads | Red while any are unresolved, green at 0 |

| Phase | When | Wheel |
|---|---|---|
| 📜 Offering laid | PR tracked, Auto-Fix not armed | Still |
| ⚙ Spinning | Auto-Fix on | Turning, with warp-lightning |
| ⚡ Warp-bolt! | A `<ci-monitor-event>` arrived; settles when the turn ends | Racing, lightning strikes |
| 💥 Cracked | Auto-Fix cut while the PR is open with work left (unresolved threads, failing checks or a conflict) | Cracked and smoking, the rat knocked out |
| ❄ Cold | Auto-Fix off, no open work | The rat sleeps |
| 🏆 Victory | PR merged | The rat stands on the still wheel holding the warpstone aloft, in a gold blaze |
| 🪦 Scrapped | PR closed unmerged | The wheel lies in a grey heap and the rat slinks away |

A cracked wheel goes back to Spinning when Auto-Fix is re-armed, or to Cold once its open work drops to zero. Victory and Scrapped are retired: polling stops, and **Clear retired** removes them.

| Event | Toast | Native notification | Pane opens |
|---|---|---|---|
| Wheel first appears | — | — | ✓ |
| Auto-Fix armed | ✓ | — | — |
| Cracked | ✓ | ✓ | ✓ |
| Victory | ✓ | — | ✓ |
| Scrapped | — | — | — |

- **Pane:** one card per PR, newest first, with the wheel, the HEAT, LAPS and THREADS gauges and a **squeak-scroll** of the PR's last events.
- **Squeak-scroll:** PR raised, Auto-Fix armed or cut, wakes, each submitted review (author and state), unresolved threads rising or falling, checks turning red or recovering, a merge conflict appearing or clearing, the wheel cracking, Victory and Scrapped. A poll that changes nothing writes nothing.

On the desktop app the wheel is an animated SVG. In a terminal it is drawn as a single glyph.

### What it reads

Session signals find the PRs and make the wheel react at once. GitHub polling supplies the true numbers.

| Signal | Source | Read with |
|---|---|---|
| PR raised | A `gh pr create` Bash or PowerShell call whose output holds the PR URL | `tool.call` |
| Auto-Fix on / off | The desktop app's `set_monitor` call (`auto_fix`, `url`) and its answer | `tool.call` |
| Wake | A `<ci-monitor-event>` message | `session.append` (tool output is skipped, because event-shaped text there is data) |
| Wake settled | The main turn ending | `turn.complete` |
| PR state, reviews, threads, checks, mergeability | One `gh api graphql` query per PR | `$.process.run` |

Each live PR is polled every 60 seconds, and at once on a wake, on a `gh` call that names the PR, before a cut of its Auto-Fix and at the end of each turn. If `gh` is missing or not signed in, the wheel runs on session signals alone, with one dim line on its card saying so.

### Files

| File | Role |
|---|---|
| `mods/doomwheel/register.tsx` | The hooks, the polling, the dispatch of events into state, and the Pane drawing |
| `mods/doomwheel/model.ts` | Pure logic: the signal parsers, the poll query and its reader, the reducer that folds events into wheel state, and labels |
| `mods/doomwheel/sprites.ts` | The Doomwheel, baked into self-animating SVG (SMIL) for every phase, heat and lap count |
| `mods/doomwheel/tests/` | Unit tests, and Pane tests on the terminal and desktop surfaces with `gh` and the clock mocked |

### Known limits

- **The first 100** reviews, review threads and checks of a PR are read; past that the gauges undercount.
- **Checks** are the latest commit's check runs and commit statuses.
- **A `gh` call names a PR** by its URL, `owner/name#N` or its number standing alone, so a call that merely mentions the number also triggers a poll.
- Supported on Windows and Linux; macOS is untested.

## 🧪 Develop

[run_checks.sh](../../run_checks.sh) validates the plugin and runs its tests (see [docs/running-checks.md](../../docs/running-checks.md)). After editing, run `/reload-plugins` in a session. Each commit is a new version (see the [README](../../README.md)).
