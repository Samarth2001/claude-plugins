import { expect, test } from 'claude-code/testing'

import { cardAlt, cardLines, cardSvg, glanceSvg } from './card'
import { LOOKS } from './look'
import { emptyLog, logError } from './phase'
import type { Sky } from '../types'

const dusk: Sky = {
  isOn: true,
  isPinned: false,
  phase: 'dusk',
  step: 0.4,
  weather: 'clear',
  hour: 18,
  minute: 12,
  moonAge: 10.5,
  date: 'Tue 17 Nov',
}

test('the card holds the arc, the hour, the four parts of the day, the moon and the barometer', () => {
  const svg = cardSvg(dusk, emptyLog())
  expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg"')
  expect(svg.length).toBeLessThan(131_072)
  expect(svg).toContain('>Dusk<')
  expect(svg).toContain('>18:12<')
  expect(svg).toContain('>TUE 17 NOV<')
  for (const word of ['dawn', 'day', 'dusk', 'night', 'stormy', 'change', 'fair']) expect(svg).toContain(`>${word}<`)
  expect(svg).toContain('>Waxing gibbous<')
  expect(svg).toContain('>Settled. Nothing logged yet.<')
  // In the hour's own colors: the accent is the setting sun's.
  expect(svg).toContain(LOOKS.dusk.roles.accent)
  expect(svg).not.toContain('NaN')
})

test('the glance holds the hour and the barometer in a word', () => {
  const svg = glanceSvg(dusk, logError(emptyLog()))
  expect(svg).toContain('>Dusk<')
  expect(svg).toContain('>18:12<')
  expect(svg).toContain('>FALLING<')
  expect(svg).not.toContain('NaN')
})

test('the card says what it shows', () => {
  expect(cardAlt(dusk, emptyLog())).toBe(
    'Almanac: dusk, 18:12, clear. Moon waxing gibbous, 81% lit. Barometer fair: Settled. Nothing logged yet.',
  )
})

test('in text, the card fits its columns and marks now on the arc and the dial', () => {
  for (const columns of [24, 40, 80]) {
    const lines = cardLines(dusk, emptyLog(), columns)
    expect(lines[0]?.text).toBe('Dusk · 18:12 · clear')
    expect(lines[1]?.text).toMatch(/^05 ━+●┄+ 20$/)
    expect(lines[2]?.text).toBe('dawn · day · [dusk] · night')
    expect(lines[4]?.text).toMatch(/^stormy ─+┃─+ fair$/)
    expect(lines.at(-1)?.text).toBe('Settled. Nothing logged yet.')
    for (const line of lines) expect(line.text.length).toBeLessThanOrEqual(Math.max(columns, 40))
  }
})
