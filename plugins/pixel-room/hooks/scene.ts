// The room as one SVG document, drawn on a grid of 320 by 200 art pixels: a
// tall rainy window on the left with the cat's cushion on its sill and a low
// shelf of books beneath, the window's light falling across the floor, and a
// desk on the right with a lamp, a monitor of scrolling code, a steaming mug,
// a trailing plant and a wall clock that keeps the real time. The centre and
// the foot stay dark for the conversation. Pure and deterministic for its
// input; every motion is CSS in the document's own <style>.

import { PAL } from './palette'
import { Layer, ditherPattern, seeded } from './pixels'
import type { Inks, Sprite } from './pixels'
import type { Phase, RoomState } from './room'
import { ASLEEP, CAT_KEYS, SIT, SIT_TAIL, STARTLED, STARTLED_TAIL, STRETCH, WALK_BODY, WALK_LEGS, ZED, rle } from './sprites'

/** The most an Svg's source may hold. */
export const SCENE_LIMIT = 131_072

/** Scene units per art pixel. */
const PX = 5
const FLOOR = 160

/** The local time the clock shows when the scene loads. */
export type Clock = { hour: number; minute: number; second: number }

const P = PAL

// Dither patterns, each id once: `level` of 16 pixels in `color`.
const PATTERNS: Record<string, [string, number]> = {
  'k1': [P.ink, 4],
  'k2': [P.ink, 8],
  'k3': [P.ink, 12],
  'n2': [P.night, 8],
  'a1': [P.amber, 1],
  'a2': [P.amber, 2],
  'a4': [P.amber, 4],
  'a6': [P.amber, 6],
  'm1': [P.mist, 1],
  'm2': [P.mist, 2],
  'm4': [P.mist, 4],
  's8': [P.sea, 8],
  's4': [P.sea, 4],
  'u8': [P.aubergine, 8],
  'u4': [P.aubergine, 4],
  'v8': [P.mauve, 8],
  't8': [P.steel, 8],
  't4': [P.steel, 4],
  'i8': [P.mist, 8],
  'r8': [P.rose, 8],
  'r4': [P.rose, 4],
  'b8': [P.amber, 8],
  'b4': [P.amber, 4],
  'd8': [P.dusk, 8],
  'w4': [P.umber, 4],
  'w8': [P.umber, 8],
  'w12': [P.umber, 12],
  'e8': [P.ember, 8],
  'e4': [P.ember, 4],
  'x8': [P.rust, 8],
  'x4': [P.rust, 4],
  'k4': [P.ink, 2],
}
const pat = (id: keyof typeof PATTERNS & string) => `url(#q${id})`

function defs(): string {
  return Object.entries(PATTERNS)
    .map(([id, [color, level]]) => ditherPattern(`q${id}`, color, level))
    .join('')
}

// ---------------------------------------------------------------- the room shell

function shell(state: RoomState): string {
  const wall = new Layer()
  // The wall, wide and tall enough for any crop, darkening toward the ceiling.
  wall.rect(-400, -400, 1120, 400 + FLOOR, P.plum)
  wall.rect(-400, -400, 1120, 400 + 6, pat('k3'))
  wall.rect(-400, 6, 1120, 10, pat('k2'))
  wall.rect(-400, 16, 1120, 14, pat('k1'))
  wall.rect(-400, 30, 1120, 14, pat('k4'))
  // A plain dado rail across the lower wall, and the skirting.
  wall.rect(-400, 138, 1120, 1, P.aubergine)
  for (let x = -400; x < 720; x += 36) wall.rect(x, 139, 1, 16, P.night)
  wall.rect(-400, 155, 1120, 1, P.mauve)
  wall.rect(-400, 156, 1120, 4, P.aubergine)
  wall.rect(-400, 159, 1120, 1, P.night)
  // The floor: boards with staggered joints, darker toward the viewer.
  const floor = new Layer()
  floor.rect(-400, FLOOR, 1120, 400, P.night)
  floor.rect(-400, FLOOR, 1120, 1, P.aubergine)
  const random = seeded(5)
  for (let y = FLOOR + 6; y < 240; y += 7) {
    floor.rect(-400, y, 1120, 1, P.ink)
    let x = -400 + Math.floor(random() * 30)
    while (x < 720) {
      floor.rect(x, y - 6, 1, 6, P.ink)
      x += 34 + Math.floor(random() * 30)
    }
  }
  floor.rect(-400, 178, 1120, 12, pat('k1'))
  floor.rect(-400, 190, 1120, 300, pat('k2'))
  void state
  return wall.svg() + floor.svg()
}

