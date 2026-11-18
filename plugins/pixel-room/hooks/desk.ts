// The desk wall: a desk with a lamp, a small monitor that shows what Claude
// is up to, a steaming mug and a notebook, headphones on the monitor, a
// hanging calendar, a corkboard of sticky notes for Claude's todo list, a wall
// shelf with a trailing plant, a round clock that keeps the real time, moths
// at the light, and a rug on the floor. The cat on the floor is cat.ts's.

import { glyphText, textWidth } from './font'
import type { Clock, LocalDate, Notes, SceneInput } from './model'
import { FLOOR, P, pat } from './paint'
import { Layer, ditherPattern, seeded } from './pixels'
import { rle } from './sprites'

/** The lit bulb under the shade, and the middle of the screen: what moths circle. */
const BULB = { x: 242, y: 105 }
const SCREEN = { x: 266, y: 98, w: 28, h: 18 }
const DESK = { x: 214, y: 126, w: 100 }

/** Each moth's orbit: radii, period in seconds, starting angle, direction. */
const ORBITS = [
  { rx: 7, ry: 4, period: 5.4, start: 0.4, dir: 1 },
  { rx: 11, ry: 6, period: 7.2, start: 2.6, dir: -1 },
  { rx: 14, ry: 7, period: 8.8, start: 4.4, dir: 1 },
] as const

/** An orbit's points from its start, whole pixels, each a step of about a pixel and a half. */
function orbitPoints(o: (typeof ORBITS)[number]): [number, number][] {
  const around = Math.PI * (3 * (o.rx + o.ry) - Math.sqrt((3 * o.rx + o.ry) * (o.rx + 3 * o.ry)))
  const n = Math.min(Math.round(around / 1.5), Math.floor(o.period / 0.17))
  const at = (i: number): [number, number] => {
    const a = o.start + (o.dir * i * Math.PI * 2) / n
    return [Math.round(Math.cos(a) * o.rx), Math.round(Math.sin(a) * o.ry + Math.sin(a * 3))]
  }
  const [x0, y0] = at(0)
  return Array.from({ length: n }, (_, i) => {
    const [x, y] = at(i)
    return [x - x0, y - y0]
  })
}

/** An orbit as keyframes of whole-pixel steps, repeats left out. */
function orbitKeyframes(i: number): string {
  const points = orbitPoints(ORBITS[i] ?? ORBITS[0])
  let frames = ''
  let last = ''
  points.forEach(([x, y], k) => {
    const at = `${x}px,${y}px`
    if (at === last) return
    last = at
    frames += `${+((k * 100) / points.length).toFixed(2)}%{transform:translate(${at})}`
  })
  return `@keyframes pd-o${i}{${frames}100%{transform:translate(0,0)}}`
}

export const DESK_CSS = [
  '.pr-cd{animation:pr-scroll 16s steps(12,end) infinite}',
  '.pr-cu{animation:pr-blink2 1.1s step-end infinite}',
  '.pr-sm{opacity:0;animation:pr-steam 3.9s steps(6,end) infinite}',
  '.pr-gl{animation:pr-hum 9s step-end infinite}',
  '.pr-mh,.pr-hh{opacity:0}',
  '.pr-mh{animation:pr-tick 3600s step-end infinite}',
  '.pr-hh{animation:pr-tick 43200s step-end infinite}',
  '.pr-on{opacity:1}',
  '.pd-fk{animation:pd-flick 1.2s step-end .3s forwards}',
  '.pd-hl{animation:pd-down 16s steps(8,end) infinite}',
  '.pd-ex{animation:pr-blink2 2s step-end infinite}',
  '.pd-sd{animation:pd-drift 84s steps(28,end) infinite}',
  '.pd-pl{animation:pd-cross 40s steps(36,end) infinite}',
  '.pd-na{animation:pd-swing 3.2s step-end infinite}',
  '.pd-wa{animation:pr-blink2 .36s step-end infinite}',
  '.pd-wb{opacity:0;animation:pr-blink2 .36s step-end infinite reverse}',
  ...ORBITS.map((o, i) => `.pd-o${i}{animation:pd-o${i} ${o.period}s step-end infinite}`),
  '@keyframes pr-scroll{from{transform:translateY(0)}to{transform:translateY(-24px)}}',
  '@keyframes pr-blink2{0%{opacity:1}50%{opacity:0}}',
  '@keyframes pr-steam{0%{transform:translateY(0);opacity:0}15%{opacity:.8}100%{transform:translateY(-6px);opacity:0}}',
  '@keyframes pr-hum{0%{opacity:1}96%{opacity:.85}98%{opacity:1}}',
  '@keyframes pr-tick{0%{opacity:1}8.333%,100%{opacity:0}}',
  '@keyframes pd-flick{0%{opacity:1}20%{opacity:.6}40%{opacity:1}60%{opacity:.6}80%,100%{opacity:1}}',
  '@keyframes pd-down{to{transform:translateY(16px)}}',
  '@keyframes pd-drift{to{transform:translateX(-28px)}}',
  '@keyframes pd-cross{75%,100%{transform:translateX(36px)}}',
  '@keyframes pd-swing{0%{transform:translateX(0)}50%{transform:translateX(1px)}}',
  ...ORBITS.map((_, i) => orbitKeyframes(i)),
].join('')

