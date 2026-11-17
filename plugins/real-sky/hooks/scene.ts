// Today's sky as one SVG document, drawn like a page from an almanac: a smooth
// graded sky with a fine grain, one hairline arc that the sun (or, at night,
// the moon in its real phase) rides at the local hour, a few sparse stars,
// weather as thin strata, a low misty horizon of hills and a far-off skyline,
// and two faint lines of annotation in a top corner. Pure string building,
// deterministic for its input.

import { arcAt, clockText, isWaxing, moonLit, moonName, timeAt } from './phase'
import type { Phase, Weather } from './phase'

export type SceneInput = {
  phase: Phase
  /** How far through the part of the day, from 0 to 1. */
  progress: number
  weather: Weather
  /** Days since the last new moon; absent, a first-quarter moon. */
  moonAge?: number
  /** The local time to print; absent, the one the progress stands for. */
  time?: { hour: number; minute: number }
}

/** The most an Svg's source may hold. */
export const SCENE_LIMIT = 131_072

const W = 1600
const H = 1000
/** Where the sky's gradient reaches its horizon color, just behind the hills. */
const HORIZON = 920

/** A seeded random stream (mulberry32), so the same input draws the same sky. */
export function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A number with at most one decimal, as short as it prints. */
const n = (value: number) => String(Math.round(value * 10) / 10)
/** A number with at most two decimals. */
const n2 = (value: number) => String(Math.round(value * 100) / 100)
/** An opacity, to two decimals. */
const o = (value: number) => String(Math.round(Math.min(1, Math.max(0, value)) * 100) / 100)

/** Two six-digit colors mixed: `t` of the way from `a` to `b`. */
export function mix(a: string, b: string, t: number): string {
  const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16)
  let out = '#'
  for (const at of [1, 3, 5]) {
    const value = Math.round(channel(a, at) + (channel(b, at) - channel(a, at)) * t)
    out += Math.min(255, Math.max(0, value)).toString(16).padStart(2, '0')
  }
  return out
}

/** A color's lightness, from 0 to 1. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16)) as [number, number, number]
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** A color's grey of the same lightness. */
function grey(hex: string): string {
  const [r, g, b] = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16)) as [number, number, number]
  const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
  return `#${y.toString(16).padStart(2, '0').repeat(3)}`
}

// The sky ---------------------------------------------------------------------

/** Five stops of sky, zenith to horizon. */
type Stops = readonly [string, string, string, string, string]
const OFFSETS = [0, 0.3, 0.58, 0.82, 1]

const NIGHT: Stops = ['#060911', '#0a0f1a', '#0f1726', '#162236', '#213049']
const BLUE_HOUR: Stops = ['#0b101d', '#151c2f', '#2a2f47', '#4e4a5f', '#6f6170']
const ROSE: Stops = ['#24304a', '#4b5470', '#857c8e', '#c49e98', '#e3bca4']
const MORNING: Stops = ['#56708c', '#7d93aa', '#a8b5c0', '#cfcbc2', '#e2d8c8']
const NOON: Stops = ['#5a7b9a', '#7c97b0', '#a3b7c7', '#c6d2da', '#dbe0df']
const AFTERNOON: Stops = ['#5d7590', '#8296aa', '#adb5bb', '#d3c8b6', '#e2d2b6']
const GOLDEN: Stops = ['#28304b', '#4a4b67', '#866b7a', '#c88f7a', '#e6ad85']
const AFTERGLOW: Stops = ['#0e1322', '#1b2033', '#353247', '#5f4a58', '#8c665f']

/** The skies a part of the day passes through, evenly spaced over its progress. */
const KEYS: Record<Phase, readonly Stops[]> = {
  dawn: [BLUE_HOUR, ROSE, MORNING],
  day: [MORNING, NOON, NOON, AFTERNOON],
  dusk: [AFTERNOON, GOLDEN, AFTERGLOW],
  night: [NIGHT],
}

/** What the land is drawn toward, nearest layer first: the hour's darkest ink. */
const INK: Record<Phase, string> = { dawn: '#0c0e17', day: '#34475a', dusk: '#110e17', night: '#020409' }

