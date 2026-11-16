# 🧪 PROTOTYPE: warren backdrop

Throwaway code. This folder lives only on the `prototype/warren-backdrop` branch and never merges to `main`.

## ❓ The question it answered

What should the under-empire's permanent desktop Backdrop look like? It is a Skaven warren drawn as one hand-authored, animated SVG behind the transcript. The prototype checked:

- whether SMIL and CSS animations run inside the desktop Backdrop frame
- how frosted glass reads over the scene
- which art style and contrast level keep the transcript legible

## ✅ Verdict

- **Style:** `blight` (painted, desaturated green-greys, green rim light, fog getting paler with depth).
- **Level:** `whisper` (scene opacity 0.38, glass blur 24 and opacity 0.78, tint `#0a0806`).
- **Animation:** SMIL and CSS animations run in the desktop Backdrop frame. Loops use co-prime timings, at real speed.
- **Composition:** two near walls pinned to the window edges; a far cavern pinned to the window centre, which fills wide windows; a centre fade that follows the transcript column.
- **Known limitations:** panes and the sidebar draw over the backdrop, because the Backdrop is not told where they sit. A mod cannot detect light mode, so the warren needs dark mode.

The full set of decisions is in the phase 1 spec issue.

## ▶️ Running it

Copy this folder into a Claude Code dev-mods folder (or start a session with `--plugin-dir <this folder>`). Switch variants live with `/warren`:

- styles: `silhouette`, `engraved`, `blight`, `ruin`
- levels: `whisper`, `present`, `bold`
- speeds: `real`, `fast`
- `glass on`, `glass off`
- `reset`

For example: `/warren blight whisper fast`.

The research behind the styles is in [../../docs/research/skaven-art-styles.md](../../docs/research/skaven-art-styles.md).
