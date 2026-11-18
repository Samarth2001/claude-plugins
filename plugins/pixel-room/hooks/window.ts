// The window wall: a tall window with the sky, the city and the weather
// behind the glass, its frame and sill hung with fairy lights, the low
// bookcase under it with its candle and the season's ornament, and the
// window's light falling across the floor. The cushion and the cat on the
// sill are cat.ts's, drawn over this.

import { FLOOR, P, pat } from './paint'
import { Layer, isLit, seeded } from './pixels'
import type { Inks, Sprite } from './pixels'
import type { Clock, Phase, SceneInput, Season, Weather } from './model'
import { isMoonUp } from './sky'
import { rle } from './sprites'

/** The glass, in art pixels. */
export const GLASS = { x: 24, y: 28, w: 72, h: 90 }

const BOTTOM = GLASS.y + GLASS.h
/** The upright mullion's left column, and the transom's top row. */
const MULLION = GLASS.x + GLASS.w / 2 - 1
const TRANSOM = GLASS.y + 34

export const WINDOW_CSS = [
  '.pr-rn{animation:pr-rain 1s linear infinite}',
  '.pr-dp{animation:pr-drip 16s steps(60,end) infinite}',
  '.pr-sh{animation:pr-shadow 12s steps(24,end) infinite}',
  '.pr-bl{animation:pr-blink 40s step-end infinite}',
  '.pr-fl{animation:pr-flick 1.7s step-end infinite}',
  '.pw-tw{animation:pw-tw 5s ease-in-out infinite}',
  '.pw-cl{animation:pw-cloud 100s steps(12,end) infinite alternate}',
  '.pw-sf{animation:pw-fall 22s steps(192,end) infinite}',
  '.pw-sw{animation:pw-sway 4s step-end infinite}',
  '.pw-fg{animation:pw-fog 50s steps(24,end) infinite alternate}',
  '.pw-mo{animation:pw-mote 14s steps(8,end) infinite alternate}',
  '.pw-br{animation:pw-breathe 6s ease-in-out infinite alternate}',
  '.pw-ch{opacity:0;animation:pw-chase 3s linear infinite}',
  '.pw-pl{animation:pw-glide 6s steps(44,end) .6s forwards}',
  '.pw-pd{animation:pw-dip 6s .6s forwards}',
  '.pw-p0{animation:pw-level 6s step-end .6s forwards}',
  '.pw-p1,.pw-p2{opacity:0}',
  '.pw-p1{animation:pw-down 6s step-end .6s forwards}',
  '.pw-p2{animation:pw-up 6s step-end .6s forwards}',
  '@keyframes pr-rain{from{transform:translateY(-100px)}to{transform:translateY(100px)}}',
  '@keyframes pr-drip{0%,55%{transform:translateY(0);opacity:1}55.1%{animation-timing-function:steps(40,end)}100%{transform:translateY(60px);opacity:.2}}',
  '@keyframes pr-shadow{from{transform:translate(0,0)}to{transform:translate(12px,24px)}}',
  '@keyframes pr-blink{0%,70%{opacity:1}70.1%,100%{opacity:0}}',
  '@keyframes pr-flick{0%{transform:translateY(0)}60%{transform:translateY(-1px)}80%{transform:translateY(0)}}',
  '@keyframes pw-tw{0%,100%{opacity:1}50%{opacity:.25}}',
  '@keyframes pw-cloud{from{transform:translateX(0)}to{transform:translateX(12px)}}',
  '@keyframes pw-fall{from{transform:translateY(-96px)}to{transform:translateY(96px)}}',
  '@keyframes pw-sway{0%{transform:translateX(0)}25%{transform:translateX(1px)}50%{transform:translateX(2px)}75%{transform:translateX(1px)}}',
  '@keyframes pw-fog{from{transform:translateX(-12px)}to{transform:translateX(12px)}}',
  '@keyframes pw-mote{0%{transform:translate(0,0)}50%{transform:translate(4px,-4px)}100%{transform:translate(8px,0)}}',
  '@keyframes pw-breathe{from{opacity:.2}to{opacity:.5}}',
  '@keyframes pw-chase{0%,34%,100%{opacity:0}12%{opacity:1}}',
  '@keyframes pw-glide{from{transform:translateX(0)}to{transform:translateX(88px)}}',
  '@keyframes pw-dip{0%{transform:translateY(0);animation-timing-function:steps(1,end)}14%{transform:translateY(0);animation-timing-function:steps(5,end)}42%{transform:translateY(5px);animation-timing-function:steps(6,end)}76%{transform:translateY(-1px);animation-timing-function:steps(1,end)}100%{transform:translateY(-1px)}}',
  '@keyframes pw-level{0%{opacity:1}14%{opacity:0}76%{opacity:1}}',
  '@keyframes pw-down{0%{opacity:0}14%{opacity:1}42%{opacity:0}}',
  '@keyframes pw-up{0%{opacity:0}42%{opacity:1}76%{opacity:0}}',
  '@media (prefers-reduced-motion:reduce){.pw-plane{display:none}.pw-ch{opacity:0}}',
].join('')

/** One loose pixel block with its own class and timing. */
function block(cls: string, x: number, y: number, w: number, h: number, fill: string, style: string, opacity?: number): string {
  const o = opacity === undefined ? '' : ` opacity="${opacity}"`
  return `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${o} style="${style}"/>`
}

const fixed = (n: number, digits = 1) => n.toFixed(digits)

// The sky's bands from the top of the glass down: the row each starts at,
// its colour, and an optional dither over it. Dusk and dawn change quickly
// low down, where the sky shows between the towers. Dawn is cool and clean
// above and amber at the horizon; dusk is deeper and redder all the way.
type Band = [number, string, string | undefined]
const SKIES: Record<Phase, Band[]> = {
  night: [[28, P.ink, undefined], [43, P.ink, pat('n2')], [58, P.night, undefined], [73, P.night, pat('s4')], [88, P.night, pat('s8')], [103, P.sea, undefined]],
  dusk: [
    [28, P.plum, undefined], [38, P.plum, pat('u8')], [44, P.aubergine, undefined], [48, P.aubergine, pat('v8')], [52, P.mauve, undefined],
    [56, P.mauve, pat('r4')], [59, P.mauve, pat('r8')], [62, P.rose, undefined], [66, P.rose, pat('x4')], [69, P.rose, pat('x8')],
    [72, P.rust, undefined], [76, P.rust, pat('e8')], [82, P.ember, pat('x4')],
  ],
  dawn: [
    [28, P.sea, undefined], [38, P.sea, pat('u4')], [42, P.sea, pat('u8')], [46, P.aubergine, undefined], [50, P.aubergine, pat('v8')],
    [54, P.mauve, undefined], [58, P.mauve, pat('r4')], [61, P.mauve, pat('r8')], [64, P.rose, undefined], [68, P.rose, pat('e4')],
    [71, P.rose, pat('e8')], [74, P.ember, undefined], [77, P.ember, pat('b8')], [82, P.amber, pat('e4')],
  ],
  day: [[28, P.steel, undefined], [43, P.steel, pat('i8')], [58, P.mist, undefined], [88, P.mist, pat('t4')], [103, P.mist, undefined]],
}

