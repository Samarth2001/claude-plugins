// The night sky as one SVG document: a deep ground, a faint galactic band, a
// fixed field of background stars, then the project's own stars, the lines of
// its constellations, their names, and a meteor when tests passed. Pure string
// building, deterministic for its input: time comes in as `now`.

import { REVEAL_MS, SAFE, baseName, constellationName, cut, joinNear, namesake, parentOf, unit } from './sky'
import type { Constellation, Placed, Point, SpectralClass, Star } from './sky'

export type SceneInput = {
  placed: Placed[]
  constellations: Constellation[]
  /** Epoch ms now. Things born or drawn within REVEAL_MS before it animate in. */
  now: number
  /** A meteor crosses once. */
  meteor: boolean
  /** The project folder's name: the label of a constellation of root-level files. */
  projectName: string
}

/** The most an Svg's source may hold. */
export const SCENE_LIMIT = 131_072
const DAY = 86_400_000
const OLD_MS = 30 * DAY

const CLASSES: readonly SpectralClass[] = ['B', 'A', 'C', 'F', 'G', 'K', 'M']

/** Core and halo color of each spectral class. */
export const CLASS_COLORS: Record<SpectralClass, { core: string; halo: string }> = {
  B: { core: '#b4caff', halo: '#7fa2ff' },
  A: { core: '#dbe5ff', halo: '#a9c0ff' },
  C: { core: '#c4f0ff', halo: '#86d9f5' },
  F: { core: '#ffffff', halo: '#dfe6ff' },
  G: { core: '#fff3d9', halo: '#ffdf9e' },
  K: { core: '#ffd9a3', halo: '#ffb968' },
  M: { core: '#ffc6ad', halo: '#ff9c7a' },
}

const LINE = '#aebfff'
const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"

/** A number with at most one decimal, as short as it prints. */
function n(value: number): string {
  const rounded = Math.round(value * 10) / 10
  const text = String(rounded === 0 ? 0 : rounded)
  return text.startsWith('0.') ? text.slice(1) : text.startsWith('-0.') ? `-${text.slice(2)}` : text
}

/** An opacity, to two decimals: fine steps of light matter more than a character. */
function o(value: number): string {
  const text = String(Math.round(Math.min(1, Math.max(0, value)) * 100) / 100)
  return text.startsWith('0.') ? text.slice(1) : text
}

