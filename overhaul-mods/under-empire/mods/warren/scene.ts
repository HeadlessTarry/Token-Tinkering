// The under-empire warren Backdrop scene: one hand-authored SVG string, no script, no external
// loads, drawn dim behind the transcript. Painted green-greys ("blight") at whisper level.

import type { WarrenEye, WarrenState } from '../../types'
import { eyesAt } from './eyes'
import { type Level, levelFor, REST } from './level'

// ---------- activity level ----------

// The level and the eyes of the render in progress, set by buildScene. Like the jitter seed, they make
// each render a pure function of its input while letting the layer functions below stay small.
let L: Level = REST
let EYES: WarrenEye[] = []

// ---------- timing ----------

// A loop of `cycle` seconds in which something happens for `len` seconds starting at `start`.
type Win = { dur: string; a: number; b: number; begin: string; c: number }

const r3 = (n: number) => Math.round(n * 1000) / 1000

function win(cycle: number, start: number, len: number, begin = 0): Win {
  const l = Math.min(len, cycle * 0.7)
  const st = Math.min(start, cycle - l - 0.01)
  return { dur: `${r3(cycle)}s`, a: r3(st / cycle), b: r3((st + l) / cycle), begin: `${r3(begin)}s`, c: cycle }
}

// Opacity that is 0 outside the window, fading in and out over `fadeSec` seconds:
// long fades let an actor melt into, or out of, a tunnel's shadow.
function show(w: Win, peak = 1, fadeSec = 0.15): string {
  const e = r3(Math.min(fadeSec / w.c, (w.b - w.a) / 4))
  return `<animate attributeName="opacity" begin="${w.begin}" dur="${w.dur}" repeatCount="indefinite" values="0;0;${peak};${peak};0;0" keyTimes="0;${w.a};${r3(w.a + e)};${r3(w.b - e)};${w.b};1"/>`
}

// ---------- shapes ----------

// Deterministic jitter, so every render draws the same crooked shapes.
let seed = 7
const rnd = () => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}
const j = (n: number) => (rnd() - 0.5) * 2 * n

// A hacked-out arch: an irregular polygon, slightly lopsided, never a clean semicircle.
function arch(cx: number, by: number, w: number, h: number): string {
  const r = w / 2
  const t = by - h + r
  const lean = j(r * 0.15)
  const pts: number[][] = [
    [cx - r + j(2), by],
    [cx - r + j(4), by - (h - r) * 0.5],
  ]
  for (let i = 0; i <= 7; i++) {
    const a = Math.PI - (Math.PI * i) / 7
    pts.push([cx + Math.cos(a) * r + j(4) + lean * Math.sin(a), t - Math.sin(a) * r + j(4)])
  }
  pts.push([cx + r + j(4), by - (h - r) * 0.5], [cx + r + j(2), by])
  return `M${pts.map((p) => p.map(Math.round).join(' ')).join('L')}Z`
}

function planks(x0: number, x1: number, y: number): string {
  let out = ''
  for (let x = x0; x < x1; x += 24 + Math.round(rnd() * 6)) {
    if (rnd() < 0.1) continue // a plank is missing; mind the gap
    const a = r3((rnd() - 0.5) * 7)
    const dy = Math.round((rnd() - 0.5) * 3)
    out += `<rect class="w" x="${x}" y="${y + dy}" width="${22 + Math.round(rnd() * 6)}" height="7" transform="rotate(${a} ${x + 12} ${y})"/>`
  }
  return `${out}<rect class="w2" x="${x0}" y="${y + 8}" width="${x1 - x0}" height="5"/>`
}

const beam = (x1: number, y1: number, x2: number, y2: number, wd = 6) => `<path class="beam" stroke-width="${wd}" d="M${x1} ${y1}L${x2} ${y2}"/>`

function ladder(x1: number, y1: number, x2: number, y2: number): string {
  let out = beam(x1, y1, x2, y2, 4) + beam(x1 + 24, y1, x2 + 24, y2, 4)
  const n = Math.floor(Math.abs(y1 - y2) / 20)
  for (let i = 1; i < n; i++) {
    const t = i / n
    const x = x1 + (x2 - x1) * t
    const y = y1 + (y2 - y1) * t
    if (i !== 4) out += beam(x, y, x + 24, y, 3) // one rung is missing, naturally
  }
  return out
}

// A tunnel mouth: black hole and ragged stone rim, plus a clip of its exact shape, so the
// shadow, glow and eyes `mouth` draws later stay inside the hole and never spill onto the rock.
const holes = new Map<string, string>()

function tunnel(cx: number, by: number, w: number, h: number): string {
  const d = arch(cx, by, w, h)
  const id = `hole${holes.size}`
  holes.set(`${cx},${by}`, id)
  return `<clipPath id="${id}"><path d="${d}"/></clipPath><path class="rim" d="${d}"/><path class="k" d="${d}"/>`
}