function sky(phase: Phase): string {
  const g = GLASS
  const layer = new Layer()
  const bands = SKIES[phase]
  bands.forEach(([y, base, over], i) => {
    const h = (bands[i + 1]?.[0] ?? BOTTOM) - y
    layer.rect(g.x, y, g.w, h, base)
    if (over !== undefined) layer.rect(g.x, y, g.w, h, over)
  })
  return layer.svg()
}

type Tower = { x: number; w: number; top: number; spire: boolean; step: boolean }
type Slot = { x: number; y: number; roll: number; delay: number }

// The city, laid out once: a far row of towers, hazy, and a near row, dark,
// with the windows that may be lit.
const FAR: Tower[] = []
const NEAR: Tower[] = []
const SLOTS: Slot[] = []
{
  const g = GLASS
  const random = seeded(19)
  let x = g.x - 2
  while (x < g.x + g.w) {
    const w = 5 + Math.floor(random() * 6)
    const h = 22 + Math.floor(random() * 24)
    FAR.push({ x, w, top: BOTTOM - h, spire: random() < 0.4, step: false })
    x += w + Math.floor(random() * 2)
  }
  x = g.x - 3
  while (x < g.x + g.w) {
    const w = 8 + Math.floor(random() * 9)
    const h = 10 + Math.floor(random() * 20)
    const top = BOTTOM - h
    NEAR.push({ x, w, top, spire: false, step: random() < 0.5 })
    for (let wy = top + 3; wy < BOTTOM - 2; wy += 3) {
      for (let wx = x + 2; wx < x + w - 1; wx += 2) SLOTS.push({ x: wx, y: wy, roll: random(), delay: Math.floor(random() * 40) })
    }
    x += w + 1
  }
}

const FAR_COLOR: Record<Phase, string> = { night: P.sea, dusk: P.mauve, dawn: P.dusk, day: P.steel }
const NEAR_COLOR: Record<Phase, string> = { night: P.night, dusk: P.night, dawn: P.aubergine, day: P.dusk }
const FOG_NEAR: Record<Phase, string> = { night: P.mauve, dusk: P.dusk, dawn: P.dusk, day: P.steel }
const LIT_ODDS: Record<Phase, number> = { night: 0.2, dusk: 0.14, dawn: 0.06, day: 0 }

function farCity(phase: Phase, weather: Weather): string {
  if (weather === 'fog') return ''
  const far = new Layer()
  const color = FAR_COLOR[phase]
  for (const t of FAR) {
    far.rect(t.x, t.top, t.w, BOTTOM - t.top, color)
    if (t.spire) far.rect(t.x + Math.floor(t.w / 2), t.top - 4, 1, 4, color)
  }
  // Rain, drizzle and snow hang a soft veil of mist over the far towers.
  const veil = weather === 'drizzle' ? 0.42 : weather === 'clear' ? 0 : 0.2
  return far.svg() + (veil > 0 ? haze('qwveil', 64, veil * (phase === 'day' ? 1.3 : 1)) : '')
}

/** A mist that thickens toward the foot of the glass, from row `top` down. */
function haze(id: string, top: number, opacity: number): string {
  const g = GLASS
  return (
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.mist}" stop-opacity="0"/><stop offset=".6" stop-color="${P.mist}" stop-opacity="${fixed(opacity, 2)}"/><stop offset="1" stop-color="${P.mist}" stop-opacity="${fixed(opacity * 0.8, 2)}"/></linearGradient></defs>` +
    `<rect x="${g.x}" y="${top}" width="${g.w}" height="${BOTTOM - top}" fill="url(#${id})"/>`
  )
}

function nearCity(phase: Phase, weather: Weather): string {
  const near = new Layer()
  const lights = new Layer()
  const caps = new Layer()
  const blink: string[] = []
  const isFog = weather === 'fog'
  const color = isFog ? FOG_NEAR[phase] : NEAR_COLOR[phase]
  for (const t of NEAR) {
    near.rect(t.x, t.top, t.w, BOTTOM - t.top, color)
    if (t.step) near.rect(t.x + 1, t.top - 2, t.w - 2, 2, color)
    if (weather === 'snow') {
      // Snow lies along each roof and its stepped top, thinning at the edges.
      const top = t.step ? t.top - 2 : t.top
      const x0 = t.step ? t.x + 1 : t.x
      const w = t.step ? t.w - 2 : t.w
      caps.rect(x0, top, w, 1, P.cream)
      caps.rect(x0 + 1, top + 1, w - 2, 1, pat('m4'))
      if (t.step) {
        caps.rect(t.x, t.top, 1, 1, P.cream)
        caps.rect(t.x + t.w - 1, t.top, 1, 1, P.cream)
      }
    }
  }
  const odds = LIT_ODDS[phase] * (isFog ? 0.4 : 1)
  for (const s of SLOTS) {
    if (s.roll >= odds) continue
    // Inside a tower and below its roof only.
    const tower = NEAR.find(t => s.x >= t.x && s.x < t.x + t.w)
    if (tower === undefined || s.y < tower.top + 3) continue
    const lit = s.roll < odds * 0.3 ? P.cream : P.amber
    if (s.roll < odds * 0.12 && !isFog) blink.push(`<rect class="pr-bl" x="${s.x}" y="${s.y}" width="1" height="1" fill="${lit}" style="animation-delay:-${s.delay}s"/>`)
    else lights.dot(s.x, s.y, lit)
  }
  const lightOpacity = phase === 'day' ? 0.6 : isFog ? 0.45 : phase === 'dawn' ? 0.75 : 1
  const capOpacity = phase === 'day' ? 1 : phase === 'night' ? 0.7 : 0.85
  return near.svg(isFog ? 'opacity=".7"' : '') + caps.svg(`opacity="${capOpacity}"`) + lights.svg(`opacity="${lightOpacity}"`) + blink.join('')
}