// ---------------------------------------------------------------- the window

const GLASS = { x: 24, y: 28, w: 72, h: 90 }

function sky(phase: Phase): string {
  const g = GLASS
  const layer = new Layer()
  // Bands of sky from the top down, each dithered into the next.
  const bands: [string, string | undefined][] =
    phase === 'night'
      ? [[P.ink, undefined], [P.ink, pat('n2')], [P.night, undefined], [P.night, pat('s4')], [P.night, pat('s8')], [P.sea, undefined]]
      : phase === 'dusk'
        ? [[P.aubergine, undefined], [P.aubergine, pat('v8')], [P.mauve, undefined], [P.mauve, pat('r8')], [P.rose, undefined], [P.rose, pat('b4')]]
        : [[P.steel, undefined], [P.steel, pat('i8')], [P.mist, undefined], [P.mist, undefined], [P.mist, pat('t4')], [P.mist, undefined]]
  const step = Math.ceil(g.h / bands.length)
  bands.forEach(([base, over], i) => {
    const y = g.y + i * step
    const h = Math.min(step, g.y + g.h - y)
    layer.rect(g.x, y, g.w, h, base)
    if (over !== undefined) layer.rect(g.x, y, g.w, h, over)
  })
  return layer.svg()
}

function city(phase: Phase): string {
  const g = GLASS
  const far = new Layer()
  const near = new Layer()
  const lights = new Layer()
  const blink: string[] = []
  const farColor = phase === 'night' ? P.sea : phase === 'dusk' ? P.dusk : P.steel
  const nearColor = phase === 'night' ? P.night : phase === 'dusk' ? P.aubergine : P.dusk
  const random = seeded(19)
  const bottom = g.y + g.h
  // A far row of towers, hazy, and a near row, dark, with lit windows.
  let x = g.x - 2
  while (x < g.x + g.w) {
    const w = 5 + Math.floor(random() * 6)
    const h = 22 + Math.floor(random() * 24)
    far.rect(x, bottom - h, w, h, farColor)
    if (random() < 0.4) far.rect(x + Math.floor(w / 2), bottom - h - 4, 1, 4, farColor)
    x += w + Math.floor(random() * 2)
  }
  x = g.x - 3
  while (x < g.x + g.w) {
    const w = 8 + Math.floor(random() * 9)
    const h = 10 + Math.floor(random() * 20)
    const top = bottom - h
    near.rect(x, top, w, h, nearColor)
    if (random() < 0.5) near.rect(x + 1, top - 2, w - 2, 2, nearColor)
    for (let wy = top + 3; wy < bottom - 2; wy += 3) {
      for (let wx = x + 2; wx < x + w - 1; wx += 2) {
        const roll = random()
        const odds = phase === 'night' ? 0.2 : phase === 'dusk' ? 0.14 : 0
        if (roll < odds) {
          const color = roll < odds * 0.3 ? P.cream : P.amber
          if (roll < odds * 0.12) blink.push(`<rect class="pr-bl" x="${wx}" y="${wy}" width="1" height="1" fill="${color}" style="animation-delay:-${Math.floor(random() * 40)}s"/>`)
          else lights.dot(wx, wy, color)
        }
      }
    }
    x += w + 1
  }
  // The city's own glow, soft behind the glass: the one blur in the room.
  const glowColor = phase === 'day' ? P.mist : P.amber
  const glowOpacity = phase === 'night' ? 0.32 : phase === 'dusk' ? 0.4 : 0.25
  const glow = `<ellipse cx="${g.x + g.w / 2}" cy="${bottom}" rx="${g.w * 0.75}" ry="${g.h * 0.45}" fill="url(#prglow)" opacity="${glowOpacity}"/>`
  const gradient = `<defs><radialGradient id="prglow"><stop offset="0" stop-color="${glowColor}"/><stop offset="1" stop-color="${glowColor}" stop-opacity="0"/></radialGradient></defs>`
  return gradient + far.svg() + glow + near.svg() + lights.svg(phase === 'day' ? 'opacity=".6"' : '') + blink.join('')
}

