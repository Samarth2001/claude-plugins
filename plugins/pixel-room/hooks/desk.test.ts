import { expect, test } from 'claude-code/testing'

import { CALENDAR, deskPart, noteKinds } from './desk'
import { GLYPH_HEIGHT, glyphText, textWidth } from './font'
import type { Monitor, SceneInput } from './model'
import { Layer } from './pixels'
import { quietScene } from './scene'
import { shellPart } from './shell'

const TIME = { hour: 22, minute: 40, second: 5 }
const night = (overrides: Partial<SceneInput> = {}) => quietScene('watching', 'night', overrides)
const count = (svg: string, needle: string) => svg.split(needle).length - 1

test('each monitor mode draws its own screen', () => {
  const screen = (monitor: Monitor) => deskPart(night({ monitor }), TIME)
  expect(screen('idle')).toContain('class="pd-sd"')
  expect(screen('idle')).toContain('class="pd-pl"')
  expect(screen('idle')).not.toContain('class="pr-cd"')
  expect(screen('working')).toContain('class="pr-cd"')
  expect(screen('working')).toContain('class="pr-cu"')
  expect(screen('working')).toContain('class="pd-hl"')
  expect(screen('error')).toContain('class="pd-ex"')
  expect(screen('error')).not.toContain('class="pr-cd"')
  expect(screen('error')).not.toContain('class="pr-cu"')
  expect(screen('done')).toContain('class="pr-cu"')
  expect(screen('done')).not.toContain('class="pr-cd"')
  expect(screen('done')).not.toContain('class="pd-ex"')
})

test('the board holds up to six notes, done first, a + past six, keepsakes with no list', () => {
  expect(noteKinds({ open: 0, active: 0, done: 0 })).toEqual([])
  expect(noteKinds({ open: 2, active: 1, done: 1 })).toEqual(['done', 'active', 'open', 'open'])
  expect(noteKinds({ open: 3, active: 1, done: 2 })).toEqual(['done', 'done', 'active', 'open', 'open', 'open'])
  expect(noteKinds({ open: 4, active: 1, done: 3 })).toEqual(['done', 'done', 'done', 'active', 'open', 'more'])
  for (let total = 0; total <= 9; total += 1) {
    const svg = deskPart(night({ notes: { open: total, active: 0, done: 0 } }), TIME)
    expect(count(svg, 'class="pd-n ')).toBe(Math.min(total, 6))
    expect(svg.includes('class="pd-n pd-nm"')).toBe(total > 6)
  }
  const svg = deskPart(night({ notes: { open: 1, active: 1, done: 1 } }), TIME)
  const order = [...svg.matchAll(/class="pd-n (pd-n\w)"/g)].map(m => m[1])
  expect(order).toEqual(['pd-nd', 'pd-na', 'pd-no'])
  // The active note is amber, a done note leaf, an open one cream.
  expect(svg).toMatch(/class="pd-n pd-na"><path fill="url\(#qk2\)"[^>]*\/><path fill="#f4b860"/)
  expect(svg).toMatch(/class="pd-n pd-nd"><path fill="url\(#qk2\)"[^>]*\/><path fill="#7fa862"/)
  expect(svg).toMatch(/class="pd-n pd-no"><path fill="url\(#qk2\)"[^>]*\/><path fill="#f3e2c0"/)
  // With no list, the keepsakes, and no notes.
  const empty = deskPart(night(), TIME)
  expect(count(empty, 'class="pd-n ')).toBe(0)
  expect(empty).toContain('#2a3a62')
})