/** The city's own glow, soft behind the glass. */
function cityGlow(phase: Phase, weather: Weather): string {
  const g = GLASS
  const color = phase === 'day' || weather === 'fog' ? P.mist : P.amber
  const opacity = (phase === 'night' ? 0.32 : phase === 'day' ? 0.25 : 0.4) * (weather === 'fog' ? 0.6 : 1)
  return (
    `<defs><radialGradient id="qwglow"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs>` +
    `<ellipse cx="${g.x + g.w / 2}" cy="${BOTTOM}" rx="${g.w * 0.75}" ry="${g.h * 0.45}" fill="url(#qwglow)" opacity="${fixed(opacity, 2)}"/>`
  )
}

/** Stars over the city on clear nights, fewer and fainter at dusk and dawn; a few twinkle. */
function stars(phase: Phase, moonBox: Box | undefined): string {
  const g = GLASS
  const isNight = phase === 'night'
  const count = isNight ? 36 : 26
  const floor = isNight ? 74 : 56
  const random = seeded(73)
  const steady = new Layer()
  const dim = new Layer()
  let twinkle = ''
  for (let i = 0; i < count; i += 1) {
    const x = g.x + 1 + Math.floor(random() * (g.w - 2))
    const y = g.y + 2 + Math.floor(Math.pow(random(), 1.4) * (floor - g.y - 2))
    const roll = random()
    if (moonBox !== undefined && x >= moonBox.x0 - 2 && x <= moonBox.x1 + 2 && y >= moonBox.y0 - 2 && y <= moonBox.y1 + 2) continue
    if (i % 6 === 2) {
      const d = fixed(3 + roll * 5)
      twinkle += block('pw-tw', x, y, 1, 1, roll < 0.5 ? P.cream : P.mist, `animation-duration:${d}s;animation-delay:-${fixed(random() * 8)}s`)
    } else if (roll < 0.45) steady.dot(x, y, P.mist)
    else dim.dot(x, y, roll < 0.6 ? P.cream : P.mist)
  }
  // Two bright stars with a faint cross of light.
  const bright = new Layer()
  const glints = new Layer()
  for (const [x, y] of isNight ? [[34, 36], [84, 46]] : [[86, 34]]) {
    if (x === undefined || y === undefined) continue
    bright.dot(x, y, P.cream)
    glints.rect(x - 1, y, 1, 1, P.mist).rect(x + 1, y, 1, 1, P.mist).rect(x, y - 1, 1, 1, P.mist).rect(x, y + 1, 1, 1, P.mist)
  }
  const fade = isNight ? 1 : 0.6
  return `<g class="pw-sk" opacity="${fade}">${steady.svg('opacity=".8"')}${dim.svg('opacity=".45"')}${glints.svg('opacity=".35"')}${bright.svg()}${twinkle}</g>`
}

type Box = { x0: number; y0: number; x1: number; y1: number }

const MOON_R = 5

/** Where the moon is at this hour: low at the left near 18:00, high near midnight, low at the right toward 06:00. */
export function moonSpot(phase: Phase, time: Clock): { cx: number; cy: number } {
  const g = GLASS
  const hours = time.hour + time.minute / 60
  let t = (((hours - 18) % 24) + 24) % 24 / 12
  if (t > 1) t = hours < 12 ? 1 : 0
  if (phase === 'dusk') t = Math.min(t, 0.06)
  if (phase === 'dawn') t = Math.max(t, 0.94)
  const r = MOON_R
  const left = g.x + r + 3
  const right = g.x + g.w - r - 4
  let cx = Math.round(left + t * (right - left))
  const cy = Math.round(TRANSOM - r - 4 - Math.sin(Math.PI * t) * 20)
  // Never behind the upright: slide into the nearer pane.
  if (cx + r + 1 >= MULLION && cx - r - 1 <= MULLION + 1) cx = cx < MULLION + 1 ? MULLION - r - 2 : MULLION + r + 3
  return { cx, cy }
}

/** The moon's disc, lit by its phase row by row, with a soft halo; dimmer and hazier through rain or snow. */
function moon(input: SceneInput, time: Clock): { svg: string; box: Box } {
  const { cx, cy } = moonSpot(input.phase, time)
  const r = MOON_R
  const k = Math.cos(2 * Math.PI * input.moon)
  const isWaxing = (((input.moon % 1) + 1) % 1) < 0.5
  const lit = new Layer()
  const shade = new Layer()
  const dark = new Layer()
  let litCount = 0
  for (let dy = -r; dy <= r; dy += 1) {
    const half = Math.floor(Math.sqrt((r + 0.5) ** 2 - dy * dy))
    const span = half + 0.5
    for (let dx = -half; dx <= half; dx += 1) {
      // How much of this pixel's width lies on the lit side of the terminator.
      const ul = (dx - 0.5) / span
      const ur = (dx + 0.5) / span
      const cover = isWaxing ? (ur - Math.max(ul, k)) / (ur - ul) : (Math.min(ur, -k) - ul) / (ur - ul)
      const x = cx + dx
      const y = cy + dy
      if (cover > 0.3) {
        litCount += 1
        const edge = Math.abs(dx) === half || Math.abs(dy) === r
        const nearTerminator = isWaxing ? (dx - 1 - 0.5) / span < k : (dx + 1 + 0.5) / span > -k
        const crater = (dx === -2 && dy === -1) || (dx === 1 && dy === 2) || (dx === 2 && dy === -3) || (dx === -1 && dy === 3)
        // Lit from the sunward side: the limb away from it and the craters in mist.
        if (crater || (nearTerminator && k > -0.95) || (edge && dy > 2)) shade.dot(x, y, P.mist)
        else lit.dot(x, y, P.cream)
      } else dark.dot(x, y, P.sea)
    }
  }
  const total = Math.PI * (r + 0.5) ** 2
  const fraction = litCount / total
  const veiled = input.weather === 'rain' || input.weather === 'drizzle' || input.weather === 'snow'
  const isNight = input.phase === 'night'
  const haloR = veiled ? 19 : 13
  const haloOpacity = (0.18 + 0.32 * fraction) * (veiled ? 0.8 : 1) * (isNight ? 1 : 0.6)
  const opacity = veiled ? 0.9 : 1
  const darkOpacity = isNight ? 0.7 : 0.3
  const svg =
    `<defs><radialGradient id="qwhalo"><stop offset="0" stop-color="${P.mist}"/><stop offset=".35" stop-color="${P.mist}" stop-opacity=".45"/><stop offset="1" stop-color="${P.mist}" stop-opacity="0"/></radialGradient></defs>` +
    `<g class="pw-mn" opacity="${fixed(opacity, 2)}">` +
    `<circle cx="${cx + 0.5}" cy="${cy + 0.5}" r="${haloR}" fill="url(#qwhalo)" opacity="${fixed(haloOpacity, 2)}"/>` +
    dark.svg(`opacity="${darkOpacity}"`) +
    lit.svg() +
    shade.svg() +
    `</g>`
  return { svg, box: { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r } }
}