/** A soft elliptical glow of one colour, strongest at its middle. */
function glow(id: string, cx: number, cy: number, rx: number, ry: number, color: string, opacity: number): string {
  return (
    `<defs><radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/>` +
    `<stop offset=".45" stop-color="${color}" stop-opacity="${+(opacity * 0.45).toFixed(3)}"/>` +
    `<stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs>` +
    `<rect x="${cx - rx}" y="${cy - ry}" width="${rx * 2}" height="${ry * 2}" fill="url(#${id})"/>`
  )
}

/** The lamp's light: humming while lit, and flickering twice when the cat startles. */
function lit(input: SceneInput, inner: string): string {
  const glowing = `<g class="pr-gl">${inner}</g>`
  return input.cat === 'startled' ? `<g class="pd-fk">${glowing}</g>` : glowing
}

/** The warm light on the wall behind the lamp, under everything on the wall. */
function lampWall(input: SceneInput): string {
  if (!input.lampOn) return ''
  return lit(input, glow('pdwall', BULB.x, 102, 52, 40, P.amber, 0.2))
}

function lamp(input: SceneInput): string {
  const l = new Layer()
  const on = input.lampOn
  // Base, a jointed arm, and a shade tipped toward the desk.
  l.rect(224, 123, 11, 3, P.mauve)
  l.rect(224, 123, 11, 1, P.dusk)
  l.rect(228, 111, 2, 12, P.dusk)
  l.rect(229, 111, 1, 12, P.mauve)
  for (let i = 0; i < 6; i += 1) l.rect(229 + i, 110 - i, 2, 1, P.dusk)
  l.rect(227, 110, 3, 2, P.rose)
  l.rect(234, 104, 2, 3, P.mauve)
  l.rect(235, 103, 3, 2, P.dusk)
  const shade = on ? { a: P.ember, b: P.rust, c: P.amber } : { a: P.mauve, b: P.aubergine, c: P.dusk }
  l.sprite(rle(['3.4c4.', '2.6a3.', '.8a2.', '9ab.', '10bb', '12b']), { a: shade.a, b: shade.b, c: shade.c }, 236, 98)
  l.rect(240, 104, 6, 1, on ? P.cream : P.mauve)
  if (!on) return l.svg()
  // The lit bulb's cone onto the desk, and a dithered halo on the wall behind.
  const cone = new Layer()
  for (let y = 105; y < 126; y += 1) {
    const t = y - 105
    const x0 = Math.round(240 - t * 0.85)
    const x1 = Math.round(246 + t * 1.15)
    cone.rect(x0, y, x1 - x0, 1, t < 4 ? pat('a4') : t < 11 ? pat('e4') : pat('x8'))
  }
  const halo = new Layer()
  for (let y = 76; y < 126; y += 1) {
    for (const [r, id] of [[30, 'w4'], [21, 'w8'], [13, 'w12']] as const) {
      const dy = (y - 108) * 1.15
      if (Math.abs(dy) >= r) continue
      const half = Math.round(Math.sqrt(r * r - dy * dy) * 1.4)
      halo.rect(242 - half, y, half * 2, 1, pat(id))
    }
  }
  return lit(input, halo.svg()) + l.svg() + lit(input, cone.svg())
}

/** The pool of lamplight on the desk top and its spill onto the floor under the desk's front. */
function lampPool(input: SceneInput): string {
  if (!input.lampOn) return ''
  const pool = new Layer()
  pool.rect(224, 126, 48, 1, P.ember)
  pool.rect(230, 126, 32, 1, P.amber)
  return lit(
    input,
    pool.svg() + glow('pdpool', 245, 125, 34, 5, P.amber, 0.45) + glow('pdspill', 246, 162, 40, 6, P.amber, 0.12),
  )
}