function rain(phase: Phase): string {
  const g = GLASS
  const random = seeded(31)
  const color = phase === 'day' ? P.cream : P.mist
  let out = ''
  // Far streaks, faint and slow; near streaks, brighter and quick.
  for (let i = 0; i < 46; i += 1) {
    const isNear = i % 3 === 0
    const x = g.x + Math.floor(random() * g.w)
    const y = g.y + Math.floor(random() * g.h)
    const d = (isNear ? 0.45 + random() * 0.2 : 0.8 + random() * 0.4).toFixed(2)
    const delay = (-random() * 2).toFixed(2)
    out += `<rect class="pr-rn" x="${x}" y="${y}" width="1" height="${isNear ? 4 : 2}" fill="${color}" opacity="${isNear ? 0.55 : 0.3}" style="animation-duration:${d}s;animation-delay:${delay}s"/>`
  }
  // Drops beaded on the glass that gather, then run down it a pixel at a time.
  for (let i = 0; i < 14; i += 1) {
    const x = g.x + 2 + Math.floor(random() * (g.w - 4))
    const y = g.y + 2 + Math.floor(random() * (g.h * 0.6))
    const d = (12 + random() * 10).toFixed(1)
    const delay = (-random() * 22).toFixed(1)
    out +=
      `<g class="pr-dp" style="animation-duration:${d}s;animation-delay:${delay}s">` +
      `<rect x="${x}" y="${y}" width="1" height="1" fill="${P.mist}"/><rect x="${x}" y="${y + 1}" width="1" height="1" fill="${P.steel}" opacity=".7"/></g>`
  }
  return out
}

function windowFrame(): string {
  const f = new Layer()
  const g = GLASS
  // Outer frame with a lit top edge and a shadowed right and bottom.
  f.rect(g.x - 4, g.y - 4, g.w + 8, 4, P.mauve)
  f.rect(g.x - 4, g.y - 4, g.w + 8, 1, P.dusk)
  f.rect(g.x - 4, g.y, 4, g.h, P.mauve)
  f.rect(g.x - 4, g.y, 1, g.h, P.dusk)
  f.rect(g.x + g.w, g.y, 4, g.h, P.aubergine)
  f.rect(g.x + g.w + 3, g.y - 4, 1, g.h + 4, P.night)
  // Inner shadow on the glass edge.
  f.rect(g.x, g.y, g.w, 1, P.ink)
  f.rect(g.x, g.y, 1, g.h, P.ink)
  // Mullions: one upright, one transom, each with a lit edge.
  const mx = g.x + g.w / 2 - 1
  f.rect(mx, g.y, 2, g.h, P.mauve)
  f.rect(mx, g.y, 1, g.h, P.dusk)
  f.rect(g.x, g.y + 34, g.w, 2, P.mauve)
  f.rect(g.x, g.y + 34, g.w, 1, P.dusk)
  // The sill: a lit top face, a front face, and its shadow on the wall.
  f.rect(g.x - 8, g.y + g.h, g.w + 16, 2, P.dusk)
  f.rect(g.x - 8, g.y + g.h, g.w + 16, 1, P.rose)
  f.rect(g.x - 8, g.y + g.h + 2, g.w + 16, 3, P.mauve)
  f.rect(g.x - 8, g.y + g.h + 5, g.w + 16, 1, P.aubergine)
  f.rect(g.x - 6, g.y + g.h + 6, g.w + 12, 2, pat('k2'))
  return f.svg()
}

/** The cushion on the sill, and whichever cat is on it. */
function sill(state: RoomState): string {
  const c = new Layer()
  const sy = GLASS.y + GLASS.h
  // A plump cushion: a lit top, a seam, a shadowed underside.
  c.sprite(
    rle(['2.26r2.', '.r28r.', 'v3r1d22r1d3rv', 'v28vv', '.v28v.', '2.26v2.'].map(row => row)),
    { r: P.rose, v: P.mauve, d: P.dusk },
    28,
    sy - 6,
  )
  let cat = ''
  if (state.cat === 'asleep') cat = sleeper(31, sy - 15)
  else if (state.cat === 'stretch') {
    cat =
      `<g class="pr-st">${new Layer().sprite(STRETCH, CAT_KEYS, 30, sy - 17).svg()}</g>` +
      `<g class="pr-af">${sleeper(31, sy - 15)}</g>`
  }
  return c.svg() + cat
}

