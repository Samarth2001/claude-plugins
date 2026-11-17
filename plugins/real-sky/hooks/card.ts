// The almanac card the pane draws on desktop: the sun's path in miniature with
// now marked, the hour, the four parts of the day on one line, the moon's
// phase, and the session barometer, its needle and its set hand. A glance of
// the same for the widget. Pure SVG strings, in the hour's own colors.

import { LOOKS } from './look'
import { PHASES, STARTS, arcAt, clockText, isWaxing, moonLit, moonName, zoneOf } from './phase'
import type { Log, Phase } from './phase'
import { moonPath } from './scene'
import { forecast, glanceWord, moonText, nextChange } from './voice'
import type { Sky } from '../types'

const SERIF = "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif"
const MONO = "ui-monospace,'SF Mono','Cascadia Mono',Consolas,Menlo,monospace"

const n = (value: number) => String(Math.round(value * 10) / 10)

/** Text safe to put inside SVG markup. */
const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

type Ink = { ink: string; sub: string; faint: string; accent: string; shade: string; lit: string }

function inkOf(phase: Phase): Ink {
  const { anchors, roles, scheme } = LOOKS[phase]
  return {
    ink: anchors['text-primary'],
    sub: anchors['text-secondary'],
    faint: anchors['text-muted'],
    accent: roles.accent,
    // On paper the moon's lit side is the paper and its dark side a shade of the ink.
    shade: scheme === 'light' ? anchors['text-muted'] : anchors['surface-3'] ?? anchors['surface-2'],
    lit: scheme === 'light' ? '#ffffff' : anchors['text-primary'],
  }
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

type Arc = { cx: number; cy: number; rx: number; ry: number }

const on = (arc: Arc, f: number) => {
  const angle = Math.PI * (1 - f)
  return { x: arc.cx + arc.rx * Math.cos(angle), y: arc.cy - arc.ry * Math.sin(angle) }
}

/** The arc in miniature: hours gone solid, hours to come dotted, a tick each hour, and the body now. */
function path(arc: Arc, sky: Sky, c: Ink, r: number, isFine: boolean): string {
  const f = arcAt(sky.phase, sky.step)
  const hours = sky.phase === 'night' ? 9 : 15
  const p = (t: number) => {
    const { x, y } = on(arc, t)
    return `${n(x)} ${n(y)}`
  }
  const span = (a: number, b: number) => `M${p(a)}A${arc.rx} ${arc.ry} 0 0 1 ${p(b)}`
  let out = `<path d="M${n(arc.cx - arc.rx - 10)} ${arc.cy}H${n(arc.cx + arc.rx + 10)}" stroke="${c.faint}" stroke-width=".6" opacity=".45"/>`
  if (f > 0.002) out += `<path d="${span(0, f)}" stroke="${c.sub}" stroke-width=".9" fill="none" opacity=".8"/>`
  if (f < 0.998) out += `<path d="${span(f, 1)}" stroke="${c.faint}" stroke-width=".9" fill="none" stroke-dasharray="1 3.5" stroke-linecap="round"/>`
  if (isFine) {
    let ticks = ''
    for (let i = 0; i <= hours; i++) {
      const t = i / hours
      const angle = Math.PI * (1 - t)
      const { x, y } = on(arc, t)
      const nx = arc.ry * Math.cos(angle)
      const ny = -arc.rx * Math.sin(angle)
      const length = Math.hypot(nx, ny)
      ticks += `M${n(x + (nx / length) * 2)} ${n(y + (ny / length) * 2)}l${n((nx / length) * 3.5)} ${n((ny / length) * 3.5)}`
    }
    out += `<path d="${ticks}" stroke="${c.faint}" stroke-width=".7" opacity=".8"/>`
  }
  const now = on(arc, f)
  if (sky.phase === 'night') {
    out +=
      `<circle cx="${n(now.x)}" cy="${n(now.y)}" r="${r + 3.5}" fill="none" stroke="${c.sub}" stroke-width=".6" opacity=".6"/>` +
      `<circle cx="${n(now.x)}" cy="${n(now.y)}" r="${r}" fill="${c.shade}"/>` +
      `<path d="${moonPath(now.x, now.y, r, sky.moonAge)}" fill="${c.lit}"/>`
  } else {
    out +=
      `<circle cx="${n(now.x)}" cy="${n(now.y)}" r="${r + 3.5}" fill="none" stroke="${c.accent}" stroke-width=".7" opacity=".6"/>` +
      `<circle cx="${n(now.x)}" cy="${n(now.y)}" r="${r}" fill="${c.accent}"/>`
  }
  return out
}

/** A moon glyph in its phase, with its dark side faint. */
function moonGlyph(cx: number, cy: number, r: number, age: number, c: Ink): string {
  return (
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c.shade}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c.faint}" stroke-width=".5" opacity=".6"/>` +
    `<path d="${moonPath(cx, cy, r, age)}" fill="${c.lit}"/>`
  )
}