// Fire is a secondary, dim light: the warp machines are each wall's key light.
function flame(x: number, y: number, size: number, n: number): string {
  const s = size / 24
  return (
    `<circle class="glow gl${n}" cx="${x}" cy="${y - size * 0.6}" r="${size * 2.4}" fill="url(#fireGlow)"/>` +
    `<g transform="translate(${x - 8 * s} ${y - 24 * s}) scale(${r3(s)})"><use class="fl f${n}" href="#flame" width="16" height="24"/></g>`
  )
}

const brazier = (x: number, y: number) => beam(x - 16, y, x, y - 28, 3) + beam(x + 16, y, x, y - 28, 3) + `<path class="m" d="M${x - 18} ${y - 34}h36l-6 11h-24z"/>` + flame(x, y - 32, 22, 1)

const torch = (x: number, y: number, n: number) => beam(x - 4, y + 26, x, y, 4) + flame(x, y + 2, 18, n)

const wallBrazier = (x: number, y: number, n: number) =>
  beam(x + 14, y + 22, x, y + 4, 3) + beam(x + 14, y + 4, x + 2, y + 2, 2) + `<path class="m" d="M${x - 11} ${y - 4}h22l-4 8h-14z"/>` + flame(x, y - 3, 16, n)

// A jib hoist on the end of the walkway: a pulley hauls a bucket of warpstone up from the
// lower tunnel on the floor to the walkway, holds it there, and lowers it again.
function hoist(): string {
  const run = 'dur="47s" repeatCount="indefinite" keyTimes="0;.3;.45;.75;.9;1"'
  return (
    beam(372, 420, 374, 362, 5) +
    beam(368, 366, 418, 372, 5) +
    beam(374, 398, 402, 370, 3) +
    `<circle class="b" cx="412" cy="377" r="6"/>` +
    `<path class="rope" d="M412 383V804"><animate attributeName="d" values="M412 383V804;M412 383V804;M412 383V404;M412 383V404;M412 383V804;M412 383V804" ${run}/></path>` +
    `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -400;0 -400;0 0;0 0" ${run}/>` +
    `<path class="m" d="M403 804h18l-3 16h-12z"/><path class="orb" opacity=".5" d="M406 804l3 -4l4 3l4 -3l2 4z"/></g>`
  )
}

function gear(x: number, y: number, r: number, dur: number, rev = false): string {
  const spin = `<animateTransform attributeName="transform" type="rotate" from="0" to="${rev ? -360 : 360}" dur="${dur}s" repeatCount="indefinite"/>`
  return (
    `<g transform="translate(${x} ${y})"><g>${spin}` +
    `<circle class="teeth" r="${r}" stroke-width="7" stroke-dasharray="5 4 3 5 6 3 4 9 5 4 2 5"/>` +
    `<circle class="b" r="${r - 3}"/><circle class="k" r="${r * 0.3}"/>` +
    `<path class="spoke" d="M${-r + 5} 0H${r - 5}M0 ${-r + 5}V${r - 5}"/></g></g>`
  )
}

// ---------- actors ----------

// How an actor moves: `one-way` walks the path once; `there-and-back` walks it, pauses,
// turns round and walks home. `fade` is seconds of fade at each end (shadowed tunnels get long ones).
type Trip = { back?: boolean; fade?: number }

// Walks a sprite along `path` during the window; `flip` faces it left on the way out.
function walker(sym: string, w: number, h: number, path: string, t: Win, flip: boolean, bob: number, trip: Trip = {}): string {
  const pause = r3(Math.min(0.8 / t.c, (t.b - t.a) / 10))
  const m1 = r3((t.a + t.b) / 2 - pause / 2)
  const m2 = r3((t.a + t.b) / 2 + pause / 2)
  const kp = trip.back ? `keyPoints="0;0;1;1;0;0" keyTimes="0;${t.a};${m1};${m2};${t.b};1" calcMode="linear"` : `keyPoints="0;0;1;1" keyTimes="0;${t.a};${t.b};1" calcMode="linear"`
  const out = flip ? '-1 1' : '1 1'
  const home = flip ? '1 1' : '-1 1'
  const face = trip.back
    ? `<animateTransform attributeName="transform" type="scale" begin="${t.begin}" dur="${t.dur}" repeatCount="indefinite" calcMode="discrete" values="${out};${home}" keyTimes="0;${r3((t.a + t.b) / 2)}"/>`
    : ''
  const bobA = `<animateTransform attributeName="transform" type="translate" values="0 0;0 ${-bob};0 0" dur="${bob > 2 ? 0.5 : 0.18}s" repeatCount="indefinite"/>`
  return (
    `<g class="mv" opacity="0">${show(t, 1, trip.fade ?? 0.15)}<g>` +
    `<animateMotion begin="${t.begin}" dur="${t.dur}" repeatCount="indefinite" ${kp} path="${path}"/>` +
    `<g>${bobA}<g transform="scale(${out})">${face}<use href="#${sym}" x="${-w / 2}" y="${-h}" width="${w}" height="${h}"/></g></g>` +
    `</g></g>`
  )
}