/** The dawn sun, a low disc half behind the far towers, its glow warming the sky. */
function sun(weather: Weather): string {
  const cx = 36
  const cy = 78
  const s = new Layer()
  const r = 6
  for (let dy = -r; dy <= r; dy += 1) {
    const half = Math.floor(Math.sqrt((r + 0.5) ** 2 - dy * dy))
    s.rect(cx - half, cy + dy, half * 2 + 1, 1, P.amber)
    if (Math.abs(dy) < r - 1) {
      const inner = Math.max(0, half - 1)
      s.rect(cx - inner, cy + dy, inner * 2 + 1, 1, P.cream)
    }
  }
  const dimmed = weather === 'clear' ? 1 : weather === 'fog' ? 0.4 : 0.65
  return (
    `<defs><radialGradient id="qwsun"><stop offset="0" stop-color="${P.amber}" stop-opacity=".8"/><stop offset="1" stop-color="${P.ember}" stop-opacity="0"/></radialGradient></defs>` +
    `<g opacity="${dimmed}"><circle cx="${cx + 0.5}" cy="${cy + 0.5}" r="26" fill="url(#qwsun)" opacity=".55"/>${s.svg()}</g>`
  )
}

// Pale clouds for a clear day: lit tops, mist bodies, a soft steel base.
const CLOUDS: [number, number, Sprite][] = [
  [26, 36, ['..........cccc..........', '.....ccc.cmmmmc.........', '....cmmmcmmmmmmc.ccc....', '..ccmmmmmmmmmmmmcmmmcc..', '.cmmmmmmmmmmmmmmmmmmmmc.', 'cmmmmmmmmmmmmmmmmmmmmmmm', '.msmmsmmsmsmmsmmsmmsmms.', '...ss.s.ss.ss.s.ss.ss...']],
  [70, 48, ['......ccc.......', '..ccc.cmmmc.....', '.cmmmcmmmmmcc...', 'cmmmmmmmmmmmmmc.', '.mmsmmsmsmmsmmm.', '..ss.s.ss.s.ss..']],
  [44, 66, ['....cc....', '.ccmmmcc..', 'cmmmmmmmmc', '.smsmmsms.']],
]

/** Two or three pale clouds drifting very slowly across a clear day. */
function clouds(): string {
  return CLOUDS.map(([x, y, rows], i) => {
    const l = new Layer().sprite(rows, { c: P.cream, m: P.mist, s: P.steel }, x, y)
    return l.svg(`class="pw-cl" opacity="${i === 2 ? 0.6 : 0.9}" style="animation-duration:${90 + i * 25}s;animation-delay:-${i * 31}s"`)
  }).join('')
}

function rain(phase: Phase): string {
  const g = GLASS
  const random = seeded(31)
  const color = phase === 'day' ? P.cream : P.mist
  let out = ''
  // Three depths of streaks: far ones faint and slow, near ones longer, brighter and quick.
  for (let i = 0; i < 46; i += 1) {
    const depth = i % 3 === 0 ? 2 : i % 3 === 1 ? 1 : 0
    const x = g.x + Math.floor(random() * g.w)
    const y = g.y + Math.floor(random() * g.h)
    const d = fixed(depth === 2 ? 0.45 + random() * 0.15 : depth === 1 ? 0.65 + random() * 0.2 : 0.9 + random() * 0.35, 2)
    const delay = fixed(-random() * 2, 2)
    const h = depth === 2 ? 5 : depth === 1 ? 3 : 2
    const opacity = depth === 2 ? 0.5 : depth === 1 ? 0.36 : 0.24
    out += `<rect class="pr-rn" x="${x}" y="${y}" width="1" height="${h}" fill="${color}" opacity="${opacity}" style="animation-duration:${d}s;animation-delay:${delay}s"/>`
  }
  // Drops beaded on the glass that gather, then run down it a pixel at a time.
  for (let i = 0; i < 14; i += 1) {
    const x = g.x + 2 + Math.floor(random() * (g.w - 4))
    const y = g.y + 2 + Math.floor(random() * (g.h * 0.6))
    const d = fixed(12 + random() * 10)
    const delay = fixed(-random() * 22)
    out += `<g class="pr-dp" style="animation-duration:${d}s;animation-delay:${delay}s">` + new Layer().dot(x, y, P.mist).svg() + `<rect x="${x}" y="${y + 1}" width="1" height="1" fill="${P.steel}" opacity=".7"/></g>`
  }
  return out
}

function drizzle(phase: Phase): string {
  const g = GLASS
  const random = seeded(37)
  const color = phase === 'day' ? P.cream : P.mist
  let out = ''
  // Fine short streaks, faint and unhurried.
  for (let i = 0; i < 20; i += 1) {
    const x = g.x + Math.floor(random() * g.w)
    const y = g.y + Math.floor(random() * g.h)
    const d = fixed(1.3 + random() * 0.6, 2)
    out += `<rect class="pr-rn" x="${x}" y="${y}" width="1" height="2" fill="${color}" opacity=".22" style="animation-duration:${d}s;animation-delay:-${fixed(random() * 2, 2)}s"/>`
  }
  // Many small beads resting on the glass, and a few that run.
  const beads = new Layer()
  const under = new Layer()
  for (let i = 0; i < 30; i += 1) {
    const x = g.x + 1 + Math.floor(random() * (g.w - 2))
    const y = g.y + 2 + Math.floor(random() * (g.h - 4))
    if (x === MULLION || x === MULLION + 1 || y === TRANSOM || y === TRANSOM + 1) continue
    beads.dot(x, y, P.mist)
    if (random() < 0.5) under.dot(x, y + 1, P.steel)
  }
  out += `<g class="pw-bd">${under.svg('opacity=".5"')}${beads.svg('opacity=".75"')}</g>`
  for (let i = 0; i < 6; i += 1) {
    const x = g.x + 2 + Math.floor(random() * (g.w - 4))
    const y = g.y + 2 + Math.floor(random() * (g.h * 0.5))
    out += `<g class="pr-dp" style="animation-duration:${fixed(16 + random() * 10)}s;animation-delay:-${fixed(random() * 26)}s">` + `<rect x="${x}" y="${y}" width="1" height="1" fill="${P.mist}"/><rect x="${x}" y="${y + 1}" width="1" height="1" fill="${P.steel}" opacity=".6"/></g>`
  }
  return out
}