/** The color of the light that lands on cloud. */
const LIGHT: Record<Phase, string> = { dawn: '#fbe6da', day: '#ffffff', dusk: '#fbdcc6', night: '#8d98ab' }

/** The sky at a part of the day and a progress through it, before the weather. */
export function skyAt(phase: Phase, progress: number): Stops {
  const keys = KEYS[phase]
  if (keys.length === 1) return keys[0] as Stops
  const at = Math.min(Math.max(progress, 0), 1) * (keys.length - 1)
  const i = Math.min(Math.floor(at), keys.length - 2)
  const a = keys[i] as Stops
  const b = keys[i + 1] as Stops
  return a.map((color, k) => mix(color, b[k] ?? color, at - i)) as unknown as Stops
}

/** How far a weather greys and darkens the light. */
const VEIL: Record<Weather, { grey: number; dark: number }> = {
  clear: { grey: 0, dark: 0 },
  cloudy: { grey: 0.42, dark: 0.08 },
  storm: { grey: 0.66, dark: 0.26 },
}

function weathered(hex: string, weather: Weather): string {
  const { grey: g, dark } = VEIL[weather]
  return g === 0 ? hex : mix(mix(hex, grey(hex), g), '#000000', dark)
}

/** How much of the sky is lit like day: drives the stars, the window lights and the ink of the notes. */
function daylight(phase: Phase, progress: number): number {
  if (phase === 'day') return 1
  if (phase === 'night') return 0
  const p = Math.min(Math.max(progress, 0), 1)
  return phase === 'dawn' ? Math.min(1, p * 1.4) : Math.min(1, (1 - p) * 1.4)
}

// The arc ---------------------------------------------------------------------

/** One drawing of the arc: where it stands in the frame, and which aspect shows it. */
export type Frame = { cx: number; cy: number; rx: number; ry: number; body: number; className: string }

/** Wide windows, squarish ones and tall phones each get an arc that fits what they show. */
export const FRAMES: readonly Frame[] = [
  { cx: 800, cy: 620, rx: 650, ry: 490, body: 9, className: 'rs-wide' },
  { cx: 800, cy: 560, rx: 330, ry: 390, body: 8, className: 'rs-mid' },
  { cx: 800, cy: 500, rx: 168, ry: 320, body: 7.5, className: 'rs-tall' },
]

/** A point on a frame's arc, `f` from 0 at the left foot to 1 at the right. */
export function pointOn(frame: Frame, f: number): { x: number; y: number } {
  const angle = Math.PI * (1 - Math.min(Math.max(f, 0), 1))
  return { x: frame.cx + frame.rx * Math.cos(angle), y: frame.cy - frame.ry * Math.sin(angle) }
}

/** The lit part of a moon of radius `r` at an age: the limb on its lit side, closed by the terminator. */
export function moonPath(cx: number, cy: number, r: number, age: number): string {
  const k = Math.cos((2 * Math.PI * age) / 29.530588853)
  const tx = Math.abs(k) * r
  const top = `M${n2(cx)} ${n2(cy - r)}`
  const bottom = `${n2(cx)} ${n2(cy + r)}`
  const back = `${n2(cx)} ${n2(cy - r)}`
  if (isWaxing(age)) return `${top}A${n2(r)} ${n2(r)} 0 0 1 ${bottom}A${n2(tx)} ${n2(r)} 0 0 ${k > 0 ? 0 : 1} ${back}Z`
  return `${top}A${n2(r)} ${n2(r)} 0 0 0 ${bottom}A${n2(tx)} ${n2(r)} 0 0 ${k > 0 ? 1 : 0} ${back}Z`
}

type Ink = { line: string; lineOpacity: number; body: string; dim: number; shade: string }