const rat = (path: string, t: Win, flip: boolean, trip?: Trip) => walker('rat', 30, 13, path, t, flip, 1.5, trip)

// The shadowed throat of a tunnel, drawn over the rats so they sink into the dark rather than
// vanish; then any watching eyes, then the tunnel's inner glow. All clipped to the hole.
function mouth(cx: number, by: number, w: number, h: number, glow?: 'fire'): string {
  const g = glow ? `<ellipse class="gl gf" cx="${cx}" cy="${by - h * 0.35}" rx="${w * 0.42}" ry="${h * 0.4}" fill="url(#fireIn)"/>` : ''
  const e = eyesAt(`${cx},${by}`, EYES, cx, by)
  return `<g clip-path="url(#${holes.get(`${cx},${by}`)})"><ellipse cx="${cx}" cy="${by - h * 0.42}" rx="${w * 0.52}" ry="${h * 0.56}" fill="url(#throat)"/>${e}${g}</g>`
}

// A burst of warp-lightning: invisible for the cycle, three flickers at its window.
function lightning(t: Win, d: string, gx: number, gy: number, reach = 460): string {
  // At rest there is none. When busy, strikes come more often but each lasts as long as ever, so the
  // markers keep it out of the machinery's speed-up and the stillness pass.
  if (L.inert) return ''
  const len = t.b - t.a
  const k = (f: number) => r3(t.a + len * f)
  const vals = '0;0;1;0.1;0.9;0;1;0;0'
  const kt = `0;${t.a};${k(0.08)};${k(0.25)};${k(0.35)};${k(0.5)};${k(0.62)};${t.b};1`
  const flick = `<animate attributeName="opacity" begin="${t.begin}" dur="${t.dur}" repeatCount="indefinite" values="${vals}" keyTimes="${kt}"/>`
  // The glow builds a little before the strike and lingers after it.
  const pre = r3(Math.max(0, t.a - len * 2))
  const glow = `<animate attributeName="opacity" begin="${t.begin}" dur="${t.dur}" repeatCount="indefinite" values="0;0;0.35;1;0.6;0;0" keyTimes="0;${pre};${t.a};${k(0.4)};${t.b};${r3(Math.min(0.999, t.b + len))};1"/>`
  // The flash lights the whole wall for a moment: a temporary third light source.
  return (
    `<!--E--><g class="mv" opacity="0">${glow}<circle cx="${gx}" cy="${gy}" r="${reach}" fill="url(#flashGlow)"/></g>` +
    `<g class="mv" opacity="0">${flick}<path class="bolt0" d="${d}"/><path class="bolt1" d="${d}"/></g><!--/E-->`
  )
}

// ---------- defs ----------