/** Text from a file path, safe inside an element or an attribute. */
export function escapeText(text: string): string {
  return text
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * The delay that starts an endless animation where it would stand had it run
 * since the epoch, so a fresh document picks up the loop where the last left it.
 */
export function loopDelay(now: number, cycleSeconds: number, phaseSeconds = 0): number {
  const at = (now / 1000 + phaseSeconds) % cycleSeconds
  return -((at + cycleSeconds) % cycleSeconds)
}

/** A star's brightness: 1 edit is 1, 3 is 2, 7 is 3, 15 is 4, 31 or more is 5. */
export const magnitude = (edits: number) => Math.min(5, Math.log2(1 + edits))
// Light is rare: a file edited once is a crisp small point with a slight glow,
// and the glow grows in reach and strength with every doubling of edits, so the
// eye finds the few bright stars first.
export const coreRadius = (edits: number) => 0.85 + 0.65 * magnitude(edits)
const haloRadius = (edits: number) => coreRadius(edits) * (2.4 + magnitude(edits))
const haloStrength = (edits: number) => Math.min(1, 0.3 + 0.14 * magnitude(edits))

/** Four thin spikes, as two diamonds; with `diagonal`, the shorter four at 45 degrees. */
function spikes(edits: number, diagonal: boolean): string {
  const m = magnitude(edits)
  const length = coreRadius(edits) * (5 + 1.6 * m) * (diagonal ? 0.45 : 1)
  const width = 0.42
  if (!diagonal) {
    return `M0-${n(length)}L${n(width)} 0 0 ${n(length)}-${n(width)} 0ZM-${n(length)} 0 0-${n(width)} ${n(length)} 0 0 ${n(width)}Z`
  }
  const d = length / Math.SQRT2
  const w = width / Math.SQRT2
  return (
    `M-${n(d)}-${n(d)}L${n(w)}-${n(w)} ${n(d)} ${n(d)}-${n(w)} ${n(w)}Z` +
    `M${n(d)}-${n(d)}L${n(w)} ${n(w)}-${n(d)} ${n(d)}-${n(w)}-${n(w)}Z`
  )
}

const hasSpikes = (edits: number) => magnitude(edits) >= 3.2
const hasDiagonals = (edits: number) => magnitude(edits) >= 4.6
/** Stars of 31 edits and more look the same, so one shape serves them all. */
const shapeKey = (edits: number) => Math.min(31, Math.max(1, Math.round(edits)))

/** A star's parts at the origin, each with the class that colors it. */
function starParts(edits: number, animate?: { halo: string; core: string; spikes: string }): string {
  const tag = (base: string, extra: string | undefined) => (extra === undefined ? base : `${base} ${extra}`)
  const style = (delay: string | undefined) => (delay === undefined ? '' : ` style="animation-delay:${delay}"`)
  const classes = animate === undefined ? undefined : { halo: 'cn-ih', core: 'cn-ic', spikes: 'cn-ik' }
  let out = `<circle class="${tag('cn-h', classes?.halo)}" r="${n(haloRadius(edits))}" fill-opacity="${o(haloStrength(edits))}"${style(animate?.halo)}/>`
  if (hasSpikes(edits)) {
    out += `<path class="${tag('cn-k', classes?.spikes)}" d="${spikes(edits, false)}"${style(animate?.spikes)}/>`
    if (hasDiagonals(edits)) {
      out += `<path class="${tag('cn-k cn-kd', classes?.spikes)}" d="${spikes(edits, true)}"${style(animate?.spikes)}/>`
    }
  }
  return out + `<circle class="${tag('cn-c', classes?.core)}" r="${n(coreRadius(edits))}"${style(animate?.core)}/>`
}

type Motion = 'new' | 'brighter' | 'rest'

function motionOf(star: Star, now: number): Motion {
  if (now - star.born < REVEAL_MS) return 'new'
  if (now - star.touched < REVEAL_MS) return 'brighter'
  return 'rest'
}

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`

/** The tooltip: the path, its head cut where it is very long, and the edits. */
function title(star: Placed): string {
  const path = star.path.length > 80 ? `…${star.path.slice(-79)}` : star.path
  return `<title>${escapeText(`${path} · ${plural(star.star.edits, 'edit')}`)}</title>`
}

// Seeds for the field of background stars: the same sky in every build.
const FIELD_COUNT = 440
const TWINKLERS = 26
const FIELD_SIZES = [
  { width: 1.1, opacity: 0.42 },
  { width: 1.7, opacity: 0.66 },
  { width: 2.5, opacity: 0.9 },
] as const
const FIELD_TINTS = ['#dfe7ff', '#ffffff', '#ffe9cf', '#b9ccff'] as const

/** The band runs through the middle of the picture, turned 31 degrees up to the right. */
const BAND_ANGLE = -31
const BAND_CENTER = { x: 800, y: 500 }

/** Where a point lies along and across the band. */
function bandFrame(x: number, y: number): { along: number; across: number } {
  const turn = (-BAND_ANGLE * Math.PI) / 180
  const dx = x - BAND_CENTER.x
  const dy = y - BAND_CENTER.y
  return { along: dx * Math.cos(turn) - dy * Math.sin(turn), across: dx * Math.sin(turn) + dy * Math.cos(turn) }
}

type FieldStar = { x: number; y: number; size: 0 | 1 | 2; tint: 0 | 1 | 2 | 3; seed: string }

/** About 440 stars, richer inside the band, three sizes and four tints. */
function fieldStars(): FieldStar[] {
  const stars: FieldStar[] = []
  for (let index = 0; stars.length < FIELD_COUNT && index < 4000; index += 1) {
    const seed = `field-${index}`
    const x = 4 + unit(seed, 11) * 1592
    const y = 4 + unit(seed, 12) * 992
    const { across } = bandFrame(x, y)
    // Inside the band every star stays; outside it, about half.
    const inBand = Math.abs(across) < 70 + 90 * unit(seed, 16)
    if (!inBand && unit(seed, 13) >= 0.55) continue
    const pick = unit(seed, 14)
    const size = pick < 0.68 ? 0 : pick < 0.92 ? 1 : 2
    const hue = unit(seed, 15)
    const tint = hue < 0.6 ? 0 : hue < 0.82 ? 1 : hue < 0.94 ? 2 : 3
    stars.push({ x, y, size, tint, seed })
  }
  return stars
}

const FIELD = fieldStars()

/** Faint unresolved stars that crowd the band's core, so it reads as starlight and not as mist. */
function bandDust(): Point[] {
  const turn = (BAND_ANGLE * Math.PI) / 180
  const points: Point[] = []
  for (let index = 0; index < 300; index += 1) {
    const seed = `dust-${index}`
    const along = (unit(seed, 21) - 0.5) * 1900
    // Three uniform draws summed: thick in the middle of the band, thin at its edges.
    // and wider in some stretches than others, as the glow is.
    const width = 70 + 50 * unit(`stretch-${Math.floor((along + 950) / 240)}`, 25)
    const across = (unit(seed, 22) + unit(seed, 23) + unit(seed, 24) - 1.5) * width
    const x = BAND_CENTER.x + along * Math.cos(turn) - across * Math.sin(turn)
    const y = BAND_CENTER.y + along * Math.sin(turn) + across * Math.cos(turn)
    if (x > 2 && x < 1598 && y > 2 && y < 998) points.push({ x, y })
  }
  return points
}

const BAND_DUST = bandDust()

/** Zero-length strokes with round caps: one path draws a whole set of dots. */
function dots(points: readonly Point[]): string {
  return points.map(point => `M${n(point.x)} ${n(point.y)}h0`).join('')
}

function fieldLayer(now: number): string {
  // The twinklers are picked from the medium and large stars, spread through the list.
  const bright = FIELD.filter(star => star.size > 0)
  const step = bright.length / TWINKLERS
  const twinklers = new Set(Array.from({ length: TWINKLERS }, (_, index) => bright[Math.floor(index * step)]))
  let out = `<path stroke="#c8d4ff" stroke-width="1" stroke-opacity=".42" d="${dots(BAND_DUST)}"/>`
  for (const [size, look] of FIELD_SIZES.entries()) {
    for (const [tint, color] of FIELD_TINTS.entries()) {
      const points = FIELD.filter(star => star.size === size && star.tint === tint && !twinklers.has(star))
      if (points.length === 0) continue
      out += `<path stroke="${color}" stroke-width="${n(look.width)}" stroke-opacity="${look.opacity}" d="${dots(points)}"/>`
    }
  }
  for (const star of twinklers) {
    if (star === undefined) continue
    // Each eases one way and back: a whole loop is twice its period.
    const period = Math.round((3.6 + 3.9 * unit(star.seed, 17)) * 10) / 10
    const phase = unit(star.seed, 18) * period * 2
    const look = FIELD_SIZES[star.size]
    out +=
      `<circle class="cn-tw" cx="${n(star.x)}" cy="${n(star.y)}" r="${n(look.width / 2)}" fill="${FIELD_TINTS[star.tint]}" ` +
      `fill-opacity="${look.opacity}" style="animation-duration:${n(period)}s;animation-delay:${n(loopDelay(now, period * 2, phase))}s"/>`
  }
  return out
}

// The band: soft ellipses along its axis, staggered so the edge is uneven, and
// a dark lane of dust through its middle. Each is a radial gradient that falls
// to nothing, scaled by its fill opacity: no edge anywhere.
const BAND_GLOWS = [
  // A broad, very faint wash under the whole band, so its light thins out instead of stopping.
  { along: 0, across: 0, rx: 980, ry: 150, color: 'cn-gb', opacity: 0.035 },
  // Then lobes of differing width along it, each a little off the axis, so the edge wanders.
  { along: -720, across: 34, rx: 300, ry: 64, color: 'cn-gb', opacity: 0.06 },
  { along: -470, across: 6, rx: 330, ry: 104, color: 'cn-gv', opacity: 0.055 },
  { along: -230, across: -18, rx: 260, ry: 58, color: 'cn-gb', opacity: 0.09 },
  { along: -40, across: 22, rx: 320, ry: 92, color: 'cn-gb', opacity: 0.075 },
  { along: 200, across: -6, rx: 280, ry: 120, color: 'cn-gv', opacity: 0.05 },
  { along: 400, across: -30, rx: 300, ry: 66, color: 'cn-gb', opacity: 0.08 },
  { along: 640, across: 12, rx: 310, ry: 86, color: 'cn-gv', opacity: 0.055 },
  { along: 860, across: -12, rx: 240, ry: 48, color: 'cn-gb', opacity: 0.045 },
] as const

// The dark lane: short soft lobes, each its own length and a few degrees off
// the axis, stepping across the band's middle rather than ruling a line.
const DUST_LANES = [
  { along: -560, across: 10, rx: 170, ry: 9, turn: 4, opacity: 0.2 },
  { along: -330, across: -4, rx: 240, ry: 13, turn: -3, opacity: 0.26 },
  { along: -90, across: 14, rx: 120, ry: 8, turn: 6, opacity: 0.18 },
  { along: 70, across: -2, rx: 200, ry: 11, turn: -5, opacity: 0.24 },
  { along: 300, across: 9, rx: 150, ry: 10, turn: 3, opacity: 0.2 },
  { along: 510, across: -8, rx: 230, ry: 12, turn: -2, opacity: 0.22 },
  { along: 760, across: 4, rx: 110, ry: 7, turn: 5, opacity: 0.16 },
] as const

function bandLayer(): string {
  const glows = BAND_GLOWS.map(
    glow =>
      `<ellipse cx="${n(BAND_CENTER.x + glow.along)}" cy="${n(BAND_CENTER.y + glow.across)}" rx="${glow.rx}" ry="${glow.ry}" fill="url(#${glow.color})" fill-opacity="${glow.opacity}"/>`,
  ).join('')
  const lanes = DUST_LANES.map(lane => {
    const x = n(BAND_CENTER.x + lane.along)
    const y = n(BAND_CENTER.y + lane.across)
    return `<ellipse cx="${x}" cy="${y}" rx="${lane.rx}" ry="${lane.ry}" transform="rotate(${lane.turn} ${x} ${y})" fill="url(#cn-gd)" fill-opacity="${lane.opacity}"/>`
  }).join('')
  return `<g transform="rotate(${BAND_ANGLE} ${BAND_CENTER.x} ${BAND_CENTER.y})">${glows}${lanes}</g>`
}

/** A soft falloff in five stops, near a Gaussian: what makes a glow read as light and not as a disc. */
function glowStops(color: string): string {
  const stops: Array<[number, number]> = [[0, 1], [0.22, 0.82], [0.45, 0.48], [0.7, 0.17], [0.88, 0.04], [1, 0]]
  return stops.map(([offset, opacity]) => `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`).join('')
}

function defs(classes: ReadonlySet<SpectralClass>, shapes: readonly number[]): string {
  let out =
    '<linearGradient id="cn-ground" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#04060e"/><stop offset=".45" stop-color="#070b1b"/>' +
    '<stop offset=".8" stop-color="#0c1230"/><stop offset="1" stop-color="#131a3b"/></linearGradient>' +
    `<radialGradient id="cn-air1">${glowStops('#2b2f72')}</radialGradient>` +
    `<radialGradient id="cn-air2">${glowStops('#0f3b4d')}</radialGradient>` +
    `<radialGradient id="cn-gb">${glowStops('#93a6ff')}</radialGradient>` +
    `<radialGradient id="cn-gv">${glowStops('#c9b8ff')}</radialGradient>` +
    `<radialGradient id="cn-gd">${glowStops('#060917')}</radialGradient>` +
    '<radialGradient id="cn-vig" r=".7"><stop offset=".55" stop-color="#02030a" stop-opacity="0"/>' +
    '<stop offset=".8" stop-color="#02030a" stop-opacity=".22"/><stop offset="1" stop-color="#02030a" stop-opacity=".6"/></radialGradient>' +
    '<linearGradient id="cn-tail" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#dfe7ff" stop-opacity=".85"/>' +
    '<stop offset=".3" stop-color="#dfe7ff" stop-opacity=".32"/><stop offset="1" stop-color="#dfe7ff" stop-opacity="0"/></linearGradient>' +
    '<radialGradient id="cn-head"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>'
  for (const type of classes) {
    const { core, halo } = CLASS_COLORS[type]
    // The halo: bright at the heart, a third as bright a third of the way out, then a long faint tail.
    out +=
      `<radialGradient id="cn-h${type}"><stop offset="0" stop-color="${halo}" stop-opacity=".34"/>` +
      `<stop offset=".12" stop-color="${halo}" stop-opacity=".22"/><stop offset=".35" stop-color="${halo}" stop-opacity=".11"/>` +
      `<stop offset=".62" stop-color="${halo}" stop-opacity=".035"/><stop offset="1" stop-color="${halo}" stop-opacity="0"/></radialGradient>` +
      // The spikes: one radial ramp over a spike pair's box, full at the core and none at the tips.
      `<radialGradient id="cn-k${type}"><stop offset="0" stop-color="${core}" stop-opacity=".55"/>` +
      `<stop offset=".4" stop-color="${core}" stop-opacity=".22"/><stop offset="1" stop-color="${core}" stop-opacity="0"/></radialGradient>`
  }
  for (const key of shapes) out += `<g id="cn-m${key}">${starParts(key)}</g>`
  return out
}

const KEYFRAMES =
  '@keyframes cn-tw{from{opacity:1}to{opacity:.55}}' +
  '@keyframes cn-ignite{0%{transform:scale(0);opacity:0}30%{transform:scale(1.7);opacity:1}100%{transform:scale(1);opacity:1}}' +
  '@keyframes cn-fade{from{opacity:0}to{opacity:1}}' +
  '@keyframes cn-grow{from{transform:scale(0)}to{transform:scale(1)}}' +
  '@keyframes cn-pulse{0%,100%{transform:scale(1)}40%{transform:scale(1.35)}}' +
  '@keyframes cn-draw{from{stroke-dashoffset:1.02}to{stroke-dashoffset:0}}' +
  '@keyframes cn-br{from{stroke-opacity:.58}to{stroke-opacity:.42}}' +
  '@keyframes cn-meteor{0%{transform:translateX(0);opacity:0}12%{opacity:1}75%{opacity:1}100%{transform:translateX(620px);opacity:0}}'

function style(classes: ReadonlySet<SpectralClass>): string {
  const vars = [...classes]
    .map(type => `.cn-${type}{--h:url(#cn-h${type});--k:url(#cn-k${type});--c:${CLASS_COLORS[type].core}}`)
    .join('')
  return (
    '<style>' +
    '.cn-h{fill:var(--h)}.cn-c{fill:var(--c)}.cn-k{fill:var(--k)}.cn-kd{fill-opacity:.55}' +
    '.cn-tw{animation:cn-tw ease-in-out infinite alternate}' +
    '.cn-ih,.cn-ik,.cn-pulse{transform-box:fill-box;transform-origin:center}' +
    '.cn-ih{animation:cn-ignite 1.1s cubic-bezier(.2,.8,.2,1) both}' +
    '.cn-ic{animation:cn-fade 350ms ease-out both}' +
    '.cn-ik{animation:cn-grow 700ms cubic-bezier(.2,.8,.2,1) both}' +
    '.cn-pulse{animation:cn-pulse 900ms ease-in-out both}' +
    '.cn-dr{stroke-dasharray:1 2;animation:cn-draw 1.2s ease-in-out both}' +
    '.cn-br{animation:cn-br 7s ease-in-out infinite alternate}' +
    '.cn-dr.cn-br{animation:cn-draw 1.2s ease-in-out both,cn-br 7s ease-in-out infinite alternate}' +
    '.cn-nl{animation:cn-fade 900ms ease both;animation-delay:1.8s}' +
    '.cn-met{opacity:0;animation:cn-meteor 1250ms cubic-bezier(.3,0,.2,1) 1.5s both}' +
    vars +
    KEYFRAMES +
    // Asked for less motion: everything as it rests, finished, and no meteor.
    '@media (prefers-reduced-motion:reduce){*{animation:none!important}.cn-met{opacity:0}}' +
    '</style>'
  )
}

type Edge = { from: Point; to: Point }

/** A line between two stars, stopping short of both as an atlas draws it; none where they sit too close for one. */
function edgeOf(one: Placed, other: Placed): Edge | undefined {
  const length = Math.hypot(other.x - one.x, other.y - one.y)
  const start = coreRadius(one.star.edits) + 4.5
  const end = coreRadius(other.star.edits) + 4.5
  if (length - start - end < 6) return undefined
  const ux = (other.x - one.x) / length
  const uy = (other.y - one.y) / length
  return {
    from: { x: one.x + ux * start, y: one.y + uy * start },
    to: { x: other.x - ux * end, y: other.y - uy * end },
  }
}

const segment = (edge: Edge) => `M${n(edge.from.x)} ${n(edge.from.y)}L${n(edge.to.x)} ${n(edge.to.y)}`

/**
 * A constellation as drawn: its stars still in the sky, the lines that join
 * near ones (in the order its tree grew) and the figures they make. Files far
 * apart form separate figures, and a star left alone is drawn unlinked.
 */
type Drawn = {
  constellation: Constellation
  stars: Placed[]
  edges: Edge[]
  /** Its largest figure, where the name goes: ties go to the one holding the most-edited star. */
  main: Placed[]
  rank: number
  isNew: boolean
}

/** Whether two lines cross. */
function crosses(one: Edge, other: Edge): boolean {
  const side = (a: Point, b: Point, c: Point) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))
  return (
    side(one.from, one.to, other.from) * side(one.from, one.to, other.to) < 0 &&
    side(other.from, other.to, one.from) * side(other.from, other.to, one.to) < 0
  )
}