/** Snow falling slowly and swaying, settled along the ledge, and frost in the corners of the panes. */
function snow(phase: Phase): string {
  const g = GLASS
  const random = seeded(41)
  const far = phase === 'day' ? P.cream : P.mist
  let out = ''
  // Each flake falls in an outer group and sways inside it; far flakes are
  // single pixels, near ones small crosses, nearer and quicker.
  for (let i = 0; i < 60; i += 1) {
    const isNear = i % 8 === 0
    const x = g.x + Math.floor(random() * g.w)
    const y = g.y + Math.floor(random() * g.h)
    const across = isNear ? 8 + random() * 2 : 11 + random() * 3
    const fall = `animation-duration:${fixed(across * 2)}s;animation-delay:-${fixed(random() * across * 2)}s`
    const sway = `animation-duration:${fixed(3 + random() * 2.5)}s;animation-delay:-${fixed(random() * 5)}s`
    const flake = isNear
      ? new Layer().rect(x, y - 1, 1, 3, P.cream).rect(x - 1, y, 3, 1, P.cream).svg()
      : `<rect x="${x}" y="${y}" width="1" height="1" fill="${far}" opacity="${random() < 0.6 ? 1 : 0.65}"/>`
    out += `<g class="pw-sf" style="${fall}"><g class="pw-sw" style="${sway}">${flake}</g></g>`
  }
  // A soft drift heaped along the ledge outside.
  const drift = new Layer()
  for (let x = g.x; x < g.x + g.w; x += 1) {
    const h = 2 + Math.round(1.1 + Math.sin(x * 0.23) * 1.1 + Math.sin(x * 0.61 + 1) * 0.6)
    drift.rect(x, BOTTOM - h, 1, 1, P.cream)
    drift.rect(x, BOTTOM - h + 1, 1, h - 1, P.mist)
  }
  const shadow = new Layer().rect(g.x, BOTTOM - 2, g.w, 2, pat('t8'))
  out += drift.svg(phase === 'night' ? 'opacity=".8"' : '') + shadow.svg('opacity=".6"')
  // Frost dithered into the corners of the glass, heaviest at the frame.
  const frost = new Layer()
  const corners: [number, number, number][] = [
    [g.x + 1, g.y + 1, 10],
    [g.x + g.w - 1, g.y + 1, 9],
    [g.x + 1, BOTTOM - 1, 12],
    [g.x + g.w - 1, BOTTOM - 1, 12],
    [MULLION - 1, BOTTOM - 1, 6],
    [MULLION + 2, BOTTOM - 1, 6],
  ]
  for (const [cx, cy, radius] of corners) {
    for (let y = cy - radius; y <= cy + radius; y += 1) {
      for (let x = cx - radius; x <= cx + radius; x += 1) {
        if (x < g.x || x >= g.x + g.w || y < g.y || y >= BOTTOM) continue
        const d = Math.hypot(x - cx, (y - cy) * 1.2)
        const level = Math.round(14 * Math.max(0, 1 - d / radius) ** 1.3)
        if (level > 0 && isLit(x, y, level)) frost.dot(x, y, P.mist)
      }
    }
  }
  out += frost.svg(`opacity="${phase === 'day' ? 0.75 : 0.5}"`)
  return out
}

/** Fog: a pale veil over everything and wide banks drifting very slowly. */
function fog(phase: Phase): string {
  const g = GLASS
  const banks: [number, number, number][] = [
    [60, 10, 55],
    [82, 12, 68],
    [100, 12, 44],
  ]
  let out = ''
  banks.forEach(([y, h, d], i) => {
    const b = new Layer()
    const x = g.x - 14
    const w = g.w + 28
    b.rect(x, y, w, 2, pat('m4'))
    b.rect(x, y + 2, w, h - 4, pat('i8'))
    b.rect(x, y + h - 2, w, 2, pat('m4'))
    out += b.svg(`class="pw-fg" opacity="${phase === 'day' ? 0.38 : 0.28}" style="animation-duration:${d}s;animation-delay:-${i * 19}s"`)
  })
  return out
}

/** The paper plane after a push: it glides once across the glass, dipping and rising, then is gone. */
const PLANE_FRAMES: Sprite[] = [
  ['cc.....', 'mcccc..', '.sscccc', '..d....'],
  ['c......', 'mcc....', '.mccc..', '..ssccc', '...d...'],
  ['....ccc', '.ccccc.', 'mmss...', '..d....'],
]
const PLANE_INKS: Inks = { c: P.cream, m: P.mist, s: P.steel, d: P.dusk }

function plane(): string {
  const x = GLASS.x - 9
  const y = 44
  const frames = PLANE_FRAMES.map((rows, i) => `<g class="pw-p${i}">${new Layer().sprite(rows, PLANE_INKS, x, y).svg()}</g>`).join('')
  return `<g class="pw-plane"><g class="pw-pl"><g class="pw-pd">${frames}</g></g></g>`
}

