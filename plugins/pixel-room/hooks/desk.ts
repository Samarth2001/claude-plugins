// The desk wall: a desk with a lamp, a small monitor of scrolling code, a
// steaming mug and a notebook, a wall shelf with a trailing plant, and a
// round clock that keeps the real time. The cat on the floor is cat.ts's.

import { FLOOR, P, pat } from './paint'
import { Layer, seeded } from './pixels'
import type { Clock, Phase, SceneInput } from './model'
import { rle } from './sprites'

export const DESK_CSS = [
  '.pr-cd{animation:pr-scroll 30s steps(12,end) infinite}',
  '.pr-cu{animation:pr-blink2 1.1s step-end infinite}',
  '.pr-sm{opacity:0;animation:pr-steam 3.9s steps(6,end) infinite}',
  '.pr-gl{animation:pr-hum 9s step-end infinite}',
  '.pr-mh,.pr-hh{opacity:0}',
  '.pr-mh{animation:pr-tick 3600s step-end infinite}',
  '.pr-hh{animation:pr-tick 43200s step-end infinite}',
  '.pr-on{opacity:1}',
  '@keyframes pr-scroll{from{transform:translateY(0)}to{transform:translateY(-24px)}}',
  '@keyframes pr-blink2{0%{opacity:1}50%{opacity:0}}',
  '@keyframes pr-steam{0%{transform:translateY(0);opacity:0}15%{opacity:.8}100%{transform:translateY(-6px);opacity:0}}',
  '@keyframes pr-hum{0%{opacity:1}96%{opacity:.85}98%{opacity:1}}',
  '@keyframes pr-tick{0%{opacity:1}8.333%,100%{opacity:0}}',
].join('')

const DESK = { x: 214, y: 126, w: 100 }

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
  // The lit bulb's cone onto the desk, and a warm pool on the wall behind.
  const cone = new Layer()
  for (let y = 105; y < 126; y += 1) {
    const t = y - 105
    const x0 = Math.round(240 - t * 0.85)
    const x1 = Math.round(246 + t * 1.15)
    cone.rect(x0, y, x1 - x0, 1, t < 4 ? pat('a4') : t < 11 ? pat('e4') : pat('x8'))
  }
  const pool = new Layer()
  pool.rect(226, 126, 44, 1, P.amber)
  pool.rect(222, 127, 52, 1, pat('a6'))
  const halo = new Layer()
  for (let y = 76; y < 126; y += 1) {
    for (const [r, id] of [[30, 'w4'], [21, 'w8'], [13, 'w12']] as const) {
      const dy = (y - 108) * 1.15
      if (Math.abs(dy) >= r) continue
      const half = Math.round(Math.sqrt(r * r - dy * dy) * 1.4)
      halo.rect(242 - half, y, half * 2, 1, pat(id))
    }
  }
  return `<g class="pr-gl">${halo.svg()}</g>` + l.svg() + `<g class="pr-gl">${cone.svg()}${pool.svg()}</g>`
}

function monitor(phase: Phase): string {
  const m = new Layer()
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
  // The keyboard and a pencil beside it.
  m.rect(256, 124, 0, 0, P.ink)
  const screen = { x: 266, y: 98, w: 28, h: 18 }
  const code = new Layer()
  const random = seeded(23)
  const colors = [P.leaf, P.steel, P.amber, P.rose, P.steel, P.leaf]
  const lines: [number, number, string][] = []
  for (let i = 0; i < 12; i += 1) {
    const indent = [0, 2, 4, 2, 4, 6][Math.floor(random() * 6)] ?? 0
    const w = 5 + Math.floor(random() * (screen.w - 10 - indent))
    lines.push([indent, w, colors[i % colors.length] ?? P.leaf])
  }
  // Twice over, so the scroll wraps without a seam.
  for (let copy = 0; copy < 2; copy += 1) {
    lines.forEach(([indent, w, color], i) => {
      const y = screen.y + 2 + (copy * 12 + i) * 2
      if (w > 9 && i % 3 === 1) {
        code.rect(screen.x + 2 + indent, y, 3, 1, P.rose)
        code.rect(screen.x + 6 + indent, y, w - 4, 1, color)
      } else code.rect(screen.x + 2 + indent, y, w, 1, color)
    })
  }
  const glowColor = phase === 'day' ? P.steel : P.sea
  return (
    m.svg() +
    `<defs><clipPath id="prscreen"><rect x="${screen.x}" y="${screen.y}" width="${screen.w}" height="${screen.h}"/></clipPath></defs>` +
    `<g clip-path="url(#prscreen)"><rect x="${screen.x}" y="${screen.y}" width="${screen.w}" height="${screen.h}" fill="${P.night}"/>` +
    `<g class="pr-cd" opacity=".85">${code.svg()}</g>` +
    `<rect x="${screen.x}" y="${screen.y}" width="${screen.w}" height="${screen.h}" fill="${pat('k1')}"/></g>` +
    `<rect class="pr-cu" x="${screen.x + 2}" y="${screen.y + screen.h - 3}" width="2" height="1" fill="${P.cream}"/>` +
    // The screen's faint light on the desk in front of it.
    `<rect x="264" y="126" width="32" height="1" fill="${glowColor}" opacity=".6"/>`
  )
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
  d.rect(250, 124, 10, 2, P.cream)
  d.rect(250, 125, 10, 1, P.rose)
  d.rect(251, 123, 8, 1, P.amber)
  d.dot(259, 123, P.umber)
  const steam = [0, 1, 2]
    .map(i => `<rect class="pr-sm" x="${302 + (i % 2)}" y="117" width="1" height="1" fill="${P.mist}" style="animation-delay:${(i * 1.3).toFixed(1)}s"/>`)
    .join('')
  void input
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


/** Everything of the desk wall but the cat. */
export function deskPart(input: SceneInput, time: Clock): string {
  return `<g class="pr-wd">${plantShelf()}${clock(time)}</g>` + lamp(input) + deskThings(input) + monitor(input.phase)
}