function body(frame: Frame, x: number, y: number, input: SceneInput, ink: Ink): string {
  const r = frame.body
  const glow = `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 7)}" fill="url(#rs-glow)"/>`
  const ring = `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r + 8)}" fill="none" stroke="${ink.body}" stroke-width=".8" opacity=".4"/>`
  if (input.phase !== 'night') {
    return `<g class="rs-sun" opacity="${o(ink.dim)}">${glow}${ring}<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${ink.body}"/></g>`
  }
  const age = input.moonAge ?? 7.4
  // The dark of the moon, faintly lit by the Earth, under the part the sun lights.
  return (
    `<g class="rs-moon" opacity="${o(ink.dim)}">${glow}${ring}` +
    `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${ink.shade}"/>` +
    `<path d="${moonPath(x, y, r, age)}" fill="${ink.body}"/></g>`
  )
}

/** The arc in one frame: the hours gone as a solid hairline, those to come dotted, a tick on each hour. */
function diagram(frame: Frame, input: SceneInput, ink: Ink): string {
  const f = arcAt(input.phase, input.progress)
  const hours = input.phase === 'night' ? 9 : 15
  const first = input.phase === 'night' ? 20 : 5
  const at = (t: number) => {
    const { x, y } = pointOn(frame, t)
    return `${n(x)} ${n(y)}`
  }
  const arc = (from: number, to: number) => `M${at(from)}A${frame.rx} ${frame.ry} 0 0 1 ${at(to)}`
  let out = `<g class="${frame.className}" stroke="${ink.line}" fill="none" stroke-width=".9">`
  if (f > 0.002) out += `<path d="${arc(0, f)}" opacity="${o(ink.lineOpacity)}"/>`
  if (f < 0.998) out += `<path d="${arc(f, 1)}" opacity="${o(ink.lineOpacity * 0.85)}" stroke-dasharray="1 6" stroke-linecap="round"/>`
  let ticks = ''
  for (let i = 0; i <= hours; i++) {
    const t = i / hours
    const angle = Math.PI * (1 - t)
    const { x, y } = pointOn(frame, t)
    // The outward normal of the ellipse at this point.
    const nx = frame.ry * Math.cos(angle)
    const ny = -frame.rx * Math.sin(angle)
    const length = Math.hypot(nx, ny)
    const long = (first + i) % 6 === 0 ? 11 : 5
    ticks += `M${n(x + (nx / length) * 2)} ${n(y + (ny / length) * 2)}l${n((nx / length) * long)} ${n((ny / length) * long)}`
  }
  out += `<path d="${ticks}" opacity="${o(ink.lineOpacity * 0.9)}"/></g>`
  const left = pointOn(frame, 0)
  const right = pointOn(frame, 1)
  const last = (first + hours) % 24
  out +=
    `<g class="${frame.className} rs-feet" fill="${ink.line}" opacity="${o(ink.lineOpacity * 1.1)}">` +
    `<text x="${n(left.x)}" y="${n(left.y + 26)}">${String(first).padStart(2, '0')}</text>` +
    `<text x="${n(right.x)}" y="${n(right.y + 26)}">${String(last).padStart(2, '0')}</text></g>`
  const now = pointOn(frame, f)
  return out + `<g class="${frame.className}">${body(frame, now.x, now.y, input, ink)}</g>`
}

// The stars -------------------------------------------------------------------

function stars(input: SceneInput): string {
  const strength = (1 - daylight(input.phase, input.progress)) * { clear: 1, cloudy: 0.4, storm: 0 }[input.weather]
  if (strength <= 0.04) return ''
  const next = random(17)
  let still = ''
  let twinkling = ''
  for (let i = 0; i < 96; i++) {
    const x = next() * W
    // Thinner toward the horizon, where the air is thick.
    const y = Math.pow(next(), 1.5) * 780
    const magnitude = Math.pow(next(), 3.2)
    const r = 0.45 + magnitude * 1.25
    const alpha = (0.28 + magnitude * 0.6 + next() * 0.12) * strength * (1 - (y / 780) * 0.55)
    const star = `<circle cx="${n(x)}" cy="${n(y)}" r="${n2(r)}" fill-opacity="${o(alpha)}"`
    if (i % 16 === 3) twinkling += `${star} style="animation-delay:-${n(next() * 9)}s"/>`
    else still += `${star}/>`
  }
  return `<g fill="#f3f1ea">${still}</g><g fill="#f3f1ea" class="rs-tws">${twinkling}</g>`
}