/** The four parts of the day on one line from 05:00, the one now drawn in the accent. */
function dayLine(sky: Sky, c: Ink, x0: number, width: number, y: number): string {
  const order: Phase[] = ['dawn', 'day', 'dusk', 'night']
  const at = (hour: number) => x0 + (((hour - 5 + 24) % 24) / 24) * width
  let out = ''
  for (const phase of order) {
    const from = at(STARTS[phase])
    const to = phase === 'night' ? x0 + width : at(STARTS[order[order.indexOf(phase) + 1] ?? 'dawn'])
    const isNow = phase === sky.phase
    out +=
      `<path d="M${n(from + 1)} ${y}H${n(to - 1)}" stroke="${isNow ? c.accent : c.faint}" stroke-width="${isNow ? 2 : 0.7}" opacity="${isNow ? 1 : 0.6}"/>` +
      `<text x="${n((from + to) / 2)}" y="${y - 7}" text-anchor="middle" fill="${isNow ? c.ink : c.faint}" class="m">${phase}</text>` +
      `<path d="M${n(from)} ${y - 3}v6" stroke="${c.faint}" stroke-width=".6"/>` +
      `<text x="${n(from)}" y="${y + 14}" text-anchor="middle" fill="${c.faint}" class="m">${String(STARTS[phase]).padStart(2, '0')}</text>`
  }
  const nowX = at(sky.hour + sky.minute / 60)
  return out + `<path d="M${n(nowX)} ${y - 4.5}v9" stroke="${c.ink}" stroke-width="1.1"/>`
}

/** The session barometer: a half dial, the needle where the turns have put it, the set hand where this turn began. */
function barometer(log: Log, c: Ink, cx: number, cy: number, r: number): string {
  const point = (value: number, radius: number) => {
    const angle = Math.PI * (1 - value)
    return { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) }
  }
  let ticks = ''
  for (let i = 0; i <= 20; i++) {
    const long = i % 5 === 0
    const a = point(i / 20, r)
    const b = point(i / 20, r - (long ? 7 : 3.5))
    ticks += `M${n(a.x)} ${n(a.y)}L${n(b.x)} ${n(b.y)}`
  }
  // The dial's words sit outside it, clear of the needle: under each foot and over the top.
  const words = [
    { x: cx - r, y: cy + 13, word: 'stormy' },
    { x: cx, y: cy - r - 7, word: 'change' },
    { x: cx + r, y: cy + 13, word: 'fair' },
  ]
  const labels = words
    .map(({ x, y, word }) => `<text x="${n(x)}" y="${n(y)}" text-anchor="middle" fill="${zoneOf(log.pressure) === word ? c.ink : c.faint}" class="m">${word}</text>`)
    .join('')
  const tip = point(log.pressure, r - 4)
  const tail = point(log.pressure, -7)
  const set = point(log.setHand, r + 4)
  const setFoot = point(log.setHand, r - 9)
  return (
    `<path d="M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${c.faint}" stroke-width=".7"/>` +
    `<path d="${ticks}" stroke="${c.faint}" stroke-width=".7"/>` +
    labels +
    `<path d="M${n(cx - r - 8)} ${cy}H${n(cx + r + 8)}" stroke="${c.faint}" stroke-width=".6" opacity=".45"/>` +
    `<path d="M${n(setFoot.x)} ${n(setFoot.y)}L${n(set.x)} ${n(set.y)}" stroke="${c.accent}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M${n(tail.x)} ${n(tail.y)}L${n(tip.x)} ${n(tip.y)}" stroke="${c.ink}" stroke-width="1.1" stroke-linecap="round"/>` +
    `<circle cx="${cx}" cy="${cy}" r="2.6" fill="${c.ink}"/>`
  )
}

const STYLE =
  `<style>text{font-family:${MONO};font-size:8.5px;letter-spacing:.6px}.m{font-size:8px;letter-spacing:.8px}` +
  `.cap{font-size:8.5px;letter-spacing:2.4px}.s{font-family:${SERIF};letter-spacing:0}.big{font-size:23px}` +
  `.it{font-style:italic;font-size:12.5px}.mid{font-size:13.5px}</style>`