/** What the newer constellations already drew: the pairs of stars they join, how many lines meet at each star, and the lines. */
type Taken = { pairs: Set<string>; degree: Map<string, number>; lines: Edge[] }

/** The most lines that meet at one star, across every figure. */
const MAX_DEGREE = 3

/**
 * Drawn newest first. As in an atlas, figures never cross and no star is a
 * hub: a line that would cross a newer one's, join two stars a newer one joins
 * already, or meet a star that has its three lines is left out, so a file
 * edited turn after turn does not gather a burst of lines.
 */
function drawn(constellation: Constellation, stars: Placed[], rank: number, now: number, taken: Taken): Drawn {
  const { edges, groups } = joinNear(stars)
  const lines = edges.flatMap(([a, b]) => {
    const one = stars[a]
    const other = stars[b]
    if (one === undefined || other === undefined) return []
    const pair = one.path < other.path ? `${one.path}
${other.path}` : `${other.path}
${one.path}`
    const busy = (star: Placed) => (taken.degree.get(star.path) ?? 0) >= MAX_DEGREE
    const edge = taken.pairs.has(pair) || busy(one) || busy(other) ? undefined : edgeOf(one, other)
    if (edge === undefined || taken.lines.some(line => crosses(edge, line))) return []
    taken.pairs.add(pair)
    for (const star of [one, other]) taken.degree.set(star.path, (taken.degree.get(star.path) ?? 0) + 1)
    return [edge]
  })
  taken.lines.push(...lines)
  const figures = groups.map(group => group.flatMap(index => stars[index] ?? []))
  const brightest = (figure: Placed[]) => Math.max(...figure.map(star => star.star.edits))
  const main = [...figures].sort((a, b) => b.length - a.length || brightest(b) - brightest(a))[0] ?? []
  return { constellation, stars, edges: lines, main, rank, isNew: now - constellation.at < REVEAL_MS }
}

