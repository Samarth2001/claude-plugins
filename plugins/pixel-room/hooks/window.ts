// The window wall: a tall window with the sky, the city and the weather
// behind the glass, its frame and sill, the low bookcase under it with its
// candle, and the window's light falling across the floor. The cushion and
// the cat on the sill are cat.ts's, drawn over this.

import { FLOOR, P, pat } from './paint'
import { Layer, seeded } from './pixels'
import type { Clock, Phase, SceneInput } from './model'

/** The glass, in art pixels. */
export const GLASS = { x: 24, y: 28, w: 72, h: 90 }

export const WINDOW_CSS = [
  '.pr-rn{animation:pr-rain 1s linear infinite}',
  '.pr-dp{animation:pr-drip 16s steps(60,end) infinite}',
  '.pr-sh{animation:pr-shadow 12s steps(24,end) infinite}',
  '.pr-bl{animation:pr-blink 40s step-end infinite}',
  '.pr-fl{animation:pr-flick 1.7s step-end infinite}',
  '@keyframes pr-rain{from{transform:translateY(-100px)}to{transform:translateY(100px)}}',
  '@keyframes pr-drip{0%,55%{transform:translateY(0);opacity:1}55.1%{animation-timing-function:steps(40,end)}100%{transform:translateY(60px);opacity:.2}}',
  '@keyframes pr-shadow{from{transform:translate(0,0)}to{transform:translate(12px,24px)}}',
  '@keyframes pr-blink{0%,70%{opacity:1}70.1%,100%{opacity:0}}',
  '@keyframes pr-flick{0%{transform:translateY(0)}60%{transform:translateY(-1px)}80%{transform:translateY(0)}}',
].join('')

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

/** Everything of the window wall but the cat. */
export function windowPart(input: SceneInput, time: Clock): string {
  void time
  const g = GLASS
  return (
    `<defs><clipPath id="prglass"><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}"/></clipPath></defs>` +
    `<g class="pr-fp">${floorLight(input.phase)}</g>` +
    `<g class="pr-bk">${shelf()}</g>` +
    `<g clip-path="url(#prglass)">${sky(input.phase)}${city(input.phase)}${rain(input.phase)}</g>` +
    windowFrame()
  )
}