const DEFS = `<defs>
<linearGradient id="fg" x1="0" x2="0" y1="1" y2="0"><stop offset="0" stop-color="#d9772e" stop-opacity=".8"/><stop offset=".45" stop-color="#a8431a" stop-opacity=".45"/><stop offset="1" stop-color="#6e2410" stop-opacity="0"/></linearGradient>
<linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="-470" x2="470" y1="0" y2="0"><stop offset="0" class="bgc" stop-color="#080706" stop-opacity="0"/><stop offset=".149" class="bgc" stop-color="#080706" stop-opacity=".94"/><stop offset=".851" class="bgc" stop-color="#080706" stop-opacity=".94"/><stop offset="1" class="bgc" stop-color="#080706" stop-opacity="0"/></linearGradient>
<linearGradient id="vfade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#050404" stop-opacity=".85"/><stop offset=".14" stop-color="#050404" stop-opacity="0"/><stop offset=".92" stop-color="#050404" stop-opacity="0"/><stop offset="1" stop-color="#050404" stop-opacity=".45"/></linearGradient>
<radialGradient id="fireGlow"><stop offset="0" stop-color="#ff9a3c" stop-opacity=".22"/><stop offset=".4" stop-color="#d0581c" stop-opacity=".06"/><stop offset="1" stop-color="#d0581c" stop-opacity="0"/></radialGradient>
<radialGradient id="keyGlow"><stop offset="0" stop-color="#9dff6a" stop-opacity=".3"/><stop offset=".3" stop-color="#4fcf3a" stop-opacity=".14"/><stop offset=".7" stop-color="#2f8f2a" stop-opacity=".05"/><stop offset="1" stop-color="#2f8f2a" stop-opacity="0"/></radialGradient>
<radialGradient id="flashGlow"><stop offset="0" stop-color="#e4ffb0" stop-opacity=".55"/><stop offset=".25" stop-color="#8fe05a" stop-opacity=".25"/><stop offset=".6" stop-color="#4fbf3a" stop-opacity=".08"/><stop offset="1" stop-color="#4fbf3a" stop-opacity="0"/></radialGradient>
<linearGradient id="fogBack" x1="0" x2="0" y1="0" y2="1"><stop class="fogc" offset="0" stop-opacity="0"/><stop class="fogc" offset=".45" stop-opacity=".5"/><stop class="fogc" offset=".7" stop-opacity=".15"/><stop class="fogc" offset="1" stop-opacity="0"/></linearGradient>
<linearGradient id="band" x1="0" x2="0" y1="0" y2="1"><stop class="fogc" offset="0" stop-opacity="0"/><stop class="fogc" offset=".5" stop-opacity=".6"/><stop class="fogc" offset="1" stop-opacity="0"/></linearGradient>
<radialGradient id="warpGlow"><stop offset="0" stop-color="#8dff5a" stop-opacity=".55"/><stop offset=".35" stop-color="#3ccf3a" stop-opacity=".18"/><stop offset="1" stop-color="#3ccf3a" stop-opacity="0"/></radialGradient>
<radialGradient id="fireIn"><stop offset="0" stop-color="#ff8a30" stop-opacity=".15"/><stop offset="1" stop-color="#ff8a30" stop-opacity="0"/></radialGradient>
<radialGradient id="throat" cy=".55"><stop offset="0" stop-color="#030202"/><stop offset=".5" stop-color="#030202" stop-opacity=".9"/><stop offset="1" stop-color="#030202" stop-opacity="0"/></radialGradient>
<linearGradient id="tankWin" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#b6ff7a"/><stop offset="1" stop-color="#1f7a2a"/></linearGradient>
<symbol id="flame" viewBox="0 0 16 24" overflow="visible"><path fill="url(#fg)" d="M4 24C2 19 6 16 5 10C7 14 8 17 8 19C9 15 8 9 10 3C12 10 14 16 12 24Z"/><path fill="url(#fg)" opacity=".7" d="M7 24C6 20 9 17 8 12C10 16 11 20 10 24Z"/></symbol>
<symbol id="rat" viewBox="0 0 44 18" overflow="visible"><path class="x" d="M10 12C10 7 15 4 22 4C27 4 30 6 33 8L40 11C41 12 40 13 39 13L33 14C30 16 26 17 22 17C15 17 10 15 10 12Z"/><circle class="x" cx="29" cy="5" r="2.6"/><path class="tail" d="M11 12C6 13 3 11 0 14"/><circle class="halo" cx="35" cy="10" r="3"/><circle class="eye" cx="35" cy="10" r="1"/></symbol>
</defs>`

// ---------- walls ----------