/** One path per constellation, so its opacity is set once; a new one draws its lines in, one after another. */
function linesLayer(constellations: readonly Drawn[], now: number): string {
  let out = ''
  for (const figure of constellations) {
    if (figure.edges.length === 0) continue
    const opacity = o(Math.max(0.16, 0.58 - 0.06 * figure.rank))
    // Only the newest breathes.
    const breathes = figure.rank === 0
    const breath = n(loopDelay(now, 14))
    if (figure.isNew) {
      figure.edges.forEach((edge, index) => {
        const draw = `${900 + 220 * index}ms`
        const delays = breathes ? `animation-delay:${draw},${breath}s` : `animation-delay:${draw}`
        out += `<path class="cn-dr${breathes ? ' cn-br' : ''}" pathLength="1" stroke-opacity="${opacity}" d="${segment(edge)}" style="${delays}"/>`
      })
      continue
    }
    const attributes = breathes ? ` class="cn-br" style="animation-delay:${breath}s"` : ''
    out += `<path${attributes} stroke-opacity="${opacity}" d="${figure.edges.map(segment).join('')}"/>`
  }
  return out === '' ? '' : `<g fill="none" stroke="${LINE}" stroke-width=".9" stroke-linecap="round">${out}</g>`
}

type Box = { left: number; top: number; right: number; bottom: number }