// The weather -----------------------------------------------------------------

/** Soft strata: ellipses that fade to nothing at their edges, a few laid together into one streak. */
function strata(input: SceneInput): string {
  const { phase, weather } = input
  const next = random(weather === 'clear' ? 41 : weather === 'cloudy' ? 53 : 67)
  const night = phase === 'night'
  let out = ''
  if (weather === 'clear') {
    // Thin high cirrus, kept to the sides of the window.
    for (let i = 0; i < 5; i++) {
      const side = i % 2 === 0 ? 0 : 1
      const x = side === 0 ? 140 + next() * 420 : 1040 + next() * 420
      const y = 190 + next() * 260
      const rx = 170 + next() * 240
      const tilt = -2.5 + next() * 3
      const alpha = (night ? 0.05 : 0.2) + next() * (night ? 0.04 : 0.16)
      let streak = ''
      for (let k = 0; k < 2; k++) {
        streak += `<ellipse cx="${n(x + (next() - 0.5) * rx * 0.6)}" cy="${n(y + k * (5 + next() * 5))}" rx="${n(rx * (0.6 + next() * 0.4))}" ry="${n(3.5 + next() * 4)}"/>`
      }
      out += `<g transform="rotate(${n(tilt)} ${n(x)} ${n(y)})" opacity="${o(alpha)}">${streak}</g>`
    }
    return `<g class="rs-drift" fill="url(#rs-wisp)">${out}</g>`
  }
  // Stratus: long low bands across the sky, heavier in a storm.
  const isStorm = weather === 'storm'
  const count = isStorm ? 10 : 7
  let flash = ''
  for (let i = 0; i < count; i++) {
    const x = 100 + next() * 1400
    const y = 150 + (i / count) * 470 + next() * 40
    const rx = 520 + next() * 420
    const ry = (isStorm ? 22 : 14) + next() * (isStorm ? 40 : 22)
    const alpha = (isStorm ? 0.42 : 0.3) + next() * 0.24
    out += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" opacity="${o(alpha)}"/>`
    // Lightning brightens one band from within, briefly.
    if (isStorm && i === 3) flash = `<ellipse class="rs-flash" cx="${n(x)}" cy="${n(y)}" rx="${n(rx * 0.8)}" ry="${n(ry * 1.3)}" fill="url(#rs-bolt)"/>`
  }
  return (
    `<rect width="${W}" height="${H}" fill="url(#rs-veil)"/>` +
    `<g class="rs-drift" fill="url(#rs-wisp)">${out}</g>` +
    flash +
    (isStorm ? `<rect class="rs-rain" x="-200" y="-200" width="${W + 400}" height="${H + 400}" fill="url(#rs-drops)"/>` : '')
  )
}

// The horizon -----------------------------------------------------------------

/** A low ridge: a few slow waves and a little roughness, as a line of `y` by `x`. */
function ridge(seed: number, base: number, height: number, rough: number): (x: number) => number {
  const next = random(seed)
  const waves = [0.0017, 0.0049, 0.0127].map((f, i) => ({ f: f * (0.8 + next() * 0.4), p: next() * 6.28, a: [1, 0.5, 0.2][i] ?? 0 }))
  const sum = waves.reduce((total, wave) => total + wave.a, 0)
  const q = next() * 6.28
  return x => {
    let y = 0
    for (const wave of waves) y += wave.a * Math.sin(x * wave.f + wave.p)
    return base - height * (0.5 + (0.5 * y) / sum) - rough * Math.abs(Math.sin(x * 0.29 + q) * Math.sin(x * 0.071))
  }
}

function land(line: (x: number) => number, fill: string): string {
  let d = `M-20 ${H}`
  for (let x = -20; x <= W + 20; x += 10) d += `L${x} ${n(line(x))}`
  return `<path d="${d}L${W + 20} ${H}Z" fill="${fill}"/>`
}