function windowFrame(): string {
  const f = new Layer()
  const g = GLASS
  // Outer frame with a lit top edge and a shadowed right and bottom, outlined in night.
  f.rect(g.x - 5, g.y - 5, g.w + 10, 1, P.night)
  f.rect(g.x - 5, g.y - 4, 1, g.h + 4, P.night)
  f.rect(g.x - 4, g.y - 4, g.w + 8, 4, P.mauve)
  f.rect(g.x - 4, g.y - 4, g.w + 8, 1, P.dusk)
  f.rect(g.x - 4, g.y - 1, g.w + 8, 1, P.aubergine)
  f.rect(g.x - 4, g.y, 4, g.h, P.mauve)
  f.rect(g.x - 4, g.y - 4, 1, g.h + 4, P.dusk)
  f.rect(g.x + g.w, g.y - 1, 4, g.h + 1, P.aubergine)
  f.rect(g.x + g.w + 3, g.y - 4, 1, g.h + 4, P.night)
  f.rect(g.x + g.w + 4, g.y - 5, 1, g.h + 5, P.night)
  // A mitred corner at the top left, and the paint worn at the right.
  f.dot(g.x - 1, g.y - 1, P.dusk)
  f.rect(g.x + g.w + 1, g.y + 52, 1, 5, P.mauve)
  // Inner shadow on the glass edge.
  f.rect(g.x, g.y, g.w, 1, P.ink)
  f.rect(g.x, g.y, 1, g.h, P.ink)
  // Mullions: one upright, one transom, each with a lit edge and a shadowed one.
  f.rect(MULLION, g.y, 2, g.h, P.mauve)
  f.rect(MULLION, g.y, 1, g.h, P.dusk)
  f.rect(g.x, TRANSOM, g.w, 2, P.mauve)
  f.rect(g.x, TRANSOM, g.w, 1, P.dusk)
  // A small brass latch where the two meet.
  f.rect(MULLION - 1, TRANSOM + 2, 4, 2, P.umber)
  f.rect(MULLION - 1, TRANSOM + 2, 3, 1, P.amber)
  f.dot(MULLION + 2, TRANSOM + 2, P.ember)
  // The sill: a lit top face, a grained front face with rounded ends, and its shadow on the wall.
  const sx = g.x - 8
  const sw = g.w + 16
  f.rect(sx, BOTTOM, sw, 2, P.dusk)
  f.rect(sx + 1, BOTTOM, sw - 2, 1, P.rose)
  f.rect(sx, BOTTOM + 2, sw, 3, P.mauve)
  f.rect(sx + 1, BOTTOM + 5, sw - 2, 1, P.aubergine)
  for (const [x, y, w] of [[21, 121, 6], [34, 122, 4], [48, 121, 9], [66, 122, 5], [77, 121, 7], [93, 122, 5]] as const) f.rect(x, y, w, 1, P.aubergine)
  for (const x of [30, 31, 72, 88]) f.dot(x, BOTTOM, P.dusk)
  f.rect(g.x - 6, BOTTOM + 6, g.w + 12, 2, pat('k2'))
  // The mullions' shadows on the glass.
  const shade = new Layer().rect(MULLION + 2, g.y + 1, 1, g.h - 1, P.ink).rect(g.x + 1, TRANSOM + 2, g.w - 1, 1, P.ink)
  return f.svg() + shade.svg('opacity=".35"')
}

/** Books on a low shelf under the window, and the candle on top. */
function shelf(): string {
  const s = new Layer()
  const x0 = 26
  const top = 132
  s.rect(x0, top, 68, 2, P.dusk)
  s.rect(x0, top, 68, 1, P.rose)
  s.dot(x0 + 30, top, P.dusk)
  s.dot(x0 + 31, top, P.dusk)
  s.rect(x0 + 1, top + 2, 2, 24, P.mauve)
  s.rect(x0 + 1, top + 2, 1, 24, P.dusk)
  s.rect(x0 + 65, top + 2, 2, 24, P.aubergine)
  s.rect(x0 + 3, top + 13, 62, 2, P.mauve)
  s.rect(x0 + 3, top + 13, 62, 1, P.dusk)
  s.rect(x0 + 3, top + 2, 62, 11, P.night)
  s.rect(x0 + 3, top + 15, 62, 11, P.night)
  s.rect(x0 + 3, top + 2, 62, 1, P.ink)
  s.rect(x0 + 3, top + 15, 62, 1, P.ink)
  s.rect(x0, top + 26, 68, 2, P.aubergine)
  const colors = [P.rust, P.sea, P.moss, P.dusk, P.rose, P.umber, P.steel, P.mauve]
  const random = seeded(11)
  for (const row of [top + 2, top + 15]) {
    let x = x0 + 4
    while (x < x0 + 58) {
      const roll = random()
      if (roll < 0.1) {
        // A short stack lying flat.
        for (let i = 0; i < 3; i += 1) s.rect(x + i, row + 11 - (i + 1) * 2, 9 - i, 2, colors[(i * 3 + Math.floor(roll * 50)) % colors.length] ?? P.rust)
        x += 11
        continue
      }
      const w = 2 + Math.floor(random() * 2)
      const h = 7 + Math.floor(random() * 4)
      const color = colors[Math.floor(random() * colors.length)] ?? P.rust
      s.rect(x, row + 11 - h, w, h, color)
      s.rect(x, row + 13 - h, w, 1, P.cream)
      s.rect(x + w - 1, row + 11 - h, 1, h, P.ink)
      x += w + (random() < 0.2 ? 2 : 0)
    }
  }
  // A book leaning into the gap at the end of the top row.
  for (let i = 0; i < 9; i += 1) {
    const lean = Math.floor(i / 3)
    s.rect(x0 + 60 + lean, top + 4 + i, 3, 1, P.sea)
    s.dot(x0 + 62 + lean, top + 4 + i, P.ink)
  }
  s.rect(x0 + 60, top + 6, 3, 1, P.mist)
  // A small candle and its flame on top.
  s.rect(x0 + 52, top - 3, 4, 3, P.cream)
  s.rect(x0 + 55, top - 3, 1, 3, P.rose)
  s.rect(x0 + 53, top - 4, 1, 1, P.umber)
  return s.svg() + `<g class="pr-fl"><rect x="${x0 + 52}" y="${top - 6}" width="3" height="2" fill="${P.ember}"/><rect x="${x0 + 53}" y="${top - 8}" width="1" height="3" fill="${P.amber}"/><rect x="${x0 + 53}" y="${top - 6}" width="1" height="1" fill="${P.cream}"/></g>`
}

/** The candle's warm glow on the wall, breathing slowly. */
function candleGlow(): string {
  return (
    `<defs><radialGradient id="qwcandle"><stop offset="0" stop-color="${P.amber}" stop-opacity=".9"/><stop offset="1" stop-color="${P.ember}" stop-opacity="0"/></radialGradient></defs>` +
    `<circle class="pw-br" cx="80" cy="125" r="10" fill="url(#qwcandle)" opacity=".3" style="animation-duration:5s"/>`
  )
}