/** How strongly the screen lights the wall, by what it shows. */
const SCREEN_LIGHT = { idle: 0.3, working: 1, error: 0.6, done: 0.6 } as const

/** The screen's cool light on the wall around the monitor. */
function screenWall(input: SceneInput): string {
  return glow('pdscr', 280, 106, 34, 26, P.steel, +(0.22 * SCREEN_LIGHT[input.monitor]).toFixed(3))
}

/** A dozen lines of code, seeded, as [indent, width, colour]. */
function codeLines(): [number, number, string][] {
  const random = seeded(23)
  const colors = [P.leaf, P.steel, P.amber, P.rose, P.steel, P.leaf]
  const lines: [number, number, string][] = []
  for (let i = 0; i < 12; i += 1) {
    const indent = [0, 2, 4, 2, 4, 6][Math.floor(random() * 6)] ?? 0
    const w = 5 + Math.floor(random() * (SCREEN.w - 10 - indent))
    lines.push([indent, w, colors[i % colors.length] ?? P.leaf])
  }
  return lines
}

/** Lines of code from row `from`, `copies` times over so a scroll can wrap. */
function code(lines: [number, number, string][], copies: number, skip = -1): Layer {
  const s = SCREEN
  const layer = new Layer()
  for (let copy = 0; copy < copies; copy += 1) {
    lines.forEach(([indent, w, color], i) => {
      if (i === skip) return
      const y = s.y + 2 + (copy * 12 + i) * 2
      if (w > 9 && i % 3 === 1) {
        layer.rect(s.x + 2 + indent, y, 3, 1, P.rose)
        layer.rect(s.x + 6 + indent, y, w - 4, 1, color)
      } else layer.rect(s.x + 2 + indent, y, w, 1, color)
    })
  }
  return layer
}

/**
 * What the screen shows: a screensaver, scrolling code, a stopped red line,
 * a green check. The second part sits over the screen's scanlines, crisp.
 */
function screen(input: SceneInput): [string, string] {
  const s = SCREEN
  const lines = codeLines()
  if (input.monitor === 'idle') {
    // Dim stars drifting left, twice over for the wrap, and a small ringed planet now and then.
    const stars = new Layer()
    const random = seeded(41)
    for (let i = 0; i < 9; i += 1) {
      const x = Math.floor(random() * s.w)
      const y = 1 + Math.floor(random() * (s.h - 2))
      const color = i % 3 === 0 ? P.steel : P.dusk
      stars.dot(s.x + x, s.y + y, color).dot(s.x + x + s.w, s.y + y, color)
    }
    const planet = new Layer()
    planet.sprite(rle(['2.2r3.', '.r2dv2.', 's2dvv2s', '.d3v2.', '2.2v3.']), { r: P.rose, d: P.dusk, v: P.mauve, s: P.steel }, s.x - 7, s.y + 4)
    return [`<g opacity=".7"><g class="pd-sd">${stars.svg()}</g><g class="pd-pl">${planet.svg()}</g></g>`, '']
  }
  if (input.monitor === 'working') {
    return [
      `<rect class="pd-hl" x="${s.x}" y="${s.y + 1}" width="${s.w}" height="3" fill="${P.steel}" opacity=".16"/>` +
        `<g class="pr-cd" opacity=".85">${code(lines, 2).svg()}</g>`,
      '',
    ]
  }
  if (input.monitor === 'error') {
    // The code stops on a line, barred in rust, with a slow `!` beside it.
    const bad = 4
    const y = s.y + 2 + bad * 2
    const mark = new Layer()
    mark.rect(s.x + s.w - 5, y - 3, 3, 7, P.rust)
    glyphText(mark, '!', s.x + s.w - 4, y - 2, P.amber)
    const bar = new Layer()
    bar.rect(s.x, y - 1, s.w - 6, 3, P.rust)
    bar.rect(s.x + 2, y, Math.min((lines[bad]?.[1] ?? 10) + 2, s.w - 10), 1, P.cream)
    return [
      `<g opacity=".55">${code(lines, 1, bad).svg()}</g>`,
      `<g opacity=".85">${bar.svg()}</g><g class="pd-ex">${mark.svg()}</g>`,
    ]
  }
  // Done: the last lines of output, dim, and a green prompt with a check.
  const prompt = new Layer()
  const y = s.y + s.h - 5
  prompt.sprite(rle(['4.l', '3.l.', 'l.l2.', '.l3.']), { l: P.leaf }, s.x + 2, y - 1)
  prompt.rect(s.x + 8, y + 1, 8, 1, P.leaf)
  return [`<g opacity=".35">${code(lines.slice(0, 5), 1).svg()}</g>`, prompt.svg()]
}