const overlaps = (one: Box, other: Box) =>
  one.left < other.right && other.left < one.right && one.top < other.bottom && other.top < one.bottom

/** How far a point lies from a box: 0 inside it. */
const distanceTo = (box: Box, x: number, y: number) =>
  Math.hypot(Math.max(box.left - x, 0, x - box.right), Math.max(box.top - y, 0, y - box.bottom))

const textWidth = (text: string, size: number, spacing: number) => [...text].length * (size * 0.6 + spacing)

function labelsLayer(constellations: readonly Drawn[], edited: readonly Placed[], now: number, projectName: string): string {
  const boxes: Box[] = []
  const clear = (box: Box, own: ReadonlySet<string>) =>
    !boxes.some(other => overlaps(box, other)) &&
    !edited.some(star => !own.has(star.path) && distanceTo(box, star.x, star.y) - coreRadius(star.star.edits) < 10)
  const starsByPath: Record<string, Star> = Object.create(null) as Record<string, Star>
  for (const star of edited) starsByPath[star.path] = star.star
  let out = ''

  const named = constellations.filter(figure => figure.main.length >= 3).slice(0, 5)
  for (const figure of named) {
    // The name is its largest figure's, set under the stars of that figure it is named for.
    const paths = figure.main.map(star => star.path)
    const name = constellationName(paths, starsByPath, projectName)
    const folder = namesake(paths, starsByPath)
    const own = figure.main.filter(star => parentOf(star.path) === folder)
    const spacing = 4.2
    const width = textWidth(name, 10, spacing)
    const centroid = own.reduce((sum, star) => sum + star.x, 0) / own.length
    const lowest = Math.max(...own.map(star => star.y))
    const highest = Math.min(...own.map(star => star.y))
    const x = Math.min(SAFE.right - width / 2, Math.max(SAFE.left + width / 2, centroid))
    // Under the stars, or where something is in the way there, over them.
    const place = [lowest + 20, highest - 14]
      .map(baseline => Math.min(SAFE.bottom, Math.max(SAFE.top + 10, baseline)))
      .map(baseline => ({ y: baseline, box: { left: x - width / 2, top: baseline - 10, right: x + width / 2, bottom: baseline + 3 } }))
      .find(spot => clear(spot.box, new Set(own.map(star => star.path))))
    if (place === undefined) continue
    const { y, box } = place
    boxes.push(box)
    // The trailing letter space would pull the text left of its center: half of it goes back.
    out +=
      `<text${figure.isNew ? ' class="cn-nl"' : ''} x="${n(x + spacing / 2)}" y="${n(y)}" text-anchor="middle" font-size="10" ` +
      `letter-spacing="4.2" font-weight="500" fill="${LINE}" fill-opacity="${figure.rank === 0 ? '.42' : '.28'}">${escapeText(name)}</text>`
  }

  const brightest = edited
    .filter(star => star.star.edits >= 3)
    .sort((a, b) => b.star.edits - a.star.edits || b.star.touched - a.star.touched || (a.path < b.path ? -1 : 1))
    .slice(0, 6)
  for (const star of brightest) {
    const name = cut(baseName(star.path), 26)
    const width = textWidth(name, 9.5, 0.4)
    const gap = coreRadius(star.star.edits) + 8
    const toLeft = star.x + gap + width > SAFE.right
    const left = toLeft ? star.x - gap - width : star.x + gap
    const baseline = star.y + 3.2
    const box = { left, top: baseline - 7.5, right: left + width, bottom: baseline + 2.5 }
    if (!clear(box, new Set([star.path]))) continue
    boxes.push(box)
    const isNew = now - star.star.born < REVEAL_MS
    out +=
      `<text${isNew ? ' class="cn-nl"' : ''} x="${n(toLeft ? star.x - gap : left)}" y="${n(baseline)}"${toLeft ? ' text-anchor="end"' : ''} ` +
      `font-size="9.5" letter-spacing=".4" fill="#dfe6ff" fill-opacity=".5">${escapeText(name)}</text>`
  }
  return out === '' ? '' : `<g font-family="${FONT}">${out}</g>`
}

