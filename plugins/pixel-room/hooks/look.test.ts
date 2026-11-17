import { expect, test } from 'claude-code/testing'

import { COLORS, PROBLEMS, glassFor } from './look'
import { checkColors } from './make-colors.js'
import { PAL } from './palette'

test('Desktop paints both palettes', () => {
  for (const problems of [PROBLEMS.day, PROBLEMS.lamplight]) {
    expect(problems.filter(line => line.startsWith("Desktop won't paint this theme"))).toEqual([])
  }
})

test('both palettes hold only design-system names, under their labels', () => {
  for (const colors of [COLORS.day, COLORS.lamplight]) {
    expect(checkColors(colors).filter(line => line.startsWith("Desktop won't paint this theme"))).toEqual([])
    expect(checkColors(colors).filter(line => !line.includes(' in dark mode; it needs '))).toEqual([])
  }
  expect(COLORS.day.label).toBe('Pixel Room')
  expect(COLORS.lamplight.label).toBe('Pixel Room Lamplight')
})

test('the room has one palette of about sixteen colors, each six-digit hex', () => {
  const colors = Object.values(PAL)
  expect(colors.length).toBeLessThanOrEqual(18)
  expect(new Set(colors).size).toBe(colors.length)
  expect(colors.every(color => /^#[0-9a-f]{6}$/.test(color))).toBe(true)
})

test('the glass is clear, a light veil, or the full frost', () => {
  for (const look of ['day', 'lamplight'] as const) {
    expect(glassFor(look, 'clear')).toBe(false)
    expect(glassFor(look, 'soft')).toMatchObject({ blur: 4, opacity: 0.28 })
    expect(glassFor(look, 'frosted')).toMatchObject({ blur: 16, opacity: 0.5 })
  }
})