function leftWall(): string {
  return `<svg width="100%" height="100%" viewBox="0 0 560 900" preserveAspectRatio="xMinYMid meet" overflow="visible">
<path class="r" d="M-400 -50H500C470 50 480 110 455 160C430 210 470 260 445 320C420 380 470 430 440 500C415 560 465 620 440 690C420 750 470 820 455 950H-400Z"/>
<path class="edge" d="M500 -50C470 50 480 110 455 160C430 210 470 260 445 320C420 380 470 430 440 500C415 560 465 620 440 690C420 750 470 820 455 950"/>
<path class="strata" d="M0 120C120 110 260 140 430 125M0 560C150 548 300 575 445 560M0 330C90 320 200 345 300 330"/>
<path class="r2" d="M0 0H500L470 40L430 30L400 80L370 35L330 60L300 20L260 70L230 25L190 50L150 10L110 45L60 15L20 40L0 20Z"/>
${tunnel(330, 420, 96, 122)}
${tunnel(120, 250, 70, 86)}
${tunnel(330, 822, 112, 142)}
${tunnel(418, 640, 40, 48)}
${beam(30, 433, 24, 950)}${beam(150, 433, 158, 950)}${beam(270, 433, 262, 760)}${beam(370, 433, 410, 560)}
${beam(30, 470, 150, 600, 4)}${beam(150, 470, 30, 600, 4)}${beam(150, 480, 270, 612, 4)}${beam(270, 480, 158, 640, 4)}
${planks(-12, 384, 420)}
${beam(20, 420, 20, 386, 3)}${beam(120, 420, 122, 386, 3)}${beam(220, 420, 218, 388, 3)}${beam(300, 420, 304, 390, 3)}
<path class="rope" d="M0 392Q70 404 120 388"/>
<g><animateTransform attributeName="transform" type="rotate" values="3 120 388;-4 120 388;3 120 388" dur="8.9s" repeatCount="indefinite"/><path class="rope" d="M120 388C114 404 124 426 117 444M117 444l-4 5M117 444l1 7M117 444l4 5"/></g>
<g><animateTransform attributeName="transform" type="rotate" values="-3 220 390;4 220 390;-3 220 390" dur="7.3s" repeatCount="indefinite"/><path class="rope" d="M220 390C227 406 221 428 229 452M229 452l-4 6M229 452l1 7M229 452l4 5"/></g>
<path class="rope" d="M302 392C305 399 301 405 304 412M304 412l-3 4M304 412l2 4"/>
${beam(40, 257, 0, 330, 5)}${beam(150, 257, 200, 330, 5)}
${planks(-12, 168, 250)}
${ladder(196, 420, 172, 250)}
${brazier(78, 420)}
${wallBrazier(176, 196, 2)}
${torch(396, 728, 2)}
<path class="r" d="M-400 824L60 818L140 826L260 820L400 828L520 820L700 830V950H-400Z"/>
<path class="edge" d="M-400 824L60 818L140 826L260 820L400 828L520 820L700 830"/>
<g transform="translate(0 -52)">
<path class="pipe" d="M170 790H214V560H300M80 810H40V690H0M150 726V640H90V560"/>
<rect class="m" x="80" y="722" width="90" height="150" rx="12"/>
<rect class="b" x="76" y="742" width="98" height="8"/><rect class="b" x="76" y="842" width="98" height="8"/>
<rect class="pu" x="108" y="760" width="34" height="72" rx="6" fill="url(#tankWin)"/>
<path class="b" d="M80 734Q125 690 170 734Z"/>
${beam(125, 706, 125, 652, 4)}
<path class="coil" d="M117 700L133 694L117 688L133 682L117 676L133 670L117 664L133 658"/>
<circle class="orb" cx="125" cy="645" r="9"/>
<circle class="key pu" cx="125" cy="640" r="330" fill="url(#keyGlow)"/><circle class="glow pu" cx="125" cy="645" r="70" fill="url(#warpGlow)"/>
${gear(214, 838, 22, 9)}${gear(250, 810, 14, 5.7, true)}
<rect class="m" x="54" y="748" width="20" height="54" rx="3"/>
<rect class="b" x="59" y="722" width="10" height="34"><animate attributeName="y" values="722;704;722" dur="2.9s" repeatCount="indefinite"/></rect>
<circle class="b" cx="155" cy="772" r="9"/><circle class="k" cx="155" cy="772" r="6.5"/>
<path class="needle" d="M155 772V766"><animateTransform attributeName="transform" type="rotate" values="-50 155 772;20 155 772;-5 155 772;55 155 772;-50 155 772" dur="5.3s" repeatCount="indefinite"/></path>
<g class="drift"><circle class="puff pf1" cx="90" cy="556" r="6"/><circle class="puff pf2" cx="90" cy="556" r="6"/><circle class="puff pf3" cx="90" cy="556" r="6"/></g>
${beam(330, 604, 294, 574, 4)}<rect class="b" x="304" y="582" width="5" height="12" transform="rotate(-40 306 588)"/><circle class="b" cx="290" cy="571" r="6"/>
${lightning(win(17 / L.boost, 6, 0.25, 0), 'M118 690L132 684L118 676L131 668', 125, 680, 50)}
${lightning(win(293 / L.boost, 200, 0.9, 0), 'M125 636L140 618L133 604L162 590L155 577L190 572L204 586L232 566L250 578L284 572M162 590L171 613L163 626M190 572L197 551L188 538M232 566L238 546M140 618L108 600L114 586', 200, 590)}
</g>
${rat('M330 414L-30 414', win(23, 6, 3.2, 0), true, { fade: 0.9 })}
${rat('M330 818L-30 818', win(41, 12, 3.6, 0), true, { fade: 0.9 })}
${rat('M330 818L-30 818', win(41, 12.5, 3.6, 0), true, { fade: 0.9 })}
${rat('M-30 244L118 244', win(53, 30, 2.2, 0), false, { fade: 0.9 })}
${mouth(330, 420, 96, 122, 'fire')}
${mouth(120, 250, 70, 86)}
${mouth(330, 822, 112, 142, 'fire')}
${mouth(418, 640, 40, 48)}
${hoist()}
</svg>`
}

