import { expect, test } from 'claude-code/testing'

import { COLORS, PROBLEMS, glassFor } from './look'
import { checkColors } from './make-colors.js'

test('Desktop paints the palette', () => {
  expect(PROBLEMS.filter(line => line.startsWith("Desktop won't paint this theme"))).toEqual([])
})

test('the palette holds only design-system names, under its label', () => {
  expect(checkColors(COLORS)).toEqual([])
  expect(COLORS.label).toBe('Pearl')
})

test('the glass is clear, a light veil, or the full frost', () => {
  expect(glassFor('clear')).toBe(false)
  expect(glassFor('soft')).toEqual({ blur: 4, tint: '#111116', opacity: 0.28 })
  expect(glassFor('frosted')).toEqual({ blur: 16, tint: '#111116', opacity: 0.5 })
})