function starsLayer(edited: readonly Placed[], now: number): string {
  let out = ''
  let order = 0
  for (const star of edited) {
    const motion = motionOf(star.star, now)
    const faded = now - star.star.touched > OLD_MS ? ' opacity=".72"' : ''
    const type = `cn-${star.class}`
    if (motion === 'rest') {
      out += `<g>${title(star)}<use href="#cn-m${shapeKey(star.star.edits)}" class="${type}" x="${n(star.x)}" y="${n(star.y)}"${faded}/></g>`
      continue
    }
    const start = 250 + 160 * order
    order += 1
    const parts =
      motion === 'new'
        ? starParts(star.star.edits, { halo: `${start}ms`, core: `${start}ms`, spikes: `${start + 120}ms` })
        : starParts(star.star.edits).replace('class="cn-h"', `class="cn-h cn-pulse" style="animation-delay:${start}ms"`)
    out += `<g class="${type}" transform="translate(${n(star.x)} ${n(star.y)})"${faded}>${title(star)}${parts}</g>`
  }
  return out
}

function dustLayer(dust: readonly Placed[]): string {
  let out = ''
  for (const type of CLASSES) {
    const points = dust.filter(star => star.class === type)
    if (points.length === 0) continue
    out += `<path stroke="${CLASS_COLORS[type].core}" d="${dots(points)}"/>`
  }
  return out === '' ? '' : `<g stroke-width="1.9" stroke-opacity=".6" stroke-linecap="round">${out}</g>`
}