// Clan Skryre works on the right wall: a piston drives a crank, the crank works a bellows,
// the bellows feeds a warp-condenser, and the overcharged condenser now and then discharges up into the pipes.
function machine(): string {
  const pump = 'dur="3.7s" repeatCount="indefinite"'
  return `<g>
<path class="pipe" d="M200 90H560M300 90V40M500 90V150M545 90V420M438 362H470"/>
${gear(300, 90, 16, 33)}${gear(400, 90, 12, 21, true)}
<rect class="m" x="482" y="150" width="36" height="70" rx="5"/>
<rect class="b" x="492" y="120" width="16" height="40"><animate attributeName="y" values="120;100;120" ${pump}/></rect>
${beam(500, 220, 500, 282, 7)}
${gear(500, 296, 16, 3.7)}
<rect class="w" x="392" y="420" width="168" height="8"/>
${beam(398, 428, 376, 486, 4)}${beam(550, 428, 530, 486, 4)}
<rect class="m" x="402" y="340" width="36" height="80" rx="4"/>
<rect class="b" x="398" y="348" width="44" height="5"/><rect class="b" x="398" y="378" width="44" height="5"/><rect class="b" x="398" y="406" width="44" height="5"/>
<rect class="pu" x="414" y="356" width="12" height="48" rx="3" fill="url(#tankWin)"/>
${beam(420, 340, 420, 322, 3)}<circle class="b" cx="420" cy="317" r="6"/>
<circle class="key pu2" cx="420" cy="360" r="330" fill="url(#keyGlow)"/><circle class="glow pu2" cx="420" cy="370" r="80" fill="url(#warpGlow)"/>
<rect class="b" x="464" y="414" width="72" height="6"/>
<g transform="translate(500 414)">
<g><animateTransform attributeName="transform" type="scale" values="1 1;1 .6;1 1" ${pump}/>
<path class="bellows" d="M-30 0L-34 -8L-30 -16L-34 -24L-30 -32L-34 -40H34L30 -32L34 -24L30 -16L34 -8L30 0Z"/>
<path class="fold" d="M-30 -8H30M-30 -16H30M-30 -24H30M-30 -32H30"/></g>
<g><animateTransform attributeName="transform" type="translate" values="0 0;0 16;0 0" ${pump}/>
<rect class="b" x="-36" y="-46" width="72" height="6"/>${beam(0, -46, 0, -104, 5)}</g>
</g>
${lightning(win(241 / L.boost, 120, 0.7, 0), 'M420 311L408 286L418 268L396 240L406 222L384 190L392 170L376 138L380 118L372 96M396 240L374 250M384 190L405 176M376 138L358 147', 398, 205)}
${lightning(win(67 / L.boost, 30, 0.35, 0), 'M426 316L444 304L456 314L486 298', 456, 306, 140)}
</g>`
}

function rightWall(): string {
  return `<svg width="100%" height="100%" viewBox="0 0 560 900" preserveAspectRatio="xMaxYMid meet" overflow="visible">
<path class="r" d="M960 -50H70C100 60 85 120 115 180C140 240 95 300 125 360C150 420 100 480 130 550C155 610 105 680 125 750C140 810 100 860 110 950H960Z"/>
<path class="edge" d="M70 -50C100 60 85 120 115 180C140 240 95 300 125 360C150 420 100 480 130 550C155 610 105 680 125 750C140 810 100 860 110 950"/>
<path class="strata" d="M120 180C260 170 400 195 560 182M130 620C260 610 420 632 560 618M118 440C240 432 330 450 400 440"/>
<path class="r2" d="M560 0H70L100 45L140 20L170 70L200 30L240 60L270 15L310 55L350 20L390 65L430 25L470 50L510 15L560 40Z"/>
${tunnel(300, 300, 110, 140)}
${tunnel(440, 540, 80, 96)}
${tunnel(450, 834, 120, 150)}
${beam(236, 547, 232, 950)}${beam(340, 547, 346, 950)}${beam(236, 600, 340, 720, 4)}${beam(340, 600, 236, 720, 4)}
${planks(220, 470, 540)}
${beam(240, 540, 240, 330, 7)}${beam(250, 340, 116, 330, 6)}${beam(240, 430, 160, 336, 4)}
<g transform="translate(128 338)"><g>
<animateTransform attributeName="transform" type="rotate" values="-4;4;-4" dur="11s" repeatCount="indefinite"/>
<path class="chain" d="M0 0V128"/>
<rect class="m" x="-18" y="128" width="36" height="6"/><rect class="m" x="-18" y="172" width="36" height="6"/>
<path class="bars" d="M-16 132V174M-8 132V174M0 132V174M8 132V174M16 132V174"/>
</g></g>
<circle class="b" cx="122" cy="334" r="6"/>
${beam(120, 300, 150, 360, 5)}${beam(240, 300, 220, 370, 5)}
${planks(110, 262, 300)}
${torch(500, 476, 1)}${torch(372, 768, 3)}
<path class="r" d="M-200 836L100 830L240 838L380 828L560 834V950H-200Z"/>
<path class="edge" d="M-200 836L100 830L240 838L380 828L560 834"/>
${machine()}
${rat('M440 534L256 534', win(29, 3, 4.4, 0), true, { back: true, fade: 0.9 })}
${rat('M450 830L600 830', win(47, 25, 2.5, 0), false, { fade: 0.9 })}
${mouth(300, 300, 110, 140, 'fire')}
${mouth(440, 540, 80, 96)}
${mouth(450, 834, 120, 150)}
</svg>`
}

// ---------- style ----------

// The blight palette: desaturated green-greys, green rim light, fog getting paler with depth. Our own
// derivation of the painted style, not a copy of any artwork.
const PALETTE = `.bg{fill:#0c100e}.bgc{stop-color:#0a0d0c}.r{fill:#151b18}.r2{fill:#0f1412}.edge{stroke:#8fbf5a;stroke-opacity:.35;stroke-width:2}.strata{stroke:#1d2622;stroke-width:3}
.w{fill:#2b2a22}.w2{fill:#1c1d18}.beam{stroke:#262720}.m{fill:#1d2420}.b{fill:#3a4a3f}.x{fill:#070a09}.sack{fill:#1f241f}.bellows{fill:#22261f;stroke:#141812}
.tail{stroke:#070a09}.rope{stroke:#3a4a3f}.pipe{stroke:#1f2723}.teeth{stroke:#3a4a3f}.spoke{stroke:#1d2420}.chain,.bars{stroke:#2a332e}.k{fill:#040605}.rim{stroke:#1d2622;stroke-dasharray:12 5}.deck{stroke:#262720}
.fogc{stop-color:#3a4a3f}.fogback{opacity:.55}.fogfront{opacity:.5}`