/** The full card, for a pane docked or inline. */
export function cardSvg(sky: Sky, log: Log): string {
  const c = inkOf(sky.phase)
  const W = 300
  const H = 432
  const lit = Math.round(moonLit(sky.moonAge) * 100)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    STYLE +
    `<text x="20" y="22" class="cap" fill="${c.faint}">ALMANAC</text>` +
    `<text x="${W - 20}" y="22" class="cap" fill="${c.faint}" text-anchor="end">${esc(sky.date.toUpperCase())}</text>` +
    `<path d="M20 32H${W - 20}" stroke="${c.faint}" stroke-width=".6" opacity=".5"/>` +
    path({ cx: 150, cy: 126, rx: 112, ry: 74 }, sky, c, 4.6, true) +
    `<text x="38" y="141" class="m" text-anchor="middle" fill="${c.faint}">${sky.phase === 'night' ? '20' : '05'}</text>` +
    `<text x="262" y="141" class="m" text-anchor="middle" fill="${c.faint}">${sky.phase === 'night' ? '05' : '20'}</text>` +
    `<text x="20" y="178" class="s big" fill="${c.ink}">${capital(sky.phase)}</text>` +
    `<text x="${W - 20}" y="178" text-anchor="end" fill="${c.sub}" style="font-size:15px;letter-spacing:1px">${clockText(sky.hour, sky.minute)}</text>` +
    `<text x="20" y="198" class="s it" fill="${c.sub}">${esc(`${{ clear: 'Clear sky', cloudy: 'Overcast', storm: 'Storm' }[sky.weather]}, ${nextChange(sky.phase)}${sky.isPinned ? ' (pinned)' : ''}`)}</text>` +
    dayLine(sky, c, 20, W - 40, 236) +
    `<path d="M20 262H${W - 20}" stroke="${c.faint}" stroke-width=".6" opacity=".5"/>` +
    moonGlyph(30, 281, 7, sky.moonAge, c) +
    `<text x="46" y="285.5" class="s mid" fill="${c.ink}">${capital(moonName(sky.moonAge))}</text>` +
    `<text x="${W - 20}" y="285" text-anchor="end" fill="${c.faint}">${lit}% ${isWaxing(sky.moonAge) ? 'waxing' : 'waning'}</text>` +
    `<path d="M20 300H${W - 20}" stroke="${c.faint}" stroke-width=".6" opacity=".5"/>` +
    `<text x="20" y="318" class="cap" fill="${c.faint}">BAROMETER</text>` +
    `<text x="${W - 20}" y="318" class="cap" fill="${c.faint}" text-anchor="end">${log.turns} ${log.turns === 1 ? 'TURN' : 'TURNS'}</text>` +
    barometer(log, c, 150, 390, 50) +
    `<text x="${W / 2}" y="422" text-anchor="middle" class="s it" fill="${c.ink}">${esc(forecast(log, sky.weather))}</text>` +
    '</svg>'
  )
}

/** The glance, for the widget: the arc with now marked, the hour, and the barometer in a word. */
export function glanceSvg(sky: Sky, log: Log): string {
  const c = inkOf(sky.phase)
  const W = 216
  const H = 58
  const scale = (value: number) => 70 + value * 56
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    STYLE +
    path({ cx: 32, cy: 42, rx: 22, ry: 24 }, sky, c, 3.2, false) +
    `<text x="70" y="27" class="s" style="font-size:17px" fill="${c.ink}">${capital(sky.phase)}</text>` +
    `<text x="${W - 8}" y="27" text-anchor="end" fill="${c.sub}" style="font-size:11.5px;letter-spacing:.8px">${clockText(sky.hour, sky.minute)}</text>` +
    `<path d="M70 42H126" stroke="${c.faint}" stroke-width=".7"/>` +
    `<path d="M70 39.5v5M84 40.5v3M98 39.5v5M112 40.5v3M126 39.5v5" stroke="${c.faint}" stroke-width=".6"/>` +
    `<path d="M${n(scale(log.setHand))} 37v10" stroke="${c.accent}" stroke-width="1.2"/>` +
    `<path d="M${n(scale(log.pressure))} 35.5v13" stroke="${c.ink}" stroke-width="1.1"/>` +
    `<text x="${W - 8}" y="45.5" text-anchor="end" class="cap" fill="${c.faint}">${glanceWord(log).toUpperCase()}</text>` +
    '</svg>'
  )
}

/** What the card says, for a reader that cannot see it. */
export function cardAlt(sky: Sky, log: Log): string {
  return (
    `Almanac: ${sky.phase}, ${clockText(sky.hour, sky.minute)}, ${sky.weather}. ` +
    `Moon ${moonName(sky.moonAge)}, ${Math.round(moonLit(sky.moonAge) * 100)}% lit. ` +
    `Barometer ${zoneOf(log.pressure)}: ${forecast(log, sky.weather)}`
  )
}

/** The card as a few lines of text, for a surface that draws no Svg, sized to `columns`. */
export function cardLines(sky: Sky, log: Log, columns: number): { text: string; isDim: boolean }[] {
  const width = Math.max(8, Math.min(30, columns - 12))
  const at = Math.round(arcAt(sky.phase, sky.step) * (width - 1))
  const [from, to] = sky.phase === 'night' ? ['20', '05'] : ['05', '20']
  const needle = Math.round(log.pressure * (width - 1))
  return [
    { text: `${capital(sky.phase)} · ${clockText(sky.hour, sky.minute)} · ${sky.weather}`, isDim: false },
    { text: `${from} ${'━'.repeat(at)}●${'┄'.repeat(width - 1 - at)} ${to}`, isDim: true },
    { text: PHASES.map(phase => (phase === sky.phase ? `[${phase}]` : phase)).join(' · '), isDim: true },
    { text: `moon ${moonText(sky.moonAge)}`, isDim: true },
    { text: `stormy ${'─'.repeat(needle)}┃${'─'.repeat(width - 1 - needle)} fair`, isDim: true },
    { text: forecast(log, sky.weather), isDim: false },
  ]
}