/** A far-off skyline of slender towers on the far ridge, a crane beside it, and a mast with a slow light. */
function skyline(on: (x: number) => number, fill: string, lit: number, glint: string): string {
  const next = random(311)
  // Windows draw from a stream of their own, so the towers stand the same at every hour.
  const lamp = random(733)
  let towers = ''
  let lights = ''
  let tallest = { x: 0, top: H }
  for (const cluster of [{ at: 1060, span: 330 }, { at: 268, span: 128 }]) {
    let x = cluster.at - cluster.span / 2
    while (x < cluster.at + cluster.span / 2) {
      const width = 1.6 + Math.pow(next(), 2) * 4
      const middle = 1 - Math.abs((x - cluster.at) / (cluster.span / 2))
      const height = 5 + (cluster.span > 200 ? 42 : 24) * Math.pow(middle, 0.8) * Math.pow(next(), 1.6)
      const base = on(x + width / 2) + 4
      const top = base - height - 4
      towers += `M${n(x)} ${n(base)}V${n(top)}h${n(width)}V${n(base)}Z`
      if (top < tallest.top) tallest = { x: x + width / 2, top }
      for (let y = top + 3; y < base - 6; y += 4.5) {
        if (lamp() < lit) lights += `<rect x="${n(x + 0.6 + lamp() * Math.max(0, width - 2))}" y="${n(y)}" width="1" height="1.2"/>`
      }
      x += width + 1.5 + Math.pow(next(), 2) * (middle > 0.5 ? 9 : 22)
    }
  }
  // A mast on the tallest tower, and its slow red light.
  const mast = `M${n(tallest.x)} ${n(tallest.top)}v-24`
  // A tower crane past the east end of the skyline, all hairlines.
  const cx = 1262
  const ground = on(cx) + 3
  const top = ground - 56
  const crane =
    `M${cx} ${n(ground)}V${n(top - 9)}` +
    `M${cx - 16} ${n(top)}H${cx + 62}` +
    `M${cx} ${n(top - 9)}L${cx + 62} ${n(top)}M${cx} ${n(top - 9)}L${cx - 16} ${n(top)}` +
    `M${cx + 44} ${n(top)}v20`
  return (
    `<path d="${towers}" fill="${fill}"/>` +
    `<path d="${mast}${crane}" stroke="${fill}" stroke-width=".8" fill="none"/>` +
    `<rect x="${cx - 16}" y="${n(top - 1)}" width="7" height="3" fill="${fill}"/>` +
    (lights === '' ? '' : `<g fill="${glint}" opacity=".8">${lights}</g>`) +
    `<circle class="rs-beacon" cx="${n(tallest.x)}" cy="${n(tallest.top - 24)}" r="1.5" fill="#e8705f"/>`
  )
}

function horizon(input: SceneInput, stops: Stops): string {
  const sky = stops[4]
  const ink = weathered(INK[input.phase], input.weather)
  const far = ridge(7, 914, 34, 0.5)
  const mid = ridge(19, 952, 30, 1)
  const near = ridge(29, 986, 22, 2)
  const dark = 1 - daylight(input.phase, input.progress)
  const lit = input.weather === 'storm' ? Math.max(0.05, dark * 0.2) : dark * 0.17
  return (
    `<g class="rs-low">` +
    land(far, mix(sky, ink, 0.16)) +
    skyline(far, mix(sky, ink, 0.26), lit, '#f6d7a2') +
    `<rect y="880" width="${W}" height="120" fill="url(#rs-mist)"/>` +
    land(mid, mix(sky, ink, 0.36)) +
    `<rect y="930" width="${W}" height="70" fill="url(#rs-mist)" opacity=".6"/>` +
    land(near, mix(sky, ink, 0.58)) +
    '</g>'
  )
}

// The notes -------------------------------------------------------------------

const WEATHER_WORDS: Record<Weather, string> = { clear: 'clear sky', cloudy: 'overcast', storm: 'storm' }