// The whole scene is drawn at whisper level, so the transcript stays legible.
const SCENE_OPACITY = 0.38

const css = () => {
  const d = (n: number) => `${r3(n / L.speed)}s`
  const anim = (name: string, n: number, rest: string) => (L.inert ? 'none' : `${name} ${d(n)} ${rest}`)
  const g = r3(L.glow)
  return `<style>
svg{overflow:visible}
.scene{opacity:${SCENE_OPACITY}}.deep{opacity:.9}
path,rect,circle{stroke-linecap:round;stroke-linejoin:round}
.edge,.strata,.beam,.tail,.rope,.pipe,.teeth,.spoke,.chain,.bars,.coil,.deck,.rim,.bolt0,.bolt1,.fold{fill:none}
.tail{stroke-width:1.6}.rope{stroke-width:1.5}.chain{stroke-width:3;stroke-dasharray:5 3}.bars{stroke-width:1.5}.spoke{stroke-width:3}.pipe{stroke-width:9}.rim{stroke-width:9}
.deck{stroke-width:5;stroke-dasharray:4 2}.bellows{stroke-width:1.5}.fold{stroke:#1a130c;stroke-width:1.2}
.coil{stroke:#a07d3a;stroke-width:2}.orb{fill:#b6ff7a;fill-opacity:${g}}.eye{fill:#ff5a3a}.halo{fill:#ff3b2a;opacity:.18}
.bolt0{stroke:#6fd13a;stroke-width:9;opacity:.3}.bolt1{stroke:#e4ffb0;stroke-width:1.8}
${PALETTE}
.key,.pu,.pu2{fill-opacity:${g}}
.fl{transform-box:fill-box;transform-origin:50% 100%;animation:${anim('fl', 1.1, 'ease-in-out infinite alternate')}}
.f2{animation-duration:${d(1.37)}}.f3{animation-duration:${d(0.83)};animation-delay:-.4s}
.gl1,.gl2,.gl3,.gf{animation:${anim('gl', 2.3, 'ease-in-out infinite alternate')}}.gl2{animation-duration:${d(1.9)}}.gl3{animation-duration:${d(2.9)}}
.pu{animation:${anim('pu', 4.3, 'ease-in-out infinite alternate')}}.pu2{animation:${anim('pu', 6.1, 'ease-in-out infinite alternate')}}
@keyframes fl{0%{transform:scale(1,1)}30%{transform:scale(.94,1.07) skewX(4deg)}55%{transform:scale(1.03,.93) skewX(-2deg)}80%{transform:scale(.97,1.1) skewX(-5deg)}100%{transform:scale(1,.97)}}
@keyframes gl{from{opacity:.7}to{opacity:1}}
@keyframes pu{from{opacity:.55}to{opacity:1}}
.needle{stroke:#c9b27a;stroke-width:1.5}
.puff{fill:#6f8f6a;opacity:0;transform-box:fill-box;transform-origin:50% 50%;animation:${anim('puff', 6.3, 'ease-out infinite')}}.pf2{animation-delay:-2.1s}.pf3{animation-delay:-4.2s}
@keyframes puff{0%{opacity:0;transform:translate(0,0) scale(.6)}15%{opacity:.35}100%{opacity:0;transform:translate(-14px,-70px) scale(2.6)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.mv,.drift{display:none}}
</style>`
}

// Fog planes: one behind the walls (depth), two drifting bands in front.
const FOG_BACK = `<rect class="fog fogback" width="100%" height="100%" fill="url(#fogBack)"/>`
const FOG_FRONT = `<g class="fog fogfront">
<rect x="-10%" y="48%" width="120%" height="16%" fill="url(#band)"><animateTransform attributeName="transform" type="translate" values="-40 0;40 0;-40 0" dur="83s" repeatCount="indefinite"/></rect>
<rect x="-10%" y="80%" width="120%" height="22%" fill="url(#band)"><animateTransform attributeName="transform" type="translate" values="30 0;-30 0;30 0" dur="61s" repeatCount="indefinite"/></rect>
</g>`