// The season's ornament on the bookcase, left of the candle.
const ORNAMENTS: Record<Season, [Sprite, Inks]> = {
  // A snow globe with a tiny house in it.
  winter: [
    rle(['3.5o3.', '2.oh4go2.', '.oh2gr3go.', '.o2g3r2go.', '.o2geye2go.', '.o2s3e2so.', '2.o5so2.', '.9B.', '10bd']),
    { o: P.steel, h: P.mist, g: P.sea, r: P.rust, e: P.ember, y: P.amber, s: P.cream, B: P.rust, b: P.umber, d: P.ink },
  ],
  // Two tulips in a small blue vase.
  spring: [
    rle(['.A.z6.', '.Aaz2.E.Z.', '2.a3.EeZ.', '.Ll4.e2.', '.L.l2.l3.', '2.q4wq2.', '2.qh2vsq2.', '2.qh2vsq2.', '3.4q3.']),
    { A: P.ember, a: P.rust, z: P.umber, E: P.cream, e: P.amber, Z: P.ember, L: P.leaf, l: P.moss, q: P.night, w: P.mist, h: P.mist, v: P.steel, s: P.sea },
  ],
  // A little cactus in a clay pot, one flower on top.
  summer: [
    rle(['4.n3.', '3.LLM2.', '.L.LcM2.', '.4LM.M', '3.LcM2M', '3.L2M2.', '.6R.', '.r4tu.', '2.r2tu2.']),
    { n: P.rose, L: P.leaf, M: P.moss, c: P.cream, R: P.ember, r: P.ember, t: P.rust, u: P.umber },
  ],
  // A small pumpkin and a fallen leaf.
  autumn: [
    rle(['4.s6.', '.2kOs2k4.', 'kOodoodk3.', 'kOodoodk3.', 'koodoodk.f.', 'kdododdkfFf', '.6k.2F.']),
    { k: P.umber, O: P.amber, o: P.ember, d: P.rust, s: P.moss, f: P.amber, F: P.rust },
  ],
}

function ornament(season: Season): string {
  const [rows, inks] = ORNAMENTS[season]
  const w = rows[0]?.length ?? 0
  const x = 75 - w
  const y = 132 - rows.length
  const o = new Layer().sprite(rows, inks, x, y)
  // Its shadow on the shelf top, falling right.
  const shadow = new Layer().rect(x + 2, 132, w, 1, pat('k2'))
  return `<g class="pw-or">${shadow.svg()}${o.svg()}</g>`
}

// Fairy lights: a string draped in two shallow swags along the top of the
// frame, its bulbs amber, cream, rose and leaf in turn.
const BULBS: { body: string; light: string; shade: string }[] = [
  { body: P.amber, light: P.cream, shade: P.ember },
  { body: P.cream, light: P.cream, shade: P.amber },
  { body: P.rose, light: P.cream, shade: P.dusk },
  { body: P.leaf, light: P.cream, shade: P.moss },
]
const ANCHORS = [12, 60, 108]
const WIRE_Y = 14

function wireY(x: number): number {
  const half = (ANCHORS[1]! - ANCHORS[0]!) / 2
  const c = x < ANCHORS[1]! ? ANCHORS[0]! + half : ANCHORS[1]! + half
  return WIRE_Y + Math.round(5 * (1 - ((x - c) / half) ** 2))
}

function fairyLights(input: SceneInput): string {
  const wire = new Layer()
  const bulbs = new Layer()
  const lit = input.lampOn
  let prev = wireY(ANCHORS[0]!)
  for (let x = ANCHORS[0]!; x <= ANCHORS[2]!; x += 1) {
    const y = wireY(x)
    // Join steep steps so the wire never breaks.
    const y0 = Math.min(y, prev)
    const y1 = Math.max(y, prev)
    wire.rect(x, y0 === y ? y : y0 + 1, 1, y1 === y0 ? 1 : y1 - y0, P.mauve)
    prev = y
  }
  // Little nails where it hangs.
  const nails = new Layer()
  for (const x of ANCHORS) nails.rect(x, WIRE_Y - 1, 1, 2, P.dusk).dot(x, WIRE_Y - 1, P.rose)
  const dull = new Layer()
  let glows = ''
  let chase = ''
  const defsOut: string[] = []
  const count = 12
  for (let i = 0; i < count; i += 1) {
    const x = 15 + i * 8
    const y = wireY(x)
    const b = BULBS[i % BULBS.length]!
    bulbs.dot(x, y + 1, P.mauve)
    bulbs.rect(x, y + 2, 2, 1, P.aubergine)
    if (lit) {
      bulbs.dot(x, y + 3, b.light).dot(x + 1, y + 3, b.body).dot(x, y + 4, b.body).dot(x + 1, y + 4, b.shade)
      glows += `<circle class="pw-br" cx="${x + 1}" cy="${y + 4}" r="3.5" fill="url(#qwb${i % BULBS.length})" opacity=".35" style="animation-duration:${fixed(4 + ((i * 7) % 11) * 0.5)}s;animation-delay:-${fixed((i * 1.7) % 6)}s"/>`
      if (input.isWorking) chase += `<g class="pw-ch" style="animation-delay:${fixed(i * 0.25, 2)}s"><circle cx="${x + 1}" cy="${y + 4}" r="5" fill="url(#qwb${i % BULBS.length})" opacity=".6"/><rect x="${x}" y="${y + 3}" width="2" height="2" fill="${P.cream}"/></g>`
    } else {
      // Unlit glass by day: its colour dulled over the dark socket.
      bulbs.rect(x, y + 3, 2, 2, P.mauve)
      dull.rect(x, y + 3, 2, 2, b.body).dot(x, y + 3, P.cream)
    }
  }
  if (lit) BULBS.forEach((b, i) => defsOut.push(`<radialGradient id="qwb${i}"><stop offset="0" stop-color="${b.body}"/><stop offset="1" stop-color="${b.body}" stop-opacity="0"/></radialGradient>`))
  return (
    (defsOut.length > 0 ? `<defs>${defsOut.join('')}</defs>` : '') +
    `<g class="pw-fy">${glows}${wire.svg()}${nails.svg()}${bulbs.svg()}${dull.svg('opacity=".45"')}${chase}</g>`
  )
}