/** Two faint lines in the top-left corner: the hour, then the weather and, after dark, the moon. */
function notes(input: SceneInput, ink: string, opacity: number): string {
  const { hour, minute } = input.time ?? timeAt(input.phase, input.progress)
  const age = input.moonAge ?? 7.4
  const isDark = daylight(input.phase, input.progress) < 0.5
  const moon = isDark ? ` · ${moonName(age)} ${Math.round(moonLit(age) * 100)}%` : ''
  const first = `${input.phase} · ${clockText(hour, minute)}`
  const second = `${WEATHER_WORDS[input.weather]}${moon}`
  return (
    `<g class="rs-note" fill="${ink}" opacity="${o(opacity)}">` +
    `<path d="M64 52h22" stroke="${ink}" stroke-width=".8"/>` +
    `<text x="64" y="78" class="rs-n1">${first.toUpperCase()}</text>` +
    `<text x="64" y="100" class="rs-n2">${second.toUpperCase()}</text></g>`
  )
}

// The document ----------------------------------------------------------------

/** Fine slanted rain, scattered unevenly over one tile. */
const DROPS = (() => {
  const next = random(97)
  let d = ''
  for (let i = 0; i < 14; i++) {
    const length = 12 + next() * 16
    d += `M${n(next() * 192)} ${n(next() * 288)}l${n(-length * 0.25)} ${n(length)}`
  }
  return d
})()

const MONO = "ui-monospace,'SF Mono','Cascadia Mono',Consolas,Menlo,monospace"

const STYLE =
  '<style>' +
  `text{font-family:${MONO}}` +
  '.rs-n1{font-size:12.5px;letter-spacing:3.4px}.rs-n2{font-size:10.5px;letter-spacing:2.8px;opacity:.75}' +
  '.rs-feet text{font-size:10.5px;letter-spacing:1.5px;text-anchor:middle}' +
  '.rs-drift{animation:rs-drift 240s ease-in-out infinite alternate}' +
  '@keyframes rs-drift{from{transform:translateX(-36px)}to{transform:translateX(48px)}}' +
  '.rs-tws circle{animation:rs-tw 9s ease-in-out infinite}' +
  '@keyframes rs-tw{0%,100%{opacity:1}50%{opacity:.3}}' +
  '.rs-beacon{animation:rs-beacon 4s steps(1) infinite}' +
  '@keyframes rs-beacon{0%,9%{opacity:.85}10%,100%{opacity:.12}}' +
  '.rs-rain{animation:rs-rain 2.4s linear infinite}' +
  '@keyframes rs-rain{to{transform:translate(-72px,288px)}}' +
  '.rs-flash{opacity:0;animation:rs-flash 14s linear infinite}' +
  '@keyframes rs-flash{0%,60%,61.6%,62.4%,63.6%,100%{opacity:0}60.5%{opacity:.85}62.9%{opacity:.45}}' +
  '.rs-mid,.rs-tall{display:none}' +
  '@media (max-aspect-ratio:4/3){.rs-wide{display:none}.rs-mid{display:inline}.rs-note{transform:translateX(200px)}}' +
  '@media (max-aspect-ratio:1/1){.rs-note{transform:translateX(270px)}}' +
  '@media (max-aspect-ratio:3/4){.rs-mid{display:none}.rs-tall{display:inline}.rs-note{transform:translateX(400px)}}' +
  // A tall phone shows a narrow middle strip: keep the notes just inside its left edge.
  '@media (max-aspect-ratio:2/3){.rs-note{transform:translateX(444px)}}' +
  '@media (max-aspect-ratio:3/5){.rs-note{transform:translateX(478px)}}' +
  '@media (max-aspect-ratio:1/2){.rs-note{transform:translateX(528px)}}' +
  '@media (max-aspect-ratio:9/20){.rs-note{transform:translateX(552px)}}' +
  '@media (min-aspect-ratio:2/1){.rs-low{transform:translateY(-100px)}.rs-note{transform:translateY(100px)}}' +
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}.rs-flash{opacity:0!important}}' +
  '</style>'