// The deep cavern: far walls anchored to the window's centre, not its edges, so a wide window
// shows more cavern between the near walls and the transcript instead of empty dark.
// Each half's viewBox puts the centre line at its inner edge (x 560 on the left, x 0 on the right).
function deepLeft(): string {
  return `<svg width="50%" height="100%" viewBox="0 0 560 900" preserveAspectRatio="xMaxYMid meet" overflow="visible"><g class="deep">
<path class="r" d="M-900 -50H175C150 70 172 150 148 250C128 340 168 420 140 520C120 610 160 700 138 790C128 850 150 900 140 950H-900Z"/>
<path class="edge" opacity=".6" d="M175 -50C150 70 172 150 148 250C128 340 168 420 140 520C120 610 160 700 138 790C128 850 150 900 140 950"/>
<path class="strata" d="M-200 210C-60 200 60 225 160 212M-200 600C-40 590 80 612 150 600"/>
<path class="r2" d="M150 0L170 70L184 0ZM210 0L222 44L236 0ZM262 0L270 30L282 0Z"/>
<path class="k" d="M84 362L90 320L108 304L126 318L130 362Z"/><circle class="glow gl2" cx="108" cy="350" r="40" fill="url(#fireGlow)"/>
<path class="k" d="M66 720L74 670L96 652L118 670L124 720Z"/>
<path class="deck" opacity=".6" d="M146 470L250 476"/>
${beam(176, 474, 168, 580, 3)}${beam(226, 476, 236, 560, 3)}${beam(248, 477, 244, 500, 2)}
<path class="rope" d="M250 476C254 514 246 548 252 590"/>
</g></svg>`
}

function deepRight(): string {
  return `<svg x="50%" width="50%" height="100%" viewBox="0 0 560 900" preserveAspectRatio="xMinYMid meet" overflow="visible"><g class="deep">
<path class="r" d="M1460 -50H390C412 80 392 170 420 270C440 360 400 450 424 550C444 640 404 730 428 820C436 870 418 910 425 950H1460Z"/>
<path class="edge" opacity=".6" d="M390 -50C412 80 392 170 420 270C440 360 400 450 424 550C444 640 404 730 428 820C436 870 418 910 425 950"/>
<path class="strata" d="M420 300C560 290 700 310 900 298M430 700C600 690 760 712 900 700"/>
<path class="r2" d="M300 0L314 52L326 0ZM350 0L360 80L374 0ZM408 0L416 36L428 0Z"/>
<path class="k" d="M448 260L454 216L474 200L494 216L500 260Z"/><circle class="glow gl3" cx="474" cy="248" r="40" fill="url(#fireGlow)"/>
<path class="k" d="M452 640L460 592L484 576L506 592L512 640Z"/>
${beam(372, 900, 380, 520, 4)}${beam(412, 900, 410, 520, 4)}${beam(380, 860, 410, 760, 2)}${beam(410, 760, 378, 660, 2)}${beam(378, 660, 410, 560, 2)}
<path class="deck" opacity=".6" d="M352 520L432 516"/>
<path class="pipe" opacity=".6" d="M436 380H520V300H700"/><circle class="glow pu2" cx="520" cy="380" r="26" fill="url(#warpGlow)"/>
</g></svg>`
}

// The centre fade, anchored to the window's centre and scaled by its height like the walls,
// so it covers the transcript column at any width. The 2-unit viewBox makes the scale height/900.
const FADE = `<svg width="100%" height="100%" viewBox="-1 0 2 900" preserveAspectRatio="xMidYMid meet" overflow="visible"><rect x="-6000" y="-2000" width="12000" height="5000" fill="url(#fade)"/></svg>`

/** Inert: strip every SMIL animation. Running: scale every SMIL duration by the machinery speed. The eyes, wrapped
 *  in markers, are left alone: they keep their own fades and blinks. */
function pace(svg: string): string {
  return svg
    .split(/(<!--E-->[\s\S]*?<!--\/E-->)/)
    .map((part, i) => {
      if (i % 2) return part
      if (L.inert) return part.replace(/<animate(?:Transform|Motion)?[^>]*\/>/g, '')
      return part.replace(/dur="([\d.]+)s"/g, (_, n: string) => `dur="${r3(Number(n) / L.speed)}s"`)
    })
    .join('')
}

/** The whole warren as one SVG string. Pure: every call draws the same crooked shapes. */
export function buildScene(state: WarrenState = { running: false, eyes: [] }): string {
  seed = 7
  holes.clear()
  L = levelFor(state)
  EYES = state.eyes
  // Near walls first: they draw from the seeded jitter, so their shapes stay as approved.
  const left = leftWall()
  const right = rightWall()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="none">
${css()}${DEFS}
<!--layer:background-->
<rect class="bg" width="100%" height="100%"/>
<g class="scene">
<!--layer:far-cavern-->
${deepLeft()}
${deepRight()}
<!--layer:back-fog-->
${FOG_BACK}
<!--layer:near-walls-->
${left}
${right}
<!--layer:front-fog-->
${FOG_FRONT}
</g>
<!--layer:centre-fade-->
${FADE}
<!--layer:vertical-fade-->
<rect width="100%" height="100%" fill="url(#vfade)"/>
</svg>`
  return pace(svg)
}