function meteorLayer(): string {
  // Along a line 24 degrees below the horizontal from the upper left; it travels 620 units.
  return (
    '<g transform="translate(360 150) rotate(24)"><g class="cn-met">' +
    '<path d="M0-1.1L-190-.1V.1L0 1.1Z" fill="url(#cn-tail)"/>' +
    '<circle r="5" fill="url(#cn-head)"/><circle r="1.3" fill="#ffffff"/></g></g>'
  )
}

/** The whole sky as one `<svg>` document, under SCENE_LIMIT characters. */
export function buildScene(input: SceneInput): string {
  const { placed, now } = input
  const edited = placed.filter(star => star.star.edits > 0)
  const byPath = new Map(placed.map(star => [star.path, star]))
  // Newest first, each with the stars of it that are still in the sky.
  const constellations: Drawn[] = []
  const taken: Taken = { pairs: new Set(), degree: new Map(), lines: [] }
  for (const constellation of [...input.constellations].reverse()) {
    const stars = constellation.files
      .map(file => byPath.get(file))
      .filter((star): star is Placed => star !== undefined && star.star.edits > 0)
    if (stars.length < 2) continue
    constellations.push(drawn(constellation, stars, constellations.length, now, taken))
  }
  // Oldest drawn first, so the newest lines lie on top.
  const lines = linesLayer([...constellations].reverse(), now)
  const classes = new Set(edited.map(star => star.class))
  const shapes = [...new Set(edited.filter(star => motionOf(star.star, now) === 'rest').map(star => shapeKey(star.star.edits)))].sort((a, b) => a - b)

  const head =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">' +
    style(classes) +
    `<defs>${defs(classes, shapes)}</defs>` +
    '<rect width="1600" height="1000" fill="url(#cn-ground)"/>' +
    '<ellipse cx="260" cy="1080" rx="900" ry="520" fill="url(#cn-air1)" fill-opacity=".5"/>' +
    '<ellipse cx="1450" cy="1100" rx="760" ry="420" fill="url(#cn-air2)" fill-opacity=".28"/>' +
    bandLayer() +
    `<g stroke-linecap="round">${fieldLayer(now)}</g>` +
    '<rect width="1600" height="1000" fill="url(#cn-vig)"/>' +
    lines
  const tail =
    starsLayer(edited, now) +
    labelsLayer(constellations, edited, now, input.projectName) +
    (input.meteor ? meteorLayer() : '') +
    '</svg>'

  // Dust stars are the first to go when the sky would not fit: the oldest-read first.
  const dust = placed.filter(star => star.star.edits === 0).sort((a, b) => b.star.touched - a.star.touched || (a.path < b.path ? -1 : 1))
  const room = SCENE_LIMIT - head.length - tail.length
  let kept = dust.length
  while (kept > 0 && dustLayer(dust.slice(0, kept)).length > room) kept = Math.floor(kept * 0.9)
  return head + dustLayer(dust.slice(0, kept)) + tail
}