function monitor(input: SceneInput): string {
  const m = new Layer()
  const s = SCREEN
  // A small CRT: a rounded case, a recessed screen, a stand.
  m.sprite(
    rle([
      '2.32v2.',
      '.v32dv.',
      'v34dv',
      ...Array<string>(20).fill('vd32ivv'),
      'v34uv',
      '.v32uv.',
      '2.32v2.',
    ]),
    { v: P.mauve, d: P.dusk, u: P.aubergine, i: P.ink },
    262,
    94,
  )
  m.rect(276, 120, 8, 4, P.aubergine)
  m.rect(272, 124, 16, 2, P.mauve)
  m.rect(272, 124, 16, 1, P.dusk)
  // Headphones hung over the case's corner, an ear cup resting on its side.
  m.sprite(
    rle(['5.5b7.', '3.2b5.2b5.', '2.b9.b4.', '.b11.b3.', '13.b3.', '13.b3.', '12.4k.', '11.kr3mk', '11.kr3mk', '11.kr3mk', '11.kr3mk', '12.4k.']),
    { k: P.ink, b: P.dusk, r: P.rose, m: P.mauve },
    287,
    90,
  )
  const working = input.monitor === 'working' || input.monitor === 'done'
  const cursor = working
    ? `<rect class="pr-cu" x="${input.monitor === 'done' ? s.x + 18 : s.x + 2}" y="${s.y + s.h - (input.monitor === 'done' ? 4 : 3)}" width="2" height="1" fill="${P.cream}"/>`
    : ''
  const light = SCREEN_LIGHT[input.monitor]
  const [under, over] = screen(input)
  const glowColor = input.phase === 'day' ? P.steel : P.sea
  return (
    m.svg() +
    `<defs><clipPath id="prscreen"><rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}"/></clipPath></defs>` +
    `<g clip-path="url(#prscreen)"><rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${P.night}"/>` +
    under +
    `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${pat('k1')}"/>${over}</g>` +
    cursor +
    // The screen's faint light on the desk in front of it.
    `<rect x="264" y="126" width="32" height="1" fill="${glowColor}" opacity="${+(0.6 * Math.max(light, 0.5)).toFixed(2)}"/>`
  )
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** Where the wall calendar hangs: its left edge, and the row just above its header. */
export const CALENDAR = { x: 247, y: 68, w: 15 }

/** A small calendar hung on a nail between the plant and the board: the month on a rust header, the day on a cream page. */
function calendar(date: LocalDate): string {
  const c = new Layer()
  const { x, y, w } = CALENDAR
  // The nail, and the string from it to the header's corners.
  const mid = x + Math.floor(w / 2)
  const hang = new Layer()
  hang.dot(mid, y - 2, P.mist).dot(mid, y - 1, P.dusk)
  hang.dot(mid - 1, y - 1, P.rose).dot(mid - 2, y, P.rose).dot(mid + 1, y - 1, P.rose).dot(mid + 2, y, P.rose)
  // The header, lit at its top and left.
  c.rect(x, y + 1, w, 7, P.rust)
  c.rect(x, y + 1, w, 1, P.ember)
  c.rect(x, y + 1, 1, 7, P.ember)
  c.rect(x + w - 1, y + 2, 1, 6, P.umber)
  c.rect(x, y + 7, w, 1, P.umber)
  // The page, and the next pages' edges below it.
  c.rect(x, y + 8, w, 6, P.cream)
  c.rect(x + w - 1, y + 8, 1, 6, P.rose)
  c.dot(x, y + 14, P.dusk).dot(x + w - 1, y + 14, P.dusk)
  c.rect(x + 1, y + 14, w - 2, 1, P.rose)
  c.rect(x + 1, y + 15, w - 2, 1, P.dusk)
  // Its shadow on the wall, to the right and below.
  c.rect(x + w, y + 2, 1, 14, pat('k2'))
  c.rect(x + 2, y + 16, w - 1, 1, pat('k2'))
  // The month and the day, each its own layer over the paper.
  const month = MONTHS[date.month] ?? 'JAN'
  const day = String(Math.min(Math.max(Math.floor(date.day), 1), 31))
  const words = new Layer()
  glyphText(words, month, x + Math.ceil((w - textWidth(month)) / 2), y + 2, P.cream)
  const digits = new Layer()
  glyphText(digits, day, x + Math.floor((w - textWidth(day)) / 2), y + 9, P.night)
  return hang.svg() + c.svg() + words.svg() + digits.svg()
}

function deskThings(input: SceneInput): string {
  const d = new Layer()
  // Desk top and front edge, legs, a drawer.
  d.rect(DESK.x, DESK.y, DESK.w, 1, P.rose)
  d.rect(DESK.x, DESK.y + 1, DESK.w, 2, P.dusk)
  d.rect(DESK.x, DESK.y + 3, DESK.w, 1, P.mauve)
  d.rect(DESK.x + 4, DESK.y + 4, 3, FLOOR - DESK.y - 4, P.mauve)
  d.rect(DESK.x + 4, DESK.y + 4, 1, FLOOR - DESK.y - 4, P.dusk)
  d.rect(DESK.x + DESK.w - 7, DESK.y + 4, 3, FLOOR - DESK.y - 4, P.aubergine)
  d.rect(DESK.x + 62, DESK.y + 4, 30, 16, P.mauve)
  d.rect(DESK.x + 62, DESK.y + 4, 30, 1, P.aubergine)
  d.rect(DESK.x + 63, DESK.y + 11, 28, 1, P.aubergine)
  d.rect(DESK.x + 75, DESK.y + 7, 4, 1, P.rose)
  d.rect(DESK.x + 75, DESK.y + 14, 4, 1, P.rose)
  d.rect(DESK.x + 62, DESK.y + 20, 30, 1, P.aubergine)
  // The desk's shadow on the floor.
  d.rect(DESK.x + 2, FLOOR, DESK.w - 4, 2, pat('k2'))
  // A mug of tea and its handle.
  d.sprite(rle(['k5ck.', 'kc4ck.', 'kc2r2ckk', 'kc4c.k', 'kc4ckk', '.k4k2.']), { k: P.umber, c: P.cream, r: P.rust }, 300, 120)
  // A notebook with a pencil on it.
  d.rect(250, 124, 10, 1, P.cream)
  d.rect(250, 125, 10, 1, P.rose)
  d.rect(251, 123, 8, 1, P.amber)
  d.dot(259, 123, P.umber)
  const steam = [0, 1, 2]
    .map(i => `<rect class="pr-sm" x="${302 + (i % 2)}" y="117" width="1" height="1" fill="${P.mist}" style="animation-delay:${(i * 1.3).toFixed(1)}s"/>`)
    .join('')
  return d.svg() + steam
}

/** A wall shelf with a trailing plant and two books. */
function plantShelf(): string {
  const s = new Layer()
  s.rect(222, 62, 40, 2, P.dusk)
  s.rect(222, 62, 40, 1, P.rose)
  s.rect(224, 64, 2, 3, P.aubergine)
  s.rect(258, 64, 2, 3, P.aubergine)
  s.rect(222, 64, 40, 1, pat('k2'))
  // Two books and a little clay pot.
  s.rect(248, 51, 3, 11, P.sea)
  s.rect(251, 53, 3, 9, P.rust)
  s.rect(254, 50, 2, 12, P.moss)
  s.rect(248, 52, 3, 1, P.cream)
  s.rect(251, 54, 3, 1, P.cream)
  s.sprite(rle(['k8k', 'k2r6uk', '.kr5uk.', '.kr5uk.', '.k6uk.', '2.5k2.']), { k: P.umber, r: P.rust, u: P.umber }, 230, 56)
  // Leaves heaped on the pot and vines trailing over the edge.
  const leaves = rle([
    '4.2l2.2l5.',
    '2.l2gl2.lgl2.l.',
    '.lglm2lglmlgl.',
    'lgm.mlgm2.mlg',
  ])
  s.sprite(leaves, { l: P.leaf, g: P.moss, m: P.moss }, 228, 52)
  const vine = (x: number, length: number, seed: number) => {
    const random = seeded(seed)
    let vx = x
    for (let y = 63; y < 63 + length; y += 1) {
      s.dot(vx, y, P.moss)
      if (y % 3 === 0) {
        const side = random() < 0.5 ? -1 : 1
        s.dot(vx + side, y, P.leaf)
        s.dot(vx + side * 2, y, P.leaf)
        s.dot(vx + side, y + 1, P.moss)
      }
      if (random() < 0.25) vx += random() < 0.5 ? -1 : 1
    }
  }
  vine(231, 30, 3)
  vine(236, 18, 8)
  vine(241, 24, 12)
  return s.svg()
}

/** A round wall clock whose hands step with the real time. */
function clock(time: Clock): string {
  const cx = 290
  const cy = 46
  const face = new Layer()
  face.sprite(
    rle([
      '4.5k4.',
      '2.2k5c2k2.',
      '.k9ck.',
      '.k9ck.',
      'k11ck',
      'k11ck',
      'k5cu5ck',
      'k11ck',
      'k11ck',
      '.k9ck.',
      '.k9ck.',
      '2.2k5c2k2.',
      '4.5k4.',
    ]),
    { k: P.mauve, c: P.cream, u: P.umber },
    cx - 6,
    cy - 6,
  )
  face.dot(cx, cy - 5, P.rose).dot(cx + 5, cy, P.rose).dot(cx, cy + 5, P.rose).dot(cx - 5, cy, P.rose)
  face.rect(cx - 6, cy + 7, 13, 1, pat('k2'))
  const hand = (steps: number, length: number) => {
    const angle = (steps / 12) * Math.PI * 2
    const layer = new Layer()
    for (let r = 1; r <= length; r += 1) layer.dot(Math.round(cx + Math.sin(angle) * r), Math.round(cy - Math.cos(angle) * r), P.umber)
    return layer.svg()
  }
  const secondsIntoHour = time.minute * 60 + time.second
  const secondsIntoHalfDay = (time.hour % 12) * 3600 + secondsIntoHour
  let hands = ''
  for (let i = 0; i < 12; i += 1) {
    const minuteNow = Math.floor(secondsIntoHour / 300) === i
    const hourNow = Math.floor(secondsIntoHalfDay / 3600) === i
    const minuteDelay = (((300 * i - secondsIntoHour) % 3600) + 3600) % 3600 - 3600
    const hourDelay = (((3600 * i - secondsIntoHalfDay) % 43200) + 43200) % 43200 - 43200
    hands += `<g class="pr-mh${minuteNow ? ' pr-on' : ''}" style="animation-delay:${minuteDelay}s">${hand(i, 4)}</g>`
    hands += `<g class="pr-hh${hourNow ? ' pr-on' : ''}" style="animation-delay:${hourDelay}s">${hand(i, 2)}</g>`
  }
  return face.svg() + hands
}

/** The corkboard, in art pixels: a wood frame round a cork field. */
const BOARD = { x: 266, y: 58, w: 46, h: 30 }

/** A note's place on the board, slot 0 to 5, three across and two down. */
function slot(i: number): [number, number] {
  return [BOARD.x + 7 + (i % 3) * 12, BOARD.y + 6 + Math.floor(i / 3) * 11]
}

/** A pin's round head, lit at its top left. */
function pin(layer: Layer, x: number, y: number): void {
  layer.dot(x, y, P.mist).dot(x + 1, y, P.steel).dot(x, y + 1, P.steel).dot(x + 1, y + 1, P.sea)
}

type NoteKind = 'done' | 'active' | 'open' | 'more'

/** One sticky note at (x, y), 8 by 7, its shadow on the cork. */
function note(kind: NoteKind, x: number, y: number): string {
  const n = new Layer()
  const [body, shade, ink] =
    kind === 'done' ? [P.leaf, P.moss, P.moss] : kind === 'active' ? [P.amber, P.ember, P.ember] : [P.cream, P.rose, P.rose]
  n.rect(x + 1, y + 1, 8, 7, pat('k2'))
  n.rect(x, y, 8, 7, body)
  n.rect(x, y + 6, 7, 1, shade)
  n.rect(x + 7, y + 1, 1, 6, shade)
  n.dot(x + 7, y + 6, P.umber)
  if (kind === 'done') n.sprite(rle(['5.l', '4.l.', 'l2.l2.', '.2l3.']), { l: ink }, x + 1, y + 1)
  else if (kind === 'more') glyphText(n, '+', x + 2, y + 1, P.dusk)
  else {
    n.rect(x + 1, y + 2, 5, 1, ink)
    n.rect(x + 1, y + 4, 3, 1, ink)
  }
  const cls = kind === 'done' ? 'pd-nd' : kind === 'active' ? 'pd-na' : kind === 'open' ? 'pd-no' : 'pd-nm'
  return `<g class="pd-n ${cls}">${n.svg()}</g>`
}

/** The board's notes in order, done then under way then waiting; past six the last shows a `+`. */
export function noteKinds(notes: Notes): NoteKind[] {
  const all: NoteKind[] = [
    ...Array<NoteKind>(Math.max(0, notes.done)).fill('done'),
    ...Array<NoteKind>(Math.max(0, notes.active)).fill('active'),
    ...Array<NoteKind>(Math.max(0, notes.open)).fill('open'),
  ]
  return all.length > 6 ? [...all.slice(0, 5), 'more'] : all
}

/** A corkboard of Claude's todo list, or of keepsakes when there is no list. */
function corkboard(notes: Notes): string {
  const { x, y, w, h } = BOARD
  const b = new Layer()
  // The frame: lit top and left, shaded bottom and right, outlined.
  b.rect(x, y, w, h, P.aubergine)
  b.rect(x + 1, y + 1, w - 2, h - 2, P.dusk)
  b.rect(x + 1, y + 1, w - 2, 1, P.rose)
  b.rect(x + 1, y + 1, 1, h - 2, P.rose)
  b.rect(x + 1, y + h - 2, w - 2, 1, P.mauve)
  b.rect(x + w - 2, y + 2, 1, h - 3, P.mauve)
  // The cork, flecked, shadowed under the frame's top.
  b.rect(x + 3, y + 3, w - 6, h - 6, P.umber)
  b.rect(x + 3, y + 3, w - 6, 1, pat('k2'))
  b.rect(x + 3, y + 4, 1, h - 7, pat('k1'))
  const random = seeded(17)
  for (let i = 0; i < 90; i += 1) b.dot(x + 4 + Math.floor(random() * (w - 8)), y + 4 + Math.floor(random() * (h - 8)), i % 4 ? P.rust : P.night)
  b.rect(x + 1, y + h, w, 1, pat('k2'))
  const kinds = noteKinds(notes)
  if (kinds.length > 0) {
    const pins = new Layer()
    const drawn = kinds.map((kind, i) => {
      const [nx, ny] = slot(i)
      pin(pins, nx + 3, ny - 1)
      return note(kind, nx, ny)
    })
    return b.svg() + drawn.join('') + pins.svg()
  }
  return b.svg() + keepsakes()
}

/** With no list: a polaroid of a cat, a postcard of the sea, a ticket stub. */
function keepsakes(): string {
  const { x, y } = BOARD
  // The polaroid: a cream mount, an evening photo, a cat sitting in it.
  let k = new Layer()
  k.rect(x + 7, y + 6, 10, 12, pat('k2'))
  k.rect(x + 6, y + 5, 10, 12, P.cream)
  k.rect(x + 6, y + 16, 10, 1, P.rose)
  k.rect(x + 15, y + 6, 1, 10, P.rose)
  k.rect(x + 7, y + 6, 8, 5, P.steel)
  k.rect(x + 7, y + 11, 8, 2, P.sea)
  k.dot(x + 13, y + 7, P.cream)
  k.sprite(rle(['l.l3.', '3l3.', '3l2.l', '5l.', '6l']), { l: P.ink }, x + 8, y + 8)
  pin(k, x + 10, y + 4)
  let out = k.svg()
  k = new Layer()
  // The postcard: a sun going down into the sea, in a pale border.
  k.rect(x + 20, y + 9, 14, 9, pat('k2'))
  k.rect(x + 19, y + 8, 14, 9, P.mist)
  k.rect(x + 19, y + 16, 14, 1, P.steel)
  k.rect(x + 32, y + 9, 1, 7, P.steel)
  k.rect(x + 20, y + 9, 12, 2, P.dusk)
  k.rect(x + 20, y + 11, 12, 1, P.rose)
  k.rect(x + 20, y + 12, 12, 3, P.sea)
  k.rect(x + 20, y + 15, 12, 1, P.night)
  k.rect(x + 25, y + 10, 2, 1, P.amber).rect(x + 24, y + 11, 4, 1, P.amber)
  k.rect(x + 23, y + 12, 6, 1, P.ember).rect(x + 25, y + 13, 3, 1, P.rust).rect(x + 24, y + 14, 2, 1, P.rust)
  pin(k, x + 25, y + 7)
  out += k.svg()
  k = new Layer()
  // The ticket stub, its torn edge perforated, pinned at a corner.
  k.rect(x + 25, y + 21, 13, 5, pat('k2'))
  k.rect(x + 24, y + 20, 13, 5, P.rose)
  k.rect(x + 24, y + 24, 13, 1, P.dusk)
  for (let py = y + 20; py < y + 25; py += 2) k.dot(x + 33, py, P.mauve)
  k.rect(x + 26, y + 22, 5, 1, P.cream)
  k.rect(x + 34, y + 21, 2, 3, P.cream)
  pin(k, x + 36, y + 19)
  return out + k.svg()
}

/** Moths circling the lamp while it's lit, else the screen, each on its own orbit. */
function moths(input: SceneInput): string {
  const count = Math.max(0, Math.min(3, Math.floor(input.moths)))
  const centre = input.lampOn ? BULB : { x: 280, y: 107 }
  let out = ''
  for (let i = 0; i < count; i += 1) {
    const o = ORBITS[i] ?? ORBITS[0]
    const x = centre.x + Math.round(Math.cos(o.start) * o.rx)
    const y = centre.y + Math.round(Math.sin(o.start) * o.ry + Math.sin(o.start * 3))
    const up = new Layer().dot(x - 1, y - 1, P.mist).dot(x + 1, y - 1, P.mist)
    const flat = new Layer().dot(x - 1, y, P.mist).dot(x + 1, y, P.mist)
    const body = new Layer().dot(x, y, P.cream)
    const flap = `style="animation-delay:-${(i * 0.13).toFixed(2)}s"`
    out +=
      `<g class="pd-m pd-o${i}" style="animation-delay:-${(i * 1.7).toFixed(1)}s">` +
      `<g class="pd-wa" ${flap}>${up.svg()}</g><g class="pd-wb" ${flap}>${flat.svg()}</g>${body.svg()}</g>`
  }
  return out
}

/** The rug under the floor cat: a woven rug in gentle perspective, its border and diamonds faint. */
function rug(input: SceneInput): string {
  const top = 166
  const rows = 24
  const base = new Layer()
  const r = new Layer()
  const shade = new Layer()
  for (let row = 0; row < rows; row += 1) {
    const y = top + row
    const t = row / (rows - 1)
    const x0 = Math.round(184 - 8 * t)
    const x1 = Math.round(296 + 8 * t)
    const v = row * 2
    base.rect(x0, y, x1 - x0, 1, P.umber)
    // Each pixel by where it falls on the rug, 128 across and 48 deep.
    const ink = (x: number): string => {
      const u = ((x - x0 + 0.5) / (x1 - x0)) * 128
      const edgeU = Math.min(u, 128 - u)
      const edgeV = Math.min(v, 46 - v)
      if (edgeV < 1) return row === 0 ? P.mauve : P.ink
      if (edgeU < 1.6) return P.ink
      if (edgeU < 7 || edgeV < 5) {
        if ((edgeU > 3.2 && edgeU < 4.6 && edgeV >= 3) || (edgeV >= 2 && edgeV < 3 && edgeU >= 3.2)) return P.mauve
        return ''
      }
      if (edgeU < 8.6 || edgeV < 7) return P.aubergine
      // A row of diamonds across the middle, each with a rose heart.
      const du = Math.abs(((u - 64 + 24 * 40 + 12) % 24) - 12) / 11
      const dv = Math.abs(v - 23) / 15
      const d = du + dv
      if (d <= 0.13) return P.rose
      if (d <= 0.4) return P.umber
      if (d <= 0.9) return P.aubergine
      return P.plum
    }
    let start = x0
    let last = ink(x0)
    for (let x = x0 + 1; x <= x1; x += 1) {
      const fill = x < x1 ? ink(x) : '-'
      if (fill === last) continue
      if (last !== '') r.rect(start, y, x - start, 1, last)
      start = x
      last = fill
    }
    // Darker toward the viewer.
    if (row >= 16) shade.rect(x0, y, x1 - x0, 1, pat(row >= 21 ? 'k2' : 'k1'))
    // The fringe at the short ends, every other row.
    if (row % 2 === 1 && row < rows - 2) base.rect(x0 - 2, y, 2, 1, P.mauve).rect(x1, y, 2, 1, P.mauve)
  }
  // Under the lit lamp, a faint warmth on the far edge.
  const warm = input.lampOn
    ? `<defs>${ditherPattern('qdwarm', P.rust, 2)}</defs>` +
      new Layer().rect(222, top + 2, 44, 2, 'url(#qdwarm)').svg() +
      glow('pdrug', 244, top + 2, 40, 5, P.amber, 0.1)
    : ''
  return base.svg() + r.svg() + shade.svg() + warm
}

/** Everything of the desk wall but the cat. */
export function deskPart(input: SceneInput, time: Clock): string {
  return (
    rug(input) +
    lampWall(input) +
    screenWall(input) +
    `<g class="pr-wd">${plantShelf()}${clock(time)}${corkboard(input.notes)}${calendar(input.date)}</g>` +
    lamp(input) +
    deskThings(input) +
    monitor(input) +
    lampPool(input) +
    moths(input)
  )
}