function sleeper(x: number, y: number): string {
  const [out, inn] = ASLEEP
  const zed = (i: number) =>
    `<g class="pr-z" style="animation-delay:${(i * 2.2).toFixed(1)}s">${new Layer().sprite(ZED, { z: P.mist }, x + 22, y - 4).svg()}</g>`
  return (
    `<g class="pr-b0">${new Layer().sprite(out ?? [], CAT_KEYS, x, y).svg()}</g>` +
    `<g class="pr-b1">${new Layer().sprite(inn ?? [], CAT_KEYS, x, y).svg()}</g>` +
    zed(0) +
    zed(1) +
    zed(2)
  )
}

/** Books on a low shelf under the window. */
function shelf(): string {
  const s = new Layer()
  const x0 = 26
  const top = 132
  s.rect(x0, top, 68, 2, P.dusk)
  s.rect(x0, top, 68, 1, P.rose)
  s.rect(x0 + 1, top + 2, 2, 24, P.mauve)
  s.rect(x0 + 65, top + 2, 2, 24, P.aubergine)
  s.rect(x0 + 3, top + 13, 62, 2, P.mauve)
  s.rect(x0 + 3, top + 2, 62, 11, P.night)
  s.rect(x0 + 3, top + 15, 62, 11, P.night)
  s.rect(x0, top + 26, 68, 2, P.aubergine)
  const colors = [P.rust, P.sea, P.moss, P.dusk, P.rose, P.umber, P.steel, P.mauve]
  const random = seeded(11)
  for (const row of [top + 2, top + 15]) {
    let x = x0 + 4
    while (x < x0 + 60) {
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
  // A small candle and its flame on top.
  s.rect(x0 + 52, top - 3, 4, 3, P.cream)
  s.rect(x0 + 55, top - 3, 1, 3, P.rose)
  s.rect(x0 + 53, top - 4, 1, 1, P.umber)
  return s.svg() + `<g class="pr-fl"><rect x="${x0 + 52}" y="${top - 6}" width="3" height="2" fill="${P.ember}"/><rect x="${x0 + 53}" y="${top - 8}" width="1" height="3" fill="${P.amber}"/><rect x="${x0 + 53}" y="${top - 6}" width="1" height="1" fill="${P.cream}"/></g>`
}

/** The window's light across the floor, dithered, with rain shadows sliding through it. */
function floorLight(phase: Phase): string {
  const rows = new Layer()
  const clip: string[] = []
  const near = phase === 'day' ? pat('t8') : phase === 'dusk' ? pat('r4') : pat('s8')
  const far = phase === 'day' ? pat('t4') : phase === 'dusk' ? pat('w8') : pat('s4')
  for (let y = FLOOR + 2; y < 200; y += 1) {
    const t = y - FLOOR
    const x0 = Math.round(30 + t * 1.25)
    const x1 = Math.round(96 + t * 1.9)
    const mid = Math.round((x0 + x1) / 2)
    const fill = t < 16 ? near : far
    // The mullion's shadow splits the patch in two.
    rows.rect(x0, y, mid - 1 - x0, 1, fill)
    rows.rect(mid + 2, y, x1 - mid - 2, 1, fill)
    clip.push(`<rect x="${x0}" y="${y}" width="${x1 - x0}" height="1"/>`)
  }
  const random = seeded(47)
  let shadows = ''
  for (let i = 0; i < 9; i += 1) {
    const x = 40 + Math.floor(random() * 100)
    const y = FLOOR + Math.floor(random() * 20)
    shadows += `<rect class="pr-sh" x="${x}" y="${y}" width="1" height="2" fill="${P.ink}" style="animation-duration:${(9 + random() * 8).toFixed(1)}s;animation-delay:-${(random() * 12).toFixed(1)}s"/>`
  }
  return (
    `<defs><clipPath id="prpatch">${clip.join('')}</clipPath></defs>` +
    rows.svg() +
    `<g clip-path="url(#prpatch)" opacity=".5">${shadows}</g>`
  )
}

function windowPart(state: RoomState): string {
  const g = GLASS
  return (
    `<defs><clipPath id="prglass"><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}"/></clipPath></defs>` +
    `<g class="pr-fp">${floorLight(state.phase)}</g>` +
    `<g class="pr-bk">${shelf()}</g>` +
    `<g clip-path="url(#prglass)">${sky(state.phase)}${city(state.phase)}${rain(state.phase)}</g>` +
    windowFrame() +
    sill(state)
  )
}

// ---------------------------------------------------------------- the desk

const DESK = { x: 214, y: 126, w: 100 }

function lamp(state: RoomState): string {
  const l = new Layer()
  const on = state.lampOn
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

function deskThings(state: RoomState): string {
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
  void state
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

/** The cat on the floor in front of the desk: pacing, sitting up to watch, or startled. */
function floorCat(state: RoomState): string {
  const feet = 178
  if (state.cat === 'pacing') {
    const top = feet - (WALK_BODY.length + 3)
    const frames = WALK_LEGS.map(
      (legs, i) => `<g class="pr-w pr-w${i}">${new Layer().sprite(legs, CAT_KEYS, 0, WALK_BODY.length - 1).svg()}</g>`,
    ).join('')
    const body = new Layer().sprite(WALK_BODY, CAT_KEYS, 0, 0).svg()
    return (
      `<g class="pr-pc" style="--x:186px"><g transform="translate(186 ${top})"><g class="pr-fc">` +
      `<g class="pr-bob">${body}</g>${frames}</g></g></g>`
    )
  }
  if (state.cat === 'watching' || state.cat === 'startled') {
    const x = 232
    const y = feet - SIT.length
    const tails = SIT_TAIL.map((tail, i) => `<g class="pr-t pr-t${i}">${new Layer().sprite(tail, CAT_KEYS, x - 6, y + SIT.length - 7).svg()}</g>`).join('')
    const sitting = `${tails}${new Layer().sprite(SIT, CAT_KEYS, x, y).svg()}`
    if (state.cat === 'watching') return `<g>${sitting}</g>`
    const startled =
      new Layer().sprite(STARTLED_TAIL, CAT_KEYS, x - 3, y + 3).svg() + new Layer().sprite(STARTLED, CAT_KEYS, x, y).svg()
    return `<g class="pr-jo">${startled}</g><g class="pr-af">${sitting}</g>`
  }
  return ''
}

function deskPart(state: RoomState, time: Clock): string {
  return (
    `<g class="pr-wd">${plantShelf()}${clock(time)}</g>` +
    lamp(state) +
    deskThings(state) +
    monitor(state.phase) +
    floorCat(state)
  )
}

// ---------------------------------------------------------------- motion

const STYLE = `
.pr-rn{animation:pr-rain 1s linear infinite}
.pr-dp{animation:pr-drip 16s steps(60,end) infinite}
.pr-sh{animation:pr-shadow 12s steps(24,end) infinite}
.pr-bl{animation:pr-blink 40s step-end infinite}
.pr-b0{animation:pr-breath 4.8s step-end infinite}
.pr-b1{opacity:0;animation:pr-breath 4.8s step-end infinite reverse}
.pr-z{opacity:0;animation:pr-z 6.6s steps(10,end) infinite}
.pr-pc{animation:pr-pace 18s steps(90,end) infinite}
.pr-fc{transform-box:fill-box;transform-origin:center;animation:pr-face 18s step-end infinite}
.pr-w{opacity:0;animation:pr-step .64s step-end infinite}
.pr-w0{animation-delay:0s}.pr-w1{animation-delay:-.48s}.pr-w2{animation-delay:-.32s}.pr-w3{animation-delay:-.16s}
.pr-bob{animation:pr-bob .32s step-end infinite}
.pr-t{opacity:0;animation:pr-tail 2.4s step-end infinite}
.pr-t0{animation-delay:0s}.pr-t1{animation-delay:-1.6s}.pr-t2{animation-delay:-.8s}
.pr-jo{animation:pr-jolt 2.6s steps(1,end) forwards}
.pr-st{animation:pr-once 3.4s step-end forwards}
.pr-af{opacity:0;animation:pr-after 3.4s step-end forwards}
.pr-cd{animation:pr-scroll 30s steps(12,end) infinite}
.pr-cu{animation:pr-blink2 1.1s step-end infinite}
.pr-sm{opacity:0;animation:pr-steam 3.9s steps(6,end) infinite}
.pr-fl{animation:pr-flick 1.7s step-end infinite}
.pr-gl{animation:pr-hum 9s step-end infinite}
.pr-mh,.pr-hh{opacity:0}
.pr-mh{animation:pr-tick 3600s step-end infinite}
.pr-hh{animation:pr-tick 43200s step-end infinite}
.pr-on{opacity:1}
@keyframes pr-rain{from{transform:translateY(-100px)}to{transform:translateY(100px)}}
@keyframes pr-drip{0%,55%{transform:translateY(0);opacity:1}55.1%{animation-timing-function:steps(40,end)}100%{transform:translateY(60px);opacity:.2}}
@keyframes pr-shadow{from{transform:translate(0,0)}to{transform:translate(12px,24px)}}
@keyframes pr-blink{0%,70%{opacity:1}70.1%,100%{opacity:0}}
@keyframes pr-breath{0%{opacity:1}50%{opacity:0}}
@keyframes pr-z{0%{transform:translate(0,0);opacity:0}10%{opacity:.9}100%{transform:translate(5px,-10px);opacity:0}}
@keyframes pr-pace{0%{transform:translateX(0)}45%{transform:translateX(90px)}50%{transform:translateX(90px)}95%{transform:translateX(0)}100%{transform:translateX(0)}}
@keyframes pr-face{0%{transform:scaleX(1)}47.5%{transform:scaleX(-1)}97.5%{transform:scaleX(1)}}
@keyframes pr-step{0%{opacity:1}25%{opacity:0}}
@keyframes pr-bob{0%{transform:translateY(0)}50%{transform:translateY(1px)}}
@keyframes pr-tail{0%{opacity:1}33.3%{opacity:0}}
@keyframes pr-jolt{0%{transform:translateY(-3px)}8%{transform:translateY(0)}100%{opacity:0;transform:translateY(0)}}
@keyframes pr-once{0%{opacity:1}100%{opacity:0}}
@keyframes pr-after{0%{opacity:0}100%{opacity:1}}
@keyframes pr-scroll{from{transform:translateY(0)}to{transform:translateY(-24px)}}
@keyframes pr-blink2{0%{opacity:1}50%{opacity:0}}
@keyframes pr-steam{0%{transform:translateY(0);opacity:0}15%{opacity:.8}100%{transform:translateY(-6px);opacity:0}}
@keyframes pr-flick{0%{transform:translateY(0)}60%{transform:translateY(-1px)}80%{transform:translateY(0)}}
@keyframes pr-hum{0%{opacity:1}96%{opacity:.85}98%{opacity:1}}
@keyframes pr-tick{0%{opacity:1}8.333%,100%{opacity:0}}
@media (max-aspect-ratio:5/4){.pr-l{transform:translate(46px,0)}.pr-r{transform:translate(-56px,0)}}
@media (max-aspect-ratio:3/4){.pr-l{transform:translate(98px,-34px)}.pr-r{transform:translate(-104px,0)}.pr-bk,.pr-fp,.pr-wd{display:none}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.pr-b1,.pr-w1,.pr-w2,.pr-w3,.pr-t1,.pr-t2,.pr-jo,.pr-st{opacity:0}.pr-w0,.pr-t0,.pr-af{opacity:1}.pr-z{opacity:.6}}
`
  .trim()
  .replace(/\n/g, '')

/** The colour laid over the whole room for the time of day: cool by day, rosy at dusk, warm under the lamp. */
function tint(phase: Phase): string {
  const [color, opacity] = phase === 'day' ? [P.steel, 0.07] : phase === 'dusk' ? [P.rose, 0.06] : [P.amber, 0.05]
  return `<rect x="-400" y="-400" width="1120" height="1000" fill="${color}" opacity="${opacity}"/>`
}

/** The whole room for one state, its clock showing `time`. */
export function buildScene(state: RoomState, time: Clock): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" shape-rendering="crispEdges">` +
    `<style>${STYLE}</style>` +
    `<defs>${defs()}</defs>` +
    `<g transform="scale(${PX})">` +
    shell(state) +
    `<g class="pr-l">${windowPart(state)}</g>` +
    `<g class="pr-r">${deskPart(state, time)}</g>` +
    tint(state.phase) +
    `</g></svg>`
  )
}

export type { Inks, Sprite }