// The window's light on the floor: near and far dither by the weather and
// the hour, and whether the rain's shadows slide through it.
function floorLook(phase: Phase, weather: Weather): { near: string; far: string; shadows: number } {
  const wet = weather === 'rain' ? 9 : weather === 'drizzle' ? 5 : 0
  if (weather === 'fog') {
    const dim = phase === 'day' ? pat('t4') : phase === 'night' ? pat('s4') : pat('w4')
    return { near: dim, far: dim, shadows: 0 }
  }
  if (weather === 'snow') {
    if (phase === 'day') return { near: pat('i8'), far: pat('t8'), shadows: 0 }
    if (phase === 'night') return { near: pat('t8'), far: pat('t4'), shadows: 0 }
    return { near: pat('t8'), far: pat('r4'), shadows: 0 }
  }
  if (weather === 'clear') {
    if (phase === 'day') return { near: pat('i8'), far: pat('t8'), shadows: 0 }
    if (phase === 'night') return { near: pat('t4'), far: pat('s8'), shadows: 0 }
    return { near: phase === 'dawn' ? pat('b4') : pat('r8'), far: pat('r4'), shadows: 0 }
  }
  if (phase === 'day') return { near: pat('t8'), far: pat('t4'), shadows: wet }
  if (phase === 'dusk') return { near: pat('r4'), far: pat('w8'), shadows: wet }
  if (phase === 'dawn') return { near: pat('r4'), far: pat('a2'), shadows: wet }
  return { near: pat('s8'), far: pat('s4'), shadows: wet }
}

/** The window's light across the floor, dithered, with rain shadows sliding through it. */
function floorLight(phase: Phase, weather: Weather): string {
  const rows = new Layer()
  const clip: string[] = []
  const look = floorLook(phase, weather)
  for (let y = FLOOR + 2; y < 200; y += 1) {
    const t = y - FLOOR
    const x0 = Math.round(30 + t * 1.25)
    const x1 = Math.round(96 + t * 1.9)
    const mid = Math.round((x0 + x1) / 2)
    const fill = t < 16 ? look.near : look.far
    // The mullion's shadow splits the patch in two.
    rows.rect(x0, y, mid - 1 - x0, 1, fill)
    rows.rect(mid + 2, y, x1 - mid - 2, 1, fill)
    if (look.shadows > 0) clip.push(`<rect x="${x0}" y="${y}" width="${x1 - x0}" height="1"/>`)
  }
  if (look.shadows === 0) return rows.svg()
  const random = seeded(47)
  let shadows = ''
  for (let i = 0; i < look.shadows; i += 1) {
    const x = 40 + Math.floor(random() * 100)
    const y = FLOOR + Math.floor(random() * 20)
    shadows += `<rect class="pr-sh" x="${x}" y="${y}" width="1" height="2" fill="${P.ink}" style="animation-duration:${fixed(9 + random() * 8)}s;animation-delay:-${fixed(random() * 12)}s"/>`
  }
  return `<defs><clipPath id="prpatch">${clip.join('')}</clipPath></defs>` + rows.svg() + `<g clip-path="url(#prpatch)" opacity=".5">${shadows}</g>`
}

/** A clear day's sunbeam: a soft slanted shaft from the window to the floor, dust drifting in it. */
function sunbeam(): string {
  const g = GLASS
  // A faint wide shaft and a narrower core inside it, so its edges fall off softly.
  const shaft = `M${g.x} ${g.y + 40}L${g.x + g.w} ${g.y + 20}L172 200L80 200L30 ${FLOOR}L${g.x} ${BOTTOM}Z`
  const core = `M${g.x + 8} ${g.y + 52}L${g.x + g.w - 6} ${g.y + 36}L152 200L98 200L42 ${FLOOR}L${g.x + 6} ${BOTTOM}Z`
  const gradient =
    `<defs><linearGradient id="qwbeam" gradientUnits="userSpaceOnUse" x1="50" y1="${BOTTOM - 20}" x2="130" y2="200">` +
    `<stop offset="0" stop-color="${P.cream}" stop-opacity="0"/><stop offset=".25" stop-color="${P.cream}" stop-opacity=".1"/><stop offset="1" stop-color="${P.cream}" stop-opacity=".02"/></linearGradient></defs>`
  const random = seeded(53)
  let motes = ''
  for (let i = 0; i < 10; i += 1) {
    // Spread along the shaft, from under the sill to above the floor.
    const t = (i + random() * 0.8) / 10
    const y = Math.round(126 + t * 50)
    const x = Math.round(36 + t * 72 + (random() - 0.5) * 26)
    motes += block('pw-mo', x, y, 1, 1, i % 3 === 0 ? P.cream : P.mist, `animation-duration:${fixed(10 + random() * 10)}s;animation-delay:-${fixed(random() * 20)}s`, i % 2 === 0 ? 0.7 : 0.45)
  }
  return `<g class="pw-sb pr-tall-hide">${gradient}<path d="${shaft}" fill="url(#qwbeam)" opacity=".6"/><path d="${core}" fill="url(#qwbeam)" opacity=".7"/>${motes}</g>`
}

/** Everything of the window wall but the cat. */
export function windowPart(input: SceneInput, time: Clock): string {
  const g = GLASS
  const { phase, weather } = input
  const moonUp = isMoonUp(phase, weather, input.moon)
  const m = moonUp ? moon(input, time) : undefined
  let glass = sky(phase)
  if (weather === 'clear' && phase !== 'day') glass += stars(phase, m?.box)
  if (phase === 'dawn') glass += sun(weather)
  if (weather === 'clear' && phase === 'day') glass += clouds()
  if (m !== undefined) glass += m.svg
  glass += farCity(phase, weather) + cityGlow(phase, weather)
  if (weather === 'fog') glass += haze('qwfog', g.y, phase === 'day' ? 0.7 : 0.38)
  glass += nearCity(phase, weather)
  if (weather === 'fog') glass += fog(phase)
  if (input.flourish === 'plane') glass += plane()
  if (weather === 'rain') glass += rain(phase)
  else if (weather === 'drizzle') glass += drizzle(phase)
  else if (weather === 'snow') glass += snow(phase)
  return (
    `<defs><clipPath id="prglass"><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}"/></clipPath></defs>` +
    `<g class="pr-fp">${floorLight(phase, weather)}</g>` +
    `<g class="pr-bk">${input.lampOn ? candleGlow() : ''}${shelf()}</g>` +
    `<g clip-path="url(#prglass)">${glass}</g>` +
    windowFrame() +
    `<g class="pr-tall-hide">${ornament(input.season)}</g>` +
    fairyLights(input) +
    (weather === 'clear' && phase === 'day' ? sunbeam() : '')
  )
}