test('the wall calendar shows the month and the day, and hides with the shelf on tall screens', () => {
  // The header's text is the month's glyph runs; compare against a layer drawn the same way.
  const runs = (text: string, x: number, y: number) => {
    const layer = new Layer()
    glyphText(layer, text, x, y, '#000')
    return layer.svg().match(/d="([^"]*)"/)?.[1] ?? ''
  }
  const nov = deskPart(night({ date: { month: 10, day: 18, weekday: 3 } }), TIME)
  const jan = deskPart(night({ date: { month: 0, day: 1, weekday: 4 } }), TIME)
  expect(nov).not.toBe(jan)
  const month = (svg: string, text: string, day: string) => {
    const { x, y, w } = CALENDAR
    const head = runs(text, x + Math.ceil((w - textWidth(text)) / 2), y + 2)
    const page = runs(day, x + Math.floor((w - textWidth(day)) / 2), y + 9)
    return svg.includes(head) && svg.includes(page)
  }
  expect(month(nov, 'NOV', '18')).toBe(true)
  // The shelf group, up to its own closing tag.
  const start = nov.indexOf('<g class="pr-wd">')
  let depth = 0
  let end = start
  for (const m of nov.slice(start).matchAll(/<g[ >]|<\/g>/g)) {
    depth += m[0] === '</g>' ? -1 : 1
    if (depth === 0) {
      end = start + (m.index ?? 0)
      break
    }
  }
  const wall = nov.slice(start, end)
  expect(wall).toContain(runs('NOV', CALENDAR.x + Math.ceil((CALENDAR.w - textWidth('NOV')) / 2), CALENDAR.y + 2))
  expect(month(jan, 'JAN', '1')).toBe(true)
  expect(month(nov, 'JAN', '1')).toBe(false)
})

test('as many moths as subagents, at the lamp by night and the screen by day', () => {
  for (let moths = 0; moths <= 3; moths += 1) expect(count(deskPart(night({ moths }), TIME), 'class="pd-m ')).toBe(moths)
  expect(count(deskPart(night({ moths: 7 }), TIME), 'class="pd-m ')).toBe(3)
  const day = deskPart(quietScene('watching', 'day', { moths: 2 }), TIME)
  expect(count(day, 'class="pd-m ')).toBe(2)
})

test('the lamp glows exactly when lit, and flickers only when the cat startles under it', () => {
  expect(deskPart(night(), TIME)).toContain('class="pr-gl"')
  expect(deskPart(quietScene('watching', 'day'), TIME)).not.toContain('class="pr-gl"')
  expect(deskPart(night(), TIME)).not.toContain('pd-fk')
  expect(deskPart(quietScene('startled', 'night'), TIME)).toContain('class="pd-fk"')
  expect(deskPart(quietScene('startled', 'day'), TIME)).not.toContain('pd-fk')
})

test('the desk wall is the same for the same input, and small in its worst state', () => {
  const worst = quietScene('startled', 'night', { moths: 3, notes: { open: 5, active: 1, done: 4 }, monitor: 'working' })
  expect(deskPart(worst, TIME)).toBe(deskPart(worst, TIME))
  for (const monitor of ['idle', 'working', 'error', 'done'] as const) {
    expect(deskPart({ ...worst, monitor }, TIME).length).toBeLessThan(45_000)
    expect(deskPart({ ...worst, monitor, notes: { open: 0, active: 0, done: 0 } }, TIME).length).toBeLessThan(45_000)
  }
  expect(shellPart(worst)).toBe(shellPart(worst))
  expect(shellPart(worst)).toContain('id="pstrellis"')
})

test('the font measures and draws its glyphs', () => {
  expect(GLYPH_HEIGHT).toBe(5)
  expect(textWidth('')).toBe(0)
  expect(textWidth('1')).toBe(3)
  expect(textWidth('18')).toBe(7)
  expect(textWidth('NOV')).toBe(12)
  expect(textWidth('DEC')).toBe(11)
  expect(textWidth('MAY')).toBe(13)
  expect(textWidth('!')).toBe(1)
  expect(textWidth('A.B')).toBe(9)
  expect(textWidth('+')).toBe(3)
  for (const ch of '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+!?.:') {
    const layer = new Layer()
    expect(glyphText(layer, ch, 0, 0, '#fff')).toBe(textWidth(ch))
    expect(layer.isEmpty).toBe(false)
  }
  // Lower case draws as upper case; an unknown character as `?`.
  const draw = (text: string) => {
    const layer = new Layer()
    glyphText(layer, text, 0, 0, '#fff')
    return layer.svg()
  }
  expect(draw('nov')).toBe(draw('NOV'))
  expect(draw('~')).toBe(draw('?'))
})