function inkOf(input: SceneInput, stops: Stops): Ink {
  const { phase, weather } = input
  const isLight = daylight(phase, input.progress) >= 0.5
  const dim = { clear: 1, cloudy: 0.5, storm: 0.2 }[weather]
  const sun = phase === 'day' ? '#fffaf0' : phase === 'dawn' ? '#ffe6cf' : '#ffd9b8'
  return {
    line: phase === 'night' ? '#c9d3e6' : isLight ? '#ffffff' : '#f2e5da',
    lineOpacity: phase === 'night' ? 0.26 : isLight ? 0.44 : 0.28,
    body: phase === 'night' ? '#eef0ee' : sun,
    dim,
    shade: mix(stops[0], '#8b97ab', 0.22),
  }
}

/** The whole sky as one `<svg>` document, under SCENE_LIMIT characters. */
export function buildScene(input: SceneInput): string {
  const stops = skyAt(input.phase, input.progress).map(color => weathered(color, input.weather)) as unknown as Stops
  const ink = inkOf(input, stops)
  const isLight = daylight(input.phase, input.progress) >= 0.5
  // The notes sit on the top of the sky: dark ink on a pale one, light on a dark one.
  const isPaleTop = luminance(stops[0]) > 0.36
  const noteInk = isPaleTop ? '#1c2a38' : '#ece7df'
  const glow = input.phase === 'night' ? '#c6d0e4' : ink.body
  const cloud = input.weather === 'clear' ? LIGHT[input.phase] : weathered(mix(stops[1], LIGHT[input.phase], 0.4), input.weather)
  const sky = OFFSETS.map((offset, i) => `<stop offset="${offset}" stop-color="${stops[i]}"/>`).join('')
  const defs =
    '<defs>' +
    `<linearGradient id="rs-sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${HORIZON}">${sky}</linearGradient>` +
    `<radialGradient id="rs-glow"><stop offset="0" stop-color="${glow}" stop-opacity="${input.phase === 'night' ? '.16' : '.3'}"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="rs-wisp"><stop offset="0" stop-color="${cloud}"/><stop offset=".55" stop-color="${cloud}" stop-opacity=".45"/><stop offset="1" stop-color="${cloud}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="rs-bolt"><stop offset="0" stop-color="#e8ecf6" stop-opacity=".7"/><stop offset="1" stop-color="#e8ecf6" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="rs-veil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(stops[0], '#000000', 0.2)}" stop-opacity="${input.weather === 'storm' ? '.6' : '.35'}"/><stop offset=".9" stop-color="${stops[3]}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="rs-mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${stops[4]}" stop-opacity="0"/><stop offset=".45" stop-color="${stops[4]}" stop-opacity=".5"/><stop offset="1" stop-color="${stops[4]}" stop-opacity="0"/></linearGradient>` +
    `<pattern id="rs-drops" width="192" height="288" patternUnits="userSpaceOnUse"><path d="${DROPS}" stroke="${mix(stops[3], '#ffffff', 0.45)}" stroke-width=".6" opacity=".2"/></pattern>` +
    // Film grain: a tile of fine noise laid over the sky so its gradient never bands.
    '<filter id="rs-noise" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="5" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>' +
    '<pattern id="rs-grain" width="256" height="256" patternUnits="userSpaceOnUse"><rect width="256" height="256" filter="url(#rs-noise)"/></pattern>' +
    '</defs>'
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">` +
    STYLE +
    defs +
    `<rect width="${W}" height="${H}" fill="url(#rs-sky)"/>` +
    stars(input) +
    FRAMES.map(frame => diagram(frame, input, ink)).join('') +
    strata(input) +
    horizon(input, stops) +
    `<rect width="${W}" height="${H}" fill="url(#rs-grain)" opacity="${isLight ? '.07' : '.09'}" style="mix-blend-mode:overlay"/>` +
    notes(input, noteInk, isPaleTop ? 0.52 : 0.48) +
    '</svg>'
  )
}
